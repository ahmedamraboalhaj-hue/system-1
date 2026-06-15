/**
 * نظام اشتراكات المنصة (Offline-First)
 * Platform Subscriptions Module
 *
 * يضيف نوع اشتراك جديد "اشتراك المنصة" بجانب "اشتراك الدرس" الحالي،
 * مع دعم كامل للعمل بدون إنترنت وجدول مزامنة معلّقة (platform_subscriptions)
 * يُرفع تلقائياً إلى Firebase عند توافر الاتصال.
 */

// ============================================
// State
// ============================================
let platformSubModalStudentId = null;
let platformSubSelectedCourses = []; // courseIds selected in the modal
let platformSubAutoSyncTimer = null;

// ============================================
// Helpers
// ============================================

/** هل يوجد اتصال بالإنترنت فعلياً (وليس فقط navigator.onLine) */
async function isReallyOnline() {
    if (!navigator.onLine) return false;
    try {
        const ready = await ensureFirebaseInitialized();
        return !!ready;
    } catch (e) {
        return false;
    }
}

/** الحصول على سعر اشتراك المنصة الافتراضي (قابل للتعديل من الإعدادات) */
function getPlatformSubscriptionPrice() {
    return Number(db.settings.platformSubscriptionFee) || 100;
}

/** قائمة كورسات المنصة المتاحة للصف الحالي (أو الكل إن لم يوجد صف) */
function getAvailablePlatformCourses(searchTerm = '') {
    const grade = mapOfflineGradeToPlatformGrade(currentGrade);
    const term = (searchTerm || '').trim().toLowerCase();

    return (db.platformCourses || []).filter(c => {
        const matchesGrade = !c.grade || c.grade === 'all' || String(c.grade) === String(grade);
        if (!matchesGrade) return false;
        if (!term) return true;
        const haystack = `${c.courseTitle || ''} ${c.courseId || ''}`.toLowerCase();
        return haystack.includes(term);
    });
}

// ============================================
// 1. تحديث الكورسات (تحميلها وحفظها محلياً)
// ============================================

/**
 * يجلب جميع الكورسات المتاحة من Firebase ويحفظها محلياً في platformCourses
 * لاستخدامها بدون إنترنت بعد ذلك. زر "تحديث الكورسات".
 */
async function refreshPlatformCourses() {
    const btn = document.getElementById('btn-refresh-platform-courses');
    try {
        const online = await isReallyOnline();
        if (!online) {
            showNotification('لا يوجد اتصال بالإنترنت. سيتم استخدام آخر نسخة محفوظة من الكورسات.', 'warning');
            return false;
        }

        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري تحديث الكورسات...';
        }

        const snapshot = await window.db.collection('platform_courses').get();
        const courses = [];
        snapshot.forEach(doc => {
            const data = doc.data();
            courses.push({
                id: doc.id,
                courseId: data.courseId || doc.id,
                courseTitle: data.courseTitle || data.title || 'كورس بدون اسم',
                grade: data.grade || '',
                price: Number(data.price) || 0,
                status: data.status || 'active'
            });
        });

        db.platformCourses = courses;
        await StorageEngine.save('platformCourses', courses);

        showNotification(`✅ تم تحديث وحفظ ${courses.length} كورس محلياً. يمكنك الآن البيع بدون إنترنت.`, 'success');
        return true;
    } catch (err) {
        console.error('refreshPlatformCourses failed', err);
        showNotification('حدث خطأ أثناء تحديث الكورسات: ' + err.message, 'error');
        return false;
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-cloud-download-alt"></i> تحديث الكورسات';
        }
    }
}

// ============================================
// 2. شاشة دفع الاشتراك - اختيار نوع الاشتراك
// ============================================

/**
 * يفتح نافذة اختيار نوع الاشتراك (الدرس / المنصة / الاثنين)
 * تُستدعى من البطاقة الذكية للطالب بدلاً من recordQuickAction('payment') مباشرة
 */
function openSubscriptionTypeModal(studentId) {
    const s = db.students.find(x => x.id == studentId);
    if (!s) return;

    platformSubModalStudentId = studentId;

    currentGrade = localStorage.getItem('edu_active_grade') || currentGrade;
    currentGroupId = localStorage.getItem('edu_active_group') || currentGroupId;

    const lessonFee = db.settings.monthlyFee || 0;

    const hasLessonPaid = db.payments.some(p =>
        p.studentId == s.id &&
        p.category === 'اشتراك شهري' &&
        p.cycleId == db.settings.activeCycle
    );

    const hasPlatformSubThisMonth = (db.platformSubscriptions || []).some(ps =>
        String(ps.student_id) == String(s.id) &&
        new Date(ps.created_at).getMonth() === new Date().getMonth() &&
        new Date(ps.created_at).getFullYear() === new Date().getFullYear()
    );

    const container = document.getElementById('subscription-type-content');
    if (!container) return;

    container.innerHTML = `
        <div style="text-align:center; margin-bottom:1.5rem;">
            <h3 style="margin-bottom:0.3rem;">${s.name}</h3>
            <p style="color:var(--text-muted); font-size:0.9rem;">اختر نوع الاشتراك الذي سيتم دفعه</p>
        </div>

        <div style="display:flex; flex-direction:column; gap:0.75rem;">
            <label class="sub-type-option">
                <input type="checkbox" id="sub-type-lesson" ${hasLessonPaid ? 'disabled checked' : ''}>
                <div class="sub-type-box">
                    <div class="sub-type-title">
                        <i class="fas fa-chalkboard-teacher"></i> اشتراك الدرس
                        ${hasLessonPaid ? '<span class="status-badge" style="background:#dcfce7; color:#166534;">مدفوع ✅</span>' : ''}
                    </div>
                    <div class="sub-type-price">${lessonFee} ج.م</div>
                </div>
            </label>

            <label class="sub-type-option">
                <input type="checkbox" id="sub-type-platform" ${hasPlatformSubThisMonth ? 'checked' : ''}>
                <div class="sub-type-box">
                    <div class="sub-type-title">
                        <i class="fas fa-laptop-code"></i> اشتراك المنصة
                        ${hasPlatformSubThisMonth ? '<span class="status-badge" style="background:#dbeafe; color:#1e40af;">لديه اشتراك هذا الشهر</span>' : ''}
                    </div>
                    <div class="sub-type-price" id="platform-price-preview">حدد الكورسات لمعرفة السعر</div>
                </div>
            </label>
        </div>

        <div id="platform-selected-summary" style="display:none; margin-top:1rem; padding:0.75rem 1rem; background:var(--bg-light); border-radius:12px; font-size:0.9rem;"></div>

        <div style="margin-top:1.5rem; padding-top:1rem; border-top:1px solid var(--border); display:flex; justify-content:space-between; align-items:center;">
            <strong>الإجمالي</strong>
            <strong id="sub-type-total" style="font-size:1.3rem; color:var(--accent);">0 ج.م</strong>
        </div>

        <button class="btn btn-primary" style="width:100%; height:55px; border-radius:12px; margin-top:1.5rem; font-size:1.05rem;"
            onclick="confirmSubscriptionSelection(${s.id})">
            <i class="fas fa-check-circle"></i> متابعة
        </button>
    `;

    // Reset selected courses each time the modal opens
    platformSubSelectedCourses = [];
    document.getElementById('platform-selected-summary').style.display = 'none';

    const lessonCheckbox = document.getElementById('sub-type-lesson');
    const platformCheckbox = document.getElementById('sub-type-platform');

    lessonCheckbox.addEventListener('change', updateSubscriptionTotal);
    platformCheckbox.addEventListener('change', () => {
        if (platformCheckbox.checked) {
            openPlatformCourseModal();
        } else {
            platformSubSelectedCourses = [];
            document.getElementById('platform-selected-summary').style.display = 'none';
            document.getElementById('platform-price-preview').innerText = 'حدد الكورسات لمعرفة السعر';
        }
        updateSubscriptionTotal();
    });

    updateSubscriptionTotal();
    toggleModal('subscription-type-modal', true);
}

function updateSubscriptionTotal() {
    const lessonChecked = document.getElementById('sub-type-lesson')?.checked;
    const platformChecked = document.getElementById('sub-type-platform')?.checked;

    const lessonFee = lessonChecked ? (db.settings.monthlyFee || 0) : 0;
    const platformFee = platformChecked
        ? platformSubSelectedCourses.reduce((sum, c) => sum + (Number(c.price) || 0), 0)
        : 0;

    const total = lessonFee + platformFee;
    const totalEl = document.getElementById('sub-type-total');
    if (totalEl) totalEl.innerText = `${total} ج.م`;
}

// ============================================
// 3. نافذة اختيار كورسات المنصة
// ============================================

function openPlatformCourseModal() {
    renderPlatformCourseSelectionList();
    toggleModal('platform-course-select-modal', true);
}

function renderPlatformCourseSelectionList() {
    const search = document.getElementById('platform-course-search')?.value || '';
    const courses = getAvailablePlatformCourses(search);
    const list = document.getElementById('platform-course-select-list');
    if (!list) return;

    if (!courses.length) {
        list.innerHTML = `
            <div style="text-align:center; padding:2rem; color:var(--text-muted);">
                <i class="fas fa-box-open" style="font-size:2rem; margin-bottom:0.5rem; display:block;"></i>
                لا توجد كورسات محفوظة. اضغط "تحديث الكورسات" من قسم أكواد المنصة عند توفر الإنترنت.
            </div>`;
        return;
    }

    list.innerHTML = courses.map(c => {
        const checked = platformSubSelectedCourses.some(sel => String(sel.courseId) === String(c.courseId));
        return `
            <label class="sub-type-option" style="margin-bottom:0.5rem;">
                <input type="checkbox" value="${c.courseId}" data-price="${c.price || 0}"
                    data-title="${(c.courseTitle || '').replace(/"/g, '&quot;')}"
                    ${checked ? 'checked' : ''} onchange="togglePlatformCourseSelection(this)">
                <div class="sub-type-box">
                    <div class="sub-type-title">${c.courseTitle || 'كورس بدون اسم'}</div>
                    <div class="sub-type-price">${c.price || 0} ج.م</div>
                </div>
            </label>
        `;
    }).join('');
}

function togglePlatformCourseSelection(checkbox) {
    const courseId = checkbox.value;
    const price = Number(checkbox.dataset.price) || 0;
    const title = checkbox.dataset.title || '';

    if (checkbox.checked) {
        if (!platformSubSelectedCourses.some(c => String(c.courseId) === String(courseId))) {
            platformSubSelectedCourses.push({ courseId, price, courseTitle: title });
        }
    } else {
        platformSubSelectedCourses = platformSubSelectedCourses.filter(c => String(c.courseId) !== String(courseId));
    }
}

/** حفظ اختيار الكورسات والرجوع لشاشة نوع الاشتراك */
function savePlatformCourseSelection() {
    const summary = document.getElementById('platform-selected-summary');
    const preview = document.getElementById('platform-price-preview');
    const platformCheckbox = document.getElementById('sub-type-platform');

    if (platformSubSelectedCourses.length === 0) {
        // No courses chosen -> uncheck the platform option
        if (platformCheckbox) platformCheckbox.checked = false;
        if (summary) summary.style.display = 'none';
        if (preview) preview.innerText = 'حدد الكورسات لمعرفة السعر';
    } else {
        const total = platformSubSelectedCourses.reduce((sum, c) => sum + (Number(c.price) || 0), 0);
        if (summary) {
            summary.style.display = 'block';
            summary.innerHTML = `<strong>الكورسات المختارة:</strong> ` +
                platformSubSelectedCourses.map(c => `<span class="status-badge" style="background:#e0e7ff; color:#3730a3; margin:2px;">${c.courseTitle}</span>`).join(' ');
        }
        if (preview) preview.innerText = `${total} ج.م (${platformSubSelectedCourses.length} كورس)`;
        if (platformCheckbox) platformCheckbox.checked = true;
    }

    updateSubscriptionTotal();
    toggleModal('platform-course-select-modal', false);
}

// ============================================
// 4. تأكيد وتسجيل الاشتراكات
// ============================================

async function confirmSubscriptionSelection(studentId) {
    const s = db.students.find(x => x.id == studentId);
    if (!s) return;

    const lessonChecked = document.getElementById('sub-type-lesson')?.checked;
    const platformChecked = document.getElementById('sub-type-platform')?.checked;

    if (!lessonChecked && !platformChecked) {
        return showNotification('يرجى تحديد نوع اشتراك واحد على الأقل', 'warning');
    }

    if (platformChecked && platformSubSelectedCourses.length === 0) {
        return showNotification('يرجى اختيار كورس واحد على الأقل لاشتراك المنصة', 'warning');
    }

    let lessonResult = null;
    let platformResult = null;

    // --- 1. اشتراك الدرس ---
    if (lessonChecked) {
        const alreadyPaid = db.payments.some(p =>
            p.studentId == s.id &&
            p.category === 'اشتراك شهري' &&
            p.cycleId == db.settings.activeCycle
        );

        if (!alreadyPaid) {
            if (!db.settings.activeCycle) {
                db.settings.isMonthlyActive = true;
                db.settings.activeCycle = Date.now();
                db.settings.monthlyFee = db.settings.monthlyFee || 100;
            }
            lessonResult = {
                id: Date.now(),
                studentId: s.id,
                amount: db.settings.monthlyFee,
                month: new Date().getMonth() + 1,
                year: new Date().getFullYear(),
                date: new Date().toISOString(),
                category: 'اشتراك شهري',
                cycleId: db.settings.activeCycle
            };
            db.payments.push(lessonResult);
        }
    }

    // --- 2. اشتراك المنصة ---
    if (platformChecked && platformSubSelectedCourses.length > 0) {
        platformResult = await recordPlatformSubscription(s, platformSubSelectedCourses);
    }

    await db.save();

    // --- إشعار ---
    const parts = [];
    if (lessonResult) parts.push(`اشتراك الدرس (${lessonResult.amount} ج.م)`);
    if (platformResult) parts.push(`اشتراك المنصة (${platformResult.totalAmount} ج.م)`);

    if (parts.length) {
        showNotification(`✅ تم تسجيل: ${parts.join(' + ')} لـ ${s.name}`, 'success');
        playSound('success');
    } else {
        showNotification('الطالب مدفوع بالفعل لكل ما تم تحديده', 'warning');
    }

    toggleModal('subscription-type-modal', false);

    // تحديث الواجهات المرتبطة
    if (typeof renderFinances === 'function') renderFinances();
    if (typeof renderMonthlySubscriptionTables === 'function') renderMonthlySubscriptionTables();
    if (typeof updateDashboardStats === 'function') updateDashboardStats();
    if (typeof openSmartCard === 'function') openSmartCard(studentId);

    // طباعة إيصال اشتراك الدرس إن وُجد
    if (lessonResult && typeof showReceiptSelectionModal === 'function') {
        showReceiptSelectionModal(lessonResult.id);
    }
}

/**
 * يسجل اشتراك منصة لطالب في كورس واحد أو أكثر.
 * - يحفظ السجل محلياً دائماً (Offline-First)
 * - لو متصل بالإنترنت: يرفع مباشرة لـ Firebase ويربط الطالب بالكورس
 * - لو غير متصل: يضعه في جدول platform_subscriptions بحالة sync_status = 0
 */
async function recordPlatformSubscription(student, selectedCourses) {
    const online = await isReallyOnline();
    const now = new Date().toISOString();
    const totalAmount = selectedCourses.reduce((sum, c) => sum + (Number(c.price) || 0), 0);

    const newRecords = [];

    for (const course of selectedCourses) {
        const record = {
            id: `PSUB_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
            student_id: student.id,
            studentCode: student.qrCode,
            course_id: course.courseId,
            course_title: course.courseTitle,
            amount: Number(course.price) || 0,
            payment_date: now,
            sync_status: 0, // 0 = لم تتم المزامنة, 1 = تمت المزامنة
            created_at: now
        };
        newRecords.push(record);
    }

    // 1. الحفظ المحلي دائماً أولاً
    db.platformSubscriptions = db.platformSubscriptions || [];
    db.platformSubscriptions.push(...newRecords);
    await StorageEngine.save('platformSubscriptions', newRecords);

    // 2. تسجيل عملية دفع داخلية لإظهارها في الخزينة والمالية
    const financePayment = {
        id: Date.now() + 2,
        studentId: student.id,
        amount: totalAmount,
        date: now,
        category: 'اشتراك المنصة',
        cycleId: db.settings.activeCycle || 'misc',
        platformCourses: selectedCourses.map(c => c.courseTitle)
    };
    db.payments.push(financePayment);

    // 3. لو متصل بالإنترنت: نحاول المزامنة فوراً
    if (online) {
        const syncResult = await syncPlatformSubscriptionRecords(newRecords);
        if (syncResult.success) {
            showNotification(`🌐 تم ربط ${student.name} بالكورس(ات) على المنصة فوراً`, 'success');
        } else {
            showNotification('⚠️ تم الحفظ محلياً، وسيتم رفع الاشتراك تلقائياً عند تحسن الاتصال', 'warning');
        }
    } else {
        showNotification(`📴 تم تسجيل اشتراك المنصة محلياً لـ ${student.name}. سيتم رفعه تلقائياً عند توفر الإنترنت`, 'warning');
    }

    return { records: newRecords, totalAmount, online };
}

// ============================================
// 5. مزامنة الاشتراكات المعلّقة مع المنصة
// ============================================

/**
 * يرسل مجموعة من سجلات الاشتراك إلى Firebase ويحدّث حالة المزامنة محلياً.
 * يعيد { success, syncedCount }
 */
async function syncPlatformSubscriptionRecords(records) {
    try {
        const firebaseReady = await ensureFirebaseInitialized();
        if (!firebaseReady) return { success: false, syncedCount: 0 };

        let synced = 0;
        for (const record of records) {
            try {
                await window.db.collection('platform_subscriptions').doc(record.id).set({
                    studentId: String(record.student_id),
                    studentCode: record.studentCode,
                    courseId: record.course_id,
                    courseTitle: record.course_title,
                    amount: record.amount,
                    subscriptionDate: record.payment_date.split('T')[0],
                    subscriptionSource: 'center',
                    paymentStatus: 'paid',
                    paid: true,
                    offlineStudentId: record.student_id,
                    createdAt: record.created_at
                }, { merge: true });

                // إضافة الطالب لقائمة المشتركين في الكورس
                await window.db.collection('platform_courses').doc(String(record.course_id))
                    .collection('subscribers').doc(String(record.studentCode)).set({
                        studentCode: record.studentCode,
                        studentId: String(record.student_id),
                        subscriptionDate: record.payment_date.split('T')[0],
                        subscriptionSource: 'center',
                        paid: true
                    }, { merge: true });

                record.sync_status = 1;
                synced++;
            } catch (e) {
                console.error('Failed to sync subscription record', record.id, e);
            }
        }

        // تحديث الحالة محلياً
        if (synced > 0) {
            await StorageEngine.save('platformSubscriptions', records.filter(r => r.sync_status === 1));
        }

        return { success: synced === records.length, syncedCount: synced };
    } catch (err) {
        console.error('syncPlatformSubscriptionRecords failed', err);
        return { success: false, syncedCount: 0 };
    }
}

/**
 * يبحث عن كل الاشتراكات المعلّقة (sync_status = 0) ويحاول رفعها للمنصة.
 * يُستدعى تلقائياً عند عودة الاتصال، ويمكن استدعاؤه يدوياً من زر "مزامنة الآن".
 */
async function syncPendingPlatformSubscriptions() {
    const pending = (db.platformSubscriptions || []).filter(r => r.sync_status === 0);
    if (pending.length === 0) {
        showNotification('لا توجد اشتراكات معلّقة للمزامنة ✅', 'info');
        return;
    }

    const online = await isReallyOnline();
    if (!online) {
        showNotification(`لا يوجد اتصال بالإنترنت. يوجد ${pending.length} اشتراك معلّق سيتم رفعه تلقائياً عند الاتصال`, 'warning');
        return;
    }

    showNotification(`🔄 جاري رفع ${pending.length} اشتراك معلّق إلى المنصة...`, 'info');
    const result = await syncPlatformSubscriptionRecords(pending);

    if (result.syncedCount > 0) {
        showNotification(`✅ تم رفع ${result.syncedCount} من ${pending.length} اشتراك معلّق إلى المنصة`, 'success');
    }
    if (result.syncedCount < pending.length) {
        showNotification(`⚠️ تبقى ${pending.length - result.syncedCount} اشتراك لم تتم مزامنته بعد`, 'warning');
    }

    updatePendingSyncBadge();
}

/** عداد الاشتراكات المعلّقة - يُعرض كشارة على شاشة أكواد المنصة */
function updatePendingSyncBadge() {
    const badge = document.getElementById('platform-sync-pending-badge');
    if (!badge) return;
    const pendingCount = (db.platformSubscriptions || []).filter(r => r.sync_status === 0).length;
    if (pendingCount > 0) {
        badge.style.display = 'inline-block';
        badge.innerText = `${pendingCount} اشتراك معلّق ⏳`;
    } else {
        badge.style.display = 'none';
    }
}

// ============================================
// 6. التهيئة والمزامنة التلقائية
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    // مزامنة تلقائية عند عودة الاتصال
    window.addEventListener('online', () => {
        showNotification('🌐 تم استرجاع الاتصال بالإنترنت. جاري مزامنة الاشتراكات المعلّقة...', 'info');
        setTimeout(syncPendingPlatformSubscriptions, 1500);
    });

    // محاولة مزامنة دورية كل 5 دقائق إن وُجد اتصال
    platformSubAutoSyncTimer = setInterval(() => {
        syncPendingPlatformSubscriptions();
    }, 5 * 60 * 1000);

    // عرض شارة الاشتراكات المعلقة بعد تحميل البيانات
    setTimeout(updatePendingSyncBadge, 2000);

    // إضافة زر "تحديث الكورسات" بجانب زر استلام الأكواد إن لم يكن موجوداً
    setTimeout(() => {
        const importBtn = document.getElementById('btn-import-platform-codes');
        if (importBtn && !document.getElementById('btn-refresh-platform-courses')) {
            const refreshBtn = document.createElement('button');
            refreshBtn.className = 'btn btn-primary';
            refreshBtn.id = 'btn-refresh-platform-courses';
            refreshBtn.style.height = '48px';
            refreshBtn.style.borderRadius = '12px';
            refreshBtn.style.marginRight = '0.5rem';
            refreshBtn.innerHTML = '<i class="fas fa-cloud-download-alt"></i> تحديث الكورسات';
            refreshBtn.onclick = refreshPlatformCourses;
            importBtn.parentNode.insertBefore(refreshBtn, importBtn);

            const syncBtn = document.createElement('button');
            syncBtn.className = 'btn';
            syncBtn.style.height = '48px';
            syncBtn.style.borderRadius = '12px';
            syncBtn.style.marginRight = '0.5rem';
            syncBtn.style.background = 'var(--bg-light)';
            syncBtn.style.border = '1px solid var(--border)';
            syncBtn.innerHTML = '<i class="fas fa-sync"></i> مزامنة الاشتراكات المعلّقة <span id="platform-sync-pending-badge" class="status-badge" style="display:none; background:#fee2e2; color:#991b1b; margin-right:6px;"></span>';
            syncBtn.onclick = syncPendingPlatformSubscriptions;
            importBtn.parentNode.insertBefore(syncBtn, importBtn);
        }
    }, 1000);
});

// ============================================
// 7. دوال الدفع المباشر (للأزرار المستقلة في البطاقة الذكية)
// ============================================

/**
 * دفع اشتراك الدرس مباشرةً بدون نافذة اختيار
 */
async function payLessonDirect(studentId) {
    const s = db.students.find(x => x.id == studentId);
    if (!s) return;

    currentGrade = localStorage.getItem('edu_active_grade') || currentGrade;
    currentGroupId = localStorage.getItem('edu_active_group') || currentGroupId;

    const alreadyPaid = db.payments.some(p =>
        p.studentId == s.id &&
        p.category === 'اشتراك شهري' &&
        p.cycleId == db.settings.activeCycle
    );

    if (alreadyPaid) {
        return showNotification(`✅ ${s.name} دفع اشتراك الدرس بالفعل هذا الشهر`, 'info');
    }

    if (!db.settings.activeCycle) {
        db.settings.isMonthlyActive = true;
        db.settings.activeCycle = Date.now();
        db.settings.monthlyFee = db.settings.monthlyFee || 100;
    }

    const payment = {
        id: Date.now(),
        studentId: s.id,
        amount: db.settings.monthlyFee,
        month: new Date().getMonth() + 1,
        year: new Date().getFullYear(),
        date: new Date().toISOString(),
        category: 'اشتراك شهري',
        cycleId: db.settings.activeCycle
    };
    db.payments.push(payment);
    await db.save();

    showNotification(`✅ تم تسجيل اشتراك الدرس لـ ${s.name} (${payment.amount} ج.م)`, 'success');
    if (typeof playSound === 'function') playSound('success');
    if (typeof renderFinances === 'function') renderFinances();
    if (typeof updateDashboardStats === 'function') updateDashboardStats();
    if (typeof openSmartCard === 'function') openSmartCard(studentId);
    if (typeof showReceiptSelectionModal === 'function') showReceiptSelectionModal(payment.id);
}

/**
 * دفع اشتراك المنصة مباشرةً — يفتح نافذة اختيار الكورس مباشرة
 */
function payPlatformDirect(studentId) {
    const s = db.students.find(x => x.id == studentId);
    if (!s) return;

    currentGrade = localStorage.getItem('edu_active_grade') || currentGrade;
    currentGroupId = localStorage.getItem('edu_active_group') || currentGroupId;

    platformSubModalStudentId = studentId;
    platformSubSelectedCourses = [];

    // فتح نافذة اختيار الكورس مباشرة
    renderPlatformCourseSelectionList();

    // إضافة زر تأكيد مخصص لاشتراك المنصة فقط
    const confirmSection = document.getElementById('platform-course-confirm-section');
    if (confirmSection) {
        confirmSection.innerHTML = `
            <div style="padding:1rem; border-top:1px solid var(--border); display:flex; gap:10px;">
                <button class="btn" style="flex:1; height:50px; border-radius:12px; background:var(--bg-light); border:1px solid var(--border);"
                    onclick="toggleModal('platform-course-select-modal', false)">إلغاء</button>
                <button class="btn btn-primary" style="flex:2; height:50px; border-radius:12px;"
                    onclick="confirmPlatformOnlyPayment(${s.id})">
                    <i class='fas fa-check-circle'></i> تأكيد دفع اشتراك المنصة
                </button>
            </div>`;
    }

    toggleModal('platform-course-select-modal', true);
}

/**
 * تأكيد دفع اشتراك المنصة فقط من الدالة المباشرة
 */
async function confirmPlatformOnlyPayment(studentId) {
    const s = db.students.find(x => x.id == studentId);
    if (!s) return;

    if (platformSubSelectedCourses.length === 0) {
        return showNotification('يرجى اختيار كورس واحد على الأقل', 'warning');
    }

    const result = await recordPlatformSubscription(s, platformSubSelectedCourses);
    await db.save();

    showNotification(`✅ تم تسجيل اشتراك المنصة لـ ${s.name} (${result.totalAmount} ج.م)`, 'success');
    if (typeof playSound === 'function') playSound('success');

    toggleModal('platform-course-select-modal', false);
    if (typeof renderFinances === 'function') renderFinances();
    if (typeof updateDashboardStats === 'function') updateDashboardStats();
    if (typeof openSmartCard === 'function') openSmartCard(studentId);
    updatePendingSyncBadge();
}

/**
 * دفع الاشتراكين معاً (الدرس + المنصة) — يفتح نافذة الاختيار مع تفعيل خيار الدرس مسبقاً
 */
function payBothDirect(studentId) {
    openSubscriptionTypeModal(studentId);
    // تأخير قصير لضمان تحميل النافذة قبل التفعيل
    setTimeout(() => {
        const lessonCb = document.getElementById('sub-type-lesson');
        const platformCb = document.getElementById('sub-type-platform');
        if (lessonCb && !lessonCb.disabled) lessonCb.checked = true;
        if (platformCb) platformCb.checked = false; // سيختار المستخدم الكورسات
        updateSubscriptionTotal();
    }, 120);
}

// ============================================
// Exports
// ============================================
window.refreshPlatformCourses = refreshPlatformCourses;
window.openSubscriptionTypeModal = openSubscriptionTypeModal;
window.updateSubscriptionTotal = updateSubscriptionTotal;
window.openPlatformCourseModal = openPlatformCourseModal;
window.renderPlatformCourseSelectionList = renderPlatformCourseSelectionList;
window.togglePlatformCourseSelection = togglePlatformCourseSelection;
window.savePlatformCourseSelection = savePlatformCourseSelection;
window.confirmSubscriptionSelection = confirmSubscriptionSelection;
window.recordPlatformSubscription = recordPlatformSubscription;
window.syncPendingPlatformSubscriptions = syncPendingPlatformSubscriptions;
window.syncPlatformSubscriptionRecords = syncPlatformSubscriptionRecords;
window.updatePendingSyncBadge = updatePendingSyncBadge;
// دوال الدفع المباشر
window.payLessonDirect = payLessonDirect;
window.payPlatformDirect = payPlatformDirect;
window.payBothDirect = payBothDirect;
window.confirmPlatformOnlyPayment = confirmPlatformOnlyPayment;
