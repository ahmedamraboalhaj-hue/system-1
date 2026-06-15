/**
 * نظام الحفظ والتخزين المحلي المتقدم
 * Enhanced Local Storage & Auto-Save System
 */

// إضافة نظام الحفظ التلقائي
const AutoSaveSystem = {
    // علم للتحقق من التغييرات
    isDirty: false,
    saveInterval: 5000, // حفظ كل 5 ثوانٍ عند الحاجة
    autosaveTimer: null,
    saveHistory: [],

    /**
     * تسجيل تغيير في البيانات
     * يجب استدعاء هذه الدالة عند أي تعديل على البيانات
     */
    markDirty() {
        this.isDirty = true;
        this.scheduleAutoSave();
        // إظهار مؤشر بسيط على الشاشة
        this.showSaveIndicator();
    },

    /**
     * جدولة الحفظ التلقائي
     */
    scheduleAutoSave() {
        if (this.autosaveTimer) {
            clearTimeout(this.autosaveTimer);
        }
        
        this.autosaveTimer = setTimeout(() => {
            this.performAutoSave();
        }, this.saveInterval);
    },

    /**
     * تنفيذ الحفظ التلقائي
     */
    async performAutoSave() {
        if (!this.isDirty) return;

        try {
            if (!StorageEngine.db) await StorageEngine.init();

            // حفظ جميع الجداول الرئيسية
            const tables = [
                'students', 'attendance', 'exams', 'scores', 'expenses',
                'handouts', 'studentHandouts', 'materials', 'quizzes',
                'rewards', 'payments', 'waQueue', 'groups', 'cycles',
                'absenceSessions', 'dailyTreasuryArchives', 'staff',
                'shifts', 'courseCodes', 'platformCourses', 'platformSubscriptions'
            ];

            for (const table of tables) {
                if (db[table] && db[table].length > 0) {
                    await StorageEngine.save(table, db[table]);
                }
            }

            // حفظ الإعدادات
            if (db._settings && Object.keys(db._settings).length > 0) {
                localStorage.setItem('edu_master_settings', JSON.stringify(db._settings));
            }

            this.isDirty = false;
            this.hideSaveIndicator();
            this.logSave();
            
            console.log('✅ تم حفظ البيانات تلقائيًا');
        } catch (error) {
            console.error('❌ خطأ في الحفظ التلقائي:', error);
            this.showSaveError();
        }
    },

    /**
     * حفظ فوري (عند الحاجة)
     */
    async forceSave() {
        await this.performAutoSave();
    },

    /**
     * عرض مؤشر الحفظ على الشاشة
     */
    showSaveIndicator() {
        if (!document.getElementById('auto-save-indicator')) {
            const indicator = document.createElement('div');
            indicator.id = 'auto-save-indicator';
            indicator.style.cssText = `
                position: fixed;
                bottom: 30px;
                left: 30px;
                background: rgba(59, 130, 246, 0.9);
                color: white;
                padding: 12px 20px;
                border-radius: 8px;
                font-size: 14px;
                font-weight: 600;
                z-index: 9999;
                display: flex;
                align-items: center;
                gap: 8px;
                box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
                animation: slideIn 0.3s ease;
            `;
            indicator.innerHTML = `
                <i class="fas fa-spinner fa-spin"></i>
                جاري الحفظ المحلي...
            `;
            document.body.appendChild(indicator);
        }
    },

    /**
     * إخفاء مؤشر الحفظ
     */
    hideSaveIndicator() {
        const indicator = document.getElementById('auto-save-indicator');
        if (indicator) {
            indicator.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => {
                if (indicator.parentNode) {
                    indicator.parentNode.removeChild(indicator);
                }
            }, 300);
        }
    },

    /**
     * عرض رسالة خطأ
     */
    showSaveError() {
        const errorDiv = document.createElement('div');
        errorDiv.style.cssText = `
            position: fixed;
            bottom: 30px;
            left: 30px;
            background: rgba(239, 68, 68, 0.9);
            color: white;
            padding: 12px 20px;
            border-radius: 8px;
            font-size: 14px;
            font-weight: 600;
            z-index: 9999;
            display: flex;
            align-items: center;
            gap: 8px;
            box-shadow: 0 4px 12px rgba(239, 68, 68, 0.3);
        `;
        errorDiv.innerHTML = `
            <i class="fas fa-exclamation-triangle"></i>
            خطأ في الحفظ المحلي
        `;
        document.body.appendChild(errorDiv);
        
        setTimeout(() => {
            if (errorDiv.parentNode) {
                errorDiv.parentNode.removeChild(errorDiv);
            }
        }, 5000);
    },

    /**
     * تسجيل كل عملية حفظ
     */
    logSave() {
        const timestamp = new Date().toISOString();
        const entry = {
            timestamp,
            rowsCount: (db.students?.length || 0) +
                      (db.attendance?.length || 0) +
                      (db.payments?.length || 0)
        };
        this.saveHistory.push(entry);
        
        // الاحتفاظ بآخر 100 عملية حفظ فقط
        if (this.saveHistory.length > 100) {
            this.saveHistory.shift();
        }
        
        localStorage.setItem('edu_save_history', JSON.stringify(this.saveHistory));
    },

    /**
     * الحصول على إحصائيات الحفظ
     */
    getSaveStats() {
        const lastSave = this.saveHistory[this.saveHistory.length - 1];
        return {
            lastSave: lastSave?.timestamp || 'لم يتم',
            totalSaves: this.saveHistory.length,
            history: this.saveHistory
        };
    }
};

// ============================================
// Interceptor لتسجيل التغييرات التلقائية
// ============================================

/**
 * دالة wrapper للتعديل على البيانات
 * استخدمها بدلاً من التعديل المباشر على db
 */
function updateData(storeName, data) {
    if (Array.isArray(data)) {
        db[storeName] = data;
    } else {
        db[storeName].push(data);
    }
    AutoSaveSystem.markDirty();
}

/**
 * دالة لحذف بيانات مع تسجيل التغيير
 */
function deleteDataItem(storeName, itemId) {
    db[storeName] = db[storeName].filter(item => item.id !== itemId);
    AutoSaveSystem.markDirty();
}

/**
 * دالة لتحديث عنصر محدد مع تسجيل التغيير
 */
function updateDataItem(storeName, itemId, updatedData) {
    const index = db[storeName].findIndex(item => item.id === itemId);
    if (index !== -1) {
        db[storeName][index] = { ...db[storeName][index], ...updatedData };
        AutoSaveSystem.markDirty();
    }
}

// ============================================
// Data Sync & Verification
// ============================================

/**
 * التحقق من توافق البيانات في IndexedDB و memory
 */
async function verifyDataSync() {
    console.log('🔍 جاري التحقق من توافق البيانات...');
    
    const tables = ['students', 'attendance', 'exams', 'scores', 'payments'];
    const syncReport = {};
    
    for (const table of tables) {
        const memoryCount = db[table]?.length || 0;
        const dbCount = (await StorageEngine.getAll(table)).length;
        
        syncReport[table] = {
            memory: memoryCount,
            indexedDB: dbCount,
            synced: memoryCount === dbCount
        };
        
        if (memoryCount !== dbCount) {
            console.warn(`⚠️ عدم توافق في ${table}: الذاكرة=${memoryCount}, قاعدة البيانات=${dbCount}`);
        }
    }
    
    console.log('📊 تقرير التوافق:', syncReport);
    return syncReport;
}

/**
 * إصلاح عدم التوافق (إعادة مزامنة)
 */
async function resyncData() {
    console.log('🔄 جاري إعادة مزامنة البيانات...');
    
    if (!StorageEngine.db) await StorageEngine.init();
    
    const tables = ['students', 'attendance', 'exams', 'scores', 'payments', 'groups'];
    
    for (const table of tables) {
        const indexedDBData = await StorageEngine.getAll(table);
        db[table] = indexedDBData;
    }
    
    console.log('✅ تمت إعادة المزامنة بنجاح');
}

// ============================================
// Export & Backup Functions
// ============================================

/**
 * إنشاء نسخة احتياطية كاملة
 */
async function createFullBackup() {
    const backup = {
        version: '2.0',
        timestamp: new Date().toISOString(),
        data: {
            students: db.students || [],
            attendance: db.attendance || [],
            exams: db.exams || [],
            scores: db.scores || [],
            payments: db.payments || [],
            groups: db.groups || [],
            expenses: db.expenses || [],
            handouts: db.handouts || [],
            materials: db.materials || [],
            quizzes: db.quizzes || [],
            rewards: db.rewards || [],
            cycles: db.cycles || [],
            settings: db._settings || {}
        },
        backupSize: JSON.stringify(db).length
    };
    
    return backup;
}

/**
 * حفظ النسخة الاحتياطية في localStorage كنقطة استرجاع سريعة
 */
async function createQuickSnapshot() {
    const snapshot = await createFullBackup();
    localStorage.setItem('edu_quick_snapshot', JSON.stringify(snapshot));
    console.log('📸 تم إنشاء لقطة سريعة');
}

/**
 * استعادة من النقطة السريعة
 */
async function restoreFromSnapshot() {
    const snapshotStr = localStorage.getItem('edu_quick_snapshot');
    if (!snapshotStr) {
        console.log('لا توجد لقطة محفوظة');
        return false;
    }
    
    try {
        const snapshot = JSON.parse(snapshotStr);
        for (const [table, data] of Object.entries(snapshot.data)) {
            if (data && Array.isArray(data) && data.length > 0) {
                db[table] = data;
            }
        }
        console.log('✅ تم الاستعادة من اللقطة السريعة');
        return true;
    } catch (error) {
        console.error('❌ خطأ في استعادة اللقطة:', error);
        return false;
    }
}

// ============================================
// Storage Information & Analytics
// ============================================

/**
 * الحصول على معلومات استخدام التخزين
 */
async function getStorageInfo() {
    const storageEstimate = await navigator.storage.estimate();
    const usage = storageEstimate.usage;
    const quota = storageEstimate.quota;
    const percentUsed = (usage / quota * 100).toFixed(2);
    
    const info = {
        used: (usage / 1024 / 1024).toFixed(2) + ' MB',
        quota: (quota / 1024 / 1024).toFixed(2) + ' MB',
        percentUsed: percentUsed + '%',
        available: ((quota - usage) / 1024 / 1024).toFixed(2) + ' MB'
    };
    
    console.log('💾 معلومات التخزين:', info);
    return info;
}

/**
 * الحصول على إحصائيات البيانات
 */
function getDataStats() {
    const stats = {
        students: db.students?.length || 0,
        attendance: db.attendance?.length || 0,
        payments: db.payments?.length || 0,
        exams: db.exams?.length || 0,
        scores: db.scores?.length || 0,
        groups: db.groups?.length || 0,
        materials: db.materials?.length || 0,
        quizzes: db.quizzes?.length || 0,
        totalRecords: (db.students?.length || 0) +
                     (db.attendance?.length || 0) +
                     (db.payments?.length || 0) +
                     (db.exams?.length || 0)
    };
    
    console.log('📊 إحصائيات البيانات:', stats);
    return stats;
}

// ============================================
// Cleanup & Maintenance
// ============================================

/**
 * تنظيف البيانات القديمة
 */
async function cleanupOldData(daysOld = 90) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);
    
    let deletedCount = 0;
    
    // تنظيف السجلات القديمة
    const oldAttendance = db.attendance.filter(record => {
        const recordDate = new Date(record.date);
        return recordDate < cutoffDate;
    });
    
    deletedCount = db.attendance.length - oldAttendance.length;
    db.attendance = oldAttendance;
    
    AutoSaveSystem.markDirty();
    console.log(`✅ تم حذف ${deletedCount} سجل قديم`);
}

// ============================================
// Initialization
// ============================================

// تشغيل نظام الحفظ التلقائي عند بدء التطبيق
document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 تم تفعيل نظام الحفظ التلقائي والتخزين المحلي');
    
    // حفظ تلقائي عند الخروج
    window.addEventListener('beforeunload', async () => {
        if (AutoSaveSystem.isDirty) {
            await AutoSaveSystem.performAutoSave();
        }
    });
});

// تصدير الدوال للاستخدام في console
window.AutoSaveSystem = AutoSaveSystem;
window.updateData = updateData;
window.deleteDataItem = deleteDataItem;
window.updateDataItem = updateDataItem;
window.verifyDataSync = verifyDataSync;
window.resyncData = resyncData;
window.createFullBackup = createFullBackup;
window.createQuickSnapshot = createQuickSnapshot;
window.restoreFromSnapshot = restoreFromSnapshot;
window.getStorageInfo = getStorageInfo;
window.getDataStats = getDataStats;
window.cleanupOldData = cleanupOldData;
