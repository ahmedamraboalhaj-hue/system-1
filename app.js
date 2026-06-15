/**
 * الأمين في اللغة العربية v2.0 - Core Intelligence Engine
 * Specialized for Mr. Mohamed's Education Center
 */

// --- Database & Persistence ---
// --- Database & Persistence ---
let currentGrade = localStorage.getItem('edu_active_grade') || null;
let currentGroupId = localStorage.getItem('edu_active_group') || null;

/** 
 * --- ULTRA ROYAL STORAGE ENGINE (IndexedDB) ---
 * Optimized for handling 1,000,000+ students without hanging
 */
const StorageEngine = {
    db: null,
    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open("EduMasterLargeDB", 5);
            request.onerror = (e) => reject("IndexedDB error: " + e.target.errorCode);
            request.onupgradeneeded = (e) => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains("students")) {
                    const store = db.createObjectStore("students", { keyPath: "id" });
                    store.createIndex("qrCode", "qrCode", { unique: true });
                    store.createIndex("grade", "grade", { unique: false });
                    store.createIndex("groupId", "groupId", { unique: false });
                    store.createIndex("name", "name", { unique: false });
                }
                const tables = ['attendance', 'exams', 'scores', 'expenses', 'handouts', 'studentHandouts', 'materials', 'quizzes', 'rewards', 'payments', 'waQueue', 'groups', 'cycles', 'absenceSessions', 'dailyTreasuryArchives', 'staff', 'shifts', 'courseCodes', 'platformCourses', 'platformSubscriptions'];
                tables.forEach(t => {
                    if (!db.objectStoreNames.contains(t)) db.createObjectStore(t, { keyPath: "id" });
                });
            };
            request.onsuccess = (e) => {
                this.db = e.target.result;
                resolve();
            };
        });
    },

    async getAll(storeName) {
        return new Promise((resolve) => {
            if (!this.db || !this.db.objectStoreNames.contains(storeName)) {
                console.warn(`Store ${storeName} not found or DB not ready.`);
                return resolve([]);
            }
            const transaction = this.db.transaction([storeName], "readonly");
            const store = transaction.objectStore(storeName);
            const request = store.getAll();
            request.onsuccess = () => resolve(request.result || []);
            request.onerror = () => resolve([]);
        });
    },

    async getPaged(storeName, filter = {}, page = 0, pageSize = 50, searchTerm = '') {
        return new Promise((resolve) => {
            const transaction = this.db.transaction([storeName], "readonly");
            const store = transaction.objectStore(storeName);
            const request = store.openCursor();
            const results = [];
            let counter = 0;
            const skip = page * pageSize;
            let matchedFoundSoFar = 0;

            request.onsuccess = (event) => {
                const cursor = event.target.result;
                if (!cursor) {
                    resolve({ data: results, hasMore: false });
                    return;
                }

                const val = cursor.value;

                // 1. Structural filtering (grade, group)
                let match = true;
                for (let key in filter) {
                    if (filter[key] && filter[key] !== 'all' && val[key] != filter[key]) {
                        match = false; break;
                    }
                }

                // 2. Search term filtering
                if (match && searchTerm) {
                    const term = searchTerm.toLowerCase();
                    const nameMatch = val.name && val.name.toLowerCase().includes(term);
                    const codeMatch = val.qrCode && val.qrCode.includes(term);
                    const phoneMatch = val.phone && val.phone.includes(term);
                    if (!nameMatch && !codeMatch && !phoneMatch) {
                        match = false;
                    }
                }

                if (match) {
                    if (matchedFoundSoFar >= skip) {
                        results.push(val);
                        counter++;
                        if (counter >= pageSize) {
                            resolve({ data: results, hasMore: true });
                            return;
                        }
                    }
                    matchedFoundSoFar++;
                }

                cursor.continue();
            };
        });
    },

    async save(storeName, data) {
        if (!this.db) await this.init();
        if (!this.db || !this.db.objectStoreNames.contains(storeName)) {
            throw new Error(`قاعدة البيانات غير جاهزة أو جدول ${storeName} غير موجود`);
        }
        if (!Array.isArray(data)) data = [data];
        if (data.length === 0) return;

        // Chunking for massive datasets to prevent transaction timeouts/memory issues
        const CHUNK_SIZE = 5000;
        for (let i = 0; i < data.length; i += CHUNK_SIZE) {
            const chunk = data.slice(i, i + CHUNK_SIZE);
            const transaction = this.db.transaction([storeName], "readwrite");
            const store = transaction.objectStore(storeName);
            chunk.forEach(item => store.put(item));
            await new Promise((resolve, reject) => {
                transaction.oncomplete = () => resolve();
                transaction.onerror = (e) => reject(e);
            });
        }
    },

    async delete(storeName, id) {
        if (!this.db) await this.init();
        if (!this.db || !this.db.objectStoreNames.contains(storeName)) return;
        const transaction = this.db.transaction([storeName], "readwrite");
        const store = transaction.objectStore(storeName);
        store.delete(id);
        return new Promise((resolve) => transaction.oncomplete = () => resolve());
    },

    async get(storeName, id) {
        return new Promise((resolve) => {
            if (!this.db || !this.db.objectStoreNames.contains(storeName)) return resolve(null);
            const transaction = this.db.transaction([storeName], "readonly");
            const store = transaction.objectStore(storeName);
            const request = store.get(id);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => resolve(null);
        });
    },

    async count(storeName, filter = {}) {
        return new Promise((resolve) => {
            if (!this.db || !this.db.objectStoreNames.contains(storeName)) return resolve(0);
            const transaction = this.db.transaction([storeName], "readonly");
            const store = transaction.objectStore(storeName);
            const request = store.getAll();
            request.onsuccess = () => {
                let items = request.result || [];
                for (let key in filter) {
                    const val = filter[key];
                    if (val !== 'all' && val !== '' && val !== null && val !== undefined) {
                        items = items.filter(i => String(i[key]) === String(val));
                    }
                }
                resolve(items.length);
            };
            request.onerror = () => resolve(0);
        });
    }
};

const db = {
    students: [],
    attendance: [],
    exams: [],
    scores: [],
    expenses: [],
    handouts: [],
    studentHandouts: [],
    materials: [],
    quizzes: [],
    rewards: [],
    payments: [],
    waQueue: [],
    groups: [],
    cycles: [],
    absenceSessions: [],
    dailyTreasuryArchives: [],
    courseCodes: [],
    platformCourses: [],
    platformSubscriptions: [],
    dailyTreasuryLastArchiveDate: null,
    staff: [],
    shifts: [],
    _settings: {},

    // Dynamic settings getter based on active grade
    get settings() {
        const grade = currentGrade || 'default';
        const group = currentGroupId || 'all';
        const key = group === 'all' ? grade : `${grade}_${group}`;
        
        if (!this._settings[key]) {
            const legacy = this._settings[grade];
            this._settings[key] = legacy ? JSON.parse(JSON.stringify(legacy)) : {
                isMonthlyActive: false,
                monthlyFee: 0,
                centerCommissionPercent: 0,
                monthlyCollected: 0,
                monthlyCycleName: '',
                activeCycle: null,
                treasurySessionResetTime: {},
                platformSubscriptionFee: 100,
                cycleSubscriptionType: 'lesson',
                activePlatformCourse: null
            };
        }
        return this._settings[key];
    },

    async load() {
        await StorageEngine.init();
        const tables = ['students', 'attendance', 'exams', 'scores', 'expenses', 'handouts', 'studentHandouts', 'materials', 'quizzes', 'rewards', 'payments', 'waQueue', 'groups', 'cycles', 'absenceSessions', 'dailyTreasuryArchives', 'courseCodes', 'platformCourses', 'platformSubscriptions'];

        // 1. Read active grade/group FIRST
        currentGrade = localStorage.getItem('edu_active_grade') || null;
        currentGroupId = localStorage.getItem('edu_active_group') || null;

        // 2. Check if DB is completely empty (fresh browser / new device)
        const allGroups = await StorageEngine.getAll('groups');
        const isDbEmpty = allGroups.length === 0;

        // 3. Auto-Hydration from data.js when DB is empty - ONLY on first-ever initialization
        // This flag ensures we only hydrate once, not every time data is cleared
        const hasEverInitialized = localStorage.getItem('edu_app_initialized') === 'true';
        const initialData = window.edu_initial_data || {};
        if (isDbEmpty && !hasEverInitialized && Object.keys(initialData).length > 0) {
            console.log('Fresh DB. Hydrating from data.js...');
            for (const table of tables) {
                if (initialData[table] && Array.isArray(initialData[table]) && initialData[table].length > 0) {
                    await StorageEngine.save(table, initialData[table]);
                }
            }
            if (initialData.settings) {
                localStorage.setItem('edu_master_settings', JSON.stringify(initialData.settings));
            }
            if (initialData.gradesList) {
                localStorage.setItem('edu_grades_list', JSON.stringify(initialData.gradesList));
            }
            // Restore grade/group context
            if (initialData.activeGrade) localStorage.setItem('edu_active_grade', initialData.activeGrade);
            if (initialData.activeGroup) localStorage.setItem('edu_active_group', initialData.activeGroup);
            localStorage.setItem('edu_app_initialized', 'true');
            console.log('Hydration complete. Reloading...');
            setTimeout(() => location.reload(), 300);
            return;
        }
        
        // Mark as initialized even if no hydration happened
        if (!hasEverInitialized) {
            localStorage.setItem('edu_app_initialized', 'true');
        }

        // 4. Migration from old localStorage single-dump
        const raw = localStorage.getItem('edu_master_db');
        if (raw) {
            console.log('Migrating legacy localStorage data to IndexedDB...');
            try {
                const master = JSON.parse(raw);
                for (const table of tables) {
                    if (master[table] && Array.isArray(master[table]) && master[table].length > 0) {
                        await StorageEngine.save(table, master[table]);
                    }
                }
                if (master.settings) {
                    localStorage.setItem('edu_master_settings', JSON.stringify(master.settings));
                }
                if (master.gradesList) {
                    localStorage.setItem('edu_grades_list', JSON.stringify(master.gradesList));
                }
            } catch (e) { console.error('Legacy migration failed', e); }
            localStorage.removeItem('edu_master_db');
        }

        // 5. Load ALL data into memory
        const masterSettings = JSON.parse(localStorage.getItem('edu_master_settings')) || {};
        this._settings = masterSettings;
        this.groups = await StorageEngine.getAll('groups');
        this.cycles = await StorageEngine.getAll('cycles');
        this.students = await StorageEngine.getAll('students');
        this.attendance = await StorageEngine.getAll('attendance');
        this.payments = await StorageEngine.getAll('payments');
        this.exams = await StorageEngine.getAll('exams');
        this.scores = await StorageEngine.getAll('scores');
        this.dailyTreasuryArchives = await StorageEngine.getAll('dailyTreasuryArchives');
        this.courseCodes = await StorageEngine.getAll('courseCodes');
        this.platformCourses = await StorageEngine.getAll('platformCourses');
        this.platformSubscriptions = await StorageEngine.getAll('platformSubscriptions');
        this.dailyTreasuryLastArchiveDate = localStorage.getItem('dailyTreasuryLastArchiveDate');
        this.handouts = await StorageEngine.getAll('handouts');
        this.studentHandouts = await StorageEngine.getAll('studentHandouts');
        this.materials = await StorageEngine.getAll('materials');
        this.quizzes = await StorageEngine.getAll('quizzes');
        this.rewards = await StorageEngine.getAll('rewards');
        this.waQueue = await StorageEngine.getAll('waQueue');
        this.absenceSessions = await StorageEngine.getAll('absenceSessions');
        this.staff = await StorageEngine.getAll('staff');
        this.shifts = await StorageEngine.getAll('shifts');

        // Refresh global gradesList variable from localStorage
        const storedGrades = localStorage.getItem('edu_grades_list');
        if (storedGrades) {
            try { gradesList = JSON.parse(storedGrades); window.gradesList = gradesList; } catch (e) { }
        }

        if (typeof renderStudents === 'function') renderStudents();
        if (typeof syncUIWithContext === 'function') syncUIWithContext();
    },

    async save(modifiedTable = null) {
        if (modifiedTable) {
            await StorageEngine.save(modifiedTable, this[modifiedTable]);
        } else {
            // Default: Save all tables including massive students table 
            const tables = ['students', 'attendance', 'exams', 'scores', 'expenses', 'handouts', 'studentHandouts', 'materials', 'quizzes', 'rewards', 'payments', 'waQueue', 'groups', 'cycles', 'absenceSessions', 'dailyTreasuryArchives', 'staff', 'shifts', 'courseCodes', 'platformCourses', 'platformSubscriptions'];
            for (const table of tables) {
                await StorageEngine.save(table, this[table]);
            }
        }

        localStorage.setItem('edu_master_settings', JSON.stringify(this._settings));
        if (currentGrade) localStorage.setItem('edu_active_grade', currentGrade);
        if (currentGroupId) localStorage.setItem('edu_active_group', currentGroupId);
        if (this.dailyTreasuryLastArchiveDate) localStorage.setItem('dailyTreasuryLastArchiveDate', this.dailyTreasuryLastArchiveDate);

        if (typeof updateDataInFile === 'function') updateDataInFile();
    }
};

let appBootPromise = null;

function showStartupError(err) {
    console.error('Application startup failed', err);
    const errorBox = document.getElementById('password-error');
    if (errorBox) {
        errorBox.style.display = 'block';
        errorBox.innerHTML = '<i class="fas fa-exclamation-triangle"></i> تعذر تشغيل قاعدة البيانات. أعد تحميل الصفحة أو افتح البرنامج من المتصفح مرة أخرى.';
    }
    if (typeof showNotification === 'function') {
        showNotification('تعذر تحميل بيانات البرنامج. برجاء إعادة فتح الصفحة.', 'error');
    }
}

function ensureAppLoaded() {
    if (!appBootPromise) {
        appBootPromise = db.load().catch(err => {
            showStartupError(err);
            throw err;
        });
    }
    return appBootPromise;
}

// --- AUTOMATIC FILE SYSTEM SYNC (For Local Portability) ---
let directoryHandle = null;
let examScanner = null;

async function updateDataInFile() {
    if (!directoryHandle) return;
    try {
        const fileHandle = await directoryHandle.getFileHandle('edumaster_data.json', { create: true });
        const writable = await fileHandle.createWritable();

        const snapshot = {};
        const tables = ['students', 'attendance', 'exams', 'scores', 'expenses', 'handouts', 'studentHandouts', 'materials', 'quizzes', 'rewards', 'payments', 'waQueue', 'groups', 'cycles', 'absenceSessions', 'dailyTreasuryArchives', 'staff', 'shifts', 'courseCodes', 'platformCourses', 'platformSubscriptions'];
        tables.forEach(t => snapshot[t] = db[t]);
        snapshot.settings = db._settings;
        snapshot.gradesList = gradesList;
        snapshot.dailyTreasuryLastArchiveDate = db.dailyTreasuryLastArchiveDate;

        await writable.write(JSON.stringify(snapshot, null, 2));
        await writable.close();

        const status = document.getElementById('sync-status');
        const indicator = document.getElementById('sync-indicator');
        if (status) status.innerText = 'متصل - تم الحفظ تلقائياً';
        if (indicator) indicator.style.background = '#22c55e';
    } catch (err) {
        console.error('Auto-save failed', err);
        const status = document.getElementById('sync-status');
        const indicator = document.getElementById('sync-indicator');
        if (status) status.innerText = 'خطأ في الحفظ!';
        if (indicator) indicator.style.background = '#ef4444';
    }
}

function normalizeIdentityValue(value) {
    return String(value ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function pickFirstValue(record, keys) {
    for (const key of keys) {
        const value = record?.[key];
        if (value !== undefined && value !== null && String(value).trim() !== '') return value;
    }
    return '';
}

function buildRecordIdentity(table, record) {
    if (!record || typeof record !== 'object') return '';

    if (table === 'students') {
        const nationalId = pickFirstValue(record, ['nationalId', 'nationalID', 'nid', 'studentNationalId']);
        if (nationalId) return `${table}:national:${normalizeIdentityValue(nationalId)}`;

        const code = pickFirstValue(record, ['qrCode', 'code', 'studentCode', 'barcode']);
        if (code) return `${table}:code:${normalizeIdentityValue(code)}`;

        const name = pickFirstValue(record, ['name', 'studentName']);
        const phone = pickFirstValue(record, ['phone', 'parentPhone', 'studentPhone']);
        const grade = pickFirstValue(record, ['grade', 'stage']);
        if (name && (phone || grade)) {
            return `${table}:natural:${normalizeIdentityValue(name)}|${normalizeIdentityValue(phone)}|${normalizeIdentityValue(grade)}`;
        }
    }

    if (['attendance', 'payments', 'expenses', 'scores', 'studentHandouts', 'rewards'].includes(table)) {
        const studentId = pickFirstValue(record, ['studentId', 'studentID', 'student']);
        const date = pickFirstValue(record, ['date', 'createdAt', 'day']);
        const amount = pickFirstValue(record, ['amount', 'value', 'paid', 'total']);
        const kind = pickFirstValue(record, ['type', 'status', 'examId', 'handoutId', 'description', 'note', 'title', 'reason']);
        const extra = pickFirstValue(record, ['cycleId', 'sessionId', 'month', 'grade', 'groupId']);
        if (studentId || date || amount || kind || extra) {
            return `${table}:natural:${normalizeIdentityValue(studentId)}|${normalizeIdentityValue(date)}|${normalizeIdentityValue(amount)}|${normalizeIdentityValue(kind)}|${normalizeIdentityValue(extra)}`;
        }
    }

    const id = pickFirstValue(record, ['id', '_id']);
    if (id) return `${table}:id:${normalizeIdentityValue(id)}`;

    const title = pickFirstValue(record, ['name', 'title']);
    const date = pickFirstValue(record, ['date', 'createdAt']);
    const grade = pickFirstValue(record, ['grade', 'groupId']);
    if (title || date || grade) {
        return `${table}:natural:${normalizeIdentityValue(title)}|${normalizeIdentityValue(date)}|${normalizeIdentityValue(grade)}`;
    }

    return `${table}:json:${normalizeIdentityValue(JSON.stringify(record))}`;
}

async function mergeTableWithoutDuplicates(table, incomingRows) {
    if (!Array.isArray(incomingRows) || incomingRows.length === 0) {
        return { added: 0, updated: 0, skipped: 0 };
    }

    const existingRows = await StorageEngine.getAll(table);
    const byIdentity = new Map();
    const byId = new Map();
    let added = 0;
    let updated = 0;
    let skipped = 0;

    existingRows.forEach(row => {
        const identity = buildRecordIdentity(table, row);
        if (identity) byIdentity.set(identity, row);
        if (row?.id !== undefined && row?.id !== null) byId.set(String(row.id), row);
    });

    for (const incoming of incomingRows) {
        if (!incoming || typeof incoming !== 'object') {
            skipped++;
            continue;
        }

        const identity = buildRecordIdentity(table, incoming);
        const current = identity ? byIdentity.get(identity) : null;

        if (current) {
            const merged = Object.assign({}, current, incoming);
            await StorageEngine.save(table, merged);
            if (merged.id !== undefined && merged.id !== null) byId.set(String(merged.id), merged);
            if (identity) byIdentity.set(identity, merged);
            updated++;
            continue;
        }

        if (incoming.id === undefined || incoming.id === null || incoming.id === '') {
            incoming.id = `${table}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        }

        const idKey = String(incoming.id);
        if (byId.has(idKey)) {
            const merged = Object.assign({}, byId.get(idKey), incoming);
            await StorageEngine.save(table, merged);
            byId.set(idKey, merged);
            updated++;
        } else {
            await StorageEngine.save(table, incoming);
            byId.set(idKey, incoming);
            added++;
        }

        const newIdentity = buildRecordIdentity(table, incoming);
        if (newIdentity) byIdentity.set(newIdentity, incoming);
    }

    return { added, updated, skipped };
}

async function hydrateDatabase(dataBlob) {
    if (!dataBlob || (typeof dataBlob === 'string' && dataBlob.trim().length === 0)) {
        console.error('hydrateDatabase: Empty input');
        return false;
    }

    if (!StorageEngine.db) await StorageEngine.init();

    let processedData = null;

    // 1. ULTRA-RESILIENT EXTRACTION
    if (typeof dataBlob === 'string') {
        const trimmed = dataBlob.trim();
        try {
            // Perfect Case: Clean JSON
            processedData = JSON.parse(trimmed);
        } catch (e1) {
            console.log('Not strict JSON, attempting JS extraction...');
            try {
                // Heuristic: Extract the primary object block { ... }
                // This handles data.js files that have assignments, comments, or trailing semicolons
                const firstBrace = trimmed.indexOf('{');
                const lastBrace = trimmed.lastIndexOf('}');

                if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
                    let rawBlock = trimmed.substring(firstBrace, lastBrace + 1);

                    // Dangerous but necessary for legacy files that aren't strict JSON (unquoted keys, etc.)
                    // We wrap it in parentheses to make it an expression
                    try {
                        // Use Function instead of eval for a bit more isolation
                        processedData = new Function(`return (${rawBlock})`)();
                    } catch (e2) {
                        // If that fails, try a desperate JSON fix (quoting keys)
                        // but usually the legacy exports were created via stringify, so should be close to JSON
                        console.error('JS Object parsing failed', e2);
                    }
                }
            } catch (e3) {
                console.error('Critical extraction error', e3);
            }
        }
    } else {
        processedData = dataBlob;
    }

    if (!processedData || typeof processedData !== 'object') {
        // Last-last chance: Check if it's a raw array (maybe just a student list backup)
        try {
            if (typeof dataBlob === 'string' && dataBlob.trim().startsWith('[')) {
                const arr = JSON.parse(dataBlob.trim());
                if (Array.isArray(arr)) {
                    processedData = { students: arr }; // Assume they are students
                }
            }
        } catch (e) { }

        if (!processedData) {
            console.error('hydrateDatabase: All extraction strategies failed.');
            return false;
        }
    }

    // 2. Normalization Strategy
    // Unroll 'db_state' or nested legacy structures
    if (processedData.db_state) {
        let state = processedData.db_state;
        if (typeof state === 'string') { try { state = JSON.parse(state); } catch (e) { } }
        const unrolled = {};
        if (state && typeof state === 'object') {
            Object.keys(state).forEach(key => {
                if (key === 'edu_master_db') {
                    try {
                        const inner = JSON.parse(state[key]);
                        if (typeof inner === 'object') Object.assign(unrolled, inner);
                    } catch (e) { }
                } else {
                    try {
                        unrolled[key] = (typeof state[key] === 'string') ? JSON.parse(state[key]) : state[key];
                    } catch (e) { unrolled[key] = state[key]; }
                }
            });
            processedData = unrolled;
        }
    }

    // 3. Robust Chunked Table Import
    const tables = ['students', 'attendance', 'exams', 'scores', 'expenses', 'handouts', 'studentHandouts', 'materials', 'quizzes', 'rewards', 'payments', 'waQueue', 'groups', 'cycles', 'absenceSessions', 'dailyTreasuryArchives', 'staff', 'shifts', 'courseCodes', 'platformCourses', 'platformSubscriptions'];
    let tablesImported = 0;
    let totalAdded = 0;
    let totalUpdated = 0;
    let totalSkipped = 0;

    showNotification('جاري قراءة البيانات... يرجى الانتظار ولا تغلق المتصفح', 'info');

    for (const table of tables) {
        // Look for the data under multiple naming conventions
        const dataArray = processedData[table] ||
            processedData[`edu_${table}`] ||
            (table === 'dailyTreasuryArchives' ? (processedData.dailyTreasury || processedData.dailyTreasuryArchives) : null) ||
            (table === 'payments' ? (processedData.studentPayments || processedData.allPayments) : null) ||
            (table === 'students' && Array.isArray(processedData) ? processedData : null);

        if (dataArray && Array.isArray(dataArray) && dataArray.length > 0) {
            console.log(`⏳ Importing ${table}...`);
            const result = await mergeTableWithoutDuplicates(table, dataArray);
            if (result.added > 0 || result.updated > 0) tablesImported++;
            totalAdded += result.added;
            totalUpdated += result.updated;
            totalSkipped += result.skipped;
        }
    }

    console.log('Import merge summary', { totalAdded, totalUpdated, totalSkipped });

    // 4. Persistence of Meta & Settings
    const settings = processedData.settings || processedData.edu_master_settings || processedData.edu_settings;
    if (settings) {
        // ✅ MERGE settings per-grade instead of replacing - old grades' settings stay intact
        let incomingSettings = (typeof settings === 'string') ? JSON.parse(settings) : settings;
        const existingSettingsRaw = localStorage.getItem('edu_master_settings');
        let existingSettings = {};
        try { existingSettings = existingSettingsRaw ? JSON.parse(existingSettingsRaw) : {}; } catch (e) { existingSettings = {}; }
        // Merge: incoming keys override existing, but existing keys NOT in incoming are preserved
        const mergedSettings = Object.assign({}, existingSettings, incomingSettings);
        localStorage.setItem('edu_master_settings', JSON.stringify(mergedSettings));
    }
    const grades = processedData.gradesList || processedData.edu_grades_list || processedData.grades;
    if (grades) {
        // ✅ MERGE grades instead of replacing - keeps Preparatory grades when importing Secondary-only old backups
        let incomingGrades = (typeof grades === 'string') ? JSON.parse(grades) : grades;
        if (!Array.isArray(incomingGrades)) incomingGrades = [];
        const existingGradesRaw = localStorage.getItem('edu_grades_list');
        let existingGrades = [];
        try { existingGrades = existingGradesRaw ? JSON.parse(existingGradesRaw) : []; } catch (e) { existingGrades = []; }
        // Add any grade from the imported file that's NOT already in the current list
        incomingGrades.forEach(g => {
            if (!existingGrades.find(eg => String(eg.id) === String(g.id))) {
                existingGrades.push(g);
            }
        });
        localStorage.setItem('edu_grades_list', JSON.stringify(existingGrades));
    }

    const localSnapshot = processedData.localStorageSnapshot || processedData.localStorage || processedData.browserStorage;
    if (localSnapshot && typeof localSnapshot === 'object' && !Array.isArray(localSnapshot)) {
        Object.keys(localSnapshot).forEach(key => {
            const value = localSnapshot[key];
            if (value !== undefined && value !== null) localStorage.setItem(key, String(value));
        });
    }
    if (processedData.activeGrade) localStorage.setItem('edu_active_grade', processedData.activeGrade);
    if (processedData.activeGroup) localStorage.setItem('edu_active_group', processedData.activeGroup);
    if (processedData.dailyTreasuryLastArchiveDate) localStorage.setItem('dailyTreasuryLastArchiveDate', processedData.dailyTreasuryLastArchiveDate);

    return (tablesImported > 0 || settings || grades || localSnapshot);
}

async function loadDataFromFile() {
    if (!directoryHandle) return;
    try {
        const fileHandle = await directoryHandle.getFileHandle('edumaster_data.json');
        const file = await fileHandle.getFile();
        const contents = await file.text();
        if (contents) {
            const success = await hydrateDatabase(contents);
            if (success) {
                await db.load(); // Refresh memory
                if (typeof showNotification === 'function') showNotification('✅ تم مزامنة البيانات من الملف بنجاح', 'success');

                const status = document.getElementById('sync-status');
                const indicator = document.getElementById('sync-indicator');
                const btn = document.getElementById('link-folder-btn');
                if (status) status.innerText = 'متصل - تم المزامنة';
                if (indicator) indicator.style.background = '#22c55e';
                if (btn) {
                    btn.style.background = '#dcfce7';
                    btn.querySelector('span').innerText = 'المجلد مربوط ✅';
                }
            }
        }
    } catch (err) {
        console.log('No existing data file found in linked folder.');
    }
}

async function importFromFolder() {
    try {
        if (!window.showDirectoryPicker) {
            return alert('متصفحك لا يدعم فتح المجلدات. يرجى استخدام Chrome أو Edge.');
        }

        const handle = await window.showDirectoryPicker();
        showNotification('جاري مسح المجلد بحثاً عن ملفات البيانات...', 'info');

        // Scan for common data file names
        const fileNames = ['data.js', 'data (5).js', 'edumaster_data.json', 'edu_master_db.json', 'backup.json'];
        let foundAny = false;

        for (const fName of fileNames) {
            try {
                const fileHandle = await handle.getFileHandle(fName);
                const file = await fileHandle.getFile();
                const text = await file.text();
                const success = await hydrateDatabase(text);
                if (success) foundAny = true;
            } catch (e) {
                // File not found, continue to next
            }
        }

        if (foundAny) {
            directoryHandle = handle; // LINK FOLDER IMMEDIATELY
            showNotification('✅ تم استعادة كافة البيانات وربط المجلد بنجاح. سنقوم بتحديث الصفحة الآن.', 'success');
            setTimeout(() => location.reload(), 1500);
        } else {
            alert('❌ لم يتم العثور على أي ملفات بيانات صالحة داخل هذا المجلد. تأكد من اختيار المجلد الصحيح الذي يحتوي على ملف data.js');
        }
    } catch (err) {
        console.error('Folder import cancelled/failed', err);
    }
}

// Initialize from external file if localStorage is empty
const initialData = window.edu_initial_data || {};

let gradesList = JSON.parse(localStorage.getItem('edu_grades_list')) || initialData.gradesList || [
    { id: 101, name: 'الأول الابتدائي', icon: 'fa-child' },
    { id: 102, name: 'الثاني الابتدائي', icon: 'fa-child' },
    { id: 103, name: 'الثالث الابتدائي', icon: 'fa-child' },
    { id: 104, name: 'الرابع الابتدائي', icon: 'fa-book-open' },
    { id: 105, name: 'الخامس الابتدائي', icon: 'fa-book-open' },
    { id: 106, name: 'السادس الابتدائي', icon: 'fa-book-open' },
    { id: 201, name: 'الأول الإعدادي', icon: 'fa-user-graduate' },
    { id: 202, name: 'الثاني الإعدادي', icon: 'fa-user-graduate' },
    { id: 203, name: 'الثالث الإعدادي', icon: 'fa-user-graduate' },
    { id: 301, name: 'الأول الثانوي', icon: 'fa-university' },
    { id: 302, name: 'الثاني الثانوي', icon: 'fa-flask' },
    { id: 303, name: 'الثالث الثانوي', icon: 'fa-graduation-cap' }
];
// تصدير gradesList لتكون متاحة في ملفات JS الأخرى
window.gradesList = gradesList;

let appZoom = parseFloat(localStorage.getItem('app_zoom')) || 1.0;

function applyZoom() {
    document.body.style.zoom = appZoom;
    const zoomVal = document.getElementById('zoom-value');
    if (zoomVal) zoomVal.innerText = `${Math.round(appZoom * 100)}%`;
}

function changeAppZoom(delta) {
    appZoom = Math.min(1.5, Math.max(0.7, appZoom + delta));
    localStorage.setItem('app_zoom', appZoom);
    applyZoom();
}

function resetAppZoom() {
    appZoom = 1.0;
    localStorage.setItem('app_zoom', appZoom);
    applyZoom();
}

// Check if we need to hydrate the db from data.js (if localStorage is empty)
if (!localStorage.getItem('edu_grades_list') && window.edu_initial_data) {
    Object.keys(window.edu_initial_data).forEach(key => {
        if (key !== 'gradesList') {
            const prefix = `g1_`; // Default to first grade for initial hydration
            // This is a simplified logic; in a real app, we'd handle multi-grade hydration
        }
    });
}

function saveGradesList() {
    localStorage.setItem('edu_grades_list', JSON.stringify(gradesList));
}

// --- Grade Management ---
function syncUIWithContext() {
    const gradeObj = gradesList.find(g => String(g.id) === String(currentGrade));
    const groupObj = db.groups.find(g => String(g.id) === String(currentGroupId));

    const label = gradeObj ? gradeObj.name : 'الصف الدراسي';
    const groupLabel = groupObj ? ` - ${groupObj.name}` : '';

    const badge = document.getElementById('current-grade-badge');
    if (badge) badge.innerText = label + groupLabel;

    const headerGradeLabel = document.getElementById('grade-label');
    if (headerGradeLabel) headerGradeLabel.innerText = label;

    const selGradeTitle = document.getElementById('selected-grade-title');
    if (selGradeTitle) selGradeTitle.innerText = label;

    // Clear search inputs when context changes to ensure search isolation
    const searchInputs = ['group-student-search', 'student-search-input'];
    searchInputs.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.value = '';
            el.dispatchEvent(new Event('input'));
        }
    });
}

async function selectGrade(gradeId) {
    const sid = String(gradeId);
    localStorage.setItem('edu_active_grade', sid);
    currentGrade = sid;
    await db.load();

    syncUIWithContext();

    // Close any previous overlays
    document.getElementById('grade-selection-overlay').style.display = 'none';

    // Instead of the blue group selection, use the Portal's modern group selection
    enterPortalMode();
    showPortalStep('group', sid);
    updateExperienceSummary();
}

function renderGroupSelection(gradeId) {
    const container = document.getElementById('group-selection-container');
    const overlay = document.getElementById('group-selection-overlay');
    if (!container || !overlay) return;

    overlay.style.display = 'flex';

    // Ensure we use string comparison for grade IDs
    const gradeGroups = db.groups.filter(g => String(g.grade) === String(gradeId));

    let html = `
        <div class="grade-card-modern fade-in" onclick="toggleModal('group-modal', true)" style="--accent-color: var(--primary); background: rgba(255,255,255,0.05); border: 2px dashed rgba(255,255,255,0.2);">
            <div class="card-icon-modern" style="background: rgba(255,255,255,0.1);"><i class="fas fa-plus"></i></div>
            <h2>مجموعة جديدة</h2>
            <p>تعريف كود وموعد حصة جديد</p>
            <div class="card-stats-modern">اضغط للإضافة</div>
        </div>
    `;

    html += gradeGroups.map((group, idx) => `
        <div class="grade-card-modern fade-in" onclick="enterGroup('${group.id}')" style="--accent-color: hsl(${200 + idx * 40}, 70%, 50%); animation-delay: ${idx * 0.1}s">
            <div class="card-icon-modern"><i class="fas fa-users"></i></div>
            <h2>${group.name}</h2>
            <p>الموعد: ${group.time}</p>
            <div class="card-stats-modern">${db.students.filter(s => String(s.groupId) === String(group.id)).length} طالب مقيد</div>
        </div>
    `).join('');

    container.innerHTML = html;
}

function enterGroup(groupId) {
    localStorage.setItem('edu_active_group', groupId);
    currentGroupId = groupId;

    syncUIWithContext();

    document.getElementById('grade-selection-overlay').style.display = 'none';
    document.getElementById('group-selection-overlay').style.display = 'none';

    showSection('dashboard');
    const groupObj = db.groups.find(g => g.id == groupId);
    const label = (gradesList.find(g => g.id == currentGrade) || {}).name || '';
    showNotification(`تم الدخول إلى: ${label} (${groupObj ? groupObj.name : ''})`);

    // Initial data refresh for the selected context
    updateDashboardStats();
    updateExperienceSummary();
}

function showGradeSelection() {
    enterPortalMode();
}

function renderGradesList() {
    const container = document.getElementById('grades-container');
    if (!container) return;

    let html = `
        <div class="grade-card-modern fade-in" onclick="toggleModal('add-grade-modal', true)" style="--accent-color: var(--primary); border: 2px dashed rgba(255,255,255,0.2); background: rgba(255,255,255,0.05);">
            <div class="card-icon-modern" style="background: rgba(255,255,255,0.1);"><i class="fas fa-plus"></i></div>
            <h2>إضافة سنة جديدة</h2>
            <p>قم بتعريف مرحلة دراسية مخصصة</p>
            <div class="card-stats-modern">اضغط للإضافة</div>
        </div>
    `;

    html += gradesList.map((g, idx) => `
        <div class="grade-card-modern fade-in" onclick="selectGrade(${g.id})" style="--accent-color: hsl(${idx * 137.5}, 70%, 60%); border: 1px solid rgba(255,255,255,0.1); animation-delay: ${idx * 0.1}s">
            <div class="card-icon-modern"><i class="fas ${g.icon || 'fa-graduation-cap'}"></i></div>
            <h2>${g.name}</h2>
            <p>إدارة بيانات مستقلة لـ ${g.name}</p>
            <div class="card-stats-modern">اضغط للدخول</div>
            <button class="btn" style="position: absolute; top: 15px; left: 15px; color: rgba(255,255,255,0.2); background: transparent; padding: 5px;" onclick="event.stopPropagation(); deleteGrade(${g.id})">
                <i class="fas fa-trash"></i>
            </button>
        </div>
    `).join('');

    container.innerHTML = html;
}

function addNewGrade() {
    const nameInput = document.getElementById('new-grade-name');
    const name = nameInput.value.trim();
    if (!name) return showNotification('يرجى إدخال مسمى السنة', 'error');

    const newGrade = { id: Date.now(), name, icon: 'fa-graduation-cap' };
    gradesList.push(newGrade);
    window.gradesList = gradesList;
    saveGradesList();
    renderGradesList();

    // Refresh portal if open
    if (document.getElementById('portal-overlay').style.display !== 'none') {
        renderPortalGrades();
    }

    initGradeSelects();
    toggleModal('add-grade-modal', false);
    nameInput.value = '';
    showNotification(`تم إضافة ${name} بنجاح`);
}

async function deleteGrade(id) {
    if (!confirm('هل أنت متأكد من حذف هذه السنة الدراسية؟ سيتم مسح كافة بياناتها نهائياً!')) return;
    gradesList = gradesList.filter(g => g.id != id);
    window.gradesList = gradesList;
    saveGradesList();
    renderGradesList();
    // Clean localStorage
    const prefix = `g${id}_`;
    for (let i = localStorage.length - 1; i >= 0; i--) {
        const key = localStorage.key(i);
        if (key && key.startsWith(prefix)) localStorage.removeItem(key);
    }
    // Clean IndexedDB - remove students and groups for this grade
    try {
        const gradeStudents = db.students.filter(s => String(s.grade) === String(id));
        for (const s of gradeStudents) {
            await StorageEngine.delete('students', s.id);
        }
        const gradeGroups = db.groups.filter(g => String(g.grade) === String(id));
        for (const g of gradeGroups) {
            await StorageEngine.delete('groups', g.id);
        }
        db.students = db.students.filter(s => String(s.grade) !== String(id));
        db.groups = db.groups.filter(g => String(g.grade) !== String(id));
        showNotification(`تم حذف السنة الدراسية وكافة بياناتها بنجاح`, 'success');
    } catch (e) {
        console.error('Error cleaning grade data', e);
    }
    if (document.getElementById('portal-overlay').style.display !== 'none') {
        renderPortalGrades();
    }
}

// --- Global State ---
let activeHandoutId = null;
let html5QrCode = null;
let portalScanner = null;
let fastGradingScanner = null; // FIX: declared here to avoid undefined in stopAllCameraScanners
let activePortalGroupId = null; // Track which group is being scanned (Used for both Portal and Internal Joint sessions)
let activePortalGroupIds = []; // NEW: Track multiple groups for Joint Day
let jointSessionContext = null; // 'portal' or 'internal'
let activeGroupDetailId = null; // Track which group is being viewed in detail
let searchScanner = null;
let activeAbsenceSessionId = null; // Track current session in details view

// --- Student List Pagination State ---
let studentListPage = 0;
const studentListPageSize = 50;

// --- Lesson Coding Session State ---
let isLessonCodingActive = false;
let isLessonCodingPaused = false;
let currentSessionAttendance = [];
const waTemplates = JSON.parse(localStorage.getItem('edu_wa_templates')) || {
    welcome: "أهلاً بك يا *[[name]]*! 👋 تم تسجيل حضورك بنجاح. نقاطك الحالية: [[points]] 💎",
    absence: "نحيطكم علماً بغياب الطالب: *[[name]]* اليوم. يرجى المتابعة.",
    payment: "تم استلام اشتراك الشهر للطالب: *[[name]]*. شكراً لكم."
};

// --- 1. Global Navigation ---
function showSection(sectionId, btnEl) {
    // Password protection for sensitive financial sections
    if (sectionId === 'daily-treasury' || sectionId === 'payments' || sectionId === 'receipts') {
        const pass = prompt("يرجى إدخال كلمة المرور للوصول إلى الخزينة والمالية:");
        const correct = (db._settings.globalPasswords && db._settings.globalPasswords.finance) || '4321';
        if (pass !== correct) {
            showNotification('❌ كلمة مرور خاطئة! لا يمكن الدخول.', 'error');
            return;
        }
    }

    // STOP all background camera scanners when switching sections to avoid conflicts
    stopAllCameraScanners();

    const sections = [
        'dashboard-section', 'students-section', 'attendance-section',
        'absence-section', 'payments-section', 'analytics-section',
        'exams-section', 'fame-section', 'backup-section',
        'whatsapp-section', 'fast-grading-section', 'certificates-section',
        'groups-section', 'group-detail-section', 'idcards-section',
        'daily-treasury-section', 'shifts-section', 'settings-section',
        'platform-codes-section', 'receipts-section', 'platform-activation-section'
    ];
    sections.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = 'none';
    });

    const activeSection = document.getElementById(`${sectionId}-section`);
    if (activeSection) activeSection.style.display = 'block';

    if (btnEl) {
        document.querySelectorAll('.nav-link').forEach(link => link.classList.remove('active'));
        btnEl.classList.add('active');
    }

    const titles = {
        'dashboard': 'الرئيسية | ملخص اليوم', 'students': 'إدارة الطلاب',
        'attendance': 'الماسح الذكي', 'absence': 'متابعة الغياب اليومي',
        'exams': 'النتائج', 'groups': 'إدارة المجموعات',
        'certificates': 'الشهادات', 'hall': 'لوحة الشرف',
        'idcards': 'طباعة الأكواد', 'daily-treasury': 'الخزنة اليومية (عهدة السكرتارية)',
        'shifts': 'إدارة شفتات الموظفين', 'platform-codes': 'أكواد المنصة',
        'receipts': 'وصولات الدفع', 'platform-activation': 'تفعيل كورسات المنصة'
    };
    document.getElementById('page-title').innerText = titles[sectionId] || 'الأمين في اللغة العربية';

    if (sectionId === 'shifts') renderShifts();

    // Special initializers
    if (sectionId === 'attendance') {
        startQRScanner();
        renderQuickAttendance();
        const today = new Date().toISOString().split('T')[0];
        const datePicker = document.getElementById('history-date-picker');
        if (datePicker) datePicker.value = today;
        toggleAttendanceView('scanner'); // Default to scanner
        initHistoryGroups();
    }
    if (sectionId === 'students') { initFilters(); renderStudents(); }
    if (sectionId === 'exams') renderExams();
    if (sectionId === 'groups') renderGroups();
    if (sectionId === 'hall') { calculateHallOfFame(); renderHallOfFame(); }
    if (sectionId === 'absence') { initAbsenceManager(); initAbsenceGroupFilter(); generateAbsenceReport(); }
    if (sectionId === 'certificates') initCertificatesSection();
    if (sectionId === 'payments') { renderFinances(); renderMonthlySubscriptionTables(); }
    if (sectionId === 'receipts') { initReceiptsSection(); }

    if (sectionId === 'make-exam') initMakeExamSection();
    if (sectionId === 'fast-grading') initFastGrading();
    if (sectionId === 'idcards') initIDCardsSection();
    if (sectionId === 'platform-codes') initPlatformCodesSection();
    if (sectionId === 'platform-activation') {
        if (typeof initPlatformActivationSection === 'function') initPlatformActivationSection();
    }
    if (sectionId === 'whatsapp') renderWABot();
    if (sectionId === 'daily-treasury') renderDailyTreasury();
    if (sectionId === 'settings') renderProgramSettings();

    updateDashboardStats();
    updateExperienceSummary();
}

function stopAllCameraScanners() {
    [html5QrCode, examScanner, searchScanner, portalScanner, fastGradingScanner].forEach(s => {
        if (s) {
            try {
                // Robust stop: Check state or just try to stop
                const state = s.getState ? s.getState() : (s.isScanning ? 2 : 0);
                if (state > 1 || s.isScanning) {
                    s.stop().catch(() => { });
                }
            } catch (e) { }
        }
    });
}

let currentExamMode = null;
let questionCount = 0;

function initMakeExamSection() {
    // Placeholder for future exam builder - delegates to renderExams for now
    if (typeof renderExams === 'function') renderExams();
}

function initFollowupSection() {
    const examSelect = document.getElementById('followup-exam-select');
    const groupSelect = document.getElementById('followup-group-select');
    if (!examSelect || !groupSelect) return;

    // Exams of current grade (either specific to current group or general grade-wide exams)
    const exams = db.exams.filter(e =>
        String(e.grade) === String(currentGrade) &&
        (!e.groupId || String(e.groupId) === String(currentGroupId))
    );
    examSelect.innerHTML = '<option value="">-- اختر الامتحان --</option>' +
        exams.map(e => `<option value="${e.id}">${e.title}</option>`).join('');

    // Groups of current grade
    const groups = db.groups.filter(g => g.grade == currentGrade);
    groupSelect.innerHTML = groups.map(g => `<option value="${g.id}" ${String(g.id) === String(currentGroupId) ? 'selected' : ''}>${g.name}</option>`).join('');
}

function initAbsenceManager() {
    if (typeof generateAbsenceReport === 'function') {
        generateAbsenceReport();
    }
}

function renderFollowupList() {
    const examId = document.getElementById('followup-exam-select').value;
    const groupId = document.getElementById('followup-group-select').value;
    const list = document.getElementById('followup-list');

    if (!examId || !groupId) {
        list.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:2rem; color:var(--text-muted);">يرجى اختيار الامتحان والمجموعة للمتابعة</td></tr>';
        return;
    }

    const students = db.students.filter(s => s.groupId == groupId);
    // Already marked scores for this exam
    const existingScores = db.scores.filter(sc => sc.examId == examId);

    list.innerHTML = students.map(s => {
        const isAttended = existingScores.some(sc => sc.studentId == s.id);
        return `
            <tr class="fade-in">
                <td><strong>${s.name}</strong></td>
                <td><code style="background:var(--bg-light); padding:0.2rem 0.5rem; border-radius:4px;">${s.qrCode}</code></td>
                <td style="text-align:center;">
                    <label class="switch">
                        <input type="checkbox" class="attendance-check" data-student-id="${s.id}" ${isAttended ? 'checked' : ''}>
                        <span class="slider round"></span>
                    </label>
                    <span style="display:inline-block; width:60px; font-weight:700; color:${isAttended ? 'var(--accent)' : 'var(--danger)'}">
                        ${isAttended ? 'حاضر' : 'غائب'}
                    </span>
                </td>
                <td><input type="text" class="form-input followup-note" style="margin-bottom:0; font-size:0.8rem;" placeholder="مثلاً: بعذر"></td>
            </tr>
        `;
    }).join('') || '<tr><td colspan="4">لا يوجد طلاب في هذه المجموعة</td></tr>';

    // Add CSS for the switch if not exists
    if (!document.getElementById('switch-styles')) {
        const style = document.createElement('style');
        style.id = 'switch-styles';
        style.innerHTML = `
            .switch { position: relative; display: inline-block; width: 45px; height: 24px; vertical-align: middle; margin-left: 10px; }
            .switch input { opacity: 0; width: 0; height: 0; }
            .slider { position: absolute; cursor: pointer; inset: 0; background-color: #ccc; transition: .4s; border-radius: 34px; }
            .slider:before { position: absolute; content: ""; height: 18px; width: 18px; left: 3px; bottom: 3px; background-color: white; transition: .4s; border-radius: 50%; }
            input:checked + .slider { background-color: var(--accent); }
            input:checked + .slider:before { transform: translateX(21px); }
        `;
        document.head.appendChild(style);
    }
}

function saveExamAttendance() {
    const examId = document.getElementById('followup-exam-select').value;
    if (!examId) return showNotification('يرجى اختيار الامتحان', 'error');

    const rows = document.querySelectorAll('#followup-list tr');
    let markedCount = 0;

    rows.forEach(row => {
        const check = row.querySelector('.attendance-check');
        if (!check) return;

        const studentId = parseInt(check.dataset.studentId);
        const isAttended = check.checked;

        if (!isAttended) {
            db.scores = db.scores.filter(sc => !(sc.studentId == studentId && sc.examId == examId));
        } else {
            const exists = db.scores.some(sc => sc.studentId == studentId && sc.examId == examId);
            if (!exists) {
                db.scores.push({
                    id: Date.now() + Math.random(),
                    studentId: studentId,
                    examId: parseInt(examId),
                    mark: null, // null means "attended but not yet graded"
                    date: new Date().toISOString()
                });
            }
        }
        markedCount++;
    });

    db.save();
    showNotification('تم تحديث سجل حضور الامتحان بنجاح ✅');
    renderFollowupList();
}


function toggleExamScanner() {
    const container = document.getElementById('exam-scan-container');
    if (container.style.display === 'none') {
        container.style.display = 'block';
        startExamScanner();
    } else {
        stopExamScanner();
    }
}

function startExamScanner() {
    const examId = document.getElementById('followup-exam-select').value;
    if (!examId) {
        showNotification('يرجى اختيار الامتحان أولاً', 'error');
        return;
    }

    if (!examScanner) {
        examScanner = new Html5Qrcode("exam-reader");
    }

    examScanner.start({ facingMode: "environment" }, { fps: 10, qrbox: 250 },
        (decodedText) => {
            handleExamAttendanceScan(decodedText);
            const reader = document.getElementById('exam-reader');
            reader.style.borderColor = 'var(--accent)';
            setTimeout(() => reader.style.borderColor = 'var(--primary)', 500);
        }
    ).catch(err => showNotification('فشل تشغيل الكاميرا', 'error'));
}

function stopExamScanner() {
    if (examScanner) {
        examScanner.stop().then(() => {
            document.getElementById('exam-scan-container').style.display = 'none';
        });
    } else {
        document.getElementById('exam-scan-container').style.display = 'none';
    }
}

function handleExamAttendanceScan(code) {
    const examId = document.getElementById('followup-exam-select').value;
    const student = db.students.find(s => s.qrCode === code);

    if (!student) return showNotification('طالب غير مسجل!', 'error');

    // --- STRICT CONTEXT CHECK ---
    if (String(student.grade) !== String(currentGrade)) {
        return showNotification('هذا الطالب غير مسجل في هذه السنة الدراسية', 'error');
    }

    const targetGroupId = document.getElementById('followup-group-select').value;
    if (String(student.groupId) !== String(targetGroupId)) {
        const studentGroupObj = db.groups.find(g => g.id == student.groupId);
        playSound('error');
        return showNotification(`🛑 خطأ: الطالب ${student.name} مقيد في مجموعة (${studentGroupObj ? studentGroupObj.name : 'أخرى'}). يرجى التبديل للمجموعة الصحيحة.`, 'error');
    }

    const exists = db.scores.some(sc => sc.studentId == student.id && sc.examId == examId);
    if (!exists) {
        db.scores.push({
            id: Date.now(),
            studentId: student.id,
            examId: parseInt(examId),
            mark: null,
            date: new Date().toISOString()
        });
        db.save();
        renderFollowupList();
        showNotification(`تم تسجيل حضور: ${student.name}`, 'success');
    } else {
        showNotification('تم تسجيل هذا الطالب مسبقاً', 'warning');
    }
}

function initAbsenceGroupFilter() {
    const select = document.getElementById('absence-group-filter');
    if (select) {
        const groups = db.groups.filter(g => g.grade == currentGrade);
        select.innerHTML = groups.map(g => `<option value="${g.id}" ${String(g.id) === String(currentGroupId) ? 'selected' : ''}>${g.name}</option>`).join('');
    }
}

// --- Helper to check for existing parents during registration ---
function checkParentPhone(phone) {
    const results = document.getElementById('std-parent-results');
    if (!results) return;
    if (!phone || phone.length < 4) {
        results.innerHTML = '';
        return;
    }
    const matches = db.students.filter(s =>
        (s.parentPhone && s.parentPhone.includes(phone)) ||
        (s.phone && s.phone.includes(phone))
    );
    if (matches.length > 0) {
        results.innerHTML = matches.map(s => `<div style="padding:4px 8px; background:#f0fdf4; border:1px solid #bbf7d0; border-radius:4px; margin-bottom:2px; color:#166534">
            <i class="fas fa-user-friends"></i> مَسجل: <b>${s.name}</b> (${s.phone || 'بدون هاتف'})
        </div>`).join('');
    } else {
        results.innerHTML = '';
    }
}

function initFilters() {
    initStudentGroups(); // Populate Student Modal
    const filter = document.getElementById('filter-group');
    if (filter) {
        const groups = db.groups.filter(g => String(g.grade) === String(currentGrade));
        filter.innerHTML = '<option value="all">كل المجموعات (الكل)</option>' +
            groups.map(g => `<option value="${g.id}" ${String(g.id) === String(currentGroupId) ? 'selected' : ''}>${g.name}</option>`).join('');
    }
}

// --- 2. Students & Groups Logic ---
async function handleStudentSubmit() {
    const submitBtn = document.querySelector('#student-modal button[onclick="handleStudentSubmit()"]');
    try {
        const name = document.getElementById('std-name').value.trim();
        const phone = document.getElementById('std-phone').value.trim();
        const groupId = document.getElementById('std-group').value;
        const parent = document.getElementById('std-parent').value.trim();

        if (!name || !phone || !parent || !groupId) {
            return showNotification('يرجى تعبئة كافة البيانات بما فيها المجموعة', 'error');
        }

        const group = db.groups.find(g => String(g.id) === String(groupId));
        const targetGrade = currentGrade || group?.grade;
        if (!targetGrade) {
            return showNotification('يرجى اختيار المرحلة الدراسية أولاً', 'error');
        }

        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري الحفظ...';
        }

        if (!StorageEngine.db) await StorageEngine.init();

        const baseTime = Date.now().toString().slice(-8);
        const randNum = Math.floor(Math.random() * 900 + 100).toString();
        const uniqueCode = '1' + baseTime + randNum;

        const student = {
            id: Date.now(), name, phone, grade: targetGrade, groupId, parentPhone: parent,
            qrCode: uniqueCode,
            balance: 0, points: 0, joinDate: new Date().toISOString()
        };

        db.students.push(student);
        await StorageEngine.save('students', student);

        studentListPage = 0;
        renderStudents();

        const attendanceSection = document.getElementById('attendance-section');
        if (attendanceSection && attendanceSection.style.display === 'block') {
            if (!db.settings.isMonthlyActive) {
                showNotification('تنبيه: تم إضافة الطالب لكن لم يتم تسجيل حضوره لعدم تفعيل الاشتراك من الخزينة', 'warning');
            } else {
                currentSessionAttendance.unshift({ ...student, scanTime: new Date().toISOString() });
                renderSessionTable();
                const att = {
                    id: Date.now() + 5,
                    studentId: student.id,
                    groupId,
                    date: new Date().toISOString(),
                    status: 'present'
                };
                db.attendance.push(att);
                await StorageEngine.save('attendance', att);
            }
        }

        document.getElementById('std-name').value = '';
        document.getElementById('std-phone').value = '';
        document.getElementById('std-parent').value = '';
        document.getElementById('std-group').value = '';

        toggleModal('student-modal', false);
        showNotification('تم إضافة الطالب بنجاح');
    } catch (err) {
        console.error('Student save failed', err);
        showNotification('حدث خطأ أثناء حفظ الطالب: ' + (err.message || err), 'error');
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = 'حفظ البيانات';
        }
    }
}

async function renderStudents() {
    const list = document.getElementById('students-list');
    const searchTerm = document.getElementById('student-search-input')?.value.toLowerCase() || '';
    const groupFilter = document.getElementById('filter-group');

    // NOTE: Do NOT modify currentGroupId here - only read it
    // The group filter only affects the display, not the global context
    const selectedGroupId = (groupFilter && groupFilter.value && groupFilter.value !== 'all')
        ? groupFilter.value
        : (currentGroupId || 'all');

    if (!list) return;

    // Use IndexedDB paged loading for performance with 1,000,000 students
    const filter = { grade: currentGrade };
    if (selectedGroupId && selectedGroupId !== 'all') filter.groupId = selectedGroupId;

    let studentsToRender = [];
    let hasMore = false;

    const paged = await StorageEngine.getPaged('students', filter, studentListPage, studentListPageSize, searchTerm);
    studentsToRender = paged.data;
    hasMore = paged.hasMore;

    studentsToRender.sort((a, b) => a.name.localeCompare(b.name, 'ar'));

    const groups = {};
    studentsToRender.forEach(s => {
        const groupObj = db.groups.find(g => g.id == s.groupId);
        const groupName = groupObj ? `${groupObj.name} (${groupObj.time})` : 'بدون مجموعة مخصصة';
        if (!groups[groupName]) groups[groupName] = [];
        groups[groupName].push(s);
    });

    if (studentsToRender.length === 0 && studentListPage === 0) {
        list.innerHTML = '<tr><td colspan="6" style="text-align:center; padding: 3rem; color: var(--text-muted);">لا يوجد طلاب مقيدين في هذا القسم حالياً</td></tr>';
        return;
    }

    let html = '';
    Object.keys(groups).forEach(groupName => {
        html += `
        <tr style="background: rgba(79, 70, 229, 0.05);">
            <td colspan="6" style="padding: 1rem; border-right: 4px solid var(--primary);">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <strong style="color: var(--primary); font-size: 1.1rem;"><i class="fas fa-users"></i> ${groupName}</strong>
                    <span class="status-badge" style="background: var(--primary); color:white;">${groups[groupName].length} طالب</span>
                </div>
            </td>
        </tr>`;

        html += groups[groupName].map(s => `
        <tr class="fade-in">
            <td style="padding-right: 2rem;"><strong>${s.name}</strong></td>
            <td>${s.phone}</td>
            <td>${s.parentPhone}</td>
            <td>${s.joinDate ? new Date(s.joinDate).toLocaleDateString('ar-EG') : '---'}</td>
            <td><span style="color:var(--primary); font-weight:bold;">${s.points} 💎</span></td>
            <td>
                <div style="display:flex; gap:5px;">
                    <button class="btn" title="طباعة الكارت" style="padding:5px 10px; background:var(--primary); color:white;" onclick="generatePrintCard(${s.id})"><i class="fas fa-barcode"></i></button>
                    <button class="btn" title="تقرير شامل" style="padding:5px 10px; background:#3b82f6; color:white;" onclick="generateMonthlyReport(${s.id})"><i class="fas fa-file-invoice"></i></button>
                    <button class="btn" title="الملف الشخصي" style="padding:5px 10px;" onclick="viewDetailedProfile(${s.id})"><i class="fas fa-user-graduate"></i></button>
                    <button class="btn" title="تعديل" style="padding:5px 10px; background:var(--accent); color:white;" onclick="editStudent(${s.id})"><i class="fas fa-edit"></i></button>
                    <button class="btn" title="حذف" style="padding:5px 10px; color:var(--danger);" onclick="deleteStudent(${s.id})"><i class="fas fa-trash"></i></button>
                </div>
            </td>
        </tr>`).join('');
    });

    if (studentListPage === 0) {
        list.innerHTML = html;
    } else {
        list.innerHTML += html;
    }

    // Load More Button Logic
    let loadMoreContainer = document.getElementById('student-load-more-container');
    if (!loadMoreContainer) {
        loadMoreContainer = document.createElement('div');
        loadMoreContainer.id = 'student-load-more-container';
        loadMoreContainer.style = 'text-align: center; padding: 1rem;';
        list.parentNode.parentNode.appendChild(loadMoreContainer);
    }

    if (hasMore) {
        loadMoreContainer.innerHTML = `
            <button class="btn" style="background: var(--bg-light); color: var(--primary); border: 1px solid var(--primary); font-weight: bold;" onclick="studentListPage++; renderStudents();">
                <i class="fas fa-chevron-down"></i> عرض المزيد من الطلاب...
            </button>`;
    } else {
        loadMoreContainer.innerHTML = '<p style="color: var(--text-muted); font-size: 0.8rem;">نهاية القائمة</p>';
    }
}

function handleAddGroup() {
    const name = document.getElementById('group-name').value;
    const time = document.getElementById('group-time').value;
    if (!name || !time) return showNotification('يرجى ملء كافة البيانات', 'error');

    // Create group
    const newGroup = { id: Date.now(), name, time, grade: currentGrade };
    db.groups.push(newGroup);
    db.save();

    // UI Updates
    renderGroups();

    // Refresh portal/overlays if open
    if (document.getElementById('group-selection-overlay').style.display !== 'none') {
        renderGroupSelection(currentGrade);
    }
    if (document.getElementById('portal-overlay').style.display !== 'none') {
        renderPortalGroups(currentGrade);
    }

    refreshGroupContexts(); // Update all dropdowns

    // Force close modal
    const modal = document.getElementById('group-modal');
    if (modal) modal.style.display = 'none';

    // Reset inputs
    document.getElementById('group-name').value = '';
    document.getElementById('group-time').value = '';

    showNotification('✅ تم إضافة المجموعة بنجاح');
}

function refreshGroupContexts() {
    // Refresh all places that show group dropdowns
    if (typeof initHistoryGroups === 'function') initHistoryGroups();
    if (typeof initFilters === 'function') initFilters();
    if (typeof initIDCardsSection === 'function') initIDCardsSection();

    if (typeof initFollowupSection === 'function') initFollowupSection();
    if (typeof initFastGrading === 'function') initFastGrading();
    if (typeof initStudentGroups === 'function') initStudentGroups();
    if (typeof initAbsenceGroupFilter === 'function') initAbsenceGroupFilter();

    // Also update portal group select
    const portalSelect = document.getElementById('portal-group-select');
    if (portalSelect) {
        const gradeGroups = db.groups.filter(g => g.grade == currentGrade);
        portalSelect.innerHTML = gradeGroups.map(g => `<option value="${g.id}">${g.name} (${g.time})</option>`).join('') || '<option value="">لا يوجد مجموعات في هذا الصف</option>';
    }
    initGradeSelects();
    if (typeof initCertificatesSection === 'function') initCertificatesSection();
}

function initGradeSelects() {
    const selects = ['std-grade']; // Add more IDs if needed
    const html = gradesList.map(g => `<option value="${g.id}">${g.name}</option>`).join('');
    selects.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.innerHTML = html;
    });
}

function renderGroups() {
    const list = document.getElementById('groups-list');
    if (!list) return;
    const groups = db.groups.filter(g => g.grade == currentGrade);
    list.innerHTML = groups.map(g => `
        <tr>
            <td><strong>${g.name}</strong></td>
            <td>${g.time}</td>
            <td><span class="badge" style="background:var(--primary); color:white">${db.students.filter(s => s.groupId == g.id).length} طالب</span></td>
            <td>
                <div style="display:flex; gap:10px;">
                    <button class="btn btn-primary" style="padding: 5px 15px; background: var(--accent);" onclick="viewGroupDetails(${g.id})">
                        <i class="fas fa-eye"></i> عرض المجموعة
                    </button>
                    <button class="btn" style="color:var(--danger)" onclick="deleteGroup(${g.id})">
                        <i class="fas fa-trash"></i>
                    </button>

                </div>
            </td>
        </tr>`).join('') || '<tr><td colspan="4" style="text-align:center">لا يوجد مجموعات حالياً في هذا الصف</td></tr>';
}

function viewGroupDetails(groupId) {
    const group = db.groups.find(g => g.id == groupId);
    if (!group) return;

    activeGroupDetailId = groupId;
    showSection('group-detail');

    document.getElementById('active-group-detail-title').innerText = group.name;
    renderGroupStudents();
    updateGroupDetailStats(groupId);
}

function renderGroupStudents() {
    const list = document.getElementById('active-group-students-list');
    const searchQuery = document.getElementById('group-student-search')?.value.toLowerCase() || '';
    if (!list || !activeGroupDetailId) return;

    let students = db.students.filter(s => s.groupId == activeGroupDetailId);

    if (searchQuery) {
        students = students.filter(s =>
            s.name.toLowerCase().includes(searchQuery) ||
            s.qrCode.toLowerCase().includes(searchQuery)
        );
    }

    list.innerHTML = students.map(s => `
        <tr>
            <td>
                <div style="display:flex; align-items:center; gap:10px;">
                    <div class="avatar" style="width:35px; height:35px; font-size:0.8rem;">${s.name.charAt(0)}</div>
                    <div>
                        <div style="font-weight:700;">${s.name}</div>
                        <div style="font-size:0.75rem; color:var(--text-muted);">${s.qrCode}</div>
                    </div>
                </div>
            </td>
            <td>${s.phone || '---'}</td>
            <td><span style="color:var(--warning); font-weight:700;"><i class="fas fa-star"></i> ${s.points || 0}</span></td>
            <td>
                <div style="display:flex; gap:8px;">
                    <button class="btn" style="padding:4px 8px; font-size:0.8rem;" onclick="viewDetailedProfile(${s.id})"><i class="fas fa-user"></i></button>
                    <button class="btn" style="padding:4px 8px; font-size:0.8rem; color:var(--danger);" onclick="removeStudentFromGroup(${s.id})"><i class="fas fa-user-minus"></i></button>
                </div>
            </td>
        </tr>
    `).join('') || '<tr><td colspan="4" style="text-align:center; padding:2rem; color:var(--text-muted);">لا يوجد طلاب في هذه المجموعة حالياً</td></tr>';
}

function updateGroupDetailStats(groupId) {
    const today = new Date().toISOString().split('T')[0];
    const presentCount = db.attendance.filter(a => a.groupId == groupId && a.date === today).length;

    document.getElementById('active-group-present-today').innerText = presentCount;

    const recentActivity = db.attendance
        .filter(a => a.groupId == groupId && a.date === today)
        .reverse()
        .slice(0, 10);

    const activityList = document.getElementById('active-group-recent-activity');
    if (activityList) {
        activityList.innerHTML = recentActivity.map(a => {
            const student = db.students.find(s => s.id == a.studentId);
            return `
                <div style="display:flex; justify-content:space-between; align-items:center; padding:10px; border-bottom:1px solid #f1f5f9;">
                    <span style="font-weight:600; font-size:0.9rem;">${student ? student.name : 'طالب محذوف'}</span>
                    <span style="font-size:0.8rem; color:var(--accent); font-weight:700;">${a.time}</span>
                </div>
            `;
        }).join('') || '<p style="text-align:center; padding:1rem; color:var(--text-muted); font-size:0.9rem;">لا يوجد حضور مسجل اليوم حتى الآن</p>';
    }
}

function openAddStudentForGroup() {
    // تنظيف النموذج قبل الفتح
    document.getElementById('std-name').value = '';
    document.getElementById('std-phone').value = '';
    document.getElementById('std-parent').value = '';
    
    // تعيين المجموعة الحالية (من صفحة التفاصيل) تلقائياً
    const groupSelect = document.getElementById('std-group');
    if (groupSelect && activeGroupDetailId) {
        groupSelect.value = activeGroupDetailId;
    } else if (groupSelect && currentGroupId) {
        groupSelect.value = currentGroupId;
    } else if (groupSelect) {
        groupSelect.value = '';
    }

    toggleModal('student-modal', true);
}

function openAddStudentModal() {
    // تنظيف النموذج قبل الفتح
    document.getElementById('std-name').value = '';
    document.getElementById('std-phone').value = '';
    document.getElementById('std-parent').value = '';
    
    // تعيين المجموعة الحالية تلقائياً
    const groupSelect = document.getElementById('std-group');
    if (groupSelect && currentGroupId) {
        groupSelect.value = currentGroupId;
    } else if (groupSelect) {
        groupSelect.value = '';
    }

    toggleModal('student-modal', true);
}

function openGroupScanner() {
    showSection('attendance');
    // We could potentially auto-select the group in the scanner, but let's just go there for now
}

async function removeStudentFromGroup(studentId) {
    if (!confirm('هل أنت متأكد من رغبتك في إزالة الطالب من هذه المجموعة؟')) return;
    const student = db.students.find(s => s.id == studentId);
    if (student) {
        student.groupId = null;
        await StorageEngine.save('students', student);
        await db.save('students');
        renderGroupStudents();
        renderGroups();
        showNotification('تم إزالة الطالب من المجموعة بنجاح');
    }
}

async function deleteGroup(id) {
    if (!confirm('سيتم حذف المجموعة نهائياً. هل أنت متأكد من الاستمرار؟')) return;
    db.groups = db.groups.filter(g => g.id != id);
    await StorageEngine.delete('groups', id);
    await db.save('groups');
    renderGroups();
    refreshGroupContexts(); // Update all dropdowns
}


function initStudentGroups() {
    const select = document.getElementById('std-group');
    if (!select) return;
    const groups = db.groups.filter(g => g.grade == currentGrade);
    select.innerHTML = '<option value="">-- اختر المجموعة --</option>' +
        groups.map(g => `<option value="${g.id}" ${g.id == currentGroupId ? 'selected' : ''}>${g.name} (${g.time})</option>`).join('');
}

// --- 3. Hall of Fame & Shop ---
function calculateHallOfFame() {
    const studentsWithPoints = db.students.filter(s => String(s.grade) === String(currentGrade)).map(s => {
        const attCount = db.attendance.filter(a => a.studentId == s.id).length;
        const scoreTotal = db.scores.filter(sc => sc.studentId == s.id).reduce((sum, m) => sum + m.mark, 0);
        return { ...s, totalScore: (attCount * 50) + (scoreTotal * 10) };
    }).sort((a, b) => b.totalScore - a.totalScore);

    const podium = document.getElementById('fame-podium');
    if (!podium) return;

    const top3 = studentsWithPoints.slice(0, 3);
    podium.innerHTML = '';

    const displayOrder = [top3[1], top3[0], top3[2]];

    displayOrder.forEach((s, idx) => {
        if (!s) return;
        const rank = idx === 0 ? 2 : (idx === 1 ? 1 : 3);
        podium.innerHTML += `
            <div class="podium-item">
                ${rank === 1 ? '<div class="crown">👑</div>' : ''}
                <div class="podium-rank-${rank}">
                    <div style="padding-top:20px; font-weight:bold; color:#1e293b; font-size:1.2rem;">#${rank}</div>
                </div>
                <div class="podium-name">${s.name}</div>
            </div>
        `;
    });

    const list = document.getElementById('fame-list');
    list.innerHTML = studentsWithPoints.slice(3, 10).map((s, i) => `
        <tr>
            <td>#${i + 4}</td>
            <td>${s.name}</td>
            <td>${s.totalScore}</td>
            <td><span class="status-badge" style="background:#fef3c7; color:#92400e">طالب متميز</span></td>
        </tr>
    `).join('');
}

function handleAddReward() {
    const title = document.getElementById('rew-title').value;
    const cost = parseInt(document.getElementById('rew-cost').value);
    if (!title || !cost) return;
    db.rewards.push({ id: Date.now(), title, cost });
    db.save();
    renderShop();
    toggleModal('reward-modal', false);
}

function renderShop() {
    const grid = document.getElementById('shop-grid');
    grid.innerHTML = db.rewards.map(r => `
        <div class="card shop-card fade-in">
            <div class="points-tag">${r.cost} نقطة</div>
            <h3>${r.title}</h3>
            <p style="color:var(--text-muted); margin:1rem 0;">استبدل نقاطك بهذا العرض الرائع</p>
            <button class="btn btn-primary" style="width:100%;" onclick="redeemReward(${r.id})">استبدال الآن</button>
        </div>
    `).join('') || '<p>لا توجد عروض حالياً</p>';
}

function redeemReward(rewardId) {
    const reward = db.rewards.find(r => r.id === rewardId);
    const studentName = prompt("أدخل اسم الطالب الذي سيتم الخصم منه:");
    const student = db.students.find(s => s.name === studentName && String(s.grade) === String(currentGrade));

    if (student && student.points >= reward.cost) {
        student.points -= reward.cost;
        db.save();
        showNotification(`تم الاستبدال بنجاح لـ ${student.name}`);
        renderShop();
    } else {
        showNotification('النقاط غير كافية أو الطالب غير موجود', 'error');
    }
}

// --- 4. Absence & Portal & Camera ---
function generateAbsenceReport() {
    const absenceList = document.getElementById('absence-list');
    const presentList = document.getElementById('absence-present-list');
    const filterGroup = document.getElementById('absence-group-filter');
    if (!absenceList || !presentList) return;

    const today = new Date().toLocaleDateString('en-CA');
    const selectedGroupValue = filterGroup ? filterGroup.value : currentGroupId;

    // 1. Get expected students strictly for the active group
    const expectedStudents = db.students.filter(s =>
        String(s.grade) === String(currentGrade) &&
        String(s.groupId) === String(selectedGroupValue)
    );

    // 2. Identify attendance records for today in this context
    const dailyAttendance = db.attendance.filter(a => {
        const aDate = new Date(a.date).toLocaleDateString('en-CA');
        return aDate === today;
    });

    // We look at all students who have a 'present' record today in this grade/group
    const presentIds = dailyAttendance.filter(a => a.status === 'present').map(a => a.studentId);

    const presentStudents = expectedStudents.filter(s => presentIds.includes(s.id));
    const absentees = expectedStudents.filter(s => !presentIds.includes(s.id));

    // 3. Render Present List
    presentList.innerHTML = presentStudents.map(s => {
        const att = dailyAttendance.find(a => a.studentId == s.id && a.status === 'present');
        return `
            <tr>
                <td><strong>${s.name}</strong></td>
                <td>${att ? new Date(att.date).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }) : '---'}</td>
                <td style="display:flex; justify-content:space-between; align-items:center;">
                    <span class="status-badge" style="background:#dcfce7; color:#166534">حاضر ✅</span>
                    <button class="btn" style="color:var(--danger); padding:2px 8px; font-size:0.7rem;" onclick="removeStudentFromPresentToday(${s.id})">
                        <i class="fas fa-trash"></i> حذف
                    </button>
                </td>
            </tr>
        `;
    }).join('') || '<tr><td colspan="3" style="text-align:center; padding:2rem;">لا يوجد حضور مسجل لهذه المجموعة اليوم</td></tr>';

    // 4. Render Absence List
    absenceList.innerHTML = absentees.map(s => {
        const group = db.groups.find(g => g.id == s.groupId);
        const isExplicitAbsent = dailyAttendance.some(a => a.studentId == s.id && a.status === 'absent');

        return `
            <tr>
                <td><strong>${s.name}</strong></td>
                <td>${group ? group.name : '---'}</td>
                <td>
                    <span class="status-badge" style="background:${isExplicitAbsent ? '#fee2e2' : '#fff7ed'}; color:${isExplicitAbsent ? '#991b1b' : '#c2410c'}">
                        ${isExplicitAbsent ? 'غائب (مؤكد)' : 'لم يحضر بعد'}
                    </span>
                </td>
                <td style="display:flex; gap:10px;">
                    <button class="btn btn-primary" style="padding:5px 15px; background:var(--accent);" onclick="sendAbsenceWhatsApp(${s.id})">
                        <i class="fab fa-whatsapp"></i> تذكير
                    </button>
                    ${!isExplicitAbsent ? `
                    <button class="btn" style="background:#f1f5f9; color:var(--danger);" onclick="markStudentAbsentToday(${s.id})">
                        <i class="fas fa-user-times"></i> تسجيل غياب
                    </button>` : ''}
                </td>
            </tr>
        `;
    }).join('') || '<tr><td colspan="4" style="text-align:center; padding:2rem; color:var(--accent);">تم تسجيل حضور جميع طلاب هذه المجموعة! 🎉</td></tr>';
}

function removeStudentFromPresentToday(studentId) {
    if (!confirm('هل تريد حذف تسجيل حضور هذا الطالب لليوم؟ سيتم إعادته إلى قائمة الغياب.')) return;

    const todayStr = new Date().toLocaleDateString('en-CA');

    // 1. Remove from global attendance
    db.attendance = db.attendance.filter(a => !(
        a.studentId == studentId &&
        new Date(a.date).toLocaleDateString('en-CA') === todayStr &&
        a.status === 'present'
    ));

    // 2. Remove from active session staging
    currentSessionAttendance = currentSessionAttendance.filter(s => s.id !== studentId);
    db.currentSessionAttendance = currentSessionAttendance;

    db.save();

    // 3. Refresh UI
    generateAbsenceReport();
    renderSessionTable();
    showNotification('تم حذف تسجيل الحضور وإعادة الطالب للغياب');
}

function archiveAbsenceSession() {
    const filterGroup = document.getElementById('absence-group-filter');
    const selectedGroupId = filterGroup && filterGroup.value !== 'all' ? filterGroup.value : currentGroupId;

    const today = new Date().toLocaleDateString('ar-EG');
    const groupObj = db.groups.find(g => String(g.id) === String(selectedGroupId));

    // Auto-generate name based on date and group
    const defaultName = groupObj ? `جلسة ${groupObj.name} - ${today}` : `جلسة يوم ${today}`;
    const sessionName = prompt("أدخل اسماً لهذه الجلسة للرجوع إليها في الأرشيف:", defaultName);

    if (!sessionName) return;

    const expectedStudents = db.students.filter(s =>
        s.grade == currentGrade &&
        (selectedGroupId && selectedGroupId !== 'all' ? String(s.groupId) === String(selectedGroupId) : true)
    );

    const attendances = db.attendance.filter(a => {
        const aDate = new Date(a.date).toLocaleDateString('en-CA');
        return aDate === new Date().toLocaleDateString('en-CA');
    });

    // SYNCED LOGIC: Archive should match exactly what's in the currentSessionAttendance (top table)
    // and the students who are NOT in it from the expected list (bottom table).
    const presentIds = currentSessionAttendance.map(s => s.id);

    // Students from this group who ARE in the active session
    const presentStudents = expectedStudents.filter(s => presentIds.includes(s.id));

    // Students from this group who are NOT in the active session
    const absentStudents = expectedStudents.filter(s => !presentIds.includes(s.id));

    // --- NEW: Officially mark them as absent in db.attendance for records/reports ---
    absentStudents.forEach(s => {
        const alreadyRecorded = db.attendance.some(a =>
            a.studentId == s.id &&
            new Date(a.date).toLocaleDateString('en-CA') === new Date().toLocaleDateString('en-CA')
        );

        if (!alreadyRecorded) {
            db.attendance.push({
                id: Date.now() + Math.random(),
                studentId: s.id,
                groupId: s.groupId || selectedGroupId,
                date: new Date().toISOString(),
                status: 'absent'
            });
        }
    });

    // كل جلسة تُحفظ كإدخال مستقل — لا يوجد استبدال أو حذف للجلسات السابقة

    const session = {
        id: Date.now(),
        name: sessionName,
        date: new Date().toISOString(),
        grade: currentGrade,
        groupId: selectedGroupId === 'all' ? null : selectedGroupId,
        presentCount: presentStudents.length,
        absentCount: absentStudents.length,
        presentNames: presentStudents.map(s => s.name),
        absenteeNames: absentStudents.map(s => s.name),
        presentIds: presentStudents.map(s => s.id),
        absentIds: absentStudents.map(s => s.id)
    };

    if (!db.absenceSessions) db.absenceSessions = [];
    db.absenceSessions.push(session);
    db.save();

    showNotification('تم حفظ الجلسة في الأرشيف بنجاح وتسجيل غياب الطلاب المتغيبين ✅');
    generateAbsenceReport();
}

function viewAbsenceSessionDetails(id) {
    const session = db.absenceSessions.find(s => s.id === id);
    if (!session) return;
    activeAbsenceSessionId = id; // Store ID for printing

    document.getElementById('session-det-title').innerText = session.name;
    document.getElementById('session-det-info').innerHTML = `
        <span><strong>حاضر:</strong> ${session.presentCount}</span>
        <span><strong>غائب:</strong> ${session.absentCount}</span>
    `;

    document.getElementById('session-det-present').innerHTML = (session.presentNames || [])
        .map(name => `<div style="padding:5px; border-bottom:1px solid #eee;">${name}</div>`).join('') || 'لا يوجد حاضرين';

    document.getElementById('session-det-absent').innerHTML = (session.absenteeNames || [])
        .map(name => `<div style="padding:5px; border-bottom:1px solid #eee; color:var(--danger);">${name}</div>`).join('') || 'لا يوجد غائبين';

    toggleModal('session-details-modal', true);
}

function showAbsenceArchive() {
    const list = document.getElementById('absence-archive-list');
    if (!list) return;

    // --- عزل صارم: الأرشيف يُعرض فقط للمجموعة الحالية المحددة ---
    // لو لم يتم تحديد مجموعة بعد، اعرض رسالة توضيحية
    if (!currentGroupId || currentGroupId === 'all') {
        list.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:2rem; color:var(--text-muted);"><i class="fas fa-info-circle"></i> يرجى تحديد مجموعة أولاً لعرض أرشيفها الخاص</td></tr>';
        toggleModal('absence-archive-modal', true);
        return;
    }

    // فلتر صارم: المجموعة الحالية فقط
    const mySessions = (db.absenceSessions || []).filter(s =>
        String(s.grade) === String(currentGrade) &&
        String(s.groupId) === String(currentGroupId)
    ).reverse();

    const currentGroupObj = db.groups.find(g => String(g.id) === String(currentGroupId));
    const archiveTitle = document.getElementById('absence-archive-modal-title') || document.querySelector('#absence-archive-modal h3');
    if (archiveTitle) archiveTitle.innerText = `أرشيف الحضور والغياب - ${currentGroupObj ? currentGroupObj.name : ''}`;

    list.innerHTML = mySessions.map(s => {
        const group = db.groups.find(g => g.id == s.groupId);
        return `
            <tr>
                <td><strong>${s.name}</strong></td>
                <td>${new Date(s.date).toLocaleDateString('ar-EG')}</td>
                <td>${group ? group.name : 'الكل'}</td>
                <td><span style="color:var(--accent)">${s.presentCount} حاضر</span> / <span style="color:var(--danger)">${s.absentCount} غائب</span></td>
                <td>
                    <button class="btn btn-primary" style="padding:5px 10px;" onclick="viewAbsenceSessionDetails(${s.id})">
                        <i class="fas fa-eye"></i> التفاصيل
                    </button>
                    <button class="btn" style="color:var(--danger);" onclick="deleteAbsenceSession(${s.id})">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>
        `;
    }).join('') || `<tr><td colspan="5" style="text-align:center; padding:2rem; color:var(--text-muted);">لا يوجد جلسات مؤرشفة لهذه المجموعة بعد</td></tr>`;

    toggleModal('absence-archive-modal', true);
}

function deleteAbsenceSession(id) {
    if (!confirm('هل أنت متأكد من حذف هذا السجل من الأرشيف؟')) return;
    db.absenceSessions = db.absenceSessions.filter(s => s.id !== id);
    db.save();
    showAbsenceArchive();
}


function markStudentAbsentToday(studentId) {
    const s = db.students.find(x => x.id === studentId);
    db.attendance.push({
        id: Date.now(),
        studentId: studentId,
        groupId: s ? s.groupId : currentGroupId,
        date: new Date().toISOString(),
        status: 'absent'
    });
    db.save();
    generateAbsenceReport();
    showNotification('تم تسجيل الطالب غائب لليوم');
}

function sendAbsenceWhatsApp(id) {
    const s = db.students.find(x => x.id === id);
    if (!s) return;

    const message = `السلام عليكم ورحمة الله، والد الطالب ${s.name}، نحيط سيادتكم علماً بأن الطالب لم يحضر اليوم.`;
    const url = `https://wa.me/2${s.parentPhone}?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
    showNotification('تم فتح واتساب للإرسال المباشر');
}

function startSearchScanner() {
    toggleModal('search-scanner-modal', true);
    if (!searchScanner) searchScanner = new Html5Qrcode("search-reader");
    searchScanner.start(
        { facingMode: "environment" },
        { fps: 20, qrbox: { width: 300, height: 200 } },
        (decodedText) => {
            const input = document.getElementById('student-search-input');
            if (input) {
                input.value = decodedText;
                renderStudents();
                stopSearchScanner();
                showNotification('تم العثور على الطالب بنجاح ✅');

                // Highlight the student in the list if possible
                setTimeout(() => {
                    const rows = document.querySelectorAll('#students-list tr');
                    rows.forEach(row => {
                        if (row.innerText.includes(decodedText)) {
                            row.style.background = 'rgba(79, 70, 229, 0.2)';
                            row.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        }
                    });
                }, 500);
            }
        }
    ).catch(err => {
        console.error("Search scanner failed", err);
        showNotification('تعذر تشغيل الكاميرا', 'error');
    });
}

function stopSearchScanner() {
    if (searchScanner && searchScanner.isScanning) {
        searchScanner.stop().then(() => {
            toggleModal('search-scanner-modal', false);
        });
    } else {
        toggleModal('search-scanner-modal', false);
    }
}

function startQRScanner() {
    if (!html5QrCode) html5QrCode = new Html5Qrcode("reader");
    html5QrCode.start({ facingMode: "environment" }, { fps: 10, qrbox: 250 }, processScan)
        .catch(err => console.error("Scanner failed to start", err));
}

// --- NEW: Attendance History Functions ---
function toggleAttendanceView(view) {
    const scannerView = document.getElementById('attendance-scanner-view');
    const historyView = document.getElementById('attendance-history-view');
    const scannerBtn = document.getElementById('attendance-mode-btn');
    const historyBtn = document.getElementById('history-mode-btn');

    if (view === 'scanner') {
        scannerView.style.display = 'block';
        historyView.style.display = 'none';
        scannerBtn.style.background = 'var(--primary)';
        scannerBtn.style.color = 'white';
        historyBtn.style.background = 'var(--bg-white)';
        historyBtn.style.color = 'var(--text-main)';
        startQRScanner();
    } else {
        scannerView.style.display = 'none';
        historyView.style.display = 'block';
        scannerBtn.style.background = 'var(--bg-white)';
        scannerBtn.style.color = 'var(--text-main)';
        historyBtn.style.background = 'var(--primary)';
        historyBtn.style.color = 'white';
        if (html5QrCode) html5QrCode.stop().catch(() => { });
        renderHistoryByDate();
    }
}

function initHistoryGroups() {
    const select = document.getElementById('history-group-select');
    if (select) {
        const groups = db.groups.filter(g => g.grade == currentGrade);
        select.innerHTML = '<option value="all">كل المجموعات</option>' +
            groups.map(g => `<option value="${g.id}" ${String(g.id) === String(currentGroupId) ? 'selected' : ''}>${g.name}</option>`).join('');
    }
}

function renderHistoryByDate() {
    let targetDate = document.getElementById('history-date-picker').value;
    if (!targetDate) {
        targetDate = new Date().toISOString().split('T')[0];
        document.getElementById('history-date-picker').value = targetDate;
    }

    const groupSelect = document.getElementById('history-group-select');
    const selectedGroup = groupSelect ? groupSelect.value : 'all';
    const list = document.getElementById('history-attendance-list');
    if (!list) return;

    document.getElementById('history-title').innerText = `سجل حضور يوم ${new Date(targetDate).toLocaleDateString('ar-EG')}`;

    // Filter students strictly by Active Group context
    const targetStudents = db.students.filter(s => {
        if (s.grade != currentGrade) return false;
        if (selectedGroup === 'all') return true;
        return String(s.groupId) === String(selectedGroup);
    });

    const attendanceRecords = db.attendance.filter(a => {
        const aDate = new Date(a.date).toLocaleDateString('en-CA');
        return aDate === targetDate;
    });
    let presentCount = 0;
    let absentCount = 0;
    list.innerHTML = targetStudents.map(student => {
        const record = attendanceRecords.find(a => a.studentId == student.id && a.status === 'present');
        const groupObj = db.groups.find(g => g.id == student.groupId);

        if (record) presentCount++; else absentCount++;

        const dateObj = new Date(targetDate);
        const dayName = dateObj.toLocaleDateString('ar-EG', { weekday: 'long' });
        const dayFormatted = `${dayName} ${dateObj.getDate()}/${dateObj.getMonth() + 1}`;

        return `
            <tr>
                <td><strong>${student.name}</strong></td>
                <td>${groupObj ? groupObj.name : '---'}</td>
                <td>${record ? new Date(record.date).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }) : dayFormatted}</td>
                <td>
                    <span class="status-badge" style="background:${record ? '#dcfce7' : '#fee2e2'}; color:${record ? '#166534' : '#991b1b'}">
                        ${record ? 'حاضر ✅' : 'غائب ❌'}
                    </span>
                </td>
            </tr>
        `;
    }).join('') || `<tr><td colspan="4" style="text-align:center; padding:3rem; color:var(--text-muted);">
        <i class="fas fa-users-slash" style="font-size:3rem; display:block; margin-bottom:1rem; opacity:0.3;"></i>
        لا يوجد طلاب مقيدين في هذه المجموعة حالياً
    </td></tr>`;

    document.getElementById('history-present-count').innerText = presentCount;
    document.getElementById('history-absent-count').innerText = absentCount;
}

function printHistoryReport() {
    const targetDate = document.getElementById('history-date-picker').value;
    if (!targetDate) return;
    window.print();
}

function enterPortalMode() {
    document.getElementById('portal-overlay').style.display = 'block';
    document.getElementById('portal-setup-container').style.display = 'flex';
    document.getElementById('portal-scanner-container').style.display = 'none';
    showPortalStep('grade');
}

function showPortalStep(step, data) {
    const gradeStep = document.getElementById('portal-step-grade');
    const groupStep = document.getElementById('portal-step-group');
    const setupContainer = document.getElementById('portal-setup-container');
    const scannerContainer = document.getElementById('portal-scanner-container');

    setupContainer.style.display = 'flex';
    scannerContainer.style.display = 'none';

    if (step === 'grade') {
        gradeStep.style.display = 'block';
        groupStep.style.display = 'none';
        renderPortalGrades();
    } else {
        gradeStep.style.display = 'none';
        groupStep.style.display = 'block';
        if (data) {
            currentGrade = String(data);
            renderPortalGroups(data);
        }
    }
}

function renderPortalGrades() {
    const container = document.getElementById('portal-grades-list');
    if (!container) return;

    // Show years first
    let html = gradesList.map((g, idx) => `
        <div class="grade-card-modern shadow-hover fade-in" onclick="showPortalStep('group', '${g.id}')" style="--accent-color: hsl(${idx * 137.5}, 70%, 50%); background: #fff; color: var(--text-main); border: 1px solid #eee; height: 260px; width: 220px; cursor: pointer;">
            <div class="card-icon-modern"><i class="fas ${g.icon || 'fa-graduation-cap'}"></i></div>
            <h2 style="font-size: 1.5rem;">${g.name}</h2>
            <p style="font-size: 0.9rem;">إدارة بيانات ${g.name}</p>
            <div class="card-stats-modern">دخول البوابة</div>
        </div>
    `).join('');

    // Add Grade at the end
    html += `
        <div class="grade-card-modern fade-in" onclick="toggleModal('add-grade-modal', true)" style="--accent-color: var(--primary); border: 2px dashed rgba(0,0,0,0.1); background: #f8fafc; color: var(--text-main); height: 260px; width: 220px; cursor: pointer;">
            <div class="card-icon-modern" style="background: var(--bg-light); color: var(--primary);"><i class="fas fa-plus"></i></div>
            <h2 style="font-size: 1.4rem;">إضافة سنة جديدة</h2>
            <p style="font-size: 0.85rem;">تعريف مرحلة دراسية مخصصة</p>
            <div class="card-stats-modern" style="color: var(--primary);">اضغط للإضافة</div>
        </div>
    `;

    container.innerHTML = html;
}

function renderPortalGroups(gradeId) {
    const container = document.getElementById('portal-groups-list');
    if (!container) return;

    const gradeObj = gradesList.find(g => String(g.id) === String(gradeId));
    document.getElementById('portal-grade-title-active').innerText = gradeObj ? gradeObj.name : 'السنة الدراسية';

    const gradeGroups = db.groups.filter(g => String(g.grade) === String(gradeId));

    // Groups first
    let html = gradeGroups.map((group, idx) => `
        <div class="grade-card-modern shadow-hover fade-in" onclick="enterSystemFromPortal('${group.id}')" style="--accent-color: hsl(${200 + idx * 40}, 70%, 50%); background: #fff; color: var(--text-main); border: 1px solid #eee; height: 260px; width: 220px; cursor: pointer;">
            <div class="card-icon-modern"><i class="fas fa-users"></i></div>
            <h2 style="font-size: 1.5rem;">${group.name}</h2>
            <p style="font-size: 0.9rem;">الموعد: ${group.time}</p>
            
            <div style="display: flex; gap: 8px; margin-top: 15px; width: 100%; padding: 0 10px; box-sizing: border-box;">
                 <button class="btn" onclick="event.stopPropagation(); startPortalSession('${group.id}')" style="flex: 1; height: 40px; font-size: 0.8rem; border-radius: 8px; background: var(--bg-light); color: var(--accent); border: 1px solid var(--border);">
                    <i class="fas fa-qrcode"></i> نظام الماسح
                </button>
                <button class="btn btn-primary" onclick="event.stopPropagation(); enterSystemFromPortal('${group.id}')" style="flex: 1.2; height: 40px; font-size: 0.8rem; border-radius: 8px;">
                    <i class="fas fa-cog"></i> الإدارة
                </button>
            </div>
            <div class="card-stats-modern">اضغط لدخول السيستم</div>
        </div>
    `).join('');

    // --- NEW: Joint Day Card ---
    html += `
        <div class="grade-card-modern shadow-hover fade-in" onclick="openJointDaySelector('${gradeId}')" style="--accent-color: var(--vibrant-orange); background: #fff; color: var(--text-main); border: 2px solid var(--vibrant-orange); border-style: dashed; height: 260px; width: 220px; cursor: pointer;">
            <div class="card-icon-modern" style="background: var(--vibrant-orange); color: white;"><i class="fas fa-layer-group"></i></div>
            <h2 style="font-size: 1.5rem; color: var(--vibrant-orange); font-weight: 800;">يوم جماعي</h2>
            <p style="font-size: 0.85rem;">رصد أكثر من مجموعة معاً</p>
            <div class="card-stats-modern" style="background: var(--vibrant-orange); color: white;">اختر المجموعات</div>
        </div>
    `;

    // Add group at the end
    html += `
        <div class="grade-card-modern fade-in" onclick="toggleModal('group-modal', true)" style="--accent-color: var(--secondary); border: 2px dashed rgba(0,0,0,0.1); background: #f8fafc; color: var(--text-main); height: 260px; width: 220px; cursor: pointer;">
            <div class="card-icon-modern" style="background: var(--bg-light); color: var(--secondary);"><i class="fas fa-plus"></i></div>
            <h2 style="font-size: 1.4rem;">مجموعة جديدة</h2>
            <p style="font-size: 0.85rem;">تعريف وقت حصة جديد</p>
            <div class="card-stats-modern" style="color: var(--secondary);">اضغط للإضافة</div>
        </div>
    `;

    container.innerHTML = html;
}

function openJointDaySelector(gradeId, context = 'portal') {
    const list = document.getElementById('joint-groups-list');
    const groups = db.groups.filter(g => String(g.grade) === String(gradeId));
    jointSessionContext = context;

    list.innerHTML = groups.map(g => `
        <div onclick="toggleJointGroup(this, '${g.id}')" style="display:flex; align-items:center; gap:15px; padding: 12px; border-radius: 10px; cursor: pointer; margin-bottom: 8px; border: 2px solid #eee; background: white; transition: 0.2s;" class="joint-group-item">
            <div style="width: 24px; height: 24px; border: 2px solid var(--primary); border-radius: 6px; display: flex; align-items: center; justify-content: center;" class="check-box">
                <i class="fas fa-check" style="color: white; font-size: 0.7rem;"></i>
            </div>
            <div style="flex:1;">
                <div style="font-weight:700; color: var(--text-main);">${g.name}</div>
                <div style="font-size:0.75rem; color: var(--text-muted);">${g.time}</div>
            </div>
        </div>
    `).join('') || '<p style="text-align:center; padding: 1rem; color: var(--text-muted);">لا توجد مجموعات مسجلة لهذا الصف بعد</p>';

    activePortalGroupIds = []; // Clear previous selections
    toggleModal('joint-day-modal', true);
}

function toggleJointGroup(el, id) {
    const isSelected = activePortalGroupIds.includes(String(id));
    const checkbox = el.querySelector('.check-box');
    const checkIcon = checkbox.querySelector('i');

    if (isSelected) {
        activePortalGroupIds = activePortalGroupIds.filter(gid => gid !== String(id));
        el.style.borderColor = '#eee';
        checkbox.style.background = 'transparent';
    } else {
        activePortalGroupIds.push(String(id));
        el.style.borderColor = 'var(--primary)';
        checkbox.style.background = 'var(--primary)';
    }
}

function startJointSession() {
    if (activePortalGroupIds.length === 0) {
        showNotification('برجاء اختيار مجموعة واحدة على الأقل', 'error');
        return;
    }

    toggleModal('joint-day-modal', false);

    // Set first group as the primary context but mark it as joint session
    const firstGroup = db.groups.find(g => activePortalGroupIds.includes(String(g.id)));
    activePortalGroupId = 'joint:' + activePortalGroupIds.join(',');

    currentGrade = String(firstGroup.grade);
    currentGroupId = activePortalGroupIds[0];
    localStorage.setItem('edu_active_grade', currentGrade);
    localStorage.setItem('edu_active_group', currentGroupId);

    syncUIWithContext();

    const selectedGroupNames = db.groups.filter(g => activePortalGroupIds.includes(String(g.id))).map(g => g.name).join(' + ');

    if (jointSessionContext === 'internal') {
        // Handle Internal Context (Attendance Section)
        startLessonCoding(); // This will use activePortalGroupId set above
        const badge = document.getElementById('session-status-badge');
        if (badge) {
            badge.innerHTML = `
                <span class="status-badge" style="background: var(--vibrant-orange); color: white; padding: 0.5rem 1.5rem; font-size: 1rem;">
                    <i class="fas fa-layer-group" style="font-size: 0.8rem; margin-left: 5px;"></i> جلسة اليوم الجماعي نشطة: ${selectedGroupNames}
                </span>`;
        }
        document.getElementById('start-joint-session-btn').style.display = 'none';
        showNotification('تم بدء جلسة التشفير الجماعي بنجاح 🚀', 'success');
    } else {
        // Handle Portal Context
        document.getElementById('active-group-label').innerHTML = `
            <span style="background:var(--vibrant-orange);">يوم جماعي</span>
            <span style="margin-right:10px;">${selectedGroupNames}</span>
        `;
        document.getElementById('portal-setup-container').style.display = 'none';
        document.getElementById('portal-scanner-container').style.display = 'grid';
        renderPortalAttendance();
        if (!portalScanner) portalScanner = new Html5Qrcode("portal-reader");
        portalScanner.start({ facingMode: "environment" }, { fps: 25, qrbox: { width: 350, height: 250 } }, processScan);
    }
}

function enterSystemFromPortal(groupId) {
    exitPortalMode();
    enterGroup(groupId);
}

function startPortalSession(groupId) {
    if (!groupId) return;

    activePortalGroupId = groupId;
    const groupObj = db.groups.find(g => g.id == groupId);

    currentGrade = String(groupObj.grade);
    currentGroupId = String(groupId);
    localStorage.setItem('edu_active_grade', currentGrade);
    localStorage.setItem('edu_active_group', currentGroupId);

    syncUIWithContext();

    document.getElementById('active-group-label').innerText = `المجموعة النشطة: ${groupObj ? groupObj.name : 'مجهولة'}`;

    // Switch containers
    document.getElementById('portal-setup-container').style.display = 'none';
    document.getElementById('portal-scanner-container').style.display = 'grid';

    renderPortalAttendance();
    if (!portalScanner) portalScanner = new Html5Qrcode("portal-reader");
    portalScanner.start({ facingMode: "environment" }, { fps: 25, qrbox: { width: 350, height: 250 } }, processScan);
}

function renderPortalAttendance() {
    const today = new Date().toISOString().split('T')[0];
    const presentToday = db.attendance.filter(a => a.date.startsWith(today));
    const list = document.getElementById('portal-attendance-list');
    const badge = document.getElementById('portal-stats-badge');

    // NEW: Handle Joint/Single group filtering for the list display
    let allowedGroupIds = [];
    if (activePortalGroupId) {
        if (String(activePortalGroupId).startsWith('joint:')) {
            allowedGroupIds = activePortalGroupId.split(':')[1].split(',');
        } else {
            allowedGroupIds = [String(activePortalGroupId)];
        }
    }

    // Determine students present who belong to the ACTIVE CONTEXT (Grade + Selected Groups if any)
    const gradeStudents = db.students.filter(s => s.grade == currentGrade);
    const gradeStudentIds = gradeStudents.map(s => s.id);

    // Narrow down to selected groups if in Joint Mode or Single Portal context
    const gradePresence = presentToday.filter(a => {
        const student = db.students.find(s => s.id === a.studentId);
        if (!student || student.grade != currentGrade) return false;

        // If groups are explicitly selected, filter by them
        if (allowedGroupIds.length > 0) {
            return allowedGroupIds.includes(String(student.groupId));
        }
        return true;
    });

    if (badge) badge.innerText = `${gradePresence.length} طلاب`;

    if (!list) return;

    list.innerHTML = gradePresence.map(att => {
        const s = db.students.find(x => x.id === att.studentId);
        if (!s) return '';

        const payment = db.payments.find(p =>
            p.studentId == s.id &&
            p.category === 'اشتراك شهري' &&
            p.cycleId == db.settings.activeCycle
        );
        const isPaid = !!payment;
        const isExemption = payment?.isExemption;

        return `
            <tr>
                <td>
                    <div style="display:flex; align-items:center; gap:10px;">
                        <div class="avatar" style="width:30px; height:30px; font-size:0.8rem;">${s.name.charAt(0)}</div>
                        <div style="text-align:right;">
                            <div style="font-weight:700;">${s.name}</div>
                            <div style="font-size:0.75rem; color:var(--text-muted);">كود: ${s.qrCode}</div>
                        </div>
                    </div>
                </td>
                <td style="font-family:monospace;">${new Date(att.date).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}</td>
                <td>
                    <div style="display:flex; gap:5px; align-items:center;">
                        <button class="btn" style="padding: 4px 12px; border-radius: 50px; font-size: 0.8rem; background: ${isPaid ? (isExemption ? 'var(--bg-light)' : '#dcfce7') : 'var(--payment-orange)'}; color: ${isPaid ? (isExemption ? 'var(--text-main)' : '#166534') : 'white'}; min-width: 80px;" onclick="toggleMonthlyPayment(${s.id})">
                            ${isPaid ? (isExemption ? 'معفي ✅' : 'خالص ✅') : 'دفع؟'}
                        </button>
                        ${!isPaid ? `
                        <button class="btn" style="padding: 4px 10px; border-radius: 50px; font-size: 0.75rem; background: #f5f3ff; border:1px solid #ddd6fe; color:#7c3aed; font-weight:600;" onclick="exemptMonthlyPayment(${s.id})">إعفاء 🤍</button>
                        <button class="btn" style="padding: 4px 10px; border-radius: 50px; font-size: 0.75rem; background: #fff7ed; border:1px solid #fed7aa; color:#ea580c; font-weight:600;" onclick="discountMonthlyPayment(${s.id})">خصم %</button>
                        ` : ''}
                    </div>
                </td>
                <td style="text-align:center;">
                    <button class="btn" style="color:var(--danger); background:transparent;" onclick="removeAttendance(${att.id})">حذف</button>
                </td>
            </tr>
        `;
    }).join('') || '<tr class="no-data"><td colspan="4" style="text-align:center; padding:2rem; color:var(--text-muted);">لا يوجد حضور في هذا الصف اليوم حتى الآن..</td></tr>';
}

function renderSubscriptionTracker() {
    // This function is now deprecated in favor of renderMonthlySubscriptionTables
    // but we can make it redirect or show a grade-wide view if needed.
    renderMonthlySubscriptionTables();
}

function toggleMonthlyPayment(studentId) {
    const payIndex = db.payments.findIndex(p =>
        p.studentId == studentId &&
        p.category === 'اشتراك شهري' &&
        p.cycleId == db.settings.activeCycle
    );

    if (payIndex > -1) {
        const pass = prompt('يرجى إدخال كلمة المرور لإلغاء تسجيل الدفع (مطلوب للصلاحيات):');
        const correct = (db._settings.globalPasswords && db._settings.globalPasswords.unlockPayment) || '100qwe';
        if (pass === correct) {
            db.payments.splice(payIndex, 1);
            showNotification('تم إلغاء تسجيل الدفع الشهري بنجاح', 'warning');
        } else {
            showNotification('كلمة المرور غير صحيحة، لم يتم الإلغاء', 'error');
            return;
        }
    } else {
        db.payments.push({
            id: Date.now(),
            studentId,
            month: new Date().getMonth() + 1,
            year: new Date().getFullYear(),
            amount: db.settings.monthlyFee || 0,
            date: new Date().toISOString(),
            category: 'اشتراك شهري',
            cycleId: db.settings.activeCycle
        });
        addToQueue(studentId, 'payment');
        showNotification('تم تسجيل الدفع بنجاح ✅');
    }
    db.save();
    renderPortalAttendance();
    renderSubscriptionTracker();
    renderFinances();
    renderMonthlySubscriptionTables();
    updateDashboardStats();
}

function renderDailyTreasury() {
    const list = document.getElementById('dt-list');
    const statsGrid = document.getElementById('dt-stats-grid');
    const dateLabel = document.getElementById('dt-current-date');
    if (!list || !statsGrid) return;

    const todayStr = new Date().toLocaleDateString('en-CA');
    if (dateLabel) dateLabel.innerText = `تقرير يوم: ${new Date().toLocaleDateString('ar-EG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`;

    const todayPayments = db.payments.filter(p => {
        const pDate = new Date(p.date).toLocaleDateString('en-CA');
        if (pDate !== todayStr) return false;

        // --- NEW: STRICT ISOLATION BY GRADE & GROUP ---
        const student = db.students.find(s => s.id === p.studentId);
        if (!student || String(student.grade) !== String(currentGrade) || String(student.groupId) !== String(currentGroupId)) return false;

        const sessionResetTime = (db.settings.treasurySessionResetTime && db.settings.treasurySessionResetTime[todayStr]) || 0;
        return p.id > sessionResetTime;
    });

    const todayExpenses = db.expenses.filter(e => {
        const eDate = new Date(e.date || e.id).toLocaleDateString('en-CA');
        if (eDate !== todayStr) return false;

        // --- NEW: STRICT ISOLATION BY GRADE & GROUP ---
        if (String(e.grade || currentGrade) !== String(currentGrade) || String(e.groupId) !== String(currentGroupId)) return false;

        const sessionResetTime = (db.settings.treasurySessionResetTime && db.settings.treasurySessionResetTime[todayStr]) || 0;
        return e.id > sessionResetTime;
    });


    let totalSub = 0;
    let totalMisc = 0;
    let totalExpensesTotal = todayExpenses.reduce((sum, e) => sum + e.amount, 0);

    list.innerHTML = `
        ${todayPayments.map(p => {
        const student = db.students.find(s => s.id === p.studentId);
        const group = student ? db.groups.find(g => g.id == student.groupId) : null;
        if (p.category === 'اشتراك شهري') totalSub += p.amount;
        else totalMisc += p.amount;

        return `
            <tr>
                <td style="padding: 1.2rem 1rem;">
                    <div style="font-weight:700;">${student ? student.name : 'طالب مجهول'}</div>
                </td>
                <td>${group ? group.name : '---'}</td>
                <td><span class="status-badge" style="background:var(--bg-light); color:var(--text-main)">${p.category}</span></td>
                <td style="text-align:center; font-weight:800; color:var(--accent); font-size:1.1rem;">${p.amount} ج.م</td>
                <td style="text-align:center; color:var(--text-muted)">${new Date(p.date).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}</td>
            </tr>
        `;
    }).join('')}
        ${todayExpenses.map(e => `
            <tr style="background: #fef2f2;">
                <td style="padding: 1.2rem 1rem;">
                    <div style="font-weight:700;">مصروف: ${e.title}</div>
                </td>
                <td>---</td>
                <td><span class="status-badge" style="background:#fee2e2; color:var(--danger)">مصروفات</span></td>
                <td style="text-align:center; font-weight:800; color:var(--danger); font-size:1.1rem;">-${e.amount} ج.م</td>
                <td style="text-align:center; color:var(--text-muted)">---</td>
            </tr>
        `).join('')}
    ` || '<tr><td colspan="5" style="text-align:center; padding:3rem; color:var(--text-muted);">لا يوجد تحصيلات مالية مسجلة اليوم حتى الآن..</td></tr>';

    statsGrid.innerHTML = `
        <div class="card" style="padding:1.5rem; text-align:center; border-bottom:4px solid var(--accent); background: #f0fdf4;">
            <div style="font-size:0.9rem; color:var(--text-muted); margin-bottom: 10px;">إجمالي الاشتراكات</div>
            <div style="font-size:2rem; font-weight:800; color:var(--accent);">${totalSub} <small>ج.م</small></div>
            <p style="font-size:0.8rem; margin-top:5px; opacity:0.7;">محصلة من اشتراكات الشهر</p>
        </div>
        <div class="card" style="padding:1.5rem; text-align:center; border-bottom:4px solid var(--vibrant-orange); background: #fffcf0;">
            <div style="font-size:0.9rem; color:var(--text-muted); margin-bottom: 10px;">ملازم / أخرى</div>
            <div style="font-size:2rem; font-weight:800; color:var(--vibrant-orange);">${totalMisc} <small>ج.م</small></div>
            <p style="font-size:0.8rem; margin-top:5px; opacity:0.7;">محصلة من الملازم والخدمات الأخرى</p>
        </div>
        <div class="card" style="padding:1.5rem; text-align:center; border-bottom:4px solid var(--danger); background: #fef2f2;">
            <div style="font-size:0.9rem; color:var(--text-muted); margin-bottom: 10px;">إجمالي المصروفات</div>
            <div style="font-size:2rem; font-weight:800; color:var(--danger);">${totalExpensesTotal} <small>ج.م</small></div>
            <p style="font-size:0.8rem; margin-top:5px; opacity:0.7;">إجمالي ما تم إنفاقه اليوم</p>
        </div>
        <div class="card" style="padding:1.5rem; text-align:center; background:var(--primary); color:#fff; box-shadow: 0 10px 25px -5px rgba(79, 70, 229, 0.4); grid-column: span 3;">
            <div style="font-size:0.9rem; opacity: 0.9; margin-bottom: 10px;">صافي العهدة النقدية اليوم</div>
            <div style="font-size:2.5rem; font-weight:900;">${totalSub + totalMisc - totalExpensesTotal} <small>ج.م</small></div>
            <p style="font-size:0.8rem; margin-top:5px; opacity:0.7;">إجمالي المتبقي في الخزنة اليوم فعلياً</p>
        </div>
    `;
}

function showDailyTreasuryReport() {
    renderDailyTreasury(); // Update data before showing
    toggleModal('daily-treasury-modal', true);
}

function manualResetDailyTreasury() {
    const pass = prompt("برجاء إدخال كلمة المرور لتصفير العهدة والبدء من جديد (إغلاق الجلسة):");
    if (pass === '1234') {
        if (!confirm("هل أنت متأكد؟ سيتم أرشفة عهدة الفترة الحالية وتصفير العداد للبدء من جديد.")) return;

        // 1. Archive the current visible session
        const todayStr = new Date().toLocaleDateString('en-CA');

        // Use a temporary filter to identify what we are archiving
        const sessionResetTime = (db.settings.treasurySessionResetTime && db.settings.treasurySessionResetTime[todayStr]) || 0;
        const currentSessionPayments = db.payments.filter(p => {
            const pDate = new Date(p.date).toLocaleDateString('en-CA');
            const s = db.students.find(x => x.id === p.studentId);
            return pDate === todayStr && p.id > sessionResetTime &&
                s && String(s.grade) === String(currentGrade) && String(s.groupId) === String(currentGroupId);
        });

        if (currentSessionPayments.length > 0) {
            let totalSub = 0, totalMisc = 0;
            currentSessionPayments.forEach(p => {
                if (p.category === 'اشتراك شهري') totalSub += p.amount; else totalMisc += p.amount;
            });

            const archiveEntry = {
                id: Date.now(),
                date: todayStr,
                grade: currentGrade,
                groupId: currentGroupId,
                sessionName: `جلسة يدوية - ${new Date().toLocaleTimeString('ar-EG')}`,
                totalSub,
                totalMisc,
                total: totalSub + totalMisc,
                payments: currentSessionPayments.map(p => {
                    const s = db.students.find(x => x.id === p.studentId);
                    return { studentName: s ? s.name : 'طالب مجهول', category: p.category, amount: p.amount };
                })
            };

            if (!db.dailyTreasuryArchives) db.dailyTreasuryArchives = [];
            db.dailyTreasuryArchives.push(archiveEntry);
        }

        // 2. Set the new reset time to NOW
        if (!db.settings.treasurySessionResetTime) db.settings.treasurySessionResetTime = {};
        db.settings.treasurySessionResetTime[todayStr] = Date.now();

        db.save();
        renderDailyTreasury();
        showNotification("✅ تم تصفير العهدة بنجاح والبدء من جديد أوتماتيكياً", "success");
    } else {
        showNotification("❌ كلمة المرور غير صحيحة", "error");
    }
}

function autoArchiveDailyTreasury() {
    const lastDateStr = db.dailyTreasuryLastArchiveDate || localStorage.getItem('dt_last_archive_date');
    const todayStr = new Date().toLocaleDateString('en-CA');

    if (!lastDateStr) {
        db.dailyTreasuryLastArchiveDate = todayStr;
        localStorage.setItem('dt_last_archive_date', todayStr);
        db.save();
        return;
    }

    if (lastDateStr === todayStr) return;

    let iterateDate = new Date(lastDateStr);
    iterateDate.setDate(iterateDate.getDate() + 1);
    const todayDate = new Date(todayStr);
    let archivedAny = false;

    while (iterateDate < todayDate) {
        const currentIterDateStr = iterateDate.toLocaleDateString('en-CA');
        const dayPayments = db.payments.filter(p => {
            const pDate = new Date(p.date).toLocaleDateString('en-CA');
            return pDate === currentIterDateStr;
        });

        // Find all unique (grade, group) combinations in this day's payments
        const groupPairs = [];
        dayPayments.forEach(p => {
            const s = db.students.find(x => x.id === p.studentId);
            if (s) {
                const pairKey = `${s.grade}_${s.groupId}`;
                if (!groupPairs.includes(pairKey)) groupPairs.push(pairKey);
            }
        });

        groupPairs.forEach(pairKey => {
            const [gId, grpId] = pairKey.split('_');
            const groupPayments = dayPayments.filter(p => {
                const s = db.students.find(x => x.id === p.studentId);
                return s && String(s.grade) === String(gId) && String(s.groupId) === String(grpId);
            });

            if (groupPayments.length > 0) {
                let totalSub = 0, totalMisc = 0;
                groupPayments.forEach(p => {
                    if (p.category === 'اشتراك شهري') totalSub += p.amount;
                    else totalMisc += p.amount;
                });

                const archiveEntry = {
                    id: Date.now() + Math.random(),
                    date: currentIterDateStr,
                    grade: gId,
                    groupId: grpId,
                    totalSub,
                    totalMisc,
                    total: totalSub + totalMisc,
                    payments: groupPayments.map(p => {
                        const s = db.students.find(x => x.id === p.studentId);
                        return {
                            studentName: s ? s.name : 'طالب مجهول',
                            category: p.category,
                            amount: p.amount,
                            time: new Date(p.date).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })
                        };
                    })
                };

                if (!db.dailyTreasuryArchives) db.dailyTreasuryArchives = [];
                // Avoid duplicate archive for same date/grade/group
                const existingIdx = db.dailyTreasuryArchives.findIndex(a => a.date === currentIterDateStr && a.grade == gId && a.groupId == grpId);
                if (existingIdx !== -1) db.dailyTreasuryArchives.splice(existingIdx, 1);
                db.dailyTreasuryArchives.push(archiveEntry);
                archivedAny = true;
            }
        });
        iterateDate.setDate(iterateDate.getDate() + 1);
    }

    db.dailyTreasuryLastArchiveDate = todayStr;
    localStorage.setItem('dt_last_archive_date', todayStr);
    db.save();

    // Refresh Treasury UI if open to show the "reset" (0.00) state
    if (document.getElementById('daily-treasury-modal')?.style.display === 'block') {
        renderDailyTreasury();
    }
}

function renderDailyTreasuryArchives() {
    const list = document.getElementById('dt-archive-list');
    if (!list) return;

    // --- عزل صارم: أرشيف الخزينة يُعرض فقط للمجموعة الحالية المحددة ---
    if (!currentGroupId || currentGroupId === 'all') {
        list.innerHTML = '<div style="text-align:center; padding:3rem; color:var(--text-muted);"><i class="fas fa-info-circle"></i> يرجى تحديد مجموعة أولاً لعرض أرشيف خزينتها</div>';
        document.getElementById('dt-main-view').style.display = 'none';
        document.getElementById('dt-archive-view').style.display = 'block';
        return;
    }

    // فلتر صارم بالصف والمجموعة الحالية فقط
    const archives = [...(db.dailyTreasuryArchives || [])]
        .filter(a => String(a.grade) === String(currentGrade) && String(a.groupId) === String(currentGroupId))
        .sort((a, b) => new Date(b.date) - new Date(a.date));

    // اعرض اسم المجموعة في عنوان الأرشيف
    const currentGroupObj = db.groups.find(g => String(g.id) === String(currentGroupId));
    const archiveTitle = document.getElementById('dt-archive-title');
    if (archiveTitle && currentGroupObj) archiveTitle.innerText = `أرشيف خزينة - ${currentGroupObj.name}`;

    list.innerHTML = archives.map(a => `
        <div class="card fade-in" style="padding: 1.5rem; border-right: 5px solid var(--accent); cursor: pointer;" onclick="viewDailyArchive('${a.id}')">
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <div>
                    <div style="font-weight:800; font-size:1.2rem; color:var(--primary);">${new Date(a.date).toLocaleDateString('ar-EG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</div>
                    <div style="color:var(--text-muted); font-size:0.9rem; margin-top:5px;">إجمالي التحصيل: <b style="color:var(--accent)">${a.total} ج.م</b></div>
                </div>
                <div style="text-align:right;">
                    <div style="font-size:0.8rem; color:var(--text-muted)">اشتراكات: ${a.totalSub} | ملازم: ${a.totalMisc}</div>
                    <button class="btn" style="margin-top:10px; background:var(--bg-light); padding:5px 15px;">عرض التفاصيل <i class="fas fa-chevron-left"></i></button>
                </div>
            </div>
        </div>
    `).join('') || `<div style="text-align:center; padding:3rem; color:var(--text-muted);">لا يوجد أرشيفات مالية لهذه المجموعة حتى الآن</div>`;

    document.getElementById('dt-main-view').style.display = 'none';
    document.getElementById('dt-archive-view').style.display = 'block';
}

function viewDailyArchive(archiveId) {
    const archive = db.dailyTreasuryArchives.find(a => String(a.id) === String(archiveId));
    if (!archive) return;

    const modalList = document.getElementById('daily-treasury-list');
    const modalStats = document.getElementById('daily-treasury-stats');
    if (!modalList || !modalStats) return;

    modalList.innerHTML = archive.payments.map(p => `
        <tr>
            <td style="padding: 1rem;">
                <div style="font-weight:700;">${p.studentName}</div>
                <div style="font-size:0.75rem; color:var(--text-muted)">توقيت: ${p.time}</div>
            </td>
            <td style="color:var(--text-muted)">${p.category}</td>
            <td style="text-align:center; font-weight:800; color:var(--accent); font-size:1.1rem;">${p.amount} ج.م</td>
        </tr>
    `).join('');

    modalStats.innerHTML = `
        <div class="card" style="padding:1rem; text-align:center; border-bottom:4px solid var(--accent); background: #f0fdf4;">
            <div style="font-size:0.85rem; color:var(--text-muted);">إجمالي الاشتراكات</div>
            <div style="font-size:1.3rem; font-weight:800; color:var(--accent);">${archive.totalSub} ج.م</div>
        </div>
        <div class="card" style="padding:1rem; text-align:center; border-bottom:4px solid var(--vibrant-orange); background: #fffcf0;">
            <div style="font-size:0.85rem; color:var(--text-muted);">ملازم / أخرى</div>
            <div style="font-size:1.3rem; font-weight:800; color:var(--vibrant-orange);">${archive.totalMisc} ج.م</div>
        </div>
        <div class="card" style="padding:1rem; text-align:center; background:var(--primary); color:#fff;">
            <div style="font-size:0.85rem; opacity: 0.9;">إجمالي العهدة الملحقة</div>
            <div style="font-size:1.5rem; font-weight:900;">${archive.total} ج.م</div>
        </div>
    `;

    // Update modal title to reflect the archived date
    const modalTitle = document.querySelector('#daily-treasury-modal h3');
    if (modalTitle) modalTitle.innerHTML = `<i class="fas fa-history"></i> أرشيف يوم: ${new Date(archive.date).toLocaleDateString('ar-EG')}`;

    toggleModal('daily-treasury-modal', true);
}

function removeAttendance(attId) {
    if (!confirm('هل تريد حذف سجل الحضور هذا؟')) return;
    db.attendance = db.attendance.filter(a => a.id !== attId);
    db.save();
    renderPortalAttendance();
    showNotification('تم حذف سجل الحضور', 'warning');
}

function renderQuickAttendance() {
    const today = new Date().toLocaleDateString('en-CA');
    const list = document.getElementById('quick-attendance-list');
    if (!list) return;

    const groupStudents = db.students.filter(s => s.grade == currentGrade && s.groupId == currentGroupId);
    const groupStudentIds = groupStudents.map(s => s.id);

    const presentToday = db.attendance.filter(a => {
        const aDate = new Date(a.date).toLocaleDateString('en-CA');
        return aDate === today && groupStudentIds.includes(a.studentId) && a.status === 'present';
    }).reverse();

    list.innerHTML = presentToday.map(att => {
        const s = db.students.find(x => x.id === att.studentId);
        if (!s) return '';
        return `
            <tr class="fade-in">
                <td><strong>${s.name}</strong></td>
                <td style="font-family:monospace;">${new Date(att.date).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}</td>
                <td><span class="status-badge" style="background:#dcfce7; color:#166534">حاضر</span></td>
                <td style="text-align:center;">
                    <button class="btn" style="color:var(--danger); padding:5px;" onclick="removeAttendance(${att.id})"><i class="fas fa-trash"></i></button>
                </td>
            </tr>
        `;
    }).join('') || '<tr><td colspan="4" style="text-align:center; padding:2rem;">لم يتم تسجيل حضور للمجموعة الحالية بعد</td></tr>';
}

function endSessionAndMarkAbsent() {
    if (!activePortalGroupId) {
        showNotification('لم يتم تحديد مجموعة نشطة', 'error');
        return;
    }

    const rawId = String(activePortalGroupId);
    let allowedGroupIds = [];
    let groupDisplayName = '';

    if (rawId.startsWith('joint:')) {
        allowedGroupIds = rawId.split(':')[1].split(',');
        groupDisplayName = 'اليوم الجماعي';
    } else {
        allowedGroupIds = [rawId];
        const groupObj = db.groups.find(g => String(g.id) === rawId);
        groupDisplayName = groupObj ? groupObj.name : 'هذه المجموعة';
    }

    if (!confirm(`هل تريد إنهاء الجلسة وتسجيل الغياب لطلاب (${groupDisplayName}) غير المسجلين؟`)) return;

    const today = new Date().toISOString().split('T')[0];

    // Students already marked present or absent TODAY
    const recordedIds = db.attendance
        .filter(a => a.date.startsWith(today))
        .map(a => a.studentId);

    // Students in the ALLOWED GROUPS of the CURRENT GRADE who aren't recorded yet
    const absentees = db.students.filter(s =>
        String(s.grade) === String(currentGrade) &&
        allowedGroupIds.includes(String(s.groupId)) &&
        !recordedIds.includes(s.id)
    );

    absentees.forEach(s => {
        db.attendance.push({
            id: Date.now() + Math.random(),
            studentId: s.id,
            groupId: s.groupId, // Record under their own group
            date: new Date().toISOString(),
            status: 'absent'
        });
        addToQueue(s.id, 'absence');
    });

    db.save();
    showNotification(`تم إنهاء الجلسة. سجل الغياب لعدد: ${absentees.length} طالب`, 'success');

    // Cleanup
    activePortalGroupId = null;
    exitPortalMode();
    showSection('absence');
}

// --- 7. WhatsApp Bot Engine ---
function saveTemplates() {
    waTemplates.welcome = document.getElementById('tpl-welcome').value;
    waTemplates.absence = document.getElementById('tpl-absence').value;
    waTemplates.payment = document.getElementById('tpl-payment').value;
    localStorage.setItem('edu_wa_templates', JSON.stringify(waTemplates));
    showNotification('تم حفظ القوالب بنجاح');
}

// --- Hall of Fame Logic ---
function renderHallOfFame() {
    const podiumArea = document.getElementById('podium-area');
    const hallList = document.getElementById('hall-list');
    if (!podiumArea || !hallList) return;

    // Calculate Performance for all students in current grade
    const performance = db.students.filter(s => String(s.grade) === String(currentGrade)).map(s => {
        const attCount = db.attendance.filter(a => a.studentId == s.id && a.status === 'present').length;
        const marks = db.scores.filter(sc => sc.studentId == s.id);
        const avgMark = marks.length > 0
            ? (marks.reduce((sum, m) => sum + (m.mark / (db.exams.find(e => e.id === m.examId)?.maxMarks || 100)), 0) / marks.length) * 100
            : 0;

        return {
            ...s,
            score: (s.points || 0) + (attCount * 10) + avgMark,
            avgMark: Math.round(avgMark),
            attCount
        };
    }).sort((a, b) => b.score - a.score);

    // Render Podium (Top 3)
    const top3 = performance.slice(0, 3);
    const podiumHtml = [
        // Rank 2 (Left)
        top3[1] ? `
            <div class="podium-item podium-rank-2 fade-in" style="animation-delay: 0.2s;">
                <div class="avatar" style="width:60px; height:60px; margin: 0 auto 10px;">${top3[1].name.charAt(0)}</div>
                <div style="font-weight:700;">${top3[1].name.split(' ')[0]}</div>
                <div style="font-size:0.8rem; color:var(--text-muted)">${Math.round(top3[1].score)} نقطة</div>
                <div class="podium-name">🥈 المركز الثاني</div>
            </div>` : '',
        // Rank 1 (Center)
        top3[0] ? `
            <div class="podium-item podium-rank-1 fade-in">
                <i class="fas fa-crown crown"></i>
                <div class="avatar" style="width:80px; height:80px; font-size:2rem; margin: 0 auto 10px; border: 4px solid #ffd700;">${top3[0].name.charAt(0)}</div>
                <div style="font-weight:800; font-size:1.1rem;">${top3[0].name.split(' ')[0]}</div>
                <div style="font-size:0.9rem; color:var(--primary-dark)">${Math.round(top3[0].score)} نقطة</div>
                <div class="podium-name">🥇 بطل الشهر</div>
            </div>` : '',
        // Rank 3 (Right)
        top3[2] ? `
            <div class="podium-item podium-rank-3 fade-in" style="animation-delay: 0.4s;">
                <div class="avatar" style="width:50px; height:50px; margin: 0 auto 10px;">${top3[2].name.charAt(0)}</div>
                <div style="font-weight:700;">${top3[2].name.split(' ')[0]}</div>
                <div style="font-size:0.8rem; color:var(--text-muted)">${Math.round(top3[2].score)} نقطة</div>
                <div class="podium-name">🥉 المركز الثالث</div>
            </div>` : ''
    ].join('');
    podiumArea.innerHTML = podiumHtml;

    // Render Table (Top 10)
    hallList.innerHTML = performance.slice(0, 10).map((s, idx) => `
        <tr class="fade-in" style="animation-delay: ${idx * 0.1}s">
            <td><span style="font-weight:800; color:var(--primary)">#${idx + 1}</span></td>
            <td><strong>${s.name}</strong></td>
            <td><span class="points-tag" style="margin-bottom:0">${s.points} 💎</span></td>
            <td>${s.avgMark}%</td>
            <td>
                <button class="btn" style="padding: 5px 10px; background:var(--vibrant-orange); color:white; font-size:0.7rem;" onclick="generateCertificate(${s.id})">
                    <i class="fas fa-certificate"></i> شهادة
                </button>
                <button class="btn" style="padding: 5px 10px; background:var(--bg-light); font-size:0.7rem;" onclick="viewDetailedProfile(${s.id})">
                    <i class="fas fa-user-circle"></i> بروفايل
                </button>
            </td>
        </tr>
    `).join('') || '<tr><td colspan="5" style="text-align:center;">لا يوجد بيانات كافية للتصنيف</td></tr>';
}

// --- Certificate Management Section ---
function initCertificatesSection() {
    const select = document.getElementById('cert-select-student');
    if (!select) return;

    // STRICTLY filter by active grade AND current group context
    const groupStudents = db.students.filter(s =>
        String(s.grade) === String(currentGrade) &&
        String(s.groupId) === String(currentGroupId)
    );
    const sortedStudents = groupStudents.sort((a, b) => a.name.localeCompare(b.name, 'ar'));

    select.innerHTML = '<option value="">-- اختر اسم الطالب --</option>' +
        sortedStudents.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
}

function generateCertificateFromSelect() {
    const studentId = document.getElementById('cert-select-student').value;
    if (!studentId) {
        showNotification('يرجى اختيار طالب أولاً', 'error');
        return;
    }
    generateCertificate(parseInt(studentId));
}

function sendCongratulationWA() {
    const studentId = document.getElementById('cert-select-student').value;
    if (!studentId) {
        showNotification('يرجى اختيار طالب أولاً', 'error');
        return;
    }
    const s = db.students.find(x => x.id == studentId);
    if (!s) return;

    // User requested message: "ابنكم متفوق وهذه شهادة منا له"
    const text = `السلام عليكم.. يَسرنا إعلامكم أن ابنكم الطالب المتميز *${s.name}* قد حقق تفوقاً باهراً في دروسه، وهذه شهادة تقدير وتفوق منا له تقديراً لمجهوده الرائع 🎉🏆. نسأل الله له دوام التوفيق والنجاح.`;

    window.open(`https://wa.me/2${s.parentPhone}?text=${encodeURIComponent(text)}`, '_blank');
}
let currentSelectedExamId = null;
let currentMarksFilter = 'all';

function generateCertificate(studentId) {
    let s;
    if (studentId) {
        s = db.students.find(x => x.id == studentId);
    } else {
        const profileName = document.getElementById('prof-name')?.innerText?.trim();
        if (profileName) {
            s = db.students.find(x => x.name.trim() === profileName);
        }
    }

    if (!s) {
        showNotification('يرجى اختيار طالب أولاً لإصدار الشهادة', 'error');
        return;
    }

    // Academic Data
    const marks = db.scores.filter(sc => sc.studentId == s.id && sc.mark !== null && sc.mark !== undefined);
    let totalPerc = 0;
    marks.forEach(m => {
        const ex = db.exams.find(e => e.id == m.examId);
        const max = (ex && ex.maxMarks > 0) ? ex.maxMarks : 100;
        totalPerc += (m.mark / max);
    });

    const avgMark = marks.length > 0 ? Math.round((totalPerc / marks.length) * 100) : 0;
    const gradeObj = gradesList.find(g => String(g.id) === String(s.grade));
    const gradeName = gradeObj ? gradeObj.name : '---';

    // Fill Modal
    document.getElementById('cert-student-name').innerText = s.name;
    document.getElementById('cert-avg').innerText = `${avgMark}%`;
    document.getElementById('cert-points').innerText = s.points || 0;
    document.getElementById('cert-grade').innerText = gradeName;
    document.getElementById('cert-date').innerText = new Date().toLocaleDateString('ar-EG');

    // Add data attribute for later capture
    document.getElementById('certificate-modal').dataset.studentId = s.id;

    toggleModal('certificate-modal', true);
}

async function sendNewCertificate(recipient) {
    const studentId = document.getElementById('certificate-modal').dataset.studentId;
    if (!studentId) {
        // If not in modal, check from select
        const selId = document.getElementById('cert-select-student').value;
        if (!selId) return showNotification('يرجى اختيار طالب أولاً', 'error');
        // Generate first to fill data
        generateCertificate(selId);
    }

    const s = db.students.find(x => x.id == (studentId || document.getElementById('cert-select-student').value));
    if (!s) return;

    showNotification('جاري تجهيز الشهادة ونسخها... يرجى الانتظار ⏳', 'success');

    const area = document.getElementById('certificate-printable-area');
    try {
        const canvas = await html2canvas(area, { scale: 2, useCORS: true });
        canvas.toBlob(async (blob) => {
            try {
                const item = new ClipboardItem({ "image/png": blob });
                await navigator.clipboard.write([item]);

                const phone = recipient === 'parent' ? s.parentPhone : s.phone;
                const msg = `ألف مبروك للطالب المتميز *${s.name}* بمناسبة تفوقه الأكاديمي! 🏆\nمرفق لسيادتكم شهادة تقدير من منصة *الأمين في اللغة العربية*.\n_(يمكنك ضغط Ctrl+V في المحادثة لإرسال صورة الشهادة فوراً)_`;

                showNotification('✅ تم نسخ الشهادة للحافظة! يمكنك الآن الضغط على Ctrl+V في واتساب', 'success');

                setTimeout(() => {
                    window.open(`https://wa.me/2${phone}?text=${encodeURIComponent(msg)}`, '_blank');
                }, 1000);
            } catch (err) {
                console.error(err);
                showNotification('عذراً، متصفحك لا يدعم نسخ الصور المباشر. يمكنك طباعة الشهادة يدوياً.', 'error');
            }
        });
    } catch (e) {
        console.error(e);
        showNotification('خطأ في معالجة الشهادة', 'error');
    }
}

function printCertificate() {
    const inner = document.getElementById('certificate-printable-area').innerHTML;
    const printWindow = window.open('', '_blank', 'width=1000,height=800');

    printWindow.document.write(`
        <html dir="rtl">
        <head>
            <title>طباعة الشهادة</title>
            <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
            <link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;700;900&display=swap" rel="stylesheet">
            <style>
                body { font-family: 'Tajawal', sans-serif; margin: 0; padding: 0; background: #fff; display: flex; align-items: center; justify-content: center; height: 100vh; overflow: hidden; }
                #printable-area { width: 100%; height: 100%; }
                @media print {
                    @page { size: landscape; margin: 0; }
                    body { -webkit-print-color-adjust: exact; margin: 0; padding: 0; }
                }
            </style>
        </head>
        <body>
            <div id="printable-area">${inner}</div>
            <script>
                window.onload = () => {
                    setTimeout(() => {
                        window.print();
                        window.close();
                    }, 500);
                }
            </script>
        </body>
        </html>
    `);
    printWindow.document.close();
}


function addToQueue(studentId, type, customText = null) {
    const s = db.students.find(x => x.id === studentId);
    if (!s) return;

    let text = customText || waTemplates[type] || "تنبيه من نظام الأمين - [[name]]";
    text = text.replace(/\[\[name\]\]/g, s.name).replace(/\[\[points\]\]/g, s.points || 0);

    db.waQueue.push({
        id: Date.now(),
        studentId,
        phone: s.parentPhone,
        text,
        type
    });
    db.save();
    if (document.getElementById('whatsapp-section').style.display === 'block') renderWAQueue();
}

function renderWABot() {
    document.getElementById('tpl-welcome').value = waTemplates.welcome;
    document.getElementById('tpl-absence').value = waTemplates.absence;
    document.getElementById('tpl-payment').value = waTemplates.payment;
    renderWAQueue();
}

function renderWAQueue() {
    const list = document.getElementById('wa-queue-list');
    const badge = document.getElementById('pending-messages');
    if (badge) badge.innerText = db.waQueue.length;
    if (!list) return;

    list.innerHTML = db.waQueue.map(item => {
        const s = db.students.find(x => x.id === item.studentId);
        const typeLabels = {
            'absence': { label: 'غـياب ❌', color: 'var(--danger)' },
            'welcome': { label: 'تـرحيب ✅', color: 'var(--accent)' },
            'payment': { label: 'دفـع 💰', color: 'var(--vibrant-orange)' }
        };
        const typeInfo = typeLabels[item.type] || { label: 'عـام', color: 'var(--primary)' };

        return `
            <div class="card" style="margin-bottom: 0.5rem; padding: 1rem; border-right: 5px solid ${typeInfo.color}; background: #f8fafc;">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <div style="text-align:right">
                        <div style="display:flex; align-items:center; gap:8px; margin-bottom:4px;">
                            <strong>إلى: ${s ? s.name : 'طالب'}</strong>
                            <span class="status-badge" style="background:${typeInfo.color}15; color:${typeInfo.color}; border:1px solid ${typeInfo.color}30; padding:2px 8px;">${typeInfo.label}</span>
                        </div>
                        <small style="color:var(--text-muted)">(${item.phone}) - ${item.text.substring(0, 60)}...</small>
                    </div>
                    <div style="display:flex; gap:8px;">
                        <button class="btn btn-primary" style="padding:6px 12px; background:var(--accent);" onclick="sendFromQueue(${item.id})">
                            <i class="fab fa-whatsapp"></i> إرسال
                        </button>
                        <button class="btn" style="padding:6px 12px; background:white; border:1px solid #ddd;" onclick="removeFromQueue(${item.id})">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
            </div>
        `;
    }).reverse().join('') || `
        <div style="text-align:center; padding:3rem; opacity:0.5;">
            <i class="fas fa-check-double" style="font-size:3rem; margin-bottom:1rem;"></i>
            <p>لا توجد رسائل معلقة</p>
        </div>
    `;
}

function handleBarcodeGrading(val) {
    if (!val) return;
    const clean = val.trim();
    const student = db.students.find(s => s.qrCode === clean || clean.includes(s.qrCode));
    if (student && clean.length >= 4) {
        processFastScan(clean);
        const input = document.getElementById('barcode-grading-entry');
        if (input) {
            input.value = '';
            setTimeout(() => {
                if (input) {
                    input.value = '';
                    input.focus();
                }
            }, 10);
        }
    }
}

function handleBarcodeAttendance(val) {
    if (!val) return;
    const clean = val.trim();
    const student = db.students.find(s => s.qrCode === clean || clean.includes(s.qrCode));
    if (student && clean.length >= 4) {
        processScan(clean);
        const input = document.getElementById('barcode-attendance-entry');
        if (input) {
            input.value = '';
            setTimeout(() => {
                if (input) {
                    input.value = '';
                    input.focus();
                }
            }, 10);
        }
    }
}

function sendFromQueue(id) {
    const item = db.waQueue.find(x => x.id === id);
    if (!item) return;
    window.open(`https://wa.me/2${item.phone}?text=${encodeURIComponent(item.text)}`, '_blank');
    removeFromQueue(id);
}

function removeFromQueue(id) {
    db.waQueue = db.waQueue.filter(x => x.id !== id);
    db.save();
    renderWAQueue();
}

function clearQueue() {
    if (!confirm('هل تريد مسح كافة الرسائل المعلقة؟')) return;
    db.waQueue = [];
    db.save();
    renderWAQueue();
}

function addToQueueBatch() {
    const grade = document.getElementById('batch-grade').value;
    const text = document.getElementById('batch-text').value;
    if (!text) return;

    const targets = grade === 'all' ? db.students : db.students.filter(s => s.grade === grade);
    targets.forEach(s => addToQueue(s.id, 'batch', text));
    showNotification(`تمت إضافة ${targets.length} رسالة إلى الطابور`);
    document.getElementById('batch-text').value = '';
    renderWAQueue();
}

// --- 8. Analytics (Chart.js) ---
function exitPortalMode() {
    document.getElementById('portal-overlay').style.display = 'none';
    activePortalGroupId = null; // Clear joint-day/portal context on exit
    activePortalGroupIds = [];
    if (portalScanner) {
        try {
            portalScanner.stop();
        } catch (e) { }
    }
}



// --- 7. Fast Grading AI Engine ---
// fastGradingScanner already declared in global state section above
let currentFastStudent = null;

function initFastGrading() {
    const examSelect = document.getElementById('fast-exam-select');
    const groupSelect = document.getElementById('fast-group-select');
    if (!examSelect || !groupSelect) return;

    // Filter Exams by current grade
    const exams = db.exams.filter(e => String(e.grade) === String(currentGrade));
    examSelect.innerHTML = '<option value="">-- اختر الامتحان --</option>' +
        exams.map(e => `<option value="${e.id}">${e.title} (درجة: ${e.maxMarks})</option>`).join('');

    // Filter Groups by current grade
    const groups = db.groups.filter(g => String(g.grade) === String(currentGrade));
    groupSelect.innerHTML = '<option value="">-- اختر المجموعة --</option>' +
        '<option value="all">كل مجموعات المرحلة (يوم جماعي)</option>' +
        groups.map(g => `<option value="${g.id}" ${String(g.id) === String(currentGroupId) ? 'selected' : ''}>${g.name}</option>`).join('');

    // AUTO SELECT LAST EXAM if none selected
    if (!examSelect.value && exams.length > 0) {
        examSelect.value = exams[0].id; // Usually first is latest in some contexts, but let's check reverse
        // Alternatively, if they are sorted by date (id is Date.now), the last one is exams[exams.length-1]
        examSelect.value = exams[exams.length - 1].id;
        updateFastExamMax();
    }

    // Add event listeners for auto-refresh
    examSelect.onchange = () => {
        updateFastExamMax();
        renderFastHistory();
        renderFastPendingList();
    };
    groupSelect.onchange = () => {
        renderFastPendingList();
    };

    renderFastHistory();
    renderFastPendingList();

    if (!fastGradingScanner) fastGradingScanner = new Html5Qrcode("fast-reader");
    fastGradingScanner.start({ facingMode: "environment" }, { fps: 20, qrbox: 250 }, processFastScan).catch(err => {
        console.error("Scanner failed", err);
        showNotification("تعذر تشغيل الكاميرا - يرجى التأكد من الصلاحيات", "error");
    });
}

function markRemainingAsExamAbsent() {
    const examId = document.getElementById('fast-exam-select').value;
    const groupId = document.getElementById('fast-group-select').value;

    if (!examId || !groupId) {
        showNotification('يرجى اختيار الامتحان والمجموعة أولاً', 'warning');
        return;
    }

    const examObj = db.exams.find(e => e.id == examId);
    const groupObj = db.groups.find(g => g.id == groupId);

    if (!confirm(`هل تريد تسجيل "غائب" لجميع طلاب مجموعة (${groupObj.name}) الذين لم يتم رصد درجاتهم في امتحان (${examObj.title})؟`)) return;

    // Students in this group and grade
    const groupStudents = db.students.filter(s => String(s.grade) === String(currentGrade) && String(s.groupId) === String(groupId));

    // Students who already have a record for this exam
    const recordedStudentIds = db.scores.filter(sc => sc.examId == examId).map(sc => sc.studentId);

    let count = 0;
    groupStudents.forEach(s => {
        if (!recordedStudentIds.includes(s.id)) {
            db.scores.push({
                id: Date.now() + Math.random(),
                studentId: s.id,
                examId: parseInt(examId),
                mark: -1,
                date: new Date().toISOString()
            });
            count++;
        }
    });

    db.save();
    showNotification(`تم تسجيل غياب ${count} طالب بنجاح`, 'success');
    renderFastHistory();
    renderFastPendingList();
}

function processFastScan(token) {
    if (typeof token === 'object' && token.decodedText) token = token.decodedText;
    const cleanToken = token.trim();

    // 1. Find the student
    let student = db.students.find(s => s.qrCode === cleanToken);
    if (!student) {
        student = db.students.find(s => cleanToken.includes(s.qrCode) || s.qrCode.includes(cleanToken));
    }

    if (!student) {
        showNotification('طالب غير مسجل', 'warning');
        return;
    }

    // 2. Prevent Re-scan flicker
    if (currentFastStudent && currentFastStudent.id === student.id) return;

    // 3. Grade Check
    if (String(student.grade) !== String(currentGrade)) {
        const studentGradeObj = gradesList.find(g => g.id == student.grade);
        playSound('error');
        showNotification(`🛑 خطأ: الطالب ${student.name} مقيد في (${studentGradeObj ? studentGradeObj.name : student.grade}).`, 'error');
        return;
    }

    // 4. Group Warning (Relaxed to warning like attendance)
    const rawSessionId = activePortalGroupId || currentGroupId;
    let isGroupMatched = false;
    if (String(rawSessionId).startsWith('joint:')) {
        const allowedGroupIds = rawSessionId.split(':')[1].split(',');
        isGroupMatched = allowedGroupIds.includes(String(student.groupId));
    } else {
        isGroupMatched = String(student.groupId) === String(rawSessionId);
    }

    if (!isGroupMatched) {
        const studentGroupObj = db.groups.find(g => g.id == student.groupId);
        showNotification(`⚠️ تنبيه: الطالب ${student.name} مقيد في مجموعة (${studentGroupObj ? studentGroupObj.name : 'أخرى'})`, 'warning');
    }

    currentFastStudent = student;
    const examId = document.getElementById('fast-exam-select').value;
    const exam = db.exams.find(e => e.id == examId);

    const infoSide = document.getElementById('fast-student-info');
    infoSide.innerHTML = `
        <div class="fade-in" style="text-align:center; padding: 2rem;">
            <div class="avatar" style="width:100px; height:100px; font-size:2.5rem; margin: 0 auto 1.5rem; background:var(--primary); color:white; border-radius:50%; display:flex; align-items:center; justify-content:center;">${student.name.charAt(0)}</div>
            <h2 style="margin-bottom:0.5rem;">${student.name}</h2>
            <p style="color:var(--primary); font-weight:700; font-size:1.1rem; margin-bottom:1rem;">رصد امتحان: ${exam ? exam.title : '---'}</p>
            
            <div class="form-group">
                <label style="font-weight:800; font-size:1.2rem; color:var(--primary);">أدخل الدرجة (من ${exam ? exam.maxMarks : '??'}):</label>
                <input type="number" id="fast-mark-input" autofocus class="form-input" 
                       style="font-size: 2.5rem; height: 80px; text-align: center; border: 3px solid var(--primary); border-radius: 20px;"
                       onkeyup="if(event.key === 'Enter') submitFastGrade()">
            </div>
            
            <button class="btn btn-primary" style="width:100%; height:60px; font-size:1.2rem; border-radius:15px; margin-top:1rem;" onclick="submitFastGrade()">
                رصد الدرجة الآن <i class="fas fa-check-double"></i>
            </button>
            <p style="margin-top:1rem; font-size:0.8rem; color:var(--text-muted);">أو استخدم ماسح الباركود للانتقال للطالب التالي</p>
        </div>
    `;

    setTimeout(() => {
        const input = document.getElementById('fast-mark-input');
        if (input) input.focus();
    }, 150);

    playSound('success');
    showNotification(`تم التعرف على: ${student.name}`);
}

function updateFastExamMax() {
    const examId = document.getElementById('fast-exam-select').value;
    const exam = db.exams.find(e => e.id == examId);
    if (exam) {
        document.getElementById('fast-max-marks').value = exam.maxMarks;
    }
    renderFastHistory();
    renderFastPendingList(); // Ensure list updates when exam changes
}

function submitFastGrade() {
    const examId = document.getElementById('fast-exam-select').value;
    const inputEl = document.getElementById('fast-mark-input');
    const rawVal = inputEl ? inputEl.value.trim() : '';

    if (!examId) return showNotification('برجاء اختيار الامتحان أولاً', 'error');

    // --- MANUAL ENTRY SUPPORT ---
    // If the input value looks like a student ID and it's a manual Enter (not a scan burst handled by global listener)
    const cleanVal = rawVal.trim();
    const possibleStudent = db.students.find(s => s.qrCode === cleanVal);

    if (possibleStudent && cleanVal.length >= 4) {
        document.getElementById('fast-mark-input').value = '';
        processFastScan(cleanVal);
        return;
    }

    if (!currentFastStudent) return showNotification('برجاء مسح كود الطالب أولاً أو اختيار اسم يدوي', 'warning');
    if (!rawVal) return showNotification('يرجى إدخال درجة الطالب', 'error');

    const mark = parseFloat(rawVal);
    if (isNaN(mark)) return showNotification('يرجى إدخال درجة صحيحة', 'error');

    processAndSaveGrade(currentFastStudent, examId, mark);

    // After manual Enter, clear and wait for next scan
    currentFastStudent = null;
    if (inputEl) inputEl.value = "";

    document.getElementById('fast-student-info').innerHTML = `
        <div style="text-align: center; color: var(--accent); padding-top: 5rem;">
            <i class="fas fa-qrcode" style="font-size: 4rem; display: block; margin-bottom: 1rem; opacity: 0.3;"></i>
            <p>تم الحفظ.. وجه الكاميرا أو استخدم المسح لورقة الطالب التالي...</p>
        </div>
    `;
    updateDashboardStats();
}

function processAndSaveGrade(studentObj, examId, mark) {
    const exam = db.exams.find(e => e.id == examId);
    const maxMarksInput = document.getElementById('fast-max-marks');
    const currentMax = maxMarksInput ? parseFloat(maxMarksInput.value) : (exam ? exam.maxMarks : 100);
    if (exam && exam.maxMarks !== currentMax) {
        exam.maxMarks = currentMax;
    }

    // Update existing score if it exists, otherwise push new one
    const existingIdx = db.scores.findIndex(sc => sc.examId == examId && sc.studentId == studentObj.id);
    if (existingIdx > -1) {
        db.scores[existingIdx].mark = mark;
        db.scores[existingIdx].date = new Date().toISOString();
    } else {
        db.scores.push({
            id: Date.now() + Math.random(),
            examId: parseInt(examId),
            studentId: studentObj.id,
            mark: mark,
            date: new Date().toISOString()
        });
    }

    studentObj.points = (studentObj.points || 0) + 5;
    db.save();
    db.save('students'); // FIXED: Ensure student points update is persisted

    showNotification(`تم رصد ${mark} لـ ${studentObj.name} ✅`, 'success');
    renderFastHistory();
    renderFastPendingList();
}


function printFastGradingReport() {
    const examId = document.getElementById('fast-exam-select').value;
    if (!examId) { showNotification('اختر الامتحان أولاً لطباعة تقريره', 'error'); return; }

    const exam = db.exams.find(e => e.id == examId);
    const scores = db.scores.filter(s => s.examId == examId);

    let reportHtml = `
        <div style="direction: rtl; font-family: 'Tajawal', sans-serif; padding: 20px;">
            <h1 style="text-align: center; color: #4f46e5;">تقرير نتائج: ${exam.title}</h1>
            <p style="text-align: center; color: #64748b;">الدرجة النهائية: ${exam.maxMarks} | التاريخ: ${new Date().toLocaleDateString('ar-EG')}</p>
            <table style="width: 100%; border-collapse: collapse; margin-top: 20px;">
                <thead>
                    <tr style="background: #f1f5f9;">
                        <th style="border: 1px solid #e2e8f0; padding: 12px;">اسم الطالب</th>
                        <th style="border: 1px solid #e2e8f0; padding: 12px;">الدرجة</th>
                        <th style="border: 1px solid #e2e8f0; padding: 12px;">الحالة</th>
                    </tr>
                </thead>
                <tbody>
                    ${scores.map(s => {
        const st = db.students.find(x => x.id === s.studentId);
        const percent = (s.mark / exam.maxMarks) * 100;
        return `
                            <tr>
                                <td style="border: 1px solid #e2e8f0; padding: 10px;">${st ? st.name : '---'}</td>
                                <td style="border: 1px solid #e2e8f0; padding: 10px; text-align: center;">${s.mark} / ${exam.maxMarks}</td>
                                <td style="border: 1px solid #e2e8f0; padding: 10px; text-align: center; font-weight: bold; color: ${percent >= 50 ? '#10b981' : '#ef4444'}">
                                    ${percent >= 50 ? 'ناجح' : 'راسب'}
                                </td>
                            </tr>
                        `;
    }).join('')}
                </tbody>
            </table>
        </div>
    `;

    const printWin = window.open('', '_blank');
    printWin.document.write(`<html><head><title>تقرير النتائج</title></head><body>${reportHtml}</body></html>`);
    printWin.document.close();
    setTimeout(() => {
        printWin.print();
        printWin.close();
    }, 500);
}

function renderFastHistory() {
    const examId = document.getElementById('fast-exam-select').value;
    const historyList = document.getElementById('fast-history-list');
    if (!historyList) return;

    if (!examId) {
        historyList.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:2rem; opacity:0.5;">يرجى اختيار امتحان لعرض السجل</td></tr>';
        return;
    }

    const scores = db.scores.filter(s => s.examId == examId).reverse().slice(0, 15);

    historyList.innerHTML = scores.map(s => {
        const student = db.students.find(x => x.id === s.studentId);
        const isAbsent = s.mark === -1;
        return `
            <tr class="fade-in">
                <td><strong>${student ? student.name : 'طالب'}</strong></td>
                <td>
                    <span style="font-weight:800; font-size:1.1rem; color:${isAbsent ? 'var(--danger)' : 'var(--primary)'}">
                        ${isAbsent ? 'غائب' : s.mark}
                    </span>
                </td>
                <td>${new Date(s.id).toLocaleTimeString('ar-EG')}</td>
                <td>
                    <button class="btn" style="color:var(--danger); padding:4px;" onclick="deleteScore(${s.id})">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>
        `;
    }).join('') || '<tr><td colspan="4" style="text-align:center; padding:2rem;">لا يوجد رصد لهذا الامتحان حالياً</td></tr>';
}

function renderFastPendingList() {
    const examId = document.getElementById('fast-exam-select').value;
    const groupId = document.getElementById('fast-group-select').value;
    const list = document.getElementById('fast-pending-list');
    const countEl = document.getElementById('fast-pending-count');

    if (!list || !countEl) return;
    if (!examId || !groupId) {
        list.innerHTML = '<tr><td colspan="3" style="text-align:center; padding:2rem; opacity:0.5;">يرجى اختيار المجموعة لفلترة المتبقيين</td></tr>';
        countEl.innerText = '0';
        return;
    }

    // Students in this group OR all students in grade
    const groupStudents = groupId === 'all'
        ? db.students.filter(s => String(s.grade) === String(currentGrade))
        : db.students.filter(s => String(s.groupId) === String(groupId));
    // Students who already have a score
    const recordedIds = db.scores.filter(sc => sc.examId == examId).map(sc => sc.studentId);

    const pendingStudents = groupStudents.filter(s => !recordedIds.includes(s.id));
    countEl.innerText = pendingStudents.length;

    list.innerHTML = pendingStudents.map(s => `
        <tr class="fade-in">
            <td style="font-weight:700;">${s.name}</td>
            <td style="font-family:monospace; color:var(--text-muted); font-size:0.8rem;">${s.qrCode}</td>
            <td style="text-align:center; display:flex; gap:5px; justify-content:center;">
                <button class="btn btn-primary" style="padding:4px 12px; font-size:0.75rem; background:var(--primary);" onclick="processFastScan('${s.qrCode}')">
                    <i class="fas fa-edit"></i> رصد الدرجة
                </button>
                <button class="btn btn-primary" style="padding:4px 12px; font-size:0.75rem; background:var(--danger);" onclick="markStudentExamAbsentDirect(${s.id}, ${examId})">
                    <i class="fas fa-user-times"></i> غائب
                </button>
            </td>
        </tr>
    `).join('') || '<tr><td colspan="3" style="text-align:center; padding:2rem; color:var(--accent); font-weight:700;">✅ اكتمل رصد جميع طلاب المجموعة!</td></tr>';
}

function markStudentExamAbsentDirect(studentId, examId) {
    db.scores.push({
        id: Date.now(),
        studentId: studentId,
        examId: parseInt(examId),
        mark: -1,
        date: new Date().toISOString()
    });
    db.save();
    showNotification('تم تسجيل الطالب غائب');
    renderFastHistory();
    renderFastPendingList();
}

function deleteScore(scoreId) {
    if (!confirm('هل تريد حذف هذه الدرجة؟')) return;
    db.scores = db.scores.filter(s => s.id !== scoreId);
    db.save();
    showNotification('تم الحذف');
    renderFastHistory();
    renderFastPendingList();
}

function openGradingArchive() {
    const container = document.getElementById('grading-archive-list');
    if (!container) return;

    // Get all exams that have scores for the current grade
    const myExams = db.exams.filter(e => String(e.grade) === String(currentGrade)).reverse();

    container.innerHTML = myExams.map(ex => {
        const scores = db.scores.filter(s => s.examId === ex.id);
        const attended = scores.filter(s => s.mark !== -1).length;
        const absent = scores.filter(s => s.mark === -1).length;

        return `
            <div class="card archive-card" style="padding: 1.5rem; text-align: center; border: 2px solid var(--border);">
                <div style="font-weight: 800; font-size: 1.3rem; margin-bottom: 0.5rem; color: var(--primary);">${ex.title}</div>
                <div style="font-size: 0.9rem; color: var(--text-muted); margin-bottom: 1rem;">
                    <i class="fas fa-users"></i> إجمالي: ${attended + absent} <br>
                    <span style="color:var(--accent)">${attended} حاضر</span> | <span style="color:var(--danger)">${absent} غائب</span>
                </div>
                <button class="btn btn-primary" style="width:100%;" onclick="toggleModal('grading-archive-modal', false); openMarksModal(${ex.id})">
                    <i class="fas fa-eye"></i> عرض النتائج
                </button>
            </div>
        `;
    }).join('') || '<p style="text-align:center; padding:3rem; grid-column:span 3; opacity:0.5;">لا يوجد امتحانات مؤرشفة بعد</p>';

    toggleModal('grading-archive-modal', true);
}


function renderExams() {
    const list = document.getElementById('exams-list');
    if (!list) return;

    // Students in the active group
    const groupStudents = db.students.filter(s => s.grade == currentGrade && s.groupId == currentGroupId);
    const groupStudentIds = groupStudents.map(s => s.id);

    // Filter exams to those belonging to our active grade 
    // AND (either matching this group Specifically OR are general grade-wide/archived exams)
    const exams = db.exams.filter(e =>
        String(e.grade) === String(currentGrade) &&
        (!e.groupId || String(e.groupId) === String(currentGroupId))
    );
    list.innerHTML = exams.map(e => {
        // Filter scores to ONLY those belonging to our active group's students
        const groupScores = db.scores.filter(s => s.examId === e.id && groupStudentIds.includes(s.studentId));
        const validScores = groupScores.filter(s => s.mark !== -1);

        const avg = validScores.length > 0 ? (validScores.reduce((sum, s) => sum + s.mark, 0) / validScores.length).toFixed(1) : 0;
        return `
            <tr>
                <td><strong>${e.title}</strong></td>
                <td>${new Date(e.id).toLocaleDateString('ar-EG')}</td>
                <td>${e.maxMarks || 100}</td>
                <td><span class="status-badge" style="background:#f0f9ff; color:#0369a1">${avg} / ${e.maxMarks || 100}</span></td>
                <td style="text-align:center;">
                    <button class="btn btn-primary" style="background:var(--accent); color:white; padding:5px 15px;" onclick="openMarksModal(${e.id})">
                        عرض النتائج <i class="fas fa-chart-line"></i>
                    </button>
                </td>
            </tr>
        `;
    }).join('') || '<tr><td colspan="5" style="text-align:center; padding:2rem;">لا توجد امتحانات مضافة في هذا الصف</td></tr>';
}

function handleAddExam() {
    const title = document.getElementById('modal-exam-title').value;
    const marks = parseInt(document.getElementById('modal-exam-marks').value);
    if (!title || !marks) return;
    db.exams.push({
        id: Date.now(),
        title,
        maxMarks: marks,
        grade: currentGrade,
        groupId: currentGroupId // Tag exam with current group context
    });
    db.save();
    renderExams();
    toggleModal('exam-modal', false);
    document.getElementById('modal-exam-title').value = '';
    document.getElementById('modal-exam-marks').value = '';
    showNotification('تم إنشاء الامتحان بنجاح');
}

function openMarksModal(id) {
    currentSelectedExamId = id;
    currentMarksFilter = 'all';
    renderMarksModalContent();
    toggleModal('marks-modal', true);
}

function filterMarks(status) {
    currentMarksFilter = status;
    renderMarksModalContent();
}

function renderMarksModalContent() {
    const id = currentSelectedExamId;
    const ex = db.exams.find(e => e.id === id);
    if (!ex) return;

    document.getElementById('marks-exam-title').innerText = `نتائج: ${ex.title}`;
    const container = document.getElementById('marks-entry-container');

    const groupStudents = db.students.filter(s => String(s.grade) === String(currentGrade) && String(s.groupId) === String(currentGroupId));
    const groupStudentIds = groupStudents.map(s => s.id);

    let scores = db.scores.filter(s => s.examId === id && groupStudentIds.includes(s.studentId));

    if (currentMarksFilter === 'present') {
        scores = scores.filter(s => s.mark !== -1);
    } else if (currentMarksFilter === 'absent') {
        scores = scores.filter(s => s.mark === -1);
    }

    container.innerHTML = scores.map(s => {
        const st = db.students.find(x => x.id === s.studentId);
        const displayMark = s.mark === -1 ? '<span class="status-badge" style="background:#fee2e2; color:#991b1b">غائب</span>' : `<b>${s.mark}</b> / ${ex.maxMarks}`;
        return `
            <div style="display:flex; justify-content:space-between; align-items:center; padding:1rem; border-bottom:1px solid #eee;">
                <span>${st ? st.name : 'طالب'}</span>
                <span>${displayMark}</span>
            </div>
        `;
    }).join('') || '<p style="text-align:center; padding:2rem; opacity:0.5;">لا يوجد طلاب في هذا التصنيف</p>';
}

function printExamResults(examId, filter = 'all') {
    const ex = db.exams.find(e => e.id === examId);
    if (!ex) return;

    const groupStudents = db.students.filter(s => String(s.grade) === String(currentGrade) && String(s.groupId) === String(currentGroupId));
    const groupStudentIds = groupStudents.map(s => s.id);
    let scores = db.scores.filter(s => s.examId === examId && groupStudentIds.includes(s.studentId));

    if (filter === 'present') {
        scores = scores.filter(s => s.mark !== -1);
    } else if (filter === 'absent') {
        scores = scores.filter(s => s.mark === -1);
    }

    const printWindow = window.open('', '_blank');
    let html = `
        <html dir="rtl">
        <head>
            <title>كشف درجات: ${ex.title}</title>
            <style>
                @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;700&display=swap');
                body { font-family: 'Tajawal', sans-serif; padding: 20mm; }
                table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                th, td { border: 1px solid #ddd; padding: 12px; text-align: right; }
                th { background-color: #f1f5f9; }
                .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #000; padding-bottom: 15px; }
                .absent { color: red; font-weight: bold; }
            </style>
        </head>
        <body>
            <div class="header">
                <h1>كشف درجات ${ex.title}</h1>
                <p>الصف: ${gradesList.find(g => String(g.id) === String(currentGrade))?.name || '---'} | المجموعة: ${db.groups.find(g => String(g.id) === String(currentGroupId))?.name || '---'}</p>
                <p>الحالة: ${filter === 'all' ? 'الكل' : (filter === 'present' ? 'الحاضرين' : 'الغائبين')}</p>
            </div>
            <table>
                <thead>
                    <tr>
                        <th>م</th>
                        <th>اسم الطالب</th>
                        <th>الدرجة</th>
                        <th>ملاحظات</th>
                    </tr>
                </thead>
                <tbody>
    `;

    scores.forEach((s, idx) => {
        const st = db.students.find(x => x.id === s.studentId);
        const markText = s.mark === -1 ? '<span class="absent">غائب</span>' : s.mark;
        html += `
            <tr>
                <td>${idx + 1}</td>
                <td>${st ? st.name : '---'}</td>
                <td>${markText} / ${ex.maxMarks}</td>
                <td></td>
            </tr>
        `;
    });

    html += `
                </tbody>
            </table>
            <div style="margin-top: 50px; display: flex; justify-content: space-between;">
                <p>توقيع المحاضر: ........................</p>
                <p>تاريخ الكشف: ${new Date().toLocaleDateString('ar-EG')}</p>
            </div>
            <script>window.onload = () => { window.print(); window.close(); }</script>
        </body>
        </html>
    `;
    printWindow.document.write(html);
}

// --- 8. AI & Analytics Core Engine ---
function runAIAnalytics() {
    const dropoutRiskEl = document.getElementById('ai-dropout-risk');
    const risingStarsEl = document.getElementById('ai-rising-stars');
    const avgEngagementEl = document.getElementById('ai-avg-engagement');
    const riskList = document.getElementById('ai-risk-list');

    if (!dropoutRiskEl) return;

    let dropoutCount = 0;
    let starCount = 0;
    let totalEng = 0;

    // Filter strictly to current group
    const activeStudents = db.students.filter(s => s.grade == currentGrade && s.groupId == currentGroupId);
    const studentAnalyses = activeStudents.map(s => analyzeStudent(s.id));

    // Stats
    dropoutCount = studentAnalyses.filter(a => a.riskLevel === 'CRITICAL' || a.riskLevel === 'HIGH').length;
    starCount = studentAnalyses.filter(a => a.academicTrend === 'IMPROVING').length;
    totalEng = studentAnalyses.reduce((sum, a) => sum + a.engagementScore, 0) / (activeStudents.length || 1);

    dropoutRiskEl.innerText = dropoutCount;
    risingStarsEl.innerText = starCount;
    avgEngagementEl.innerText = `${Math.round(totalEng)}%`;

    // Risk Table Rendering
    const riskyStudents = studentAnalyses
        .filter(a => a.riskScore > 40)
        .sort((a, b) => b.riskScore - a.riskScore);

    riskList.innerHTML = riskyStudents.map(a => `
        <div style="display:flex; justify-content:space-between; align-items:center; padding:1rem; border-bottom:1px solid var(--border); background:${a.riskLevel === 'CRITICAL' ? '#fff1f2' : 'transparent'}">
            <div>
                <strong>${a.name}</strong> <span class="status-badge" style="background:${a.riskColor}; color:white">${a.riskLevel}</span>
                <br><small style="color:var(--text-muted)">${a.recommendation}</small>
            </div>
            <button class="btn" onclick="viewDetailedProfile(${a.id})" style="background:var(--primary); color:white; padding:5px 12px;">مراجعة</button>
        </div>
    `).join('') || '<p style="padding:1rem;">لا يوجد مخاطر مكتشفة حالياً. العمل يسير بشكل ممتاز! ✅</p>';

    initAnalyticsCharts();
}

function analyzeStudent(id) {
    const s = db.students.find(x => x.id === id);
    if (!s) return null;

    const atts = db.attendance.filter(a => a.studentId == id);
    const marks = db.scores.filter(sc => sc.studentId == id);

    // 1. Attendance Risk (Weight: 60%)
    const today = new Date();
    const last30Days = new Date(today.setDate(today.getDate() - 30)).toISOString();
    const recentAtts = atts.filter(a => a.date >= last30Days);
    const attendanceRate = (recentAtts.length / 8) * 100; // Assuming 8 sessions/month
    const attRisk = Math.max(0, 100 - attendanceRate);

    // Check for consecutive absences
    const sortedAtts = atts.sort((a, b) => new Date(b.date) - new Date(a.date));
    let gapSessions = 0;
    if (sortedAtts.length > 0) {
        const lastSessionDate = new Date(sortedAtts[0].date);
        const daysSince = Math.floor((new Date() - lastSessionDate) / (1000 * 60 * 60 * 24));
        gapSessions = Math.floor(daysSince / 3); // Approx 3 days per session
    } else {
        gapSessions = 5; // Long term absence if never attended
    }

    // 2. Academic Risk (Weight: 30%)
    let academicTrend = 'STABLE';
    let gradeRisk = 0;
    const validMarks = marks.filter(m => m.mark !== -1);
    if (validMarks.length >= 2) {
        const latest = validMarks[validMarks.length - 1].mark;
        const previous = validMarks[validMarks.length - 2].mark;
        if (latest < previous) academicTrend = 'DECLINING';
        if (latest > previous + 5) academicTrend = 'IMPROVING';

        const avg = validMarks.reduce((sum, m) => sum + m.mark, 0) / validMarks.length;
        if (latest < avg * 0.8) gradeRisk = 50;
    }
    // Boost risk if the student has multiple exam absences
    const examAbsenceCount = marks.filter(m => m.mark === -1).length;
    if (examAbsenceCount >= 2) gradeRisk += 20;

    // 3. Engagement Score (Based on points/shop)
    const engagementScore = Math.min(100, (s.points / 100) * 100);

    // Final Risk Calculation
    let riskScore = (attRisk * 0.6) + (gradeRisk * 0.3) + (gapSessions * 10);
    riskScore = Math.min(100, riskScore);

    let riskLevel = 'LOW';
    let riskColor = '#10b981';
    let recommendation = 'الاستمرار في التحفيز';

    if (riskScore > 30) { riskLevel = 'MEDIUM'; riskColor = '#f59e0b'; recommendation = 'ملاحظة النشاط في الحصص القادمة'; }
    if (riskScore > 60) { riskLevel = 'HIGH'; riskColor = '#f97316'; recommendation = 'يرجى الاتصال بولي الأمر فوراً'; }
    if (riskScore > 85 || gapSessions >= 3) { riskLevel = 'CRITICAL'; riskColor = '#ef4444'; recommendation = 'خطر الانقطاع النهائي! مطلوب مقابلة شخصية'; }

    return {
        id: s.id,
        name: s.name,
        riskScore,
        riskLevel,
        riskColor,
        academicTrend,
        engagementScore,
        recommendation,
        gapSessions
    };
}

function initAnalyticsCharts() {
    const grades = { '1': 0, '2': 0, '3': 0 };
    db.students.forEach(s => grades[s.grade]++);

    new Chart(document.getElementById('grade-chart-canvas').getContext('2d'), {
        type: 'doughnut',
        data: {
            labels: ['الصف الأول', 'الصف الثاني', 'الصف الثالث'],
            datasets: [{
                data: [grades['1'], grades['2'], grades['3']],
                backgroundColor: ['#4f46e5', '#10b981', '#f59e0b']
            }]
        }
    });

    // Audit: Filter analytics by current group context
    const groupStudents = db.students.filter(s => s.grade == currentGrade && s.groupId == currentGroupId);
    const groupStudentIds = groupStudents.map(s => s.id);

    // Revenue Estimate (example based on attendance, though actual payment data might be better)
    const groupAttCount = db.attendance.filter(a => groupStudentIds.includes(a.studentId) && a.status === 'present').length;
    const income = groupAttCount * 50;

    const exp = db.expenses.filter(e => e.groupId == currentGroupId).reduce((sum, e) => sum + e.amount, 0);

    new Chart(document.getElementById('finance-chart-canvas').getContext('2d'), {
        type: 'bar',
        data: {
            labels: ['الإيرادات (تقديري)', 'المصروفات'],
            datasets: [{
                label: 'جنية مصري',
                data: [income, exp],
                backgroundColor: ['#10b981', '#ef4444']
            }]
        }
    });
}

// --- 7. GLOBAL SCANNER ENGINE (ROBUST & SMART) ---
let scannerBuffer = '';
let scannerLastKeyTime = 0;

window.addEventListener('keydown', (e) => {
    // Avoid interference with natural typing in long textareas
    if (e.target.tagName === 'TEXTAREA') return;

    const now = Date.now();

    // Sequence speed check: Real hardware scanners are extremely fast (< 30ms between keys)
    const isFast = (now - scannerLastKeyTime) < 100;

    // Reset buffer if this is a new "manual" typing attempt
    if (!isFast) {
        scannerBuffer = '';
    }

    if (e.key === 'Enter') {
        const code = scannerBuffer.trim();
        if (code.length >= 4) {
            // Audit: Find student ONLY in current grade to prevent global scan mixing
            const student = db.students.find(s => (s.qrCode === code || code.includes(s.qrCode)) && String(s.grade) === String(currentGrade));
            if (student) {
                e.preventDefault();
                e.stopPropagation();

                // If focus is in a mark input, clear it to prevent the ID from leaking in
                if (e.target.tagName === 'INPUT') {
                    e.target.value = '';
                }

                handleGlobalScanDispatch(student.qrCode);
                scannerBuffer = '';
                return;
            }
        }
        scannerBuffer = '';
        return;
    }

    // Capture alphanumeric only for the buffer
    if (e.key.length === 1) {
        scannerBuffer += e.key;
        scannerLastKeyTime = now;

        // Smart matching for scanners that don't send "Enter"
        if (scannerBuffer.length >= 6) {
            const student = db.students.find(s => s.qrCode === scannerBuffer);
            if (student) {
                // Give it a tiny delay to catch any suffix before dispatching
                setTimeout(() => {
                    if (scannerBuffer !== "") {
                        handleGlobalScanDispatch(scannerBuffer);
                        scannerBuffer = '';
                    }
                }, 50);
            }
        }
    }
});

/** Global Dispatcher with UI Intelligence **/
function handleGlobalScanDispatch(code) {
    const isGrading = document.getElementById('fast-grading-section').style.display === 'block';
    const isFollowup = document.getElementById('followup-section').style.display === 'block';

    // 1. AUTO-SAVE (Context: Fast Grading)
    // If scanning student B while a mark for student A is typed, SAVE student A first.
    if (isGrading && currentFastStudent) {
        const inputEl = document.getElementById('fast-mark-input');
        const examId = document.getElementById('fast-exam-select').value;
        const markVal = inputEl ? inputEl.value.trim() : "";
        if (markVal !== "" && !isNaN(parseFloat(markVal))) {
            processAndSaveGrade(currentFastStudent, examId, parseFloat(markVal));
        }
    }

    // 2. AUTO-OPEN PROFILE (Visual Confirmation)
    // Always show the Smart Card for visual feedback when scanning (unless in specific modes that have their own UI)
    const s = db.students.find(x => (x.qrCode === code || (code.length >= 8 && code.includes(x.qrCode))) && String(x.grade) === String(currentGrade));
    if (s && !isGrading) {
        openSmartCard(s.id);
    }

    // 3. LOGIC DISPATCH
    if (isGrading) {
        processFastScan(code);
    } else if (isFollowup) {
        handleExamAttendanceScan(code);
    } else {
        processScan(code);
    }

    // UI Monitor Ping
    const mon = document.getElementById('scanner-monitor');
    if (mon) {
        mon.style.display = 'block';
        mon.innerHTML = `<i class='fas fa-barcode' style='color:#10b981'></i> جاري المعالجة: <span style='color:#fff'>${code}</span>`;
        setTimeout(() => mon.style.display = 'none', 1500);
    }
}

function processScan(token) {
    if (typeof token === 'object' && token.decodedText) token = token.decodedText;
    const cleanToken = token.trim();
    let student = db.students.find(s => s.qrCode === cleanToken);
    if (!student) {
        student = db.students.find(s => cleanToken.includes(s.qrCode) || s.qrCode.includes(cleanToken));
    }

    if (!student) {
        showNotification(`كود غير مسجل: ${cleanToken}`, 'warning');
        return;
    }

    // --- STRICT CONTEXT CHECK: Only allow students from CURRENT GRADE ---
    if (String(student.grade) !== String(currentGrade)) {
        const studentGradeObj = gradesList.find(g => g.id == student.grade);
        playSound('error');
        showNotification(`🛑 خطأ: الطالب ${student.name} مقيد في (${studentGradeObj ? studentGradeObj.name : 'سنة أخرى'}). يرجى التبديل للسنة الدراسية الصحيحة أولاً.`, 'error');
        return;
    }

    // --- STRICT GROUP CHECK ---
    const rawSessionId = activePortalGroupId || currentGroupId;
    let isGroupMatched = false;
    let sessionGroupIdForRecord = rawSessionId;

    if (String(rawSessionId).startsWith('joint:')) {
        const allowedGroupIds = rawSessionId.split(':')[1].split(',');
        isGroupMatched = allowedGroupIds.includes(String(student.groupId));
        sessionGroupIdForRecord = student.groupId; // NEW: Record under original group on Joint Days
    } else {
        isGroupMatched = String(student.groupId) === String(rawSessionId);
        sessionGroupIdForRecord = rawSessionId;
    }

    if (!isGroupMatched) {
        const studentGroupObj = db.groups.find(g => g.id == student.groupId);
        playSound('error');
        showNotification(`⚠️ تنبيه: الطالب ${student.name} مقيد في مجموعة (${studentGroupObj ? studentGroupObj.name : 'أخرى'}) وليس في هذه الجلسة.`, 'warning');
    }

    // 3. Success! Visual feedback for the teacher
    const mon = document.getElementById('scanner-monitor');
    if (mon) {
        mon.innerHTML = `<i class='fas fa-check-double' style='color:#10b981'></i> تم التعرف: <span style='color:#fff'>${student.name}</span>`;
    }

    // --- NEW: Always open Smart Card for visual confirmation as requested ---
    openSmartCard(student.id);

    const todayStr = new Date().toLocaleDateString('en-CA');

    // --- NEW: Block Scanning if subscription is not active ---
    if (!db.settings.isMonthlyActive) {
        playSound('error');
        showNotification('🛑 تنبيه: يرجى تفعيل "بدء الاشتراك" من قسم الخزينة أولاً لتتمكن من رصد الحضور', 'error');
        return;
    }

    // --- 4. Permanent Attendance Logic ---

    // التحقق من الجلسة الحالية فقط (مش كل اليوم)
    const alreadyInSession = currentSessionAttendance.some(s => s.id === student.id);

    if (alreadyInSession) {
        // مسجل في نفس الجلسة → تحذير فقط بدون alert
        playSound('error');
        showNotification(`⚠️ ${student.name} مسجل مسبقاً في هذه الجلسة`, 'warning');
        if (document.getElementById('voice-feedback-toggle')?.checked) {
            const msg = new SpeechSynthesisUtterance();
            msg.text = 'تم تسجيله من قبل';
            msg.lang = 'ar-SA';
            window.speechSynthesis.speak(msg);
        }
        openSmartCard(student.id);
        return;
    }

    // مش في الجلسة الحالية → سجّله حتى لو كان في جلسة سابقة نفس اليوم
    let todayRecord = db.attendance.find(a =>
        a.studentId == student.id &&
        new Date(a.date).toLocaleDateString('en-CA') === todayStr
    );

    if (todayRecord) {
        todayRecord.status = 'present';
        todayRecord.date = new Date().toISOString();
        todayRecord.groupId = sessionGroupIdForRecord;
    } else {
        db.attendance.push({
            id: Date.now(),
            studentId: student.id,
            groupId: sessionGroupIdForRecord,
            date: new Date().toISOString(),
            status: 'present'
        });
        student.points = (student.points || 0) + 5;
    }

    showNotification(`تم رصد حضور: ${student.name} ✅`, 'success');

    currentSessionAttendance.unshift({ ...student, scanTime: new Date().toISOString() });
    db.currentSessionAttendance = currentSessionAttendance;
    renderSessionTable();

    // --- 5. Mode Specific Logic ---
    const isAttendanceSection = document.getElementById('attendance-section').style.display === 'block';

    const hasPaidCurrentCycle = db.payments.some(p =>
        p.studentId == student.id &&
        p.category === 'اشتراك شهري' &&
        p.cycleId == db.settings.activeCycle
    );

    // Group Warning
    const studentGroup = db.groups.find(g => g.id == student.groupId);
    if (!isGroupMatched) {
        showNotification(`⚠️ تنبيه: ${student.name} ينتمي لمجموعة (${studentGroup ? studentGroup.name : 'أخرى'})`, 'warning');
    }

    // Smart Handout Distribution
    if (activeHandoutId) {
        const alreadyHasHandout = db.studentHandouts.some(sh => sh.studentId == student.id && sh.handoutId === activeHandoutId);
        if (!alreadyHasHandout) {
            db.studentHandouts.push({
                id: Date.now(),
                studentId: student.id,
                handoutId: activeHandoutId,
                date: new Date().toISOString()
            });
            showNotification(`تم تسليم الملزمة لـ ${student.name}`, 'success');
        }
    }

    db.save();

    // Auto-update Absence Report if visible
    if (document.getElementById('absence-section').style.display === 'block') {
        generateAbsenceReport();
    }

    // 7. Open Smart Card UI
    openSmartCard(student.id);

    // Voice Feedback
    playSound('success');
    speakName(student.name);
}

function searchStudentSmart(query) {
    const results = document.getElementById('attendance-manual-results');
    if (!query || query.trim().length < 1) {
        results.style.display = 'none';
        results.innerHTML = '';
        return;
    }

    // Sync active grade/group context to ensure db.settings resolves correctly
    currentGrade = localStorage.getItem('edu_active_grade') || currentGrade;
    currentGroupId = localStorage.getItem('edu_active_group') || currentGroupId;

    // Get active context robustly using unified keys
    const activeGrade = currentGrade || localStorage.getItem('edu_active_grade');
    const activeGroup = currentGroupId || localStorage.getItem('edu_active_group');

    if (!activeGroup || activeGroup === 'all') {
        results.style.display = 'block';
        results.innerHTML = '<div class="result-item" style="color:var(--danger); justify-content:center;">⚠️ يرجى اختيار مجموعة أولاً من قائمة المجموعات أو لوحة التحكم</div>';
        return;
    }

    // Normalize Arabic for inclusive search
    const normalize = (text) => {
        return String(text)
            .replace(/[أإآ]/g, 'ا')
            .replace(/ة/g, 'ه')
            .replace(/ى/g, 'ي')
            .toLowerCase()
            .trim();
    };

    const q = normalize(query);

    // --- NEW: Block Search selection if subscription is not active ---
    if (!db.settings.isMonthlyActive) {
        results.style.display = 'block';
        results.innerHTML = '<div class="result-item" style="color:var(--danger); justify-content:center;">⚠️ يرجى تفعيل الاشتراك من الخزينة أولاً</div>';
        return;
    }

    const matchedStudents = db.students.filter(s => {
        return String(s.grade) === String(activeGrade) &&
            String(s.groupId) === String(activeGroup) &&
            (normalize(s.name).includes(q) || String(s.qrCode).startsWith(query));
    }).slice(0, 5);

    if (matchedStudents.length > 0) {
        results.style.display = 'block';
        results.innerHTML = matchedStudents.map(s => `
            <div class="result-item" onclick="recordQuickAction(${s.id}, 'attendance'); openSmartCard(${s.id});">
                <div style="text-align:right;">
                    <div style="font-weight:700; color:var(--primary);">${s.name}</div>
                    <div style="font-size:0.75rem; color:var(--text-muted);">${s.qrCode}</div>
                </div>
                <i class="fas fa-plus-circle" style="color:var(--accent);"></i>
            </div>
        `).join('');
    } else {
        results.style.display = 'block';
        results.innerHTML = '<div class="result-item" style="color:var(--text-muted); justify-content:center;">لا يوجد نتائج لهذه المجموعة</div>';
    }
}

function openSmartCard(studentId) {
    const s = db.students.find(x => x.id == studentId);
    if (!s) return;

    // Reset Search
    document.getElementById('attendance-manual-results').style.display = 'none';
    document.getElementById('manual-student-entry').value = '';

    // 1. Fetch History & Context (Check latest archived session first)
    const todayStr = new Date().toLocaleDateString('en-CA');
    const groupSessions = (db.absenceSessions || [])
        .filter(sess => String(sess.groupId) === String(s.groupId) && new Date(sess.date).toLocaleDateString('en-CA') !== todayStr)
        .sort((a, b) => new Date(b.date) - new Date(a.date));

    let lastAttStatus = null;
    if (groupSessions.length > 0) {
        const lastSession = groupSessions[0];
        if (lastSession.presentIds && lastSession.presentIds.includes(s.id)) lastAttStatus = 'present';
        else if (lastSession.absentIds && lastSession.absentIds.includes(s.id)) lastAttStatus = 'absent';
        else if (lastSession.presentNames && lastSession.presentNames.includes(s.name)) lastAttStatus = 'present';
        else if (lastSession.absenteeNames && lastSession.absenteeNames.includes(s.name)) lastAttStatus = 'absent';
    }

    const lastAttFromLegacy = db.attendance
        .filter(a => a.studentId == s.id && new Date(a.date).toLocaleDateString('en-CA') !== todayStr)
        .sort((a, b) => new Date(b.date) - new Date(a.date))[0];

    // Determine the status to display
    const finalStatus = lastAttStatus || (lastAttFromLegacy ? lastAttFromLegacy.status : null);

    const currentCycleId = db.settings.activeCycle;
    const payment = db.payments.find(p =>
        p.studentId == s.id &&
        p.category === 'اشتراك شهري' &&
        p.cycleId == currentCycleId
    );
    const isPaid = !!payment;
    const isExemption = payment?.isExemption;

    // 2. Render Card
    const container = document.getElementById('smart-card-content');
    if (!container) return;

    container.innerHTML = `
        <div style="text-align: center; padding: 0.5rem;">
            <div class="avatar" style="width: 100px; height: 100px; font-size: 3rem; margin: 0 auto 1rem; background: var(--bg-hover); color: var(--accent); border: 2px solid var(--accent);">
                ${s.name.charAt(0)}
            </div> 
            <h2 style="margin-bottom: 0.5rem; color: var(--text-main);">${s.name}</h2>
            <div style="display:flex; justify-content:center; gap:8px; margin-bottom:1.5rem;">
                <span class="status-badge" style="background:var(--bg-light);">كود: ${s.qrCode}</span>
                <span class="status-badge" style="background:#fef3c7; color:#92400e;">${s.points || 0} نقطة 💎</span>
            </div>

            <div class="grid" style="grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1.5rem;">
                <div class="card" style="padding:1rem; border:2px solid ${finalStatus === 'absent' ? 'var(--danger)' : 'var(--accent)'};">
                    <small style="color:var(--text-muted)">الحصة السابقة</small>
                    <div style="font-weight:700; color:${finalStatus === 'absent' ? 'var(--danger)' : 'var(--accent)'}">${finalStatus ? (finalStatus === 'present' ? 'حضور ✅' : 'غياب ❌') : 'أول حضور'}</div>
                </div>
                <div class="card" style="padding:1rem; border:2px solid ${isPaid ? (isExemption ? 'var(--border)' : 'var(--accent)') : 'var(--danger)'};">
                    <small style="color:var(--text-muted)">اشتراك الشهر</small>
                    <div style="font-weight:700; color:${isPaid ? (isExemption ? 'var(--text-muted)' : 'var(--accent)') : 'var(--danger)'}">${isPaid ? (isExemption ? 'معفي ✅' : 'خالص ✅') : 'غير خالص ⏳'}</div>
                </div>
            </div>

            <!-- Quick Action Buttons -->
            <div style="display: flex; flex-direction: column; gap: 10px; margin-bottom: 1rem;">
                <button class="btn btn-primary" style="height: 60px; border-radius: 12px; font-size: 1.1rem; background: var(--accent); box-shadow: 0 4px 12px -2px rgba(16, 185, 129, 0.3);"
                    onclick="recordQuickAction(${s.id}, 'attendance'); openSmartCard(${s.id});">
                    <i class="fas fa-user-check"></i> تسجيل حضور
                </button>
                <!-- أزرار دفع الاشتراك الثلاثة المستقلة -->
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                    <button class="btn btn-payment" style="height: 65px; border-radius: 12px; font-size: 0.88rem; line-height:1.3; background: #16a34a; box-shadow: 0 4px 14px -2px rgba(22,163,74,0.35);"
                        onclick="payLessonDirect(${s.id})">
                        <i class="fas fa-chalkboard-teacher" style="display:block;font-size:1.2rem;margin-bottom:3px;"></i>
                        دفع اشتراك الدرس
                    </button>
                    <button class="btn btn-payment" style="height: 65px; border-radius: 12px; font-size: 0.88rem; line-height:1.3; background: #2563eb; box-shadow: 0 4px 14px -2px rgba(37,99,235,0.35);"
                        onclick="payPlatformDirect(${s.id})">
                        <i class="fas fa-laptop-code" style="display:block;font-size:1.2rem;margin-bottom:3px;"></i>
                        دفع اشتراك المنصة
                    </button>
                </div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 4px;">
                    <button class="btn btn-payment" style="height: 65px; border-radius: 12px; font-size: 0.88rem; line-height:1.3; background: linear-gradient(135deg,#7c3aed,#db2777); box-shadow: 0 4px 14px -2px rgba(124,58,237,0.35);"
                        onclick="payBothDirect(${s.id})">
                        <i class="fas fa-layer-group" style="display:block;font-size:1.2rem;margin-bottom:3px;"></i>
                        دفع الاشتراكين معاً
                    </button>
                    <button class="btn btn-payment" style="height: 65px; border-radius: 12px; font-size: 0.88rem; line-height:1.3; background: var(--vibrant-orange);"
                        onclick="recordQuickAction(${s.id}, 'handout'); openSmartCard(${s.id});">
                        <i class="fas fa-book" style="display:block;font-size:1.2rem;margin-bottom:3px;"></i>
                        دفع ملزمة
                    </button>
                </div>
                
                ${!isPaid ? `
                <button class="btn" style="height: 45px; border-radius: 12px; background: #f5f3ff; border: 1px solid #ddd6fe; color: #7c3aed; font-weight: 700; box-shadow: 0 4px 12px -2px rgba(124, 58, 237, 0.15);"
                    onclick="exemptMonthlyPayment(${s.id}); openSmartCard(${s.id});">
                    <i class="fas fa-hand-holding-heart"></i> عمل إعفاء لهذا الطالب (يتيم / حالة خاصة)
                </button>
                <button class="btn" style="height: 45px; border-radius: 12px; background: #fff7ed; border: 1px solid #fed7aa; color: #ea580c; font-weight: 700; box-shadow: 0 4px 12px -2px rgba(234, 88, 12, 0.1);"
                    onclick="discountMonthlyPayment(${s.id}); openSmartCard(${s.id});">
                    <i class="fas fa-tags"></i> عمل خصم على الاشتراك (جزئي)
                </button>
                ` : ''}
            </div>

            <button class="btn" style="width:100%; height:50px; background:var(--bg-light); border-radius:15px; border: 1px solid var(--border);" 
                onclick="toggleModal('smart-card-modal', false)">إغلاق النافذة</button>
        </div>
    `;

    // Apply session mode if a session is currently running to allow non-blocking scanning
    const overlay = document.getElementById('smart-card-modal');
    if (isLessonCodingActive && !isLessonCodingPaused) {
        overlay.classList.add('session-mode');
    } else {
        overlay.classList.remove('session-mode');
    }

    toggleModal('smart-card-modal', true);
}

// Function to handle the new action buttons
let quickActionPaymentId = null;
function recordQuickAction(studentId, action) {
    const s = db.students.find(x => x.id == studentId);
    if (!s) return;

    // Sync active grade/group context to ensure db.settings resolves correctly
    currentGrade = localStorage.getItem('edu_active_grade') || currentGrade;
    currentGroupId = localStorage.getItem('edu_active_group') || currentGroupId;

    const todayStr = new Date().toLocaleDateString('en-CA');
    const activeGroup = currentGroupId || localStorage.getItem('edu_active_group');

    // --- NEW: Block Quick Action if subscription is not active ---
    if (!db.settings.isMonthlyActive) {
        playSound('error');
        showNotification('🛑 تنبيه: يرجى تفعيل "بدء الاشتراك" من قسم الخزينة أولاً لتتمكن من رصد الحضور', 'error');
        return;
    }

    // 1. Handle Attendance
    if (action === 'attendance' || action === 'both') {
        const alreadyInSession = currentSessionAttendance.some(att => att.id === s.id);

        if (alreadyInSession) {
            // مسجل في نفس الجلسة الحالية فقط
            playSound('error');
            showNotification(`⚠️ ${s.name} مسجل مسبقاً في هذه الجلسة`, 'warning');
            if (document.getElementById('voice-feedback-toggle')?.checked) {
                const msg = new SpeechSynthesisUtterance();
                msg.text = 'تم تسجيله من قبل';
                msg.lang = 'ar-SA';
                window.speechSynthesis.speak(msg);
            }
        } else {
            // مش في الجلسة → سجّله حتى لو كان في جلسة سابقة نفس اليوم
            let todayRecord = db.attendance.find(a =>
                a.studentId == s.id &&
                new Date(a.date).toLocaleDateString('en-CA') === todayStr
            );

            if (todayRecord) {
                todayRecord.status = 'present';
                todayRecord.date = new Date().toISOString();
                todayRecord.groupId = activeGroup;
            } else {
                db.attendance.push({
                    id: Date.now(),
                    studentId: s.id,
                    groupId: activeGroup,
                    date: new Date().toISOString(),
                    status: 'present'
                });
                s.points = (s.points || 0) + 5;
            }

            currentSessionAttendance.unshift({ ...s, scanTime: new Date().toISOString() });
            renderSessionTable();
            showNotification(`تم تسجيل حضور: ${s.name} ✅`, 'success');

            if (action === 'attendance') {
                playSound('success');
                speakName(s.name);
            }
        }
    }

    // 2. Handle Payment
    if (action === 'payment' || action === 'both') {
        const hasPaid = db.payments.some(p =>
            p.studentId == s.id &&
            p.category === 'اشتراك شهري' &&
            p.cycleId == db.settings.activeCycle
        );

        if (!hasPaid) {
            if (!db.settings.activeCycle) {
                // Auto start cycle if not exists
                db.settings.isMonthlyActive = true;
                db.settings.activeCycle = Date.now();
                db.settings.monthlyFee = db.settings.monthlyFee || 100; // default
            }

            const newPayment = {
                id: Date.now() + 1, // small offset to avoid duplicate ID
                studentId: s.id,
                amount: db.settings.monthlyFee,
                month: new Date().getMonth() + 1,
                year: new Date().getFullYear(),
                date: new Date().toISOString(),
                category: 'اشتراك شهري',
                cycleId: db.settings.activeCycle
            };
            db.payments.push(newPayment);
            db.save();
            showNotification(`تم تسجيل دفع الاشتراك لـ ${s.name} 💸`, 'success');

            // Voice Feedback
            playSound('success');
            if (action === 'both') speakName(`${s.name}. تم تسجيل الحضور والدفع`);
            else speakName(`${s.name}. تم تسجيل الدفع`);

            quickActionPaymentId = newPayment.id;
        } else {
            showNotification(`الطالب دفع الاشتراك مسبقاً`, 'warning');
            playSound('error');
        }
    }

    // 3. Handle Handout/Material Payment
    if (action === 'handout') {
        const amount = prompt('أدخل سعر الملزمة/المذكرة (ج.م):', 20);
        if (amount === null) return;

        db.payments.push({
            id: Date.now(),
            studentId: s.id,
            amount: parseInt(amount) || 0,
            date: new Date().toISOString(),
            category: 'ملزمة/مذكرة',
            cycleId: db.settings.activeCycle || 'misc'
        });
        showNotification(`تم تسجيل دفع الملزمة لـ ${s.name} ✅`, 'success');
        playSound('success');
        speakName(`${s.name}. تم تسجيل دفع الملزمة`);
        toggleModal('smart-card-modal', false);
        if (typeof renderReceiptsList === 'function') renderReceiptsList();
    }

    db.save();
    // Don't close if we just wanted to mark both and see updated state
    // but for search results, we want to stay open, so we handle modal elsewhere if needed.
    // However, for consistency with 'attendance' which is now called from search:
    if (action !== 'attendance') {
        toggleModal('smart-card-modal', false);
    }

    // Refresh UI
    renderQuickAttendance();
    updateDashboardStats();
    if (document.getElementById('payments-section').style.display === 'block') {
        renderFinances();
    }

    // If a new monthly payment was just registered, offer to print a receipt
    if (typeof quickActionPaymentId !== 'undefined' && quickActionPaymentId) {
        const paymentIdToprint = quickActionPaymentId;
        quickActionPaymentId = null;
        showReceiptSelectionModal(paymentIdToprint);
    }
}


// Helper for legacy payment flow
function handleSmartCardPayment(studentId) {
    toggleMonthlyPayment(studentId); // Assuming collectMonthlyPayment is the function to handle payment
    openSmartCard(studentId); // Refresh card to show updated payment status
}

function viewDetailedProfile(id) {
    const s = db.students.find(x => x.id === id);
    if (!s) return;

    const group = db.groups.find(g => g.id == s.groupId);
    document.getElementById('prof-avatar-char').innerText = s.name.charAt(0);
    document.getElementById('prof-name').innerText = s.name;
    const jDateRaw = s.joinDate || s.id; // Use id as fallback for old records
    const jDateObj = new Date(jDateRaw);
    const jDateStr = jDateObj.toLocaleDateString('ar-EG');
    document.getElementById('prof-info').innerText = `المجموعة: ${group ? group.name : '---'} | هاتف: ${s.phone} | انضم في: ${jDateStr}`;

    const atts = db.attendance.filter(a => a.studentId == s.id).reverse();
    const marks = db.scores.filter(sc => sc.studentId == s.id).reverse();
    const payments = db.payments.filter(p => p.studentId == s.id).reverse();

    // 1. Calculate General Attendance
    document.getElementById('prof-attendance').innerText = atts.filter(a => a.status === 'present').length;
    document.getElementById('prof-points').innerText = s.points;

    // 2. Calculate Exam Stats (Since Registration)
    // Filter exams for this grade and after joining
    const studentJoinTimestamp = jDateObj.getTime();
    const relevantExams = db.exams.filter(e => e.grade == s.grade && e.id >= (studentJoinTimestamp - 86400000));
    const examsAttended = marks.length;
    const examsMissed = Math.max(0, relevantExams.length - examsAttended);

    const attendedEl = document.getElementById('prof-exams-attended');
    const totalEl = document.getElementById('prof-exams-total');
    const missedEl = document.getElementById('prof-exams-missed');

    if (attendedEl) attendedEl.innerText = examsAttended;
    if (totalEl) totalEl.innerText = relevantExams.length;
    if (missedEl) missedEl.innerText = examsMissed;

    // Attendance Log
    const attLog = document.getElementById('prof-attendance-log');
    attLog.innerHTML = atts.map(a => {
        const d = new Date(a.date);
        const statusText = a.status === 'present' ? 'حاضر' : (a.status === 'absent' ? 'غائب' : 'تأخير');
        const statusColor = a.status === 'present' ? 'var(--accent)' : 'var(--danger)';
        return `<tr>
            <td>${d.toLocaleDateString('ar-EG')}</td>
            <td>${d.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}</td>
            <td><span style="color:${statusColor}; font-weight:bold;">${statusText}</span></td>
        </tr>`;
    }).join('') || '<tr><td colspan="3" style="text-align:center; padding:1rem;">لا يوجد سجل حضور</td></tr>';

    // Payment Log
    const payLog = document.getElementById('prof-payment-log');
    payLog.innerHTML = payments.map(p => `<tr>
        <td>${p.category || 'اشتراك'}</td>
        <td>${new Date(p.date).toLocaleDateString('ar-EG')}</td>
        <td>${p.amount ? p.amount + ' ج.م' : 'تم السداد'}</td>
    </tr>`).join('') || '<tr><td colspan="3" style="text-align:center; padding:1rem;">لا يوجد سجل مدفوعات</td></tr>';

    const avg = marks.length > 0
        ? Math.round(marks.reduce((sum, m) => sum + (m.mark / (db.exams.find(e => e.id === m.examId)?.maxMarks || 100)) * 100, 0) / marks.length)
        : 0;
    document.getElementById('prof-avg-mark').innerText = `${avg}%`;

    const sList = document.getElementById('prof-scores-list');
    sList.innerHTML = marks.map(m => {
        const ex = db.exams.find(e => e.id === m.examId);
        return `<li style="padding:0.75rem; border-bottom:1px solid #f1f5f9; display:flex; justify-content:space-between;">
            <strong>${ex ? ex.title : 'امتحان'}</strong>
            <span style="font-weight:700; color:var(--primary);">${m.mark} / ${ex ? ex.maxMarks : '-'}</span>
        </li>`;
    }).join('') || '<li>لا يوجد سجل امتحانات</li>';

    const hList = document.getElementById('prof-handouts-list');
    hList.innerHTML = db.studentHandouts.filter(sh => sh.studentId == s.id).map(sh => {
        const h = db.handouts.find(x => x.id === sh.handoutId);
        return `<li style="padding:0.5rem; border-bottom:1px solid #eee;"><i class="fas fa-check-circle" style="color:var(--accent)"></i> ${h ? h.title : 'ملزمة'}</li>`;
    }).join('') || '<li>لم يستلم ملازم بعد</li>';

    const analysis = analyzeStudent(s.id);
    const aiReport = document.getElementById('prof-ai-report');
    if (aiReport) {
        aiReport.innerHTML = `
            <div style="padding:10px; border-radius:8px; border-right:4px solid ${analysis.riskColor}; background:white; margin-bottom:10px;">
                <strong>مستوى الخطر:</strong> <span style="color:${analysis.riskColor}">${analysis.riskLevel} (${Math.round(analysis.riskScore)}%)</span><br>
                <strong>توقعات الحضور:</strong> ${analysis.gapSessions > 0 ? `غائب لـ ${analysis.gapSessions} حصص متتالية` : 'ملتزم بالحضور'}<br>
                <strong>التوجه الأكاديمي:</strong> ${analysis.academicTrend === 'IMPROVING' ? '🚀 في تحسن' : (analysis.academicTrend === 'DECLINING' ? '⚠️ تراجع في المستوى' : 'مستوى ثابت')}<br>
            </div>
            <div style="background:var(--primary); color:white; padding:10px; border-radius:8px; font-size:0.9rem;">
                <i class="fas fa-lightbulb"></i> <strong>توصية AI:</strong> ${analysis.recommendation}
            </div>
        `;
    }

    toggleModal('profile-modal', true);
}

// --- System Helpers ---
function showNotification(msg, type = 'success') {
    const n = document.createElement('div');
    n.className = 'fade-in';
    const palette = {
        success: { bg: 'var(--accent)', icon: 'fa-check-circle' },
        warning: { bg: 'var(--warning)', icon: 'fa-exclamation-triangle' },
        error: { bg: 'var(--danger)', icon: 'fa-times-circle' },
        info: { bg: 'var(--primary)', icon: 'fa-info-circle' }
    };
    const state = palette[type] || palette.success;
    n.style = `position:fixed; bottom:30px; left:30px; max-width:min(420px, calc(100vw - 40px)); background:${state.bg}; color:#fff; padding:1rem 1.4rem; border-radius:8px; z-index:10000; box-shadow:0 16px 35px rgba(16,32,51,0.22); font-weight:700; line-height:1.6; display:flex; align-items:center; gap:0.7rem;`;
    n.innerHTML = `<i class="fas ${state.icon}"></i> <span>${msg}</span>`;
    document.body.appendChild(n);
    setTimeout(() => n.remove(), 4000);
}

function toggleModal(id, show) {
    const el = document.getElementById(id);
    if (el) el.style.display = show ? 'flex' : 'none';
}

function generatePrintCard(id) {
    const s = db.students.find(x => x.id === id);
    if (!s) return;

    // Store active student ID for thermal printing
    document.getElementById('print-modal').dataset.studentId = id;

    // Fetch the actual grade name instead of ID
    const gradeObj = gradesList.find(g => String(g.id) === String(s.grade));
    const gradeName = gradeObj ? gradeObj.name : 'طالب';

    document.getElementById('print-name').innerText = s.name;
    document.getElementById('print-grade').innerText = gradeName;
    document.getElementById('print-code-text').innerText = s.qrCode;
    setTimeout(() => {
        JsBarcode("#barcode-canvas", s.qrCode, {
            format: "EAN13",
            width: 2.5,
            height: 80,
            displayValue: true,
            fontSize: 22,
            flat: true,
            margin: 10,
            background: "#ffffff",
            lineColor: "#000000"
        });
    }, 200);
    toggleModal('print-modal', true);
}

function printCurrentCardThermal() {
    const studentId = document.getElementById('print-modal').dataset.studentId;
    if (!studentId) return;
    const student = db.students.find(s => String(s.id) === String(studentId));
    const thermalWidth = document.getElementById('thermal-width-select')?.value || '80mm';
    if (student) generatePrintableIDCards([student], 'thermal', thermalWidth);
}

// Focus navigation using Enter key
document.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT')) {
        const form = e.target.closest('.modal-content') || e.target.closest('.card') || document.body;
        const focusable = Array.from(form.querySelectorAll('input, select, textarea')).filter(el => {
            return !el.disabled && el.style.display !== 'none' && el.type !== 'hidden';
        });

        const index = focusable.indexOf(e.target);
        if (index > -1 && index < focusable.length - 1) {
            e.preventDefault();
            focusable[index + 1].focus();
            if (focusable[index + 1].select) focusable[index + 1].select();
        }
    }
});
// --- Lesson Coding Session Functions ---
function startLessonCoding() {
    isLessonCodingActive = true;
    isLessonCodingPaused = false;
    currentSessionAttendance = [];

    document.getElementById('start-session-btn').style.display = 'none';
    if (document.getElementById('start-joint-session-btn')) document.getElementById('start-joint-session-btn').style.display = 'none';
    document.getElementById('pause-session-btn').style.display = 'inline-flex';
    document.getElementById('resume-session-btn').style.display = 'none';
    document.getElementById('end-session-btn').style.display = 'inline-flex';
    document.getElementById('session-status-badge').style.display = 'block';
    document.getElementById('current-session-container').style.display = 'block';

    renderSessionTable();
    showNotification('تم بدء جلسة تشفير الحصة بنجاح 🚀', 'success');
}

function pauseLessonCoding() {
    isLessonCodingPaused = true;
    document.getElementById('pause-session-btn').style.display = 'none';
    document.getElementById('resume-session-btn').style.display = 'inline-flex';
    document.getElementById('session-status-badge').innerHTML = `
        <span class="status-badge" style="background: rgba(245, 158, 11, 0.2); color: var(--warning); padding: 0.5rem 1.5rem; font-size: 1rem;">
            <i class="fas fa-pause-circle" style="font-size: 0.7rem; margin-left: 5px;"></i> التشفير متوقف مؤقتاً...
        </span>`;
    showNotification('تم إيقاف التشفير مؤقتاً ⏸️');
}

function resumeLessonCoding() {
    isLessonCodingPaused = false;
    document.getElementById('pause-session-btn').style.display = 'inline-flex';
    document.getElementById('resume-session-btn').style.display = 'none';
    document.getElementById('session-status-badge').innerHTML = `
        <span class="status-badge" style="background: rgba(16, 185, 129, 0.2); color: var(--accent); padding: 0.5rem 1.5rem; font-size: 1rem;">
            <i class="fas fa-circle" style="font-size: 0.7rem; margin-left: 5px;"></i> جلسة تشفير نشطة الآن...
        </span>`;
    showNotification('تم استئناف تشفير الحصة 🚀');
}

function renderSessionTable() {
    const list = document.getElementById('session-attendance-list');
    const count = document.getElementById('session-count');
    if (!list) return;

    // Show Stats Grid if session active or list has items
    const statsGrid = document.getElementById('session-stats-grid');
    if (statsGrid) statsGrid.style.display = currentSessionAttendance.length > 0 ? 'grid' : 'none';

    // Calculate Stats
    const total = currentSessionAttendance.length;
    let paidCount = 0;
    let totalMoney = 0;

    currentSessionAttendance.forEach(s => {
        const hasPaid = db.payments.some(p =>
            p.studentId == s.id &&
            p.category === 'اشتراك شهري' &&
            p.cycleId == db.settings.activeCycle
        );
        if (hasPaid) {
            paidCount++;
            totalMoney += db.settings.monthlyFee;
        }
    });

    // Update Stats Display
    if (count) count.innerText = total;
    if (document.getElementById('stat-session-total')) document.getElementById('stat-session-total').innerText = total;
    if (document.getElementById('stat-session-paid')) document.getElementById('stat-session-paid').innerText = paidCount;
    if (document.getElementById('stat-session-money')) document.getElementById('stat-session-money').innerHTML = `${totalMoney} <small>ج.م</small>`;

    list.innerHTML = currentSessionAttendance.map((s, index) => `
        <tr class="fade-in">
            <td><strong>${s.name}</strong></td>
            <td>${new Date(s.scanTime).toLocaleTimeString('ar-EG')}</td>
            <td style="text-align:center;">
                <div style="display:flex; gap:5px; justify-content:center;">
                    <button class="btn" style="background:var(--bg-light); color:var(--primary); padding:5px 12px; font-size:0.8rem;" onclick="openSmartCard(${s.id})">
                        <i class="fas fa-id-card"></i>
                    </button>
                    <button class="btn" style="color:var(--danger); padding:5px;" onclick="removeFromSession(${index})">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </td>
        </tr>
    `).join('') || '<tr><td colspan="3" style="text-align:center; padding:2rem;">لا يوجد طلاب في جلسة التشفير</td></tr>';

    // --- NEW: Render Absence List for current context ---
    const absenceList = document.getElementById('session-absence-list');
    const absenceCount = document.getElementById('session-absence-count');
    if (absenceList) {
        const rawId = activePortalGroupId || currentGroupId;
        let allowedGroupIds = [];
        if (String(rawId).startsWith('joint:')) {
            allowedGroupIds = rawId.split(':')[1].split(',');
        } else {
            allowedGroupIds = [String(rawId)];
        }

        const presentIds = currentSessionAttendance.map(s => s.id);

        const absentees = db.students.filter(s =>
            String(s.grade) === String(currentGrade) &&
            allowedGroupIds.includes(String(s.groupId)) &&
            !presentIds.includes(s.id)
        );

        if (absenceCount) absenceCount.innerText = absentees.length;

        absenceList.innerHTML = absentees.map(s => {
            const group = db.groups.find(g => g.id == s.groupId);
            return `
                <tr>
                    <td><strong>${s.name}</strong></td>
                    <td>${group ? group.name : '---'}</td>
                    <td style="text-align:center;">
                        <div style="display:flex; gap:5px; justify-content:center;">
                            <button class="btn" style="background:var(--bg-light); color:var(--accent); padding:5px 12px; font-size:0.8rem;" onclick="processScan('${s.qrCode}')">
                                <i class="fas fa-check"></i> تحضير يدوي
                            </button>
                            <button class="btn" style="background:rgba(37, 211, 102, 0.1); color:#25D366; padding:5px 12px; font-size:0.8rem;" title="إرسال إخطار غياب" onclick="sendAbsenceWhatsApp(${s.id})">
                                <i class="fab fa-whatsapp"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('') || '<tr><td colspan="3" style="text-align:center; padding:2rem; color:var(--accent);">تم حضور جميع طلاب المجموعة! 🎉</td></tr>';
    }
}

function printSessionAbsence() {
    const activeGroup = activePortalGroupId || currentGroupId;
    const groupObj = db.groups.find(g => g.id == activeGroup);
    const presentIds = currentSessionAttendance.map(s => s.id);
    const absentees = db.students.filter(s =>
        String(s.grade) === String(currentGrade) &&
        String(s.groupId) === String(activeGroup) &&
        !presentIds.includes(s.id)
    );

    let html = `
        <div style="direction:rtl; font-family:Arial; padding:40px;">
            <h2 style="text-align:center; border-bottom:2px solid #000; padding-bottom:10px;">كشف غياب الطلاب - ${groupObj ? groupObj.name : ''}</h2>
            <p style="text-align:center;">التاريخ: ${new Date().toLocaleDateString('ar-EG')}</p>
            <table style="width:100%; border-collapse:collapse; margin-top:30px;">
                <thead>
                    <tr style="background:#eee;">
                        <th style="border:1px solid #000; padding:10px;">م</th>
                        <th style="border:1px solid #000; padding:10px;">اسم الطالب</th>
                        <th style="border:1px solid #000; padding:10px;">تليفون ولي الأمر</th>
                        <th style="border:1px solid #000; padding:10px;">ملاحظات</th>
                    </tr>
                </thead>
                <tbody>
                    ${absentees.map((s, i) => `
                        <tr>
                            <td style="border:1px solid #000; padding:10px; text-align:center;">${i + 1}</td>
                            <td style="border:1px solid #000; padding:10px;">${s.name}</td>
                            <td style="border:1px solid #000; padding:10px; text-align:center;">${s.parentPhone || '---'}</td>
                            <td style="border:1px solid #000; padding:10px; width:150px;"></td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;

    const win = window.open('', '', 'width=900,height=700');
    win.document.write(html);
    win.document.close();
    setTimeout(() => {
        win.print();
        win.close();
    }, 500);
}

function removeFromSession(index) {
    const student = currentSessionAttendance[index];
    if (student) {
        // Find and remove matching attendance today to stay in sync
        db.attendance = db.attendance.filter(a => !(
            a.studentId == student.id &&
            new Date(a.date).toLocaleDateString('en-CA') === new Date().toLocaleDateString('en-CA') &&
            a.status === 'present'
        ));
    }

    currentSessionAttendance.splice(index, 1);
    db.currentSessionAttendance = currentSessionAttendance; // Persistent sync
    db.save();

    renderSessionTable();
    // Also update Absence report to reflect removal
    if (document.getElementById('absence-section').style.display === 'block') {
        generateAbsenceReport();
    }
}

function endLessonCoding() {
    if (currentSessionAttendance.length === 0) {
        if (!confirm('قائمة التشفير فارغة، هل تريد إنهاء الجلسة؟')) return;
    } else {
        if (!confirm(`سيتم ترحيل حضور ${currentSessionAttendance.length} طالب وإغلاق الجلسة، هل أنت متأكد؟`)) return;
    }

    const today = new Date().toLocaleDateString('en-CA');
    const activeGrade = currentGrade || localStorage.getItem('edu_active_grade');
    const rawId = activePortalGroupId || currentGroupId;

    let allowedGroupIds = [];
    let groupDisplayName = '';

    if (String(rawId).startsWith('joint:')) {
        allowedGroupIds = rawId.split(':')[1].split(',');
        groupDisplayName = 'اليوم الجماعي';
    } else {
        allowedGroupIds = [String(rawId)];
        const groupObj = db.groups.find(g => String(g.id) === String(rawId));
        groupDisplayName = groupObj ? groupObj.name : 'هذه المجموعة';
    }

    // Auto-mark others as Absent for the current group(s)
    if (allowedGroupIds.length > 0) {
        if (confirm(`هل تريد تأكيد غياب باقي طلاب (${groupDisplayName})؟`)) {
            const recordedIdsForToday = db.attendance.filter(a => {
                const aDate = new Date(a.date).toLocaleDateString('en-CA');
                return aDate === today;
            }).map(a => a.studentId);

            const absentees = db.students.filter(s =>
                String(s.grade) === String(activeGrade) &&
                allowedGroupIds.includes(String(s.groupId)) &&
                !recordedIdsForToday.includes(s.id)
            );

            absentees.forEach((s, idx) => {
                db.attendance.push({
                    id: Date.now() + idx + 1,
                    studentId: s.id,
                    groupId: s.groupId,
                    date: new Date().toISOString(),
                    status: 'absent'
                });
                addToQueue(s.id, 'absence');
            });
            showNotification(`تم تسجيل غياب ${absentees.length} طالب`, 'warning');
        }

        if (confirm('هل تريد حفظ وأرشفة سجل حضور وغياب هذه الحصة في "الأرشيف" للرجوع إليه لاحقاً؟')) {
            archiveAbsenceSession();
        }
    }

    db.save();

    // Reset State
    isLessonCodingActive = false;
    isLessonCodingPaused = false;
    currentSessionAttendance = [];
    db.currentSessionAttendance = [];
    activePortalGroupId = null; // Important: Clear joint session identifier
    renderSessionTable(); // Refresh UI to show empty table

    // UI Reset
    document.getElementById('start-session-btn').style.display = 'inline-flex';
    if (document.getElementById('start-joint-session-btn')) document.getElementById('start-joint-session-btn').style.display = 'inline-flex';
    document.getElementById('pause-session-btn').style.display = 'none';
    document.getElementById('resume-session-btn').style.display = 'none';
    document.getElementById('end-session-btn').style.display = 'none';
    document.getElementById('session-status-badge').style.display = 'none';

    renderQuickAttendance();
    updateDashboardStats();
    showNotification('تم إنهاء التشفير وحفظ البيانات بنجاح ✅');
}

function stopQRScanner() {
    if (html5QrCode) {
        html5QrCode.stop().then(() => {
            document.getElementById('reader').style.display = 'none';
        }).catch(err => console.error("Error stopping scanner:", err));
    }
}

// --- Audio and Voice Helpers ---
function playSound(type) {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    if (type === 'success') {
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(880, audioContext.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(1320, audioContext.currentTime + 0.1);
        gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
    } else {
        oscillator.type = 'sawtooth';
        oscillator.frequency.setValueAtTime(220, audioContext.currentTime);
        oscillator.frequency.linearRampToValueAtTime(110, audioContext.currentTime + 0.2);
        gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
        gainNode.gain.linearRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
    }

    oscillator.start();
    oscillator.stop(audioContext.currentTime + 0.3);
}

function speakName(name) {
    if (!document.getElementById('voice-feedback-toggle').checked) return;
    const msg = new SpeechSynthesisUtterance();
    msg.text = name;
    msg.lang = 'ar-SA';
    msg.rate = 0.9;
    window.speechSynthesis.speak(msg);
}

// --- Print Functions ---
function printDailyTreasuryReport() {
    const todayStrAr = new Date().toLocaleDateString('ar-EG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    const todayStrEn = new Date().toLocaleDateString('en-CA');

    const todayPayments = db.payments.filter(p => {
        const pDate = new Date(p.date).toLocaleDateString('en-CA');
        return pDate === todayStrEn;
    });

    let totalSub = 0;
    let totalMisc = 0;
    todayPayments.forEach(p => {
        if (p.category === 'اشتراك شهري') totalSub += p.amount;
        else totalMisc += p.amount;
    });

    const rows = todayPayments.map(p => {
        const student = db.students.find(s => s.id === p.studentId);
        return `
            <tr>
                <td>${student ? student.name : '---'}</td>
                <td>${p.category}</td>
                <td>${p.amount} ج.م</td>
                <td>${new Date(p.date).toLocaleTimeString('ar-EG')}</td>
            </tr>
        `;
    }).join('') || '<tr><td colspan="4">لا يـوجد تحصيلات اليوم</td></tr>';

    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
        <html dir="rtl">
        <head>
            <title>تقرير الخزنة اليومي - ${todayStrAr}</title>
            <style>
                @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;700&display=swap');
                body { font-family: 'Tajawal', sans-serif; padding: 40px; color: #1e293b; }
                .header { text-align: center; margin-bottom: 40px; border-bottom: 3px solid #4f46e5; padding-bottom: 20px; }
                h1 { margin: 0; color: #4f46e5; font-size: 2.2rem; }
                .summary { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 20px; margin: 30px 0; }
                .summary-item { text-align: center; padding: 20px; background: #f8fafc; border-radius: 15px; border: 1px solid #e2e8f0; }
                .summary-item span { color: #64748b; font-size: 0.9rem; display: block; margin-bottom: 5px; }
                .summary-item strong { font-size: 1.6rem; color: #1e293b; }
                table { width: 100%; border-collapse: collapse; margin-top: 30px; }
                th, td { border: 1px solid #e2e8f0; padding: 15px; text-align: center; }
                th { background: #f1f5f9; color: #475569; font-weight: 700; }
                tr:nth-child(even) { background: #f8fafc; }
                .footer { margin-top: 50px; text-align: left; font-size: 0.8rem; color: #94a3b8; }
            </style>
        </head>
        <body>
            <div class="header">
                <h1>تقرير تحصيل الخزنة اليومي</h1>
                <p>الأمين لغة عربية - أ/ أمين الغازي</p>
                <p style="font-weight: 700;">${todayStrAr}</p>
            </div>
            
            <div class="summary">
                <div class="summary-item"><span>اشتراكات شهرية</span><strong>${totalSub} ج.م</strong></div>
                <div class="summary-item"><span>ملازم / أخرى</span><strong>${totalMisc} ج.م</strong></div>
                <div class="summary-item" style="border-color: #4f46e5; background: #f5f3ff;">
                    <span style="color: #4f46e5;">إجمالي النقدية</span>
                    <strong style="color: #4f46e5;">${totalSub + totalMisc} ج.م</strong>
                </div>
            </div>

            <table>
                <thead>
                    <tr>
                        <th>اسم الطالب</th>
                        <th>بند التحصيل</th>
                        <th>المبلغ</th>
                        <th>الوقت</th>
                    </tr>
                </thead>
                <tbody>${rows}</tbody>
            </table>
            
            <div class="footer">طبع بواسطة نظام الأمين الذكي | ${new Date().toLocaleString('ar-EG')}</div>
        </body>
        </html>
    `);
    printWindow.document.close();
    // Use timeout to ensure styles are loaded
    setTimeout(() => {
        printWindow.print();
    }, 500);
}

function printSessionAttendance() {
    if (currentSessionAttendance.length === 0) {
        return showNotification('القائمة فارغة، لا يوجد ما يمكن طباعته', 'warning');
    }

    const printWindow = window.open('', '_blank');
    const groupName = db.groups.find(g => g.id == currentGroupId)?.name || 'كل المجموعات';
    const today = new Date().toLocaleDateString('ar-EG');

    let tableRows = currentSessionAttendance.map((s, index) => `
        <tr>
            <td style="border: 1px solid #000; padding: 8px;">${index + 1}</td>
            <td style="border: 1px solid #000; padding: 8px;">${s.name}</td>
            <td style="border: 1px solid #000; padding: 8px;">${s.qrCode}</td>
            <td style="border: 1px solid #000; padding: 8px;">${new Date(s.scanTime).toLocaleTimeString('ar-EG')}</td>
        </tr>
    `).join('');

    printWindow.document.write(`
        <html dir="rtl">
        <head>
            <title>كشف حضور الجلسة - ${today}</title>
            <style>
                body { font-family: 'Tajawal', sans-serif; padding: 20px; }
                h1, h2 { text-align: center; }
                table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                th { background: #f0f0f0; border: 1px solid #000; padding: 10px; }
                td { border: 1px solid #000; padding: 8px; text-align: center; }
                .header-info { display: flex; justify-content: space-between; margin-bottom: 30px; border-bottom: 2px solid #000; padding-bottom: 10px; }
            </style>
        </head>
        <body>
            <h1>كشف حضور حصة (جاري الآن)</h1>
            <div class="header-info">
                <span><strong>المجموعة:</strong> ${groupName}</span>
                <span><strong>التاريخ:</strong> ${today}</span>
                <span><strong>عدد الطلاب:</strong> ${currentSessionAttendance.length}</span>
            </div>
            <table>
                <thead>
                    <tr>
                        <th>م</th>
                        <th>اسم الطالب</th>
                        <th>كود الطالب</th>
                        <th>وقت الحضور</th>
                    </tr>
                </thead>
                <tbody>
                    ${tableRows}
                </tbody>
            </table>
            <footer style="margin-top: 50px; text-align: center; font-size: 0.8rem; color: #666;">
                تم استخراج التقرير بواسطة الأمين في اللغة العربية - ${new Date().toLocaleString('ar-EG')}
            </footer>
        </body>
        </html>
    `);

    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
        printWindow.print();
        printWindow.close();
    }, 500);
}

function printArchivedSession(filter = 'all') {
    if (!activeAbsenceSessionId) return;
    const session = db.absenceSessions.find(s => s.id === activeAbsenceSessionId);
    if (!session) return;

    const printWindow = window.open('', '_blank');
    const group = db.groups.find(g => g.id == session.groupId);
    const today = new Date(session.date).toLocaleDateString('ar-EG');

    let presentItems = (session.presentNames || []).map(name => `<li>${name}</li>`).join('');
    let absentItems = (session.absenteeNames || []).map(name => `<li>${name}</li>`).join('');

    let reportTitle = "تقرير كشف حضور وغياب";
    if (filter === 'present') reportTitle = "كشف التفوق والحضور";
    if (filter === 'absent') reportTitle = "كشف المتابعة والغياب";

    printWindow.document.write(`
        <html dir="rtl">
        <head>
            <title>${reportTitle}: ${session.name}</title>
            <style>
                @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;700&display=swap');
                body { font-family: 'Tajawal', sans-serif; padding: 30px; line-height: 1.6; }
                .header { text-align: center; border-bottom: 3px double #000; padding-bottom: 20px; margin-bottom: 30px; }
                .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 30px; background: #f9f9f9; padding: 15px; border-radius: 8px; }
                .columns { display: grid; grid-template-columns: ${filter === 'all' ? '1fr 1fr' : '1fr'}; gap: 40px; }
                h1 { margin: 0 0 10px; color: #333; }
                h3 { border-bottom: 2px solid #ccc; padding-bottom: 5px; margin-bottom: 15px; }
                .present { color: #166534; }
                .absent { color: #991b1b; }
                ul { list-style: decimal; padding-right: 25px; }
                li { margin-bottom: 5px; border-bottom: 1px dotted #eee; }
                @media print {
                    body { -webkit-print-color-adjust: exact; }
                }
            </style>
        </head>
        <body>
            <div class="header">
                <h1>${reportTitle}</h1>
                <h2 style="color: #666;">${session.name}</h2>
            </div>
            
            <div class="info-grid">
                <div><strong>المجموعة:</strong> ${group ? group.name : 'الكل'}</div>
                <div><strong>التاريخ:</strong> ${today}</div>
                ${filter !== 'absent' ? `<div><strong>إجمالي الحاضرين:</strong> ${session.presentCount} طالب</div>` : ''}
                ${filter !== 'present' ? `<div><strong>إجمالي الغائبين:</strong> ${session.absentCount} طالب</div>` : ''}
            </div>

            <div class="columns">
                ${(filter === 'all' || filter === 'present') ? `
                <div>
                    <h3 class="present">قائمة الحاضرين ✅</h3>
                    <ul>${presentItems || '<li>لا يوجد</li>'}</ul>
                </div>` : ''}
                ${(filter === 'all' || filter === 'absent') ? `
                <div>
                    <h3 class="absent">قائمة الغائبين ❌</h3>
                    <ul>${absentItems || '<li>لا يوجد</li>'}</ul>
                </div>` : ''}
            </div>

            <footer style="margin-top: 50px; text-align: center; font-size: 0.8rem; color: #999; border-top: 1px solid #eee; padding-top: 10px;">
                الأمين في اللغة العربية - أرشيف الجلسات الرقمي | استُخرج بتاريخ: ${new Date().toLocaleString('ar-EG')}
            </footer>
        </body>
        </html>
    `);

    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
        printWindow.print();
        printWindow.close();
    }, 500);
}

function updateDashboardStats() {
    const totalS = document.getElementById('total-students');
    // Stats for active group context
    const groupStudents = db.students.filter(s => s.grade == currentGrade && s.groupId == currentGroupId);
    if (totalS) totalS.innerText = groupStudents.length;

    const presentTodayEl = document.getElementById('present-today');
    const today = new Date().toLocaleDateString('en-CA');

    // Cross-reference attendance with strictly-scoped group students
    const groupStudentIds = groupStudents.map(s => s.id);
    const presentCount = db.attendance.filter(a => {
        const aDate = new Date(a.date).toLocaleDateString('en-CA');
        return aDate === today && groupStudentIds.includes(a.studentId) && a.status === 'present';
    }).length;

    if (presentTodayEl) presentTodayEl.innerText = presentCount;

    // --- Financial Stats (Money, not points) ---
    const revEl = document.getElementById('monthly-revenue');
    const debtEl = document.getElementById('total-debt');

    const currentMonth = new Date().getMonth() + 1;
    const currentYear = new Date().getFullYear();

    // Calculate actual money collected this month for this group only
    const monthlyIncome = db.payments.filter(p =>
        p.category === 'اشتراك شهري' &&
        p.cycleId == db.settings.activeCycle &&
        groupStudentIds.includes(p.studentId)
    ).reduce((sum, p) => sum + p.amount, 0);

    // Subtract monthly expenses for this group
    const monthlyExpenses = db.expenses
        .filter(e => e.groupId == currentGroupId)
        .reduce((sum, e) => sum + e.amount, 0);

    const netMonthly = monthlyIncome - monthlyExpenses;

    if (revEl) revEl.innerHTML = `${netMonthly} <small>ج.م</small>`;

    // Calculate Debt (Receivables) for this group
    if (db.settings.isMonthlyActive) {
        const unpaidCount = groupStudents.filter(s =>
            !db.payments.some(p => p.studentId == s.id && p.category === 'اشتراك شهري' && p.cycleId == db.settings.activeCycle)
        ).length;
        const totalDebt = unpaidCount * db.settings.monthlyFee;
        if (debtEl) debtEl.innerHTML = `${totalDebt} <small>ج.م</small>`;
    } else {
        if (debtEl) debtEl.innerText = `0 ج.م`;
    }

    // Display Active Group Info instead of the full grid
    const groupGrid = document.getElementById('dashboard-groups-grid');
    if (groupGrid) {
        const groupObj = db.groups.find(g => g.id == currentGroupId);
        if (groupObj) {
            groupGrid.innerHTML = `
                <div class="card active-ctx" style="padding: 1.5rem; border-right: 6px solid var(--primary); grid-column: span 3; display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <div style="font-size: 0.9rem; color: var(--text-muted);">المجموعة النشطة حالياً</div>
                        <div style="font-weight: 800; font-size: 1.8rem; color: var(--text-main);">${groupObj.name}</div>
                        <div style="color: var(--primary); font-weight: 600;">${groupObj.time}</div>
                    </div>
                    <button class="btn" onclick="showGradeSelection()" style="background: var(--bg-light); padding: 0.8rem 1.5rem; border-radius: 12px;">
                        <i class="fas fa-exchange-alt"></i> تغيير المجموعة
                    </button>
                </div>
            `;
        } else {
            groupGrid.innerHTML = '<p style="color:var(--text-muted)">يرجى إعادة اختيار المجموعة</p>';
        }
    }
}

// --- Monthly Subscription Mode ---
function startMonthlySubscription() {
    const fee = parseInt(document.getElementById('monthly-fee-input').value) || 0;
    const comm = parseInt(document.getElementById('center-commission-input').value) || 0;
    const nameInput = document.getElementById('monthly-name-input');
    const cycleName = nameInput ? nameInput.value.trim() : '';

    const typeSelect = document.getElementById('cycle-subscription-type');
    const subscriptionType = typeSelect ? typeSelect.value : 'lesson';

    if ((subscriptionType === 'lesson' || subscriptionType === 'both') && fee <= 0) {
        return showNotification('يرجى تحديد قيمة اشتراك الدرس للدورة الجديدة', 'error');
    }

    // --- Platform course requirement ---
    let platformCourse = null;
    if (subscriptionType === 'platform' || subscriptionType === 'both') {
        const courseSelect = document.getElementById('cycle-platform-course');
        const courseId = courseSelect ? courseSelect.value : '';
        if (!courseId) {
            return showNotification('يرجى اختيار كورس المنصة المطلوب لهذه الدورة', 'error');
        }
        // السعر يُقرأ من بيانات الكورس المحفوظة
        const course = (db.platformCourses || []).find(c => String(c.courseId) === String(courseId));
        if (!course) {
            return showNotification('الكورس المحدد غير موجود، يرجى تحديث الكورسات', 'error');
        }
        // نحاول قراءة السعر من data-price أولاً (أحدث قيمة) ثم من db
        const selectedOption = courseSelect.options[courseSelect.selectedIndex];
        const priceFromOption = selectedOption ? Number(selectedOption.getAttribute('data-price') || 0) : 0;
        const originalPrice = priceFromOption || Number(course.price) || 0;

        // قراءة سعر طلاب السيستم
        const systemFeeInput = document.getElementById('platform-system-fee-input');
        const systemPrice = (systemFeeInput && systemFeeInput.value !== '') ? Number(systemFeeInput.value) : originalPrice;

        platformCourse = { 
            courseId: course.courseId, 
            courseTitle: course.courseTitle, 
            originalPrice: originalPrice, 
            price: systemPrice 
        };
    }

    // platformFee = سعر الكورس المختار لطلاب السيستم (المحدد مخصصاً أو تلقائياً)
    const platformFee = platformCourse ? platformCourse.price : 0;

    db.settings.isMonthlyActive = true;
    db.settings.monthlyFee = fee;
    db.settings.platformFee = platformFee;
    db.settings.centerCommissionPercent = comm;
    db.settings.monthlyCycleName = cycleName || `اشتراك ${new Date().toLocaleDateString('ar-EG', { month: 'long', year: 'numeric' })}`;
    // Set a new unique cycle ID for this subscription period
    db.settings.activeCycle = Date.now();

    db.settings.monthlyCollected = 0;

    // --- NEW: subscription type & linked platform course for this cycle ---
    db.settings.cycleSubscriptionType = subscriptionType;
    db.settings.activePlatformCourse = platformCourse; // { courseId, courseTitle, price } or null

    db.save();

    let msg = `تم تفعيل وضع الاشتراك الشهري`;
    if (fee > 0) msg += ` | درس: ${fee} ج.م`;
    if (platformFee > 0) msg += ` | منصة: ${platformFee} ج.م`;
    if (platformCourse) msg += ` | كورس: ${platformCourse.courseTitle}`;
    msg += ' 🚀';
    showNotification(msg);
    renderFinances();
    renderMonthlySubscriptionTables();
    updateDashboardStats();
}

function promptEndMonthlySubscription() {
    const pass = prompt("برجاء إدخال كلمة المرور لإنهاء الاشتراك:");
    const correct = (db._settings.globalPasswords && db._settings.globalPasswords.endSubscription) || '01000';
    if (pass === correct) {
        const cycleTitle = prompt("ادخل اسم لهذه الفترة للأرشفة (مثلاً: شهر فبراير 2026):", db.settings.monthlyCycleName || '');
        if (!cycleTitle) return showNotification("يجب إدخال اسم للدورة للأرشفة", "error");

        // Calculate center percentage from total monthly income for this cycle for the CURRENT GROUP ONLY
        const cyclePayments = db.payments.filter(p => {
            const s = db.students.find(x => x.id === p.studentId);
            return p.cycleId == db.settings.activeCycle && p.category === 'اشتراك شهري' && s && String(s.groupId) === String(currentGroupId);
        });
        const totalCollectedForGroup = cyclePayments.reduce((sum, p) => sum + p.amount, 0);
        const centerCutAmount = Math.round(totalCollectedForGroup * (db.settings.centerCommissionPercent / 100));

        // Save current cycle to archive with group isolation
        const cycleData = {
            id: db.settings.activeCycle,
            title: cycleTitle,
            fee: db.settings.monthlyFee,
            platformFee: db.settings.platformFee || 0,
            centerPercent: db.settings.centerCommissionPercent,
            centerCut: centerCutAmount,
            totalIncome: totalCollectedForGroup,
            date: new Date().toISOString(),
            grade: currentGrade,
            groupId: currentGroupId,
            subscriptionType: db.settings.cycleSubscriptionType || 'lesson',
            activePlatformCourse: db.settings.activePlatformCourse || null
        };

        db.cycles.push(cycleData);

        db.settings.isMonthlyActive = false;
        db.settings.activeCycle = null;
        db.settings.cycleSubscriptionType = null;
        db.settings.activePlatformCourse = null;
        db.save();
        showNotification("تم إنهاء وأرشفة الدورة بنجاح ✅");
        renderFinances();
        renderMonthlySubscriptionTables();
        updateDashboardStats();
    } else {
        showNotification("كلمة المرور غير صحيحة!", "error");
    }
}

function collectMonthlyPayment(studentId) {
    const s = db.students.find(x => x.id == studentId);
    if (!s) return;

    // Sync active grade/group context to ensure db.settings resolves correctly
    currentGrade = localStorage.getItem('edu_active_grade') || currentGrade;
    currentGroupId = localStorage.getItem('edu_active_group') || currentGroupId;

    const currentMonth = new Date().getMonth() + 1;
    const currentYear = new Date().getFullYear();

    // If no active cycle exists, start one automatically (or prompt)
    if (!db.settings.activeCycle) {
        if (confirm(`لا يوجد دورة اشتراك نشطة حالياً. هل تريد بدء دورة جديدة بقيمة ${db.settings.monthlyFee} ج.م؟`)) {
            db.settings.isMonthlyActive = true;
            db.settings.activeCycle = Date.now();
            db.save();
        } else {
            return;
        }
    }

    // Check if paid in the CURRENT active cycle
    if (db.payments.some(p => p.studentId == s.id && p.category === 'اشتراك شهري' && p.cycleId == db.settings.activeCycle)) {
        return showNotification('الطالب دفع بالفعل لهذه الدورة', 'warning');
    }

    const newPayment = {
        id: Date.now(),
        studentId: s.id,
        amount: db.settings.monthlyFee,
        month: currentMonth,
        year: currentYear,
        date: new Date().toISOString(),
        category: 'اشتراك شهري',
        cycleId: db.settings.activeCycle
    };
    db.payments.push(newPayment);

    db.save();
    showNotification(`تم تسجيل دفع ${db.settings.monthlyFee} ج.م لـ ${s.name} ✅`);

    renderFinances();
    renderMonthlySubscriptionTables();
    updateDashboardStats();

    // Refresh portal if scanning
    if (document.getElementById('portal-overlay').style.display === 'block') {
        processScan(s.qrCode);
    }

    showReceiptSelectionModal(newPayment.id);
}

function exemptMonthlyPayment(studentId) {
    // Sync active grade/group context to ensure db.settings resolves correctly
    currentGrade = localStorage.getItem('edu_active_grade') || currentGrade;
    currentGroupId = localStorage.getItem('edu_active_group') || currentGroupId;

    if (!db.settings.activeCycle) return showNotification('يجب تفعيل دورة اشتراك أولاً للاعفاء', 'error');

    const s = db.students.find(x => x.id == studentId);
    if (!s) return;

    if (db.payments.some(p => p.studentId == s.id && p.category === 'اشتراك شهري' && p.cycleId == db.settings.activeCycle)) {
        return showNotification('الطالب لديه سجل بالفعل لهذه الدورة', 'warning');
    }

    const newPayment = {
        id: Date.now(),
        studentId: s.id,
        amount: 0,
        month: new Date().getMonth() + 1,
        year: new Date().getFullYear(),
        date: new Date().toISOString(),
        category: 'اشتراك شهري',
        cycleId: db.settings.activeCycle,
        isExemption: true
    };
    db.payments.push(newPayment);

    db.save();
    showNotification(`تم إعفاء الطالب ${s.name} وقبوله ✅`, 'success');

    renderPortalAttendance();
    renderSubscriptionTracker();
    renderFinances();
    renderMonthlySubscriptionTables();
    updateDashboardStats();

    showReceiptSelectionModal(newPayment.id);
}

function discountMonthlyPayment(studentId) {
    // Sync active grade/group context to ensure db.settings resolves correctly
    currentGrade = localStorage.getItem('edu_active_grade') || currentGrade;
    currentGroupId = localStorage.getItem('edu_active_group') || currentGroupId;

    if (!db.settings.activeCycle) return showNotification('يجب تفعيل دورة اشتراك أولاً لعمل خصم', 'error');

    const s = db.students.find(x => x.id == studentId);
    if (!s) return;

    if (db.payments.some(p => p.studentId == s.id && p.category === 'اشتراك شهري' && p.cycleId == db.settings.activeCycle)) {
        return showNotification('الطالب لديه سجل بالفعل لهذه الدورة', 'warning');
    }

    const discountStr = prompt(`المبلغ الأصلي: ${db.settings.monthlyFee} ج.م\nأدخل قيمة الخصم (المبلغ الذي سيتم طرحه):`, "0");
    const discount = parseFloat(discountStr);

    if (isNaN(discount) || discount < 0) return showNotification('قيمة الخصم غير صالحة', 'error');
    if (discount >= db.settings.monthlyFee) return showNotification('الخصم أكبر من أو يساوي الاشتراك! استخدم "إعفاء" بدلاً من ذلك.', 'warning');

    const netAmount = db.settings.monthlyFee - discount;

    const newPayment = {
        id: Date.now(),
        studentId: s.id,
        amount: netAmount,
        month: new Date().getMonth() + 1,
        year: new Date().getFullYear(),
        date: new Date().toISOString(),
        category: 'اشتراك شهري',
        cycleId: db.settings.activeCycle,
        discount: discount
    };
    db.payments.push(newPayment);

    db.save();
    showNotification(`تم تسجيل مبلغ ${netAmount} ج.م بعد خصم ${discount} ✅`, 'success');

    renderPortalAttendance();
    renderSubscriptionTracker();
    renderFinances();
    renderMonthlySubscriptionTables();
    updateDashboardStats();

    showReceiptSelectionModal(newPayment.id);
}

function renderMonthlySubscriptionTables() {
    const active = db.settings.isMonthlyActive;
    const monthlyFeeInput = document.getElementById('monthly-fee-input');
    const centerCommInput = document.getElementById('center-commission-input');
    const monthlyNameInput = document.getElementById('monthly-name-input');

    // Toggle controls
    document.getElementById('btn-start-monthly').style.display = active ? 'none' : 'block';
    document.getElementById('btn-stop-monthly').style.display = active ? 'block' : 'none';
    const badge = document.getElementById('monthly-status-badge');
    badge.style.display = active ? 'block' : 'none';

    if (active) {
        if (monthlyFeeInput) {
            monthlyFeeInput.value = db.settings.monthlyFee;
            monthlyFeeInput.disabled = true;
        }
        if (centerCommInput) centerCommInput.value = db.settings.centerCommissionPercent;
        if (monthlyNameInput) {
            monthlyNameInput.value = db.settings.monthlyCycleName || '';
            monthlyNameInput.disabled = true;
        }

        // عرض سعر المنصة تلقائياً (حقل مخفي + عرض للقراءة فقط)
        const platformFeeWrapper = document.getElementById('platform-fee-input-wrapper');
        const platformOriginalFeeValueEl = document.getElementById('platform-original-fee-value');
        const platformSystemFeeInput = document.getElementById('platform-system-fee-input');
        const platformFeeHidden = document.getElementById('platform-fee-input');

        const activeCourse = db.settings.activePlatformCourse;
        const savedPlatformFee = db.settings.platformFee || 0;

        if (platformFeeWrapper) {
            platformFeeWrapper.style.display = (db.settings.cycleSubscriptionType === 'platform' || db.settings.cycleSubscriptionType === 'both') ? 'block' : 'none';
        }

        if (platformFeeHidden) platformFeeHidden.value = savedPlatformFee;

        if (activeCourse) {
            if (platformOriginalFeeValueEl) {
                platformOriginalFeeValueEl.textContent = `${activeCourse.originalPrice || activeCourse.price || 0} ج.م`;
            }
            if (platformSystemFeeInput) {
                platformSystemFeeInput.value = activeCourse.price || 0;
                platformSystemFeeInput.disabled = true;
            }
        } else {
            if (platformOriginalFeeValueEl) {
                platformOriginalFeeValueEl.textContent = savedPlatformFee > 0 ? `${savedPlatformFee} ج.م` : 'مجاني (0 ج.م)';
            }
            if (platformSystemFeeInput) {
                platformSystemFeeInput.value = savedPlatformFee;
                platformSystemFeeInput.disabled = true;
            }
        }

        // Lock subscription type / course selects while a cycle is active
        const typeSelect = document.getElementById('cycle-subscription-type');
        const courseSelect = document.getElementById('cycle-platform-course');
        const courseWrapper = document.getElementById('cycle-platform-course-wrapper');
        if (typeSelect) {
            typeSelect.value = db.settings.cycleSubscriptionType || 'lesson';
            typeSelect.disabled = true;
        }
        if (courseWrapper) {
            courseWrapper.style.display = (db.settings.cycleSubscriptionType === 'platform' || db.settings.cycleSubscriptionType === 'both') ? 'block' : 'none';
        }
        if (courseSelect) {
            if (db.settings.activePlatformCourse) {
                courseSelect.innerHTML = `<option value="${db.settings.activePlatformCourse.courseId}">${db.settings.activePlatformCourse.courseTitle}</option>`;
            }
            courseSelect.disabled = true;
        }
    } else {
        if (monthlyFeeInput) {
            monthlyFeeInput.value = '';
            monthlyFeeInput.disabled = false;
        }
        if (centerCommInput) centerCommInput.value = '';
        if (monthlyNameInput) {
            monthlyNameInput.value = '';
            monthlyNameInput.disabled = false;
        }

        const platformOriginalFeeValueEl = document.getElementById('platform-original-fee-value');
        const platformSystemFeeInput = document.getElementById('platform-system-fee-input');
        const platformFeeHiddenReset = document.getElementById('platform-fee-input');

        if (platformOriginalFeeValueEl) platformOriginalFeeValueEl.textContent = 'اختر كورساً أولاً';
        if (platformSystemFeeInput) {
            platformSystemFeeInput.value = '';
            platformSystemFeeInput.disabled = false;
        }
        if (platformFeeHiddenReset) platformFeeHiddenReset.value = '0';

        const typeSelect = document.getElementById('cycle-subscription-type');
        const courseSelect = document.getElementById('cycle-platform-course');
        if (typeSelect) typeSelect.disabled = false;
        if (courseSelect) courseSelect.disabled = false;
        if (typeof onCycleSubscriptionTypeChange === 'function') onCycleSubscriptionTypeChange();
    }

    // ONLY show students from the ACTIVE group for the financial section
    const groupStudents = db.students.filter(s =>
        String(s.grade) === String(currentGrade) &&
        String(s.groupId) === String(currentGroupId)
    );
    const gradeStudentIds = groupStudents.map(s => s.id);

    if (active) {
        const collected = db.payments.filter(p =>
            p.category === 'اشتراك شهري' &&
            p.cycleId == db.settings.activeCycle &&
            gradeStudentIds.includes(p.studentId)
        ).reduce((sum, p) => sum + p.amount, 0);

        let badgeText = `وضع الاشتراك نشط (درس محصل: ${collected} ج.م)`;
        if (db.settings.platformFee) badgeText += ` | منصة: ${db.settings.platformFee} ج.م`;
        badgeText += ` | سنتر: ${db.settings.centerCommissionPercent}%`;
        const typeLabels = { lesson: 'اشتراك الدرس', platform: 'اشتراك المنصة', both: 'اشتراك الدرس + المنصة' };
        if (db.settings.cycleSubscriptionType) {
            badgeText += ` | ${typeLabels[db.settings.cycleSubscriptionType] || ''}`;
        }
        if (db.settings.activePlatformCourse) {
            badgeText += ` | كورس: ${db.settings.activePlatformCourse.courseTitle}`;
        }
        badge.innerHTML = badgeText;
    }

    const paidList = [];
    const unpaidList = [];

    groupStudents.forEach(s => {
        const hasPaid = db.payments.some(p =>
            p.studentId == s.id &&
            p.category === 'اشتراك شهري' &&
            p.cycleId == db.settings.activeCycle
        );
        if (hasPaid) paidList.push(s);
        else unpaidList.push(s);
    });

    document.getElementById('paid-students-list').innerHTML = paidList.map(s => `
        <tr style="border-bottom: 1px solid #f1f5f9;">
            <td style="padding: 0.5rem;"><i class="fas fa-check-circle" style="color:var(--accent)"></i> <strong>${s.name}</strong></td>
            <td style="font-family:monospace; color:var(--text-muted)">${s.qrCode}</td>
            <td style="text-align:left; padding: 0.5rem;">
                <button class="btn" onclick="toggleMonthlyPayment(${s.id})" style="background:transparent; color:var(--danger); padding:4px 8px; font-size:1rem; border:none; box-shadow:none;" title="إلغاء الدفع">
                    <i class="fas fa-trash-alt"></i>
                </button>
            </td>
        </tr>
    `).join('') || '<tr><td colspan="3" style="text-align:center; padding:1rem;">لا يوجد</td></tr>';

    document.getElementById('unpaid-students-list').innerHTML = unpaidList.map(s => `
        <tr style="border-bottom: 1px solid #f1f5f9;">
            <td style="padding: 0.5rem;"><i class="fas fa-clock" style="color:var(--danger)"></i> <strong>${s.name}</strong></td>
            <td style="text-align:left; padding: 0.5rem; display:flex; gap:5px; justify-content:flex-end;">
                <button class="btn" onclick="collectMonthlyPayment(${s.id})" style="background:var(--payment-orange); color:white; padding:4px 10px; font-size:0.75rem; border-radius:50px;">
                    تحصيل الآن <i class="fas fa-check"></i>
                </button>
                <button class="btn" onclick="exemptMonthlyPayment(${s.id})" style="background:#f5f3ff; color:#7c3aed; padding:4px 12px; font-size:0.75rem; border-radius:50px; border:1px solid #ddd6fe; font-weight:600;">
                    إعفاء 🤍
                </button>
                <button class="btn" onclick="discountMonthlyPayment(${s.id})" style="background:#fff7ed; color:#ea580c; padding:4px 12px; font-size:0.75rem; border-radius:50px; border:1px solid #fed7aa; font-weight:600;">
                    خصم %
                </button>
            </td>
        </tr>
    `).join('') || '<tr><td colspan="2" style="text-align:center; padding:1rem;">لا يوجد</td></tr>';
}

function renderFinances() {
    renderMonthlySubscriptionTables();

    // Filter income/expenses by the ACTIVE GROUP for strict group-level treasury
    const groupStudents = db.students.filter(s => s.grade == currentGrade && s.groupId == currentGroupId);
    const groupStudentIds = groupStudents.map(s => s.id);

    // Filter payments for these specific students
    const groupPayments = db.payments.filter(p => groupStudentIds.includes(p.studentId));

    // Annual Income (All payments for this group)
    const annualIncome = groupPayments.reduce((sum, p) => sum + p.amount, 0);

    // Monthly Income (Only active cycle for this group)
    const monthlyIncome = groupPayments.filter(p => p.cycleId == db.settings.activeCycle)
        .reduce((sum, p) => sum + p.amount, 0);

    // Expenses for this group specifically
    const expenses = db.expenses
        .filter(e => e.groupId == currentGroupId)
        .reduce((sum, e) => sum + e.amount, 0);

    document.getElementById('finance-income-monthly').innerText = `${monthlyIncome} ج.م`;
    document.getElementById('finance-income-yearly').innerText = `${annualIncome} ج.م`;
    document.getElementById('finance-expenses').innerText = `${expenses} ج.م`;
    document.getElementById('finance-net').innerText = `${annualIncome - expenses} ج.م`;

    // Breakdown: Lesson subscription vs Platform subscription (current cycle)
    const monthlyCyclePayments = groupPayments.filter(p => p.cycleId == db.settings.activeCycle);
    const lessonIncome = monthlyCyclePayments
        .filter(p => p.category === 'اشتراك شهري')
        .reduce((sum, p) => sum + p.amount, 0);
    // Platform income = payments with category 'اشتراك المنصة' OR platformAmount stored on payment
    const platformIncome = monthlyCyclePayments
        .filter(p => p.category === 'اشتراك المنصة' || p.platformAmount > 0)
        .reduce((sum, p) => sum + (p.platformAmount || p.amount), 0);
    const lessonEl = document.getElementById('finance-income-lesson');
    const platformEl = document.getElementById('finance-income-platform');
    if (lessonEl) lessonEl.innerText = `${lessonIncome} ج.م`;
    if (platformEl) platformEl.innerText = `${platformIncome} ج.م`;

    // Center Commission Calculation
    const centerCut = Math.round(monthlyIncome * (db.settings.centerCommissionPercent / 100));
    const cutEl = document.getElementById('finance-center-cut');
    if (cutEl) cutEl.innerText = `${centerCut} ج.م`;
    const labelEl = document.getElementById('center-percent-label');
    if (labelEl) labelEl.innerText = `بنسبة ${db.settings.centerCommissionPercent}% من تحصيل الشهر الحقيقي`;

    // Combine payments and expenses for a full ledger
    const ledger = [
        ...groupPayments.map(p => ({
            title: `اشتراك: ${db.students.find(s => s.id === p.studentId)?.name || 'طالب'}`,
            category: p.category || 'اشتراك',
            amount: p.amount,
            date: p.date,
            type: 'income'
        })),
        ...db.expenses.filter(e => e.groupId == currentGroupId).map(e => ({
            title: e.title,
            category: e.category,
            amount: e.amount,
            date: e.id, // e.id is timestamp
            type: 'expense'
        }))
    ].sort((a, b) => new Date(b.date) - new Date(a.date));

    document.getElementById('finances-list').innerHTML = ledger.map(item => `
        <tr>
            <td>${item.title}</td>
            <td>${item.category}</td>
            <td style="color:${item.type === 'income' ? 'var(--accent)' : 'var(--danger)'}; font-weight:bold;">
                ${item.type === 'income' ? '+' : '-'}${item.amount} ج.م
            </td>
            <td>${new Date(item.date).toLocaleDateString('ar-EG')}</td>
        </tr>`).join('') || '<tr><td colspan="4" style="text-align:center;">لا يوجد عمليات مالية مسجلة</td></tr>';
}

// =========================================================
// --- Payment Receipts: Print Modal & Templates ---
// =========================================================

let pendingReceiptPaymentId = null;

function getReceiptCycleTitle(payment) {
    if (!payment) return 'اشتراك شهري';
    if (payment.cycleId == db.settings.activeCycle && db.settings.monthlyCycleName) {
        return db.settings.monthlyCycleName;
    }
    const archivedCycle = db.cycles.find(c => c.id == payment.cycleId);
    if (archivedCycle) return archivedCycle.title;
    return db.settings.monthlyCycleName || 'اشتراك شهري';
}

// Open the print-size selection modal for a given payment (called after collecting/exempting/discounting a payment)
function showReceiptSelectionModal(paymentId) {
    const payment = db.payments.find(p => p.id == paymentId);
    if (!payment) return;

    // Keep the receipts log up to date if the section is visible
    if (typeof renderReceiptsList === 'function') renderReceiptsList();

    pendingReceiptPaymentId = paymentId;
    const student = db.students.find(s => s.id == payment.studentId);

    const infoEl = document.getElementById('receipt-choice-info');
    if (infoEl) {
        infoEl.innerHTML = student
            ? `الطالب: <strong>${student.name}</strong> | المبلغ: <strong>${payment.amount} ج.م</strong>`
            : '';
    }

    toggleModal('receipt-choice-modal', true);
}

// Called from the print-size modal buttons
function confirmReceiptPrint(size) {
    if (!pendingReceiptPaymentId) return;
    printMonthlyReceipt(pendingReceiptPaymentId, size);
    toggleModal('receipt-choice-modal', false);
    pendingReceiptPaymentId = null;
}

function skipReceiptPrint() {
    toggleModal('receipt-choice-modal', false);
    pendingReceiptPaymentId = null;
}

// Print a monthly subscription receipt. size: 'thermal' (80mm) or 'normal' (A4)
function printMonthlyReceipt(paymentId, size = 'thermal') {
    const payment = db.payments.find(p => p.id == paymentId);
    if (!payment) return showNotification('لم يتم العثور على عملية الدفع', 'error');

    const student = db.students.find(s => s.id == payment.studentId);
    if (!student) return showNotification('لم يتم العثور على بيانات الطالب', 'error');

    const cycleTitle = getReceiptCycleTitle(payment);
    const dateStr = new Date(payment.date).toLocaleDateString('ar-EG');
    const timeStr = new Date(payment.date).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
    const statusLabel = payment.isExemption ? 'إعفاء كامل' : (payment.discount ? `دفع بعد خصم ${payment.discount} ج.م` : 'دفع كامل');

    let html;

    if (size === 'normal') {
        // A4 - Official cash receipt
        html = `
        <html dir="rtl">
        <head>
            <title>إيصال استلام نقدية - ${student.name}</title>
            <style>
                @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700&display=swap');
                * { box-sizing: border-box; }
                body { font-family: 'Tajawal', sans-serif; padding: 30px; color: #1e293b; }
                .receipt { max-width: 800px; margin: 0 auto; border: 2px solid #4f46e5; border-radius: 12px; padding: 30px; }
                .header { display:flex; justify-content:space-between; align-items:center; border-bottom: 2px solid #4f46e5; padding-bottom: 15px; margin-bottom: 20px; }
                .header h1 { color: #4f46e5; margin: 0; }
                .header .meta { text-align: left; font-size: 0.9rem; color: #475569; }
                table.details { width: 100%; border-collapse: collapse; margin: 20px 0; }
                table.details td { border: 1px solid #e2e8f0; padding: 12px; }
                table.details td:first-child { background: #f1f5f9; font-weight: 700; width: 35%; }
                .amount-box { text-align: center; background: #f0fdf4; border: 2px solid #10b981; border-radius: 10px; padding: 15px; margin: 20px 0; font-size: 1.4rem; font-weight: 700; color: #10b981; }
                .signatures { display:flex; justify-content: space-between; margin-top: 60px; }
                .signatures div { width: 45%; text-align: center; border-top: 1px dashed #94a3b8; padding-top: 8px; }
                @media print { .no-print { display: none; } }
            </style>
        </head>
        <body>
            <div class="receipt">
                <div class="header">
                    <h1>إيصال استلام نقدية</h1>
                    <div class="meta">
                        رقم الإيصال: ${payment.id}<br>
                        التاريخ: ${dateStr} - ${timeStr}
                    </div>
                </div>

                <table class="details">
                    <tr><td>اسم الطالب</td><td>${student.name}</td></tr>
                    <tr><td>كود الطالب</td><td>${student.qrCode}</td></tr>
                    <tr><td>البيان</td><td>${cycleTitle}</td></tr>
                    <tr><td>الحالة</td><td>${statusLabel}</td></tr>
                </table>

                <div class="amount-box">
                    المبلغ المستلم: ${payment.amount} ج.م
                </div>

                <div class="signatures">
                    <div>توقيع الإدارة</div>
                    <div>توقيع المستلم</div>
                </div>

                <div style="text-align:center; margin-top:40px;" class="no-print">
                    <button onclick="window.print()" style="padding:10px 30px; background:#4f46e5; color:white; border:none; border-radius:5px; cursor:pointer; font-size:1rem;">طباعة الإيصال</button>
                </div>
            </div>
        </body>
        </html>`;
    } else {
        // Thermal 80mm receipt
        html = `
        <html dir="rtl">
        <head>
            <title>وصل دفع - ${student.name}</title>
            <style>
                @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;700&display=swap');
                * { box-sizing: border-box; }
                body { font-family: 'Tajawal', sans-serif; width: 80mm; margin: 0 auto; padding: 10px; color: #000; font-size: 12px; }
                .center { text-align: center; }
                hr { border: none; border-top: 1px dashed #000; margin: 8px 0; }
                table { width: 100%; font-size: 12px; }
                table td { padding: 3px 0; }
                .label { font-weight: 700; }
                .amount { text-align:center; font-size: 16px; font-weight: 700; margin: 8px 0; }
                @media print { .no-print { display: none; } body { width: 80mm; } }
            </style>
        </head>
        <body>
            <div class="center">
                <h3 style="margin:5px 0;">الأمين</h3>
                <div>${cycleTitle}</div>
            </div>
            <hr>
            <table>
                <tr><td class="label">رقم الوصل</td><td style="text-align:left;">${payment.id}</td></tr>
                <tr><td class="label">الطالب</td><td style="text-align:left;">${student.name}</td></tr>
                <tr><td class="label">الكود</td><td style="text-align:left;">${student.qrCode}</td></tr>
                <tr><td class="label">التاريخ</td><td style="text-align:left;">${dateStr} ${timeStr}</td></tr>
                <tr><td class="label">الحالة</td><td style="text-align:left;">${statusLabel}</td></tr>
            </table>
            <hr>
            <div class="amount">المدفوع: ${payment.amount} ج.م</div>
            <hr>
            <div class="center" style="margin-top:10px;">شكراً لكم 🌹</div>
            <div style="text-align:center; margin-top:15px;" class="no-print">
                <button onclick="window.print()" style="padding:8px 20px; background:#4f46e5; color:white; border:none; border-radius:5px; cursor:pointer;">طباعة</button>
            </div>
        </body>
        </html>`;
    }

    const win = window.open('', '_blank');
    win.document.write(html);
    win.document.close();
}

// =========================================================
// --- Payment Receipts Section (search by receipt/payment code) ---
// =========================================================

function initReceiptsSection() {
    const input = document.getElementById('receipt-search-input');
    const result = document.getElementById('receipt-search-result');
    const filter = document.getElementById('receipts-list-filter');
    if (input) input.value = '';
    if (result) result.innerHTML = '';
    if (filter) filter.value = '';
    renderReceiptsList('');
}

// Renders a list of all payment receipts (printed or not) for the current group, newest first
function renderReceiptsList(searchTerm = '') {
    const body = document.getElementById('receipts-list-body');
    if (!body) return;

    // Sync active grade/group context
    currentGrade = localStorage.getItem('edu_active_grade') || currentGrade;
    currentGroupId = localStorage.getItem('edu_active_group') || currentGroupId;

    const normalize = (text) => {
        return String(text)
            .replace(/[أإآ]/g, 'ا')
            .replace(/ة/g, 'ه')
            .replace(/ى/g, 'ي')
            .toLowerCase()
            .trim();
    };

    const groupStudents = db.students.filter(s =>
        String(s.grade) === String(currentGrade) &&
        String(s.groupId) === String(currentGroupId)
    );
    const groupStudentIds = new Set(groupStudents.map(s => s.id));

    let payments = db.payments
        .filter(p => groupStudentIds.has(p.studentId))
        .sort((a, b) => new Date(b.date) - new Date(a.date));

    if (searchTerm && searchTerm.trim()) {
        const term = normalize(searchTerm);
        payments = payments.filter(p => {
            const student = db.students.find(s => s.id == p.studentId);
            if (!student) return false;
            return normalize(student.name).includes(term) ||
                String(student.qrCode).includes(searchTerm.trim()) ||
                String(p.id).includes(searchTerm.trim());
        });
    }

    if (payments.length === 0) {
        body.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:1.5rem; color:var(--text-muted);">لا توجد وصولات لعرضها</td></tr>';
        return;
    }

    body.innerHTML = payments.map(p => {
        const student = db.students.find(s => s.id == p.studentId);
        const cycleTitle = getReceiptCycleTitle(p);
        const dateStr = new Date(p.date).toLocaleString('ar-EG');
        const statusLabel = p.isExemption ? 'إعفاء كامل' : (p.discount ? `بعد خصم ${p.discount} ج.م` : 'كامل');
        return `
            <tr style="border-bottom:1px solid #f1f5f9;">
                <td style="padding:8px; font-family:monospace;">#${p.id}</td>
                <td style="padding:8px;"><strong>${student ? student.name : 'غير معروف'}</strong></td>
                <td style="padding:8px;">${cycleTitle} <span style="color:var(--text-muted); font-size:0.8rem;">(${statusLabel})</span></td>
                <td style="padding:8px; color:var(--accent); font-weight:700;">${p.amount} ج.م</td>
                <td style="padding:8px; font-size:0.85rem; color:var(--text-muted);">${dateStr}</td>
                <td style="padding:8px; display:flex; gap:5px;">
                    <button class="btn" style="background:var(--accent); color:#fff; padding:4px 10px; font-size:0.75rem;" onclick="printMonthlyReceipt(${p.id}, 'thermal')" title="طباعة حرارية">
                        <i class="fas fa-print"></i>
                    </button>
                    <button class="btn" style="background:var(--primary); color:#fff; padding:4px 10px; font-size:0.75rem;" onclick="printMonthlyReceipt(${p.id}, 'normal')" title="طباعة A4">
                        <i class="fas fa-file-invoice"></i>
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

function searchPaymentCodeSection() {
    const input = document.getElementById('receipt-search-input');
    const result = document.getElementById('receipt-search-result');
    if (!input || !result) return;

    const code = input.value.trim();
    if (!code) {
        result.innerHTML = '<p style="text-align:center; color:var(--text-muted); padding:1rem;">يرجى إدخال رقم الوصل (كود الدفع)</p>';
        return;
    }

    const payment = db.payments.find(p => String(p.id) === code) ||
        db.payments.find(p => String(p.id).endsWith(code));

    if (!payment) {
        result.innerHTML = '<p style="text-align:center; color:var(--danger); padding:1rem;">❌ لا يوجد وصل بهذا الكود</p>';
        return;
    }

    const student = db.students.find(s => s.id == payment.studentId);
    const cycleTitle = getReceiptCycleTitle(payment);
    const dateStr = new Date(payment.date).toLocaleString('ar-EG');
    const statusLabel = payment.isExemption ? 'إعفاء كامل' : (payment.discount ? `دفع بعد خصم ${payment.discount} ج.م` : 'دفع كامل');

    result.innerHTML = `
        <div class="card" style="padding:1.5rem; border:2px solid var(--accent); margin-top:1.5rem;">
            <h4 style="margin-bottom:1rem;"><i class="fas fa-receipt"></i> تفاصيل الوصل #${payment.id}</h4>
            <table style="width:100%; margin-bottom:1rem;">
                <tr><td style="font-weight:700; padding:6px;">الطالب</td><td style="padding:6px;">${student ? student.name : 'غير معروف'}</td></tr>
                <tr><td style="font-weight:700; padding:6px;">الكود</td><td style="padding:6px;">${student ? student.qrCode : '-'}</td></tr>
                <tr><td style="font-weight:700; padding:6px;">البيان</td><td style="padding:6px;">${cycleTitle}</td></tr>
                <tr><td style="font-weight:700; padding:6px;">المبلغ</td><td style="padding:6px; color:var(--accent); font-weight:700;">${payment.amount} ج.م</td></tr>
                <tr><td style="font-weight:700; padding:6px;">الحالة</td><td style="padding:6px;">${statusLabel}</td></tr>
                <tr><td style="font-weight:700; padding:6px;">التاريخ</td><td style="padding:6px;">${dateStr}</td></tr>
            </table>
            <div style="display:flex; gap:10px; flex-wrap:wrap;">
                <button class="btn btn-primary" style="background:var(--accent);" onclick="printMonthlyReceipt(${payment.id}, 'thermal')">
                    <i class="fas fa-print"></i> طباعة حرارية (80mm)
                </button>
                <button class="btn btn-primary" style="background:var(--primary);" onclick="printMonthlyReceipt(${payment.id}, 'normal')">
                    <i class="fas fa-file-invoice"></i> طباعة عادية (A4)
                </button>
                ${student ? `<button class="btn" style="background:var(--bg-light); border:1px solid var(--border);" onclick="openSmartCard(${student.id})">
                    <i class="fas fa-id-card"></i> فتح كارت الطالب
                </button>` : ''}
            </div>
        </div>
    `;
}



function handleAddExpense() {
    const t = document.getElementById('exp-title').value;
    const a = parseInt(document.getElementById('exp-amount').value);
    const c = document.getElementById('exp-category').value;
    if (!t || !a) return;
    db.expenses.push({
        id: Date.now(),
        title: t,
        amount: a,
        category: c,
        date: new Date().toISOString(), // Ensure date is stored
        groupId: currentGroupId
    });
    db.save('expenses');
    renderFinances();
    updateDashboardStats(); // Refresh dashboard with deduction
    toggleModal('expense-modal', false);

    // Clear inputs
    document.getElementById('exp-title').value = '';
    document.getElementById('exp-amount').value = '';
}

function printExpensesReport() {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    // Group context
    const groupObj = db.groups.find(g => String(g.id) === String(currentGroupId));
    const groupLabel = groupObj ? groupObj.name : 'كل المجموعات';

    // Filters expenses of current month and current group (if any)
    const expenses = db.expenses.filter(e => {
        const eDate = new Date(e.date || e.id);
        const monthMatch = eDate.getMonth() === currentMonth && eDate.getFullYear() === currentYear;
        const groupMatch = !currentGroupId || String(e.groupId) === String(currentGroupId);
        return monthMatch && groupMatch;
    });

    if (expenses.length === 0) {
        showNotification('لا يوجد مصروفات مسجلة لهذا الشهر حالياً', 'warning');
        return;
    }

    const total = expenses.reduce((sum, e) => sum + e.amount, 0);

    const win = window.open('', '_blank');
    win.document.write(`
        <html dir="rtl" lang="ar">
        <head>
            <title>كشف المصروفات - ${groupLabel}</title>
            <style>
                @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;700&display=swap');
                body { font-family: 'Cairo', sans-serif; padding: 40px; color: #333; }
                .header { text-align: center; margin-bottom: 40px; border-bottom: 2px solid #ddd; padding-bottom: 20px; }
                table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                th, td { border: 1px solid #ddd; padding: 12px; text-align: center; }
                th { background-color: #f8f9fa; color: #555; font-weight: 700; }
                .total-box { margin-top: 30px; text-align: left; font-size: 1.4rem; font-weight: 700; color: #dc2626; }
                .timestamp { font-size: 0.8rem; color: #777; margin-top: 50px; text-align: center; }
            </style>
        </head>
        <body>
            <div class="header">
                <h1>كشف المصروفات الشهرية</h1>
                <p>الفترة: ${now.toLocaleDateString('ar-EG', { month: 'long', year: 'numeric' })}</p>
                <p>المجموعة الدراسية: <strong>${groupLabel}</strong></p>
            </div>
            <table>
                <thead>
                    <tr>
                        <th>البيان (التفاصيل)</th>
                        <th>الفئة</th>
                        <th>التاريخ</th>
                        <th>القيمة (ج.م)</th>
                    </tr>
                </thead>
                <tbody>
                    ${expenses.map(e => `
                        <tr>
                            <td>${e.title}</td>
                            <td>${e.category}</td>
                            <td>${new Date(e.date || e.id).toLocaleDateString('ar-EG')}</td>
                            <td style="font-weight:700;">${e.amount} ج.م</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
            <div class="total-box">
                إجمالي المنصرف: ${total} ج.م
            </div>
            <div class="timestamp">
                تاريخ الطباعة: ${new Date().toLocaleString('ar-EG')}
            </div>
            <script>setTimeout(() => { window.print(); window.close(); }, 500);</script>
        </body>
        </html>
    `);
}

async function deleteStudent(id) {
    if (!confirm('هل أنت متأكد من حذف هذا الطالب نهائياً؟')) return;
    db.students = db.students.filter(s => s.id !== id);
    await StorageEngine.delete('students', id);
    await db.save('students');
    renderStudents();
    showNotification('تم حذف الطالب بنجاح');
}

async function clearAllStudents() {
    const confirmed = confirm('⚠️ تحذير: هل أنت متأكد من رغبتك في مسح جميع الطلاب؟\n\nسيتم حذف جميع الطلاب المسجلين والبيانات المرتبطة بهم (الحضور والدرجات وغيرها).\n\nهذا الإجراء لا يمكن التراجع عنه!');
    
    if (!confirmed) return;

    const doubleConfirm = confirm('هل أنت متأكد 100%؟ سيتم حذف جميع الطلاب نهائياً!');
    if (!doubleConfirm) return;

    try {
        // مسح جميع الطلاب من الذاكرة
        db.students = [];
        
        // مسح جميع الطلاب من IndexedDB
        const allStudents = await StorageEngine.getAll('students');
        for (const student of allStudents) {
            await StorageEngine.delete('students', student.id);
        }

        // مسح بيانات الحضور المرتبطة بهم (اختياري - يمكن تركها)
        db.attendance = [];
        const allAttendance = await StorageEngine.getAll('attendance');
        for (const att of allAttendance) {
            await StorageEngine.delete('attendance', att.id);
        }

        // مسح الدرجات المرتبطة
        db.scores = [];
        const allScores = await StorageEngine.getAll('scores');
        for (const score of allScores) {
            await StorageEngine.delete('scores', score.id);
        }

        // حفظ التغييرات
        await db.save('students');
        await db.save('attendance');
        await db.save('scores');

        // تحديث الواجهة
        renderStudents();
        showNotification('✓ تم مسح جميع الطلاب بنجاح! البرنامج الآن جديد.', 'success');
    } catch (err) {
        console.error('خطأ في مسح الطلاب:', err);
        showNotification('حدث خطأ أثناء مسح الطلاب', 'error');
    }
}

function openWhatsAppMenu(id) {
    const s = db.students.find(x => x.id === id);
    if (!s) return;
    const target = prompt("أرسل إلى:\n1 - الطالب\n2 - ولي الأمر");
    if (target === '1') sendWhatsApp(s.id, 'student');
    else if (target === '2') sendWhatsApp(s.id, 'parent');
}

function sendWhatsApp(studentId, target) {
    const s = db.students.find(x => x.id === studentId);
    if (!s) return;
    const atts = db.attendance.filter(a => a.studentId == studentId);
    let msg = `*🏷️ تقرير المتابعة - الأمين*\nالطالب: ${s.name}\nحضر: ${atts.length} حصة\nنتمنى لكم دوام التفوق.`;
    const phone = target === 'student' ? s.phone : s.parentPhone;
    window.open(`https://wa.me/2${phone}?text=${encodeURIComponent(msg)}`, '_blank');
}

function generateMonthlyReport(id) {
    const s = db.students.find(x => x.id === id);
    if (!s) return;

    // Dynamic Header Info
    const now = new Date();
    const monthName = now.toLocaleString('ar-EG', { month: 'long' });
    const yearName = now.getFullYear();
    document.getElementById('report-date-range').innerText = `للفترة: ${monthName} ${yearName}`;
    document.getElementById('rep-st-name').innerText = s.name;
    document.getElementById('rep-st-code').innerText = s.qrCode;
    document.getElementById('rep-st-points').innerText = s.points;

    // Use cycle start date if active, otherwise start of calendar month
    const startOfPeriod = db.settings.activeCycle ? new Date(db.settings.activeCycle) : new Date(now.getFullYear(), now.getMonth(), 1);

    // --- 1. Attendance Logic (This Period) ---
    const currentMonthAtts = db.attendance.filter(a =>
        a.studentId == s.id &&
        new Date(a.date) >= startOfPeriod
    );

    const attendDays = currentMonthAtts.filter(a => a.status === 'present');
    const absentDays = currentMonthAtts.filter(a => a.status === 'absent');

    // --- 2. Exam Logic (This Period) ---
    const studentMarks = db.scores.filter(sc => sc.studentId == s.id);
    const monthlyExams = db.exams.filter(e =>
        e.grade == s.grade &&
        new Date(e.id) >= (startOfPeriod.getTime() - 86400000) // Include exams on same day start
    );

    let reportRows = [];

    // Add Attendance Summary Row
    reportRows.push(`
        <tr style="background: rgba(16, 185, 129, 0.05);">
            <td><strong>حضور وانضباط</strong></td>
            <td>إحصاء الشهر الحالي</td>
            <td>${attendDays.length} حضور / ${absentDays.length} غياب</td>
            <td>${attendDays.length > 3 ? 'التزام ممتاز' : 'يحتاج متابعة'}</td>
        </tr>
    `);

    // Add Detailed Present Dates
    if (attendDays.length > 0) {
        const datesStr = attendDays.map(a => new Date(a.date).toLocaleDateString('ar-EG', { day: 'numeric', month: 'numeric' })).join(', ');
        reportRows.push(`
            <tr>
                <td style="color:var(--accent)">سجل الحضور</td>
                <td colspan="2" style="font-size:0.85rem;">تواريخ الحضور: ${datesStr}</td>
                <td>✅</td>
            </tr>
        `);
    }

    // Add Detailed Absent Dates
    if (absentDays.length > 0) {
        const datesStr = absentDays.map(a => new Date(a.date).toLocaleDateString('ar-EG', { day: 'numeric', month: 'numeric' })).join(', ');
        reportRows.push(`
            <tr style="color:var(--danger)">
                <td>سجل الغياب</td>
                <td colspan="2" style="font-size:0.85rem;">تواريخ الغياب: ${datesStr}</td>
                <td>⚠️ مبرر/غير مبرر</td>
            </tr>
        `);
    }

    // Add Exam Scores
    monthlyExams.forEach(ex => {
        const score = studentMarks.find(m => m.examId === ex.id);
        if (score) {
            const percent = Math.round((score.mark / ex.maxMarks) * 100);
            reportRows.push(`
                <tr>
                    <td><strong>امتحان</strong></td>
                    <td>${ex.title}</td>
                    <td>${score.mark} / ${ex.maxMarks} (${percent}%)</td>
                    <td style="font-weight:bold; color:${percent >= 90 ? '#10b981' : (percent >= 50 ? '#f59e0b' : '#ef4444')}">
                        ${percent >= 90 ? 'ممتاز ⭐' : (percent >= 75 ? 'جيد جداً' : (percent >= 50 ? 'مقبول' : 'ضعيف'))}
                    </td>
                </tr>
            `);
        } else {
            reportRows.push(`
                <tr style="background: #fff1f2;">
                    <td><strong>امتحان</strong></td>
                    <td>${ex.title}</td>
                    <td style="color:var(--danger)">لم يحضر ❌</td>
                    <td style="color:var(--danger)">لا توجد نتيجة</td>
                </tr>
            `);
        }
    });

    document.getElementById('report-data-body').innerHTML = reportRows.join('') || '<tr><td colspan="4" style="text-align:center; padding:2rem;">لا توجد بيانات مسجلة لهذا الطالب في الشهر الحالي</td></tr>';

    toggleModal('report-modal', true);
}

// --- 13. Data Persistence & Recovery Logic ---
async function exportData() {
    try {
        showNotification('جاري تجميع البيانات للنسخ الاحتياطي...', 'info');

        if (!StorageEngine.db) await StorageEngine.init();

        const snapshot = {};
        const tables = ['students', 'attendance', 'exams', 'scores', 'expenses', 'handouts', 'studentHandouts', 'materials', 'quizzes', 'rewards', 'payments', 'waQueue', 'groups', 'cycles', 'absenceSessions', 'dailyTreasuryArchives', 'staff', 'shifts', 'courseCodes', 'platformCourses', 'platformSubscriptions'];

        for (const t of tables) {
            try {
                if (t === 'settings') snapshot[t] = db._settings;
                else snapshot[t] = await StorageEngine.getAll(t);
            } catch (e) {
                console.warn(`Failed to export table: ${t}`, e);
                snapshot[t] = [];
            }
        }

        snapshot.settings = db._settings || {};
        snapshot.gradesList = gradesList;
        snapshot.activeGrade = currentGrade;
        snapshot.activeGroup = currentGroupId;
        snapshot.dailyTreasuryLastArchiveDate = db.dailyTreasuryLastArchiveDate || localStorage.getItem('dailyTreasuryLastArchiveDate') || null;
        snapshot.localStorageSnapshot = {};
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            snapshot.localStorageSnapshot[key] = localStorage.getItem(key);
        }
        snapshot.exportDate = new Date().toISOString();

        const fileContent = `/** 
 * الأمين Permanent Data Backup - (data.js)
 * Created: ${new Date().toLocaleString()}
 */
window.edu_initial_data = ${JSON.stringify(snapshot, null, 4)};`;

        const blob = new Blob([fileContent], { type: 'application/javascript' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        document.body.appendChild(a);
        a.style.display = 'none';
        a.href = url;
        a.download = `data.js`;
        a.click();

        setTimeout(() => {
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
        }, 100);

        showNotification('🛡️ تم حفظ نسخة الحماية (data.js) بنجاح! يمكنك الآن نقل هذا الملف لأي جهاز آخر أو استعادته في حالة الطوارئ.', 'success');
    } catch (error) {
        console.error('Export Error:', error);
        showNotification('❌ حدث خطأ أثناء تجميع البيانات: ' + error.message, 'error');
    }
}

async function importData(input) {
    if (!input.files || input.files.length === 0) return;

    const confirmImport = confirm('⚠️ تنبيه هام: أنت على وشك استعادة بيانات من ملف خارجي. سيتم دمج هذه البيانات مع البيانات الحالية. هل تريد الاستمرار؟');
    if (!confirmImport) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            showNotification('⏳ جاري معالجة الملف واستعادة البيانات... يرجى الانتظار', 'info');
            const success = await hydrateDatabase(e.target.result);
            if (success) {
                showNotification('✅ تم استعادة البيانات بنجاح! سيتم تحديث البرنامج الآن بصورة كاملة.', 'success');
                setTimeout(() => location.reload(), 2000);
            } else {
                throw new Error('Hydration returned false');
            }
        } catch (err) {
            console.error('Import Error:', err);
            alert('❌ فشل في استيراد البيانات: تأكد من اختيار ملف (data.js) صحيح أو ملف JSON صالح.');
        }
    };
    reader.readAsText(input.files[0]);
}

const APP_THEME_KEY = 'alamin_theme';
const APP_THEMES = [
    { id: 'academic', name: 'أكاديمي', swatch: 'academic' },
    { id: 'emerald', name: 'زمردي', swatch: 'emerald' },
    { id: 'sunset', name: 'دافئ', swatch: 'sunset' },
    { id: 'midnight', name: 'ليلي', swatch: 'midnight' }
];

function applyAppTheme(themeId = 'academic') {
    const selected = APP_THEMES.find(t => t.id === themeId) ? themeId : 'academic';
    if (selected === 'academic') {
        document.body.removeAttribute('data-theme');
    } else {
        document.body.dataset.theme = selected;
    }
    localStorage.setItem(APP_THEME_KEY, selected);

    document.querySelectorAll('.theme-option').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.theme === selected);
    });
}

function initThemeSwitcher() {
    if (document.getElementById('theme-switcher')) return;

    const headerActions = document.querySelector('header > div:last-child');
    if (!headerActions) return;

    const switcher = document.createElement('div');
    switcher.id = 'theme-switcher';
    switcher.className = 'theme-switcher';
    switcher.innerHTML = `
        <button class="btn theme-trigger" type="button" title="تغيير الألوان">
            <i class="fas fa-palette"></i>
        </button>
        <div class="theme-menu">
            ${APP_THEMES.map(theme => `
                <button class="theme-option" type="button" data-theme="${theme.id}">
                    <span>${theme.name}</span>
                    <span class="theme-swatch ${theme.swatch}"></span>
                </button>
            `).join('')}
        </div>
    `;

    headerActions.insertBefore(switcher, headerActions.firstChild);
    switcher.querySelector('.theme-trigger').addEventListener('click', (event) => {
        event.stopPropagation();
        switcher.classList.toggle('open');
    });

    switcher.querySelectorAll('.theme-option').forEach(btn => {
        btn.addEventListener('click', () => {
            applyAppTheme(btn.dataset.theme);
            switcher.classList.remove('open');
            showNotification(`تم تطبيق ثيم ${btn.innerText.trim()}`, 'success');
        });
    });

    document.addEventListener('click', (event) => {
        if (!switcher.contains(event.target)) switcher.classList.remove('open');
    });
}

const DAY_NIGHT_THEMES = [
    { id: 'morning', name: '\u0627\u0644\u0648\u0636\u0639 \u0627\u0644\u0635\u0628\u0627\u062d\u064a', swatch: 'morning' },
    { id: 'night', name: '\u0627\u0644\u0648\u0636\u0639 \u0627\u0644\u0644\u064a\u0644\u064a', swatch: 'night' }
];

function normalizeAppTheme(themeId = 'morning') {
    if (themeId === 'midnight' || themeId === 'night') return 'night';
    return 'morning';
}

function updateThemeControls(selected) {
    document.querySelectorAll('.theme-option').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.theme === selected);
    });

    const toggle = document.getElementById('mode-toggle');
    if (!toggle) return;

    const isNight = selected === 'night';
    toggle.title = isNight ? '\u062a\u0641\u0639\u064a\u0644 \u0627\u0644\u0648\u0636\u0639 \u0627\u0644\u0635\u0628\u0627\u062d\u064a' : '\u062a\u0641\u0639\u064a\u0644 \u0627\u0644\u0648\u0636\u0639 \u0627\u0644\u0644\u064a\u0644\u064a';
    toggle.innerHTML = `<i class="fas ${isNight ? 'fa-sun' : 'fa-moon'}"></i>`;
}

function applyAppTheme(themeId = 'morning') {
    const selected = normalizeAppTheme(themeId);
    document.body.dataset.theme = selected;
    localStorage.setItem(APP_THEME_KEY, selected);
    updateThemeControls(selected);
}

function toggleDayNightMode() {
    const current = normalizeAppTheme(localStorage.getItem(APP_THEME_KEY) || document.body.dataset.theme || 'morning');
    const next = current === 'night' ? 'morning' : 'night';
    applyAppTheme(next);
    showNotification(next === 'night' ? '\u062a\u0645 \u062a\u0641\u0639\u064a\u0644 \u0627\u0644\u0648\u0636\u0639 \u0627\u0644\u0644\u064a\u0644\u064a' : '\u062a\u0645 \u062a\u0641\u0639\u064a\u0644 \u0627\u0644\u0648\u0636\u0639 \u0627\u0644\u0635\u0628\u0627\u062d\u064a', 'success');
}

function initThemeSwitcher() {
    if (document.getElementById('theme-switcher')) {
        updateThemeControls(normalizeAppTheme(localStorage.getItem(APP_THEME_KEY) || 'morning'));
        return;
    }

    const headerActions = document.querySelector('header > div:last-child');
    if (!headerActions) return;

    const switcher = document.createElement('div');
    switcher.id = 'theme-switcher';
    switcher.className = 'theme-switcher';
    switcher.innerHTML = `
        <button class="btn mode-toggle" id="mode-toggle" type="button" title="\u062a\u0628\u062f\u064a\u0644 \u0627\u0644\u0648\u0636\u0639 \u0627\u0644\u0644\u064a\u0644\u064a \u0648\u0627\u0644\u0635\u0628\u0627\u062d\u064a">
            <i class="fas fa-moon"></i>
        </button>
        <button class="btn theme-trigger" type="button" title="\u0627\u062e\u062a\u064a\u0627\u0631 \u0627\u0644\u0648\u0636\u0639">
            <i class="fas fa-palette"></i>
        </button>
        <div class="theme-menu">
            ${DAY_NIGHT_THEMES.map(theme => `
                <button class="theme-option" type="button" data-theme="${theme.id}">
                    <span>${theme.name}</span>
                    <span class="theme-swatch ${theme.swatch}"></span>
                </button>
            `).join('')}
        </div>
    `;

    headerActions.insertBefore(switcher, headerActions.firstChild);
    switcher.querySelector('#mode-toggle').addEventListener('click', (event) => {
        event.stopPropagation();
        toggleDayNightMode();
    });

    switcher.querySelector('.theme-trigger').addEventListener('click', (event) => {
        event.stopPropagation();
        switcher.classList.toggle('open');
    });

    switcher.querySelectorAll('.theme-option').forEach(btn => {
        btn.addEventListener('click', () => {
            applyAppTheme(btn.dataset.theme);
            switcher.classList.remove('open');
            showNotification(`\u062a\u0645 \u062a\u0641\u0639\u064a\u0644 ${btn.innerText.trim()}`, 'success');
        });
    });

    document.addEventListener('click', (event) => {
        if (!switcher.contains(event.target)) switcher.classList.remove('open');
    });

    updateThemeControls(normalizeAppTheme(localStorage.getItem(APP_THEME_KEY) || 'morning'));
}

function getActiveGradeName() {
    const gradeObj = gradesList.find(g => String(g.id) === String(currentGrade));
    return gradeObj ? gradeObj.name : 'لم يتم اختيار سنة';
}

function getActiveGroupName() {
    const groupObj = db.groups.find(g => String(g.id) === String(currentGroupId));
    return groupObj ? groupObj.name : 'كل المجموعات';
}

function updateExperienceSummary() {
    const bar = document.getElementById('app-insight-bar');
    if (!bar) return;

    const activeStudents = db.students.filter(s => {
        const gradeOk = !currentGrade || String(s.grade) === String(currentGrade);
        const groupOk = !currentGroupId || String(s.groupId) === String(currentGroupId);
        return gradeOk && groupOk;
    });

    const today = new Date().toLocaleDateString('en-CA');
    const presentToday = db.attendance.filter(a => {
        const student = db.students.find(s => s.id === a.studentId);
        return a.date === today && a.status === 'present' && student &&
            (!currentGrade || String(student.grade) === String(currentGrade)) &&
            (!currentGroupId || String(student.groupId) === String(currentGroupId));
    }).length;

    const dateLabel = new Date().toLocaleDateString('ar-EG', {
        weekday: 'long',
        day: 'numeric',
        month: 'long'
    });

    bar.innerHTML = `
        <div class="insight-pill">
            <i class="fas fa-layer-group"></i>
            <div><small>السنة الحالية</small><strong>${getActiveGradeName()}</strong></div>
        </div>
        <div class="insight-pill">
            <i class="fas fa-users"></i>
            <div><small>المجموعة</small><strong>${getActiveGroupName()}</strong></div>
        </div>
        <div class="insight-pill">
            <i class="fas fa-user-check"></i>
            <div><small>حضور اليوم</small><strong>${presentToday} / ${activeStudents.length}</strong></div>
        </div>
        <div class="insight-pill">
            <i class="fas fa-calendar-day"></i>
            <div><small>اليوم</small><strong>${dateLabel}</strong></div>
        </div>
    `;
}

function initExperienceSummary() {
    if (document.getElementById('app-insight-bar')) {
        updateExperienceSummary();
        return;
    }

    const header = document.querySelector('.main-content > header');
    if (!header) return;

    const bar = document.createElement('div');
    bar.id = 'app-insight-bar';
    bar.className = 'app-insight-bar';
    header.insertAdjacentElement('afterend', bar);
    updateExperienceSummary();
}

function initQuickDock() {
    if (document.getElementById('quick-dock')) return;

    const dock = document.createElement('div');
    dock.id = 'quick-dock';
    dock.className = 'quick-dock';
    dock.innerHTML = `
        <button class="btn quick-dock-btn" type="button" title="الرئيسية" data-action="dashboard"><i class="fas fa-home"></i></button>
        <button class="btn quick-dock-btn" type="button" title="اختيار السنة والمجموعة" data-action="portal"><i class="fas fa-layer-group"></i></button>
        <button class="btn quick-dock-btn" type="button" title="الحضور" data-action="attendance"><i class="fas fa-qrcode"></i></button>
        <button class="btn quick-dock-btn" type="button" title="الخزينة" data-action="payments"><i class="fas fa-wallet"></i></button>
        <button class="btn quick-dock-btn" type="button" title="نسخة احتياطية" data-action="backup"><i class="fas fa-shield-alt"></i></button>
    `;
    document.body.appendChild(dock);

    dock.addEventListener('click', (event) => {
        const btn = event.target.closest('[data-action]');
        if (!btn) return;

        const action = btn.dataset.action;
        if (action === 'portal') {
            enterPortalMode();
        } else if (action === 'backup') {
            exportData();
        } else {
            showSection(action);
        }
        updateExperienceSummary();
    });
}

function initExperienceEnhancements() {
    applyAppTheme(localStorage.getItem(APP_THEME_KEY) || 'morning');
    initThemeSwitcher();
    initExperienceSummary();
    initQuickDock();
    initProgramSettings();
}

function getProgramProfile() {
    if (!db._settings.appProfile) {
        db._settings.appProfile = {
            centerName: 'الأمين في اللغة العربية',
            teacherName: 'المدير العام',
            phone: ''
        };
    }
    return db._settings.appProfile;
}

function applyProgramProfile() {
    const profile = getProgramProfile();
    document.title = `${profile.centerName} | نظام الإدارة`;

    const logo = document.querySelector('.logo');
    if (logo) logo.innerHTML = `<i class="fas fa-book-open"></i> ${profile.centerName || 'الأمين'}`;

    const userName = document.querySelector('.user-profile span');
    if (userName) userName.innerText = profile.teacherName || 'المدير العام';
}

function initProgramSettings() {
    ensureSettingsNavItem();
    ensureSettingsSection();
    applyProgramProfile();
}

function ensureSettingsNavItem() {
    if (document.getElementById('nav-settings')) return;

    const nav = document.querySelector('.nav-links');
    if (!nav) return;

    const item = document.createElement('li');
    item.className = 'nav-item';
    item.innerHTML = `
        <a href="#" class="nav-link" id="nav-settings" onclick="showSection('settings', this)">
            <i class="fas fa-sliders-h" style="color:var(--primary-light)"></i>
            <span>إعدادات البرنامج</span>
        </a>
    `;

    const backup = document.getElementById('nav-backup')?.closest('.nav-item');
    nav.insertBefore(item, backup || nav.lastElementChild);
}

function ensureSettingsSection() {
    if (document.getElementById('settings-section')) return;

    const main = document.querySelector('.main-content');
    if (!main) return;

    const section = document.createElement('section');
    section.id = 'settings-section';
    section.className = 'fade-in';
    section.style.display = 'none';
    section.innerHTML = `
        <div class="settings-grid">
            <div class="settings-panel">
                <h3><i class="fas fa-school"></i> بيانات البرنامج</h3>
                <div class="settings-row">
                    <label for="settings-center-name">اسم السنتر أو البرنامج</label>
                    <input id="settings-center-name" class="form-input" type="text">
                </div>
                <div class="settings-row">
                    <label for="settings-teacher-name">اسم المستخدم / المدير</label>
                    <input id="settings-teacher-name" class="form-input" type="text">
                </div>
                <div class="settings-row">
                    <label for="settings-phone">رقم التواصل</label>
                    <input id="settings-phone" class="form-input" type="text">
                </div>
                <button class="btn btn-primary" onclick="saveProgramSettings()">
                    <i class="fas fa-save"></i> حفظ الإعدادات
                </button>
            </div>

            <div class="settings-panel">
                <h3><i class="fas fa-wallet"></i> الاشتراك والمالية</h3>
                <div class="settings-row">
                    <label for="settings-monthly-fee">قيمة الاشتراك الافتراضية</label>
                    <input id="settings-monthly-fee" class="form-input" type="number" min="0" step="1">
                </div>
                <div class="settings-row">
                    <label for="settings-commission">نسبة السنتر الافتراضية %</label>
                    <input id="settings-commission" class="form-input" type="number" min="0" max="100" step="1">
                </div>
                <p class="settings-note">هذه القيم تطبق على السنة الدراسية الحالية، ويمكن تغييرها لكل سنة بشكل مستقل.</p>
            </div>

            <div class="settings-panel">
                <h3><i class="fas fa-palette"></i> المظهر والتكبير</h3>
                <div class="settings-actions">
                    <button id="settings-morning-btn" class="btn settings-choice" onclick="applyAppTheme('morning'); renderProgramSettings();">
                        <i class="fas fa-sun"></i> صباحي
                    </button>
                    <button id="settings-night-btn" class="btn settings-choice" onclick="applyAppTheme('night'); renderProgramSettings();">
                        <i class="fas fa-moon"></i> ليلي
                    </button>
                </div>
                <div class="settings-actions">
                    <button class="btn settings-choice" onclick="changeAppZoom(-0.1); renderProgramSettings();">
                        <i class="fas fa-search-minus"></i> تصغير
                    </button>
                    <button class="btn settings-choice" onclick="resetAppZoom(); renderProgramSettings();">
                        <i class="fas fa-sync-alt"></i> 100%
                    </button>
                    <button class="btn settings-choice" onclick="changeAppZoom(0.1); renderProgramSettings();">
                        <i class="fas fa-search-plus"></i> تكبير
                    </button>
                </div>
                <p class="settings-note">التكبير الحالي: <strong id="settings-zoom-label">100%</strong></p>
            </div>

            <div class="settings-panel">
                <h3><i class="fas fa-lock"></i> الأمان وكلمات المرور</h3>
                <div class="settings-actions">
                    <button class="btn btn-primary" onclick="openPasswordManagement()">
                        <i class="fas fa-key"></i> إدارة كلمات المرور
                    </button>
                    <button class="btn settings-choice" onclick="toggleDayNightMode(); renderProgramSettings();">
                        <i class="fas fa-adjust"></i> تبديل الوضع
                    </button>
                </div>
                <p class="settings-note">يمكنك تغيير كلمة مرور الدخول، الخزينة، فك الحماية، وأكواد الموظفين.</p>
            </div>

            <div class="settings-panel">
                <h3><i class="fas fa-print"></i> الطباعة</h3>
                <div class="settings-row">
                    <label for="settings-print-width">عرض الطابعة الحرارية الافتراضي</label>
                    <select id="settings-print-width" class="form-input">
                        <option value="58mm">58mm</option>
                        <option value="80mm">80mm</option>
                    </select>
                </div>
                <button class="btn settings-choice" onclick="generatePrintCalibration()">
                    <i class="fas fa-ruler"></i> طباعة معايرة
                </button>
            </div>

            <div class="settings-panel">
                <h3><i class="fas fa-shield-alt"></i> النسخ الاحتياطي</h3>
                <div class="settings-actions">
                    <button class="btn btn-primary" onclick="exportData()">
                        <i class="fas fa-download"></i> نسخة أمان الآن
                    </button>
                    <label class="btn settings-choice" for="settings-import-file">
                        <i class="fas fa-upload"></i> استيراد نسخة
                    </label>
                    <input id="settings-import-file" type="file" accept=".js,.json" style="display:none" onchange="importData(this)">
                </div>
                <p class="settings-note">احفظ نسخة احتياطية قبل أي تعديل كبير أو نقل البرنامج لجهاز آخر.</p>
            </div>
        </div>
    `;
    main.appendChild(section);
}

function renderProgramSettings() {
    ensureSettingsSection();
    document.getElementById('page-title').innerText = 'إعدادات البرنامج';

    const profile = getProgramProfile();
    const center = document.getElementById('settings-center-name');
    const teacher = document.getElementById('settings-teacher-name');
    const phone = document.getElementById('settings-phone');
    const fee = document.getElementById('settings-monthly-fee');
    const commission = document.getElementById('settings-commission');
    const printWidth = document.getElementById('settings-print-width');
    const zoom = document.getElementById('settings-zoom-label');

    if (center) center.value = profile.centerName || '';
    if (teacher) teacher.value = profile.teacherName || '';
    if (phone) phone.value = profile.phone || '';
    if (fee) fee.value = db.settings.monthlyFee || 0;
    if (commission) commission.value = db.settings.centerCommissionPercent || 0;
    if (printWidth) printWidth.value = localStorage.getItem('alamin_print_width') || '80mm';
    if (zoom) zoom.innerText = `${Math.round(appZoom * 100)}%`;

    const activeTheme = normalizeAppTheme(localStorage.getItem(APP_THEME_KEY) || 'morning');
    document.getElementById('settings-morning-btn')?.classList.toggle('active', activeTheme === 'morning');
    document.getElementById('settings-night-btn')?.classList.toggle('active', activeTheme === 'night');
}

function saveProgramSettings() {
    const profile = getProgramProfile();
    profile.centerName = document.getElementById('settings-center-name')?.value.trim() || 'الأمين في اللغة العربية';
    profile.teacherName = document.getElementById('settings-teacher-name')?.value.trim() || 'المدير العام';
    profile.phone = document.getElementById('settings-phone')?.value.trim() || '';

    const monthlyFee = parseFloat(document.getElementById('settings-monthly-fee')?.value || '0');
    const commission = parseFloat(document.getElementById('settings-commission')?.value || '0');
    db.settings.monthlyFee = Number.isFinite(monthlyFee) ? Math.max(0, monthlyFee) : 0;
    db.settings.centerCommissionPercent = Number.isFinite(commission) ? Math.min(100, Math.max(0, commission)) : 0;

    const printWidth = document.getElementById('settings-print-width')?.value || '80mm';
    localStorage.setItem('alamin_print_width', printWidth);
    localStorage.setItem('edu_master_settings', JSON.stringify(db._settings));

    applyProgramProfile();
    updateExperienceSummary();
    showNotification('تم حفظ إعدادات البرنامج بنجاح', 'success');
}
// --- Firebase Export Logic ---
function mapOfflineGradeToPlatformGrade(gradeId) {
    const grade = String(gradeId || '');
    const direct = { '301': '1', '302': '2', '303': '3', '203': 'prep3' };
    if (direct[grade]) return direct[grade];
    if (['1', '2', '3', 'prep3', 'all'].includes(grade)) return grade;
    const gradeObj = gradesList.find(g => String(g.id) === grade);
    const name = gradeObj ? gradeObj.name : '';
    if (name.includes('الأول') && name.includes('الثانوي')) return '1';
    if (name.includes('الثاني') && name.includes('الثانوي')) return '2';
    if (name.includes('الثالث') && name.includes('الثانوي')) return '3';
    if (name.includes('الثالث') && name.includes('الإعدادي')) return 'prep3';
    return grade;
}
function platformGradeLabel(gradeId) {
    const grade = String(gradeId || '');
    const mappedNames = { '1': 'الأول الثانوي', '2': 'الثاني الثانوي', '3': 'الثالث الثانوي', 'prep3': 'الثالث الإعدادي', 'all': 'كل الصفوف' };
    if (mappedNames[grade]) return mappedNames[grade];
    const gradeObj = gradesList.find(g => String(g.id) === grade || String(mapOfflineGradeToPlatformGrade(g.id)) === grade);
    return gradeObj ? gradeObj.name : (grade || 'غير محدد');
}
function getPlatformCodesFiltered() {
    const grade = document.getElementById('platform-codes-grade')?.value || '';
    const course = document.getElementById('platform-codes-course')?.value || '';
    const search = (document.getElementById('platform-codes-search')?.value || '').trim().toLowerCase();
    return (db.courseCodes || []).filter(code => {
        const codeGrade = String(code.grade || '');
        const matchesGrade = !grade || codeGrade === grade;
        const matchesCourse = !course || String(code.courseId || '') === course;
        const haystack = `${code.linkedStudentName || ''} ${code.code || ''} ${code.courseTitle || ''}`.toLowerCase();
        return matchesGrade && matchesCourse && (!search || haystack.includes(search));
    }).sort((a, b) => String(a.linkedStudentName || '').localeCompare(String(b.linkedStudentName || ''), 'ar'));
}
function initPlatformCodesSection() {
    renderPlatformCodesFilters();
    renderPlatformCodesSection();
}
function renderPlatformCodesFilters() {
    const gradeSelect = document.getElementById('platform-codes-grade');
    const courseSelect = document.getElementById('platform-codes-course');
    if (!gradeSelect || !courseSelect) return;
    const currentGradeValue = gradeSelect.value;
    const currentCourseValue = courseSelect.value;
    const grades = [...new Set((db.courseCodes || []).map(c => String(c.grade || '')).filter(Boolean))];
    gradeSelect.innerHTML = '<option value="">كل الصفوف</option>' + grades.map(g => `<option value="${g}">${platformGradeLabel(g)}</option>`).join('');
    if (grades.includes(currentGradeValue)) gradeSelect.value = currentGradeValue;
    const selectedGrade = gradeSelect.value;
    const courses = (db.courseCodes || []).filter(c => !selectedGrade || String(c.grade || '') === selectedGrade);
    const uniqueCourses = [];
    courses.forEach(c => {
        if (c.courseId && !uniqueCourses.some(x => String(x.courseId) === String(c.courseId))) {
            uniqueCourses.push({ courseId: c.courseId, courseTitle: c.courseTitle || 'كورس بدون اسم' });
        }
    });
    courseSelect.innerHTML = '<option value="">كل الكورسات</option>' + uniqueCourses.map(c => `<option value="${c.courseId}">${c.courseTitle}</option>`).join('');
    if (uniqueCourses.some(c => String(c.courseId) === currentCourseValue)) courseSelect.value = currentCourseValue;
}
function renderPlatformCodesSection() {
    renderPlatformCodesFilters();
    const rows = getPlatformCodesFiltered();
    const tbody = document.getElementById('platform-codes-list');
    if (!tbody) return;
    document.getElementById('platform-codes-total').innerText = (db.courseCodes || []).length;
    const grade = document.getElementById('platform-codes-grade')?.value || '';
    const course = document.getElementById('platform-codes-course')?.value || '';
    document.getElementById('platform-codes-grade-count').innerText = grade ? (db.courseCodes || []).filter(c => String(c.grade || '') === grade).length : (db.courseCodes || []).length;
    document.getElementById('platform-codes-course-count').innerText = course ? (db.courseCodes || []).filter(c => String(c.courseId || '') === course).length : rows.length;
    if (!rows.length) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:2rem; color:var(--text-muted);">لا توجد أكواد مطابقة.</td></tr>';
        return;
    }
    tbody.innerHTML = rows.map(item => `
        <tr>
            <td>${item.linkedStudentName || 'طالب غير محدد'}</td>
            <td>${platformGradeLabel(item.grade)}</td>
            <td>${item.courseTitle || '-'}</td>
            <td style="font-family:monospace; font-size:1.1rem; font-weight:800; letter-spacing:2px;">${item.code || '-'}</td>
            <td><span class="badge" style="background:${item.status === 'مستخدم' ? '#fee2e2' : '#dcfce7'}; color:${item.status === 'مستخدم' ? '#991b1b' : '#166534'}">${item.status || 'غير مستخدم'}</span></td>
        </tr>
    `).join('');
}
// Dynamic Firebase SDK Loader
function loadScript(src) {
    return new Promise((resolve, reject) => {
        if (document.querySelector(`script[src="${src}"]`)) {
            resolve();
            return;
        }
        const script = document.createElement('script');
        script.src = src;
        script.onload = () => resolve();
        script.onerror = () => reject(new Error(`Failed to load script: ${src}`));
        document.head.appendChild(script);
    });
}

async function ensureFirebaseInitialized() {
    if (window.db) return true;
    try {
        if (typeof firebase === 'undefined') {
            await loadScript('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
            await loadScript('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore-compat.js');
        }
        if (typeof firebase !== 'undefined') {
            const firebaseConfig = {
                apiKey: "AIzaSyCoUAGpTJANr-voTNxvEIlos2I8w_1kXtA",
                authDomain: "yghjni.firebaseapp.com",
                projectId: "yghjni",
                storageBucket: "yghjni.firebasestorage.app",
                messagingSenderId: "629167303662",
                appId: "1:629167303662:web:91069e95be3ac626c13cff",
                measurementId: "G-NT4EF36RFT"
            };
            if (!firebase.apps.length) {
                firebase.initializeApp(firebaseConfig);
            }
            window.db = firebase.firestore();
            return true;
        }
    } catch (e) {
        console.error("Firebase dynamic load failed:", e);
    }
    return false;
}

async function importPlatformCourseCodes() {
    const btn = document.getElementById('btn-import-platform-codes');
    try {
        const firebaseReady = await ensureFirebaseInitialized();
        if (!firebaseReady) return showNotification('Firebase غير متاح. تأكد من اتصالك بالإنترنت وجرب مرة تانية.', 'error');
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري الاستلام...';
        }
        const snapshot = await window.db.collection('course_codes').get();
        const imported = [];
        snapshot.forEach(doc => imported.push({ id: doc.id, ...doc.data() }));
        db.courseCodes = imported;
        await StorageEngine.save('courseCodes', imported);
        renderPlatformCodesSection();
        showNotification(`تم استلام ${imported.length} كود من المنصة بنجاح`, 'success');
    } catch (err) {
        console.error('Import platform course codes failed', err);
        showNotification('حدث خطأ أثناء استلام الأكواد: ' + err.message, 'error');
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-cloud-download-alt"></i> استلام الأكواد من المنصة';
        }
    }
}
function printPlatformCourseCards() {
    const rows = getPlatformCodesFiltered();
    if (!rows.length) return showNotification('لا توجد أكواد للطباعة', 'warning');
    const html = `
    <html dir="rtl"><head><title>أكواد المنصة</title>
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;700;800&display=swap');
      body{font-family:Tajawal,Arial,sans-serif;margin:0;padding:10mm;background:#fff;color:#111827}
      .grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8mm}
      .card{border:1px dashed #94a3b8;border-radius:8px;padding:8mm;min-height:48mm;break-inside:avoid;display:flex;flex-direction:column;gap:4mm}
      .title{font-weight:800;font-size:14px;color:#0f172a}
      .student{font-weight:800;font-size:18px}
      .meta{font-size:12px;color:#475569}
      .code{font-family:monospace;font-size:24px;font-weight:900;letter-spacing:3px;text-align:center;border:1px solid #e2e8f0;border-radius:6px;padding:6px;background:#f8fafc}
      @media print{body{padding:8mm}.card{page-break-inside:avoid}}
    </style></head><body>
      <div class="grid">
        ${rows.map(item => `
          <div class="card">
            <div class="title">منصة الأمين - كود تفعيل كورس</div>
            <div class="student">${item.linkedStudentName || 'طالب غير محدد'}</div>
            <div class="meta">${platformGradeLabel(item.grade)} | ${item.courseTitle || '-'}</div>
            <div class="code">${item.code || '-'}</div>
            <div class="meta">الكود مخصص لهذا الطالب فقط ولا يعمل مع طالب آخر.</div>
          </div>
        `).join('')}
      </div>
      <script>window.onload=function(){setTimeout(function(){window.print();window.close();},300)}<\/script>
    </body></html>`;
    const printWindow = window.open('', '_blank');
    printWindow.document.write(html);
    printWindow.document.close();
}
async function exportStudentsToFirebase() {
    const btn = document.getElementById('btn-export-firebase');
    try {
        if(btn) {
            btn.disabled = true;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري التصدير...';
        }
        
        showNotification('جاري الاتصال بقاعدة البيانات لرفع بيانات الطلاب...', 'info');
        
        const firebaseReady = await ensureFirebaseInitialized();
        if (!firebaseReady) {
            showNotification('Firebase غير متاح. تأكد من اتصالك بالإنترنت وجرب مرة تانية.', 'error');
            if(btn) {
                btn.disabled = false;
                btn.innerHTML = '<i class="fas fa-cloud-upload-alt"></i> تصدير الطلاب للمنصة';
            }
            return;
        }

        if (!StorageEngine.db) await StorageEngine.init();
        const allStudents = await StorageEngine.getAll('students');
        
        if (!allStudents || allStudents.length === 0) {
            showNotification('لا يوجد طلاب لتصديرهم!', 'error');
            if(btn) {
                btn.disabled = false;
                btn.innerHTML = '<i class="fas fa-cloud-upload-alt"></i> تصدير الطلاب للمنصة';
            }
            return;
        }

        let successCount = 0;
        let batch = window.db.batch();
        let batchCount = 0;
        let syncedStudentsToUpdate = [];

        for (const student of allStudents) {
            if (!student.qrCode) continue;
            
            const docRef = window.db.collection('students').doc(String(student.qrCode));
            // Save only required minimal data
            batch.set(docRef, {
                id: String(student.qrCode),
                name: student.name,
                firstName: student.name.split(' ')[0],
                grade: mapOfflineGradeToPlatformGrade(student.grade),
                offlineGrade: student.grade,
                qrCode: student.qrCode,
                studentType: 'center',
                offlineStudentId: student.id,
                role: 'student'
            }, { merge: true });
            
            batchCount++;
            successCount++;
            syncedStudentsToUpdate.push(student);

            // Firestore batch limit is 500 operations
            if (batchCount >= 400) {
                await batch.commit();
                batch = window.db.batch();
                batchCount = 0;
            }
        }
        
        if (batchCount > 0) {
            await batch.commit();
        }

        // تحديث قاعدة البيانات المحلية لحفظ حالة الرفع
        for (let s of syncedStudentsToUpdate) {
            s.isSynced = true;
            await StorageEngine.save('students', s);
            
            // تحديث في الذاكرة العشوائية لتجنب الحاجة لإعادة تحميل الصفحة
            if(window.db && window.db.students){ // avoid shadowing issues, check if global db exists
               let memStudent = db.students ? db.students.find(ms => ms.id === s.id) : null;
               if (memStudent) memStudent.isSynced = true;
            } else if (db && db.students) {
               let memStudent = db.students.find(ms => ms.id === s.id);
               if (memStudent) memStudent.isSynced = true;
            }
        }

        if (successCount === 0) {
            showNotification('لا يوجد طلاب صالحين للتصدير.', 'info');
        } else {
            showNotification(`تم رفع/تحديث ${successCount} طالب على المنصة بنجاح!`, 'success');
        }
        
    } catch (error) {
        console.error('Firebase Export Error:', error);
        showNotification('حدث خطأ أثناء رفع البيانات: ' + error.message, 'error');
    } finally {
        if(btn) {
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-cloud-upload-alt"></i> تصدير الطلاب للمنصة';
        }
    }
}

window.exportData = exportData;
window.exportStudentsToFirebase = exportStudentsToFirebase;
window.importData = importData;
window.importPlatformCourseCodes = importPlatformCourseCodes;
window.renderPlatformCodesSection = renderPlatformCodesSection;
window.printPlatformCourseCards = printPlatformCourseCards;
window.initPlatformCodesSection = initPlatformCodesSection;

// Unified Application Entry Point
window.onload = async () => {
    try {
        await ensureAppLoaded();
    } catch (err) {
        return;
    }

    applyZoom(); // Apply the saved zoom level
    initGradeSelects(); // Initialize all grade selects
    if (typeof initFilters === 'function') initFilters(); // Initialize other filters
    if (typeof initStudentGroups === 'function') initStudentGroups();
    initExperienceEnhancements();

    // Recover from file if needed (Legacy / Manual Check)
    if (localStorage.length <= 1 && window.edu_initial_data && window.edu_initial_data.db_state) {
        // This handles older backup formats
        const state = window.edu_initial_data.db_state;
        Object.keys(state).forEach(key => localStorage.setItem(key, state[key]));
        showNotification('🚀 تم استعادة البيانات القديمة. جاري التحديث...');
        setTimeout(() => location.reload(), 1000);
        return;
    }

    // 2. Auto-login if we have a grade AND a group
    if (currentGrade && currentGroupId) {
        const overlay = document.getElementById('grade-selection-overlay');
        const gOverlay = document.getElementById('group-selection-overlay');
        if (overlay) overlay.style.display = 'none';
        if (gOverlay) gOverlay.style.display = 'none';
        document.getElementById('portal-overlay').style.display = 'none';

        const gradeObj = gradesList.find(g => g.id == currentGrade);
        const groupObj = db.groups.find(g => g.id == currentGroupId);

        const label = gradeObj ? gradeObj.name : 'سنة دراسية';
        const groupLabel = groupObj ? ` - ${groupObj.name}` : '';

        const badge = document.getElementById('current-grade-badge');
        if (badge) badge.innerText = label + groupLabel;

        showSection('dashboard');
    } else if (currentGrade) {
        // We have a grade but no group - go to porcelain portal group selection
        enterPortalMode();
        showPortalStep('group', currentGrade);
    } else {
        // Completely new or reset - go to portal grade selection
        enterPortalMode();
    }

    updateExperienceSummary();

    // 3. Initialize Global File Sync
    const linkBtn = document.getElementById('link-folder-btn');
    if (linkBtn) {
        linkBtn.addEventListener('click', async () => {
            try {
                if (!window.showDirectoryPicker) {
                    return alert('عذراً، متصفحك لا يدعم خاصية المزامنة المفتوحة. يرجى استخدام Chrome أو Edge.');
                }
                directoryHandle = await window.showDirectoryPicker();
                await loadDataFromFile();
            } catch (err) {
                console.error('Folder selection cancelled', err);
            }
        });
    }
};

// Global Exposure (Ensure all functions are accessible from HTML)
const exposures = {
    // Grade & Group Management
    selectGrade, showGradeSelection, addNewGrade, deleteGrade,
    handleAddGroup, deleteGroup, showSection, toggleModal, viewGroupDetails, renderGroupStudents,
    openAddStudentForGroup, openAddStudentModal, openGroupScanner, removeStudentFromGroup, initStudentGroups, renderGroups,

    // Student Management
    handleAddStudent: handleStudentSubmit, renderStudents, deleteStudent, clearAllStudents, viewDetailedProfile,
    startSearchScanner, stopSearchScanner, searchManualStudent, selectManualStudent, processManualEntry,

    // Attendance & Session
    startLessonCoding, pauseLessonCoding, resumeLessonCoding, endLessonCoding,
    startQRScanner, toggleAttendanceView, removeAttendance, endSessionAndMarkAbsent,
    searchStudentSmart, removeStudentFromPresentToday, archiveAbsenceSession,
    showAbsenceArchive, viewAbsenceSessionDetails, deleteAbsenceSession,
    markStudentAbsentToday, generateAbsenceReport, initAbsenceGroupFilter,
    enterPortalMode, exitPortalMode, startPortalSession, handleBarcodeAttendance,
    showPortalStep, renderPortalGrades, renderPortalGroups, enterSystemFromPortal, syncUIWithContext,

    // Fast Grading & Exams
    submitFastGrade, deleteScore, handleAddExam, openMarksModal,
    printExamResults, updateFastExamMax, printFastGradingReport,
    markRemainingAsExamAbsent, openGradingArchive, initFastGrading,
    renderExams, filterMarks, markStudentExamAbsentDirect, handleBarcodeGrading,

    // Finance & Treasury
    handleAddExpense, startMonthlySubscription, promptEndMonthlySubscription,
    collectMonthlyPayment, exemptMonthlyPayment, discountMonthlyPayment, renderFinances, toggleMonthlyPayment,
    showReceiptSelectionModal, confirmReceiptPrint, skipReceiptPrint, printMonthlyReceipt,
    initReceiptsSection, searchPaymentCodeSection, renderReceiptsList,

    // Quizzes & Hall of Fame
    handleAddReward, redeemReward,
    calculateHallOfFame, renderHallOfFame, renderShop,

    // Certificates & ID Cards
    generateCertificate, generateCertificateFromSelect, sendCongratulationWA,
    initCertificatesSection, initIDCardsSection, printGroupCodes,
    printStudentCode, generatePrintCard, generatePrintableIDCards,

    // WhatsApp & Communication
    saveTemplates, sendFromQueue, removeFromQueue, clearQueue,
    addToQueueBatch, renderWABot, openWhatsAppMenu, sendWhatsApp,
    generateMonthlyReport, sendAbsenceWhatsApp,

    // Data & Sync
    exportData, exportStudentsToFirebase, importData, importFromFolder, showCycleArchive, viewArchivedCycle,
    applyAppTheme, toggleDayNightMode, initExperienceEnhancements, updateExperienceSummary,
    initProgramSettings, renderProgramSettings, saveProgramSettings,
    prepareHandoverDownload: async () => {
        showNotification('جاري تجهيز نسخة كاملة للنقل...', 'info');
        const snapshot = {};
        const tables = ['students', 'attendance', 'exams', 'scores', 'expenses', 'handouts', 'studentHandouts', 'materials', 'quizzes', 'rewards', 'payments', 'waQueue', 'groups', 'settings', 'cycles', 'absenceSessions', 'dailyTreasuryArchives', 'staff', 'shifts', 'courseCodes', 'platformCourses', 'platformSubscriptions'];

        for (const t of tables) {
            if (t === 'settings') snapshot[t] = db._settings;
            else snapshot[t] = await StorageEngine.getAll(t);
        }
        snapshot.gradesList = gradesList;

        const dataJsContent = `/**
 * الأمين Data Storage File - للبيع والنقل
 * Created: ${new Date().toLocaleString()}
 */
window.edu_initial_data = ${JSON.stringify(snapshot, null, 4)};`;

        const blob = new Blob([dataJsContent], { type: 'text/javascript' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'data.js';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        showNotification('🚀 تم استخراج ملف data.js شامل كافة البيانات. ضعه في المجلد قبل الشحن.', 'success');
    },
    syncToPermanentFile: async () => {
        showNotification('جاري تجميع البيانات للمزامنة اليدوية...', 'info');
        const snapshot = {};
        const tables = ['students', 'attendance', 'exams', 'scores', 'expenses', 'handouts', 'studentHandouts', 'materials', 'quizzes', 'rewards', 'payments', 'waQueue', 'groups', 'settings', 'cycles', 'absenceSessions', 'dailyTreasuryArchives', 'staff', 'shifts', 'courseCodes', 'platformCourses', 'platformSubscriptions'];

        for (const t of tables) {
            if (t === 'settings') snapshot[t] = db._settings;
            else snapshot[t] = await StorageEngine.getAll(t);
        }
        snapshot.gradesList = gradesList;

        const json = JSON.stringify(snapshot);
        const el = document.createElement('textarea');
        el.value = json;
        document.body.appendChild(el);
        el.select();
        document.execCommand('copy');
        document.body.removeChild(el);
        alert("📊 تم نسخ بياناتك بالكامل (Snapshot) بنجاح! \n\nيرجى لصقها في ملف data.js أو تزويدها للمساعد (Antigravity) لتحديث ملفات المشروع.");
    },

    // UI Tools
    playSound, speakName, stopAllCameraScanners, updateDashboardStats,
    openSmartCard, recordQuickAction, handleSmartCardPayment,
    printSessionAttendance, printSessionAbsence, printArchivedSession,
    toggleMobileSidebar, changeAppZoom, resetAppZoom
};
Object.keys(exposures).forEach(key => window[key] = exposures[key]);
// --- NEW: Manual Student Entry Engine ---
let selectedManualStudent = null;

function searchManualStudent(query, context) {
    const resultsDiv = document.getElementById(`${context}-manual-results`);
    if (!query || query.trim().length < 1) {
        resultsDiv.style.display = 'none';
        return;
    }

    const normalize = (text) => {
        return String(text)
            .replace(/[أإآ]/g, 'ا')
            .replace(/ة/g, 'ه')
            .replace(/ى/g, 'ي')
            .toLowerCase()
            .trim();
    };

    const q = normalize(query);

    const filtered = db.students.filter(s =>
        normalize(s.name).includes(q) ||
        String(s.qrCode).includes(query) ||
        (s.phone && s.phone.includes(query))
    ).slice(0, 5);

    if (filtered.length > 0) {
        resultsDiv.innerHTML = filtered.map(s => `
            <div onclick="selectManualStudent('${s.id}', '${s.name}', '${context}')" style="padding:0.75rem; border-bottom:1px solid #eee; cursor:pointer;">
                <strong>${s.name}</strong> <small style="color:var(--text-muted)">(${s.qrCode})</small>
            </div>
        `).join('');
        resultsDiv.style.display = 'block';
    } else {
        resultsDiv.innerHTML = '<p style="padding:0.75rem; font-size:0.8rem; color:var(--danger);">لا يوجد حوزة طلابية مطابقة!</p>';
        resultsDiv.style.display = 'block';
    }
}

function selectManualStudent(id, name, context) {
    let input;
    if (context === 'attendance') input = document.getElementById('manual-student-entry');
    else if (context === 'grading') input = document.getElementById('manual-grading-entry');
    else if (context === 'finance') input = document.getElementById('manual-finance-entry');

    const resultsDiv = document.getElementById(`${context}-manual-results`);

    if (input) input.value = name;
    selectedManualStudent = db.students.find(s => s.id == id);
    resultsDiv.style.display = 'none';

    if (context === 'finance' || context === 'attendance') {
        openSmartCard(id);
    }
}

function processManualEntry(context) {
    if (!selectedManualStudent) {
        showNotification('برجاء اختيار طالب من القائمة أولاً', 'error');
        return;
    }

    const s = selectedManualStudent;
    const token = s.qrCode;

    if (context === 'attendance') {
        processScan(token);
        document.getElementById('manual-student-entry').value = '';
    } else if (context === 'grading') {
        processFastScan(token);
        document.getElementById('manual-grading-entry').value = '';
    } else if (context === 'finance') {
        if (typeof collectMonthlyPayment === 'function') {
            collectMonthlyPayment(s.id);
        }
        document.getElementById('manual-finance-entry').value = '';
    }

    selectedManualStudent = null;
}

// --- 9. ID Cards & Print Codes ---
function initIDCardsSection() {
    const groupSelect = document.getElementById('idcard-group-select');
    const studentSelect = document.getElementById('idcard-student-select');
    if (!groupSelect || !studentSelect) return;

    // Filter by current grade
    const gradeGroups = db.groups.filter(g => g.grade == currentGrade);
    groupSelect.innerHTML = gradeGroups.map(g => `<option value="${g.id}" ${String(g.id) === String(currentGroupId) ? 'selected' : ''}>${g.name}</option>`).join('');

    // STRICTLY filter by active group for individual selection
    const groupStudents = db.students.filter(s => String(s.groupId) === String(currentGroupId));
    const sortedStudents = groupStudents.sort((a, b) => a.name.localeCompare(b.name, 'ar'));
    studentSelect.innerHTML = '<option value="">-- اختر الطالب --</option>' +
        sortedStudents.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
}

function toggleThermalOptions() {
    const type = document.getElementById('print-type-main').value;
    const panel = document.getElementById('thermal-config-panel');
    if (panel) panel.style.display = (type === 'thermal') ? 'block' : 'none';
}

function printGroupCodes() {
    const groupId = document.getElementById('idcard-group-select').value;
    if (!groupId) return showNotification('يرجى اختيار مجموعة أولاً', 'warning');

    const students = db.students.filter(s => s.groupId == groupId);
    if (students.length === 0) return showNotification('لا يوجد طلاب في هذه المجموعة', 'warning');

    const mode = document.getElementById('print-type-main').value;
    generatePrintableIDCards(students, mode);
}

function printStudentCode() {
    const studentId = document.getElementById('idcard-student-select').value;
    if (!studentId) return showNotification('يرجى اختيار طالب أولاً', 'warning');

    const student = db.students.find(s => s.id == studentId);
    const mode = document.getElementById('print-type-main').value;
    generatePrintableIDCards([student], mode);
}

function generatePrintableIDCards(students, mode = 'normal') {
    const printWindow = window.open('', '_blank');
    const isThermal = mode === 'thermal';

    // Get Thermal Config
    const tw = document.getElementById('thermal-w')?.value || 80;
    const th = document.getElementById('thermal-h')?.value || 40;
    const tFont = document.getElementById('thermal-font')?.value || 14;
    const tBCodeH = document.getElementById('thermal-barcode-h')?.value || 50;

    let html = '<html dir="rtl"><head><title>طباعة الأكواد</title>';
    html += '<style>' +
        '@import url("https://fonts.googleapis.com/css2?family=Tajawal:wght@400;700&display=swap");' +
        'body { font-family: "Tajawal", sans-serif; margin: 0; padding: ' + (isThermal ? '0' : '10mm') + '; background: #fff; -webkit-print-color-adjust: exact; print-color-adjust: exact; }' +
        (isThermal ?
            '@page { size: ' + tw + 'mm ' + th + 'mm; margin: 0; }' +
            '.page { width: ' + tw + 'mm; height: ' + th + 'mm; overflow: hidden; page-break-after: always; display: flex; flex-direction: column; align-items: center; justify-content: center; box-sizing: border-box; padding: 2mm; }' +
            '.card { width: 100%; display: flex; flex-direction: column; align-items: center; text-align: center; }' +
            '.header-text { font-size: ' + (tFont * 0.9) + 'px; font-weight: 800; margin-bottom: 2px; }' +
            '.student-name { font-weight: 800; font-size: ' + tFont + 'px; margin-bottom: 2px; }' +
            '.info-row { font-size: ' + (tFont * 0.7) + 'px; margin-bottom: 2px; }' +
            '.barcode-area { margin-top: 5px; width: 100%; display: flex; justify-content: center; }' +
            '.barcode { width: 95% !important; max-width: ' + (tw - 10) + 'mm; }'
            :
            '.page { display: grid; grid-template-columns: 1fr 1fr; gap: 5mm; page-break-after: always; }' +
            '.card { border: 1px solid #cbd5e1; border-radius: 8px; padding: 12px; height: 52mm; display: flex; flex-direction: column; position: relative; box-sizing: border-box; background: #fff; page-break-inside: avoid; }' +
            '.header { font-weight: 700; font-size: 1.1rem; color: #1e293b; border-bottom: 2px solid #4f46e5; padding-bottom: 5px; margin-bottom: 10px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }' +
            '.info-row { font-size: 0.9rem; margin-bottom: 5px; color: #475569; }' +
            '.info-row b { color: #1e293b; }' +
            '.barcode-area { margin-top: auto; text-align: center; background: #f8fafc; padding: 5px; border-radius: 5px; }' +
            '.barcode { width: 100% !important; height: auto !important; }' +
            '.grade-badge { position: absolute; top: 12px; left: 12px; font-size: 0.65rem; background: #4f46e5; color: white; padding: 2px 8px; border-radius: 4px; }' +
            '@media print { body { padding: 0; } .page { padding: 10mm; } }'
        ) +
        '</style></head><body>';

    if (isThermal) {
        students.forEach(s => {
            const groupObj = db.groups.find(g => g.id == s.groupId);
            const gradeObj = gradesList.find(g => g.id == s.grade);
            const gradeName = gradeObj ? gradeObj.name : 'طالب منضم';

            html += '<div class="page">' +
                '<div class="card">' +
                '<div class="header-text">منصة الأمين في اللغة العربية</div>' +

                '<div style="font-size: ' + (tFont * 0.7) + 'px; color: #333; margin-bottom: 3px;">' + gradeName + '</div>' +
                '<div class="student-name">' + s.name + '</div>' +
                '<div class="info-row">المجموعة: ' + (groupObj ? groupObj.name : '---') + ' | الكود: ' + s.qrCode + '</div>' +
                '<div class="barcode-area">' +
                '<svg class="barcode" ' +
                'jsbarcode-value="' + s.qrCode + '" ' +
                'jsbarcode-displayValue="true" ' +
                'jsbarcode-height="' + tBCodeH + '" ' +
                'jsbarcode-width="2" ' +
                'jsbarcode-fontSize="' + (tFont * 0.8) + '"></svg>' +
                '</div>' +
                '</div>' +
                '</div>';
        });
    } else {
        for (let i = 0; i < students.length; i += 10) {
            html += '<div class="page">';
            const chunk = students.slice(i, i + 10);
            chunk.forEach(s => {
                const groupObj = db.groups.find(g => g.id == s.groupId);
                const gradeObj = gradesList.find(g => g.id == s.grade);
                const gradeName = gradeObj ? gradeObj.name : 'طالب منضم';

                html += '<div class="card">' +
                    '<div class="grade-badge">' + gradeName + '</div>' +
                    '<div style="background: #f8fafc; padding: 8px; border-radius: 6px; margin-bottom: 10px; border-right: 4px solid #4f46e5;">' +
                    '<span style="font-size: 0.7rem; color: #64748b; display: block;">اسم الطالب:</span>' +
                    '<div style="font-weight: 800; font-size: 1.25rem; color: #1e293b; line-height: 1.2;">' + s.name + '</div>' +
                    '</div>' +
                    '<div class="info-row"><b>المجموعة:</b> ' + (groupObj ? groupObj.name : '---') + '</div>' +
                    '<div class="info-row"><b>كود الطالب:</b> ' + s.qrCode + '</div>' +
                    '<div class="barcode-area">' +
                    '<svg class="barcode" ' +
                    'jsbarcode-value="' + s.qrCode + '" ' +
                    'jsbarcode-text="' + s.name + '" ' +
                    'jsbarcode-displayValue="true" ' +
                    'jsbarcode-textmargin="2" ' +
                    'jsbarcode-height="35" ' +
                    'jsbarcode-width="2" ' +
                    'jsbarcode-fontSize="14"></svg>' +
                    '</div>' +
                    '</div>';
            });
            html += '</div>';
        }
    }

    html += '<script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js"></script>' +
        '<script>' +
        'function initBarcodes() {' +
        '  if (typeof JsBarcode === "undefined") { setTimeout(initBarcodes, 50); return; }' +
        '  const barcodes = document.querySelectorAll(".barcode");' +
        '  barcodes.forEach(el => { try { JsBarcode(el).init(); } catch(e){ console.error(e); } });' +
        '  setTimeout(() => { window.print(); window.close(); }, 500);' +
        '}' +
        'window.onload = initBarcodes;' +
        '</script></body></html>';

    printWindow.document.write(html);
    printWindow.document.close();
}

window.addEventListener('click', (e) => {
    const searchRes = document.getElementById('attendance-manual-results');
    if (searchRes && !e.target.closest('#manual-student-entry')) {
        searchRes.style.display = 'none';
    }
});

/**
 * --- ULTRA ROYAL LUX UI ENGINES ---
 */

// 1. Mobile Sidebar Logic
function toggleMobileSidebar() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    if (!sidebar || !overlay) return;

    sidebar.classList.toggle('mobile-active');
    overlay.classList.toggle('active');
}

// 2. Splash Screen Sequencer
function checkAppPassword(val) {
    const correct = (db._settings.globalPasswords && db._settings.globalPasswords.main) || '2446';
    if (val === correct) {
        const passwordScreen = document.getElementById('password-screen');
        const loadingScreen = document.getElementById('loading-screen');
        if (passwordScreen) passwordScreen.style.display = 'none';
        if (loadingScreen) loadingScreen.style.display = 'block';

        setTimeout(() => {
            const splash = document.getElementById('app-splash');
            if (splash) {
                splash.style.opacity = '0';
                setTimeout(() => {
                    splash.style.display = 'none';
                }, 1000);
            }
        }, 2000);
    } else if (val.length === 4) {
        const err = document.getElementById('password-error');
        if (err) {
            err.style.display = 'block';
            setTimeout(() => {
                err.style.display = 'none';
                document.getElementById('app-password-input').value = '';
            }, 1000);
        }
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    try {
        await ensureAppLoaded();
    } catch (err) {
        return;
    }

    // Initial check and periodic check for date change (Midnight Reset)
    autoArchiveDailyTreasury();
    setInterval(autoArchiveDailyTreasury, 60000); // Check every minute

    const splash = document.getElementById('app-splash');
    if (splash) {
        splash.style.display = 'flex';
        document.getElementById('app-password-input')?.focus();
    }
});




async function editStudent(id) {
    const student = await StorageEngine.get('students', id);
    if (!student) return showNotification('تعذر العثور على الطالب في قاعدة البيانات', 'error');

    document.getElementById('edit-std-id').value = student.id;
    document.getElementById('edit-std-name').value = student.name;
    document.getElementById('edit-std-phone').value = student.phone;
    document.getElementById('edit-std-parent').value = student.parentPhone;

    const groupSelect = document.getElementById('edit-std-group');
    const filteredGroups = db.groups.filter(g => g.grade == currentGrade);
    groupSelect.innerHTML = filteredGroups.map(g => `<option value="${g.id}" ${g.id == student.groupId ? 'selected' : ''}>${g.name} (${g.time})</option>`).join('');

    toggleModal('edit-student-modal', true);
}

async function handleStudentUpdate() {
    const id = parseInt(document.getElementById('edit-std-id').value);
    const name = document.getElementById('edit-std-name').value;
    const phone = document.getElementById('edit-std-phone').value;
    const groupId = document.getElementById('edit-std-group').value;
    const parent = document.getElementById('edit-std-parent').value;

    if (!name || !phone || !groupId || !parent) return showNotification('يرجى ملء كافة البيانات', 'error');

    const student = await StorageEngine.get('students', id);
    if (!student) return showNotification('خطأ في استرجاع البيانات', 'error');

    student.name = name;
    student.phone = phone;
    student.groupId = groupId;
    student.parentPhone = parent;

    await StorageEngine.save('students', student);

    const idx = db.students.findIndex(s => s.id == id);
    if (idx !== -1) db.students[idx] = student;

    showNotification('تم تحديث بيانات الطالب بنجاح');
    toggleModal('edit-student-modal', false);
    renderStudents();
}

function printAttendanceSheets() {
    const filter = document.getElementById('student-search-input').value.toLowerCase();
    let students = db.students;
    if (filter) {
        students = students.filter(s => s.name.toLowerCase().includes(filter) || s.qrCode.includes(filter));
    }

    if (students.length === 0) return showNotification('لا يوجد طلاب لطباعة كشوفهم', 'error');

    students.sort((a, b) => a.name.localeCompare(b.name, 'ar'));

    const groups = {};
    students.forEach(s => {
        const g = db.groups.find(x => x.id == s.groupId);
        const gName = g ? `${g.name} (${g.time})` : 'بدون مجموعة';
        if (!groups[gName]) groups[gName] = [];
        groups[gName].push(s);
    });

    const gradeName = document.getElementById('current-grade-badge')?.innerText || 'غير محدد';

    let printHtml = `
    <html>
    <head>
        <title>كشوف حضور الطلاب</title>
        <style>
            @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;700&display=swap');
            body { font-family: 'Tajawal', sans-serif; direction: rtl; padding: 20px; }
            .sheet-header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #000; padding-bottom: 10px; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 40px; }
            th, td { border: 1px solid #000; padding: 8px; text-align: center; font-size: 14px; }
            th { background: #f2f2f2; }
            .group-title { background: #eee; font-weight: bold; margin-top: 20px; padding: 10px; border: 1px solid #000; display: flex; justify-content: space-between; }
            @media print {
                .page-break { page-break-after: always; }
            }
        </style>
    </head>
    <body>
        <div class="sheet-header">
            <h1>كشوف حضور وغياب الطلاب</h1>
            <p>الأمين لغة عربية - أ/ أمين الغازي</p>
            <p>السنة الدراسية: ${gradeName} | تاريخ الطباعة: ${new Date().toLocaleDateString('ar-EG')}</p>
        </div>
    `;

    Object.keys(groups).forEach(gName => {
        printHtml += `
        <div class="group-title">
            <span>المجموعة: ${gName}</span>
            <span>عدد الطلاب: ${groups[gName].length}</span>
        </div>`;
        printHtml += `
        <table>
            <thead>
                <tr>
                    <th style="width: 40px;">م</th>
                    <th>اسم الطالب</th>
                    <th style="width: 120px;">رقم الطالب</th>
                    <th style="width: 120px;">رقم ولي الأمر</th>
                    <th style="width: 120px;">التوقيع / ملاحظات</th>
                </tr>
            </thead>
            <tbody>
        `;

        groups[gName].forEach((s, index) => {
            printHtml += `
            <tr>
                <td>${index + 1}</td>
                <td style="text-align: right; padding-right: 15px;">${s.name}</td>
                <td>${s.phone}</td>
                <td>${s.parentPhone}</td>
                <td></td>
            </tr>
            `;
        });

        printHtml += `</tbody></table><div class="page-break"></div>`;
    });

    printHtml += `</body></html>`;

    const printWindow = window.open('', '_blank');
    printWindow.document.write(printHtml);
    printWindow.document.close();
    printWindow.print();
}

function printStudentsData() {
    const filter = document.getElementById('student-search-input').value.toLowerCase();
    const groupFilter = document.getElementById('filter-group').value;

    let students = db.students;

    // Apply group filter
    if (groupFilter !== 'all') {
        students = students.filter(s => s.groupId == groupFilter);
    }

    // Apply search filter
    if (filter) {
        students = students.filter(s => s.name.toLowerCase().includes(filter) || (s.qrCode && s.qrCode.includes(filter)));
    }

    if (students.length === 0) return showNotification('لا يوجد طلاب لطباعة بياناتهم', 'error');

    students.sort((a, b) => a.name.localeCompare(b.name, 'ar'));

    const gradeBadge = document.getElementById('current-grade-badge')?.innerText || 'غير محدد';

    let printHtml = `
    <html>
    <head>
        <title>كشف بيانات الطلاب</title>
        <style>
            @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;700&display=swap');
            body { font-family: 'Tajawal', sans-serif; direction: rtl; padding: 20px; }
            .header { text-align: center; margin-bottom: 30px; border-bottom: 3px double #000; padding-bottom: 15px; }
            table { width: 100%; border-collapse: collapse; }
            th, td { border: 1px solid #000; padding: 10px; text-align: center; font-size: 14px; }
            th { background: #f8fafc; }
            tr:nth-child(even) { background: #f1f5f9; }
            .footer { margin-top: 30px; font-size: 0.9rem; text-align: left; border-top: 1px solid #eee; padding-top: 10px; }
        </style>
    </head>
    <body onload="window.print()">
        <div class="header">
            <h1>سجل بيانات الطلاب التفصيلي</h1>
            <p>الأمين في اللغة العربية - أ/ أمين الغازي</p>
            <p>المرحلة: ${gradeBadge} | إجمالي الطلاب: ${students.length}</p>
        </div>
        <table>
            <thead>
                <tr>
                    <th style="width: 30px;">م</th>
                    <th>اسم الطالب</th>
                    <th>المجموعة</th>
                    <th>رقم الهاتف</th>
                    <th>رقم ولي الأمر</th>
                    <th>النقاط</th>
                    <th>تاريخ الالتجاق</th>
                </tr>
            </thead>
            <tbody>
    `;

    students.forEach((s, index) => {
        const g = db.groups.find(x => x.id == s.groupId);
        const groupName = g ? `${g.name} (${g.time})` : '---';
        printHtml += `
            <tr>
                <td>${index + 1}</td>
                <td style="text-align: right; font-weight: bold;">${s.name}</td>
                <td>${groupName}</td>
                <td style="direction: ltr;">${s.phone || '---'}</td>
                <td style="direction: ltr;">${s.parentPhone || '---'}</td>
                <td>${s.points || 0}</td>
                <td>${s.joinDate ? new Date(s.joinDate).toLocaleDateString('ar-EG') : '---'}</td>
            </tr>
        `;
    });

    printHtml += `
            </tbody>
        </table>
        <div class="footer">
            تم الاستخراج بتاريخ: ${new Date().toLocaleString('ar-EG')}
        </div>
    </body>
    </html>
    `;

    const printWindow = window.open('', '_blank');
    printWindow.document.write(printHtml);
    printWindow.document.close();
}

// 3. Section Auto-Close on Mobile
const navItems = document.querySelectorAll('.nav-link');
navItems.forEach(item => {
    item.addEventListener('click', () => {
        if (window.innerWidth <= 991) {
            toggleMobileSidebar();
        }
    });
});

function generatePrintCalibration() {
    const dummyStudent = {
        name: 'طالب تجريبي (معايرة)',
        qrCode: '1234567890123',
        grade: 'test',
        groupId: 'test'
    };
    const mode = document.getElementById('print-type-main').value;
    const thermalWidth = document.getElementById('thermal-width-select')?.value || '80mm';
    generatePrintableIDCards([dummyStudent], mode, thermalWidth);
}// --- Shift Management Foundations ---
let staffStream = null;

function renderShifts() {
    const list = document.getElementById('shifts-list');
    if (!list) return;

    if (!db.shifts) db.shifts = [];
    if (!db.staff) db.staff = [
        { id: 1, name: 'سكرتارية A', code: 'A', pin: 'a1234a' },
        { id: 2, name: 'سكرتارية B', code: 'B', pin: 'b1b234' },
        { id: 3, name: 'سكرتارية C', code: 'C', pin: 'c12c34' },
        { id: 4, name: 'سكرتارية D', code: 'D', pin: '12d34d' }
    ];

    const todayStr = new Date().toLocaleDateString('en-CA');
    const todayShifts = db.shifts.filter(s => s.date === todayStr);

    let activeStaffCount = 0;
    let todayHours = 0;

    list.innerHTML = todayShifts.map(s => {
        const staff = db.staff.find(st => st.id === s.staffId);
        if (!s.endTime) activeStaffCount++;
        todayHours += (s.hours || 0);

        return `
            <tr style="border-bottom: 1px solid #f1f5f9;">
                <td style="padding:1rem;"><strong style="cursor:pointer; color:var(--primary);" onclick="showStaffProfile(${s.staffId})">${staff ? staff.name : 'موظف محذوف'} <i class="fas fa-external-link-alt" style="font-size:0.7rem; opacity:0.5;"></i></strong></td>
                <td><i class="fas fa-fingerprint" style="color:var(--text-muted);"></i></td>
                <td><span class="badge" style="background:#f0fdf4; color:#166534; padding:5px 12px;">${s.startTime}</span></td>
                <td><span class="badge" style="background:${s.endTime ? '#fef2f2' : '#fff7ed'}; color:${s.endTime ? '#991b1b' : '#c2410c'}; padding:5px 12px;">${s.endTime || 'قيد العمل...'}</span></td>
                <td style="font-weight:700; color:var(--primary);">${s.workHours || '---'}</td>
            </tr>
        `;
    }).join('') || '<tr><td colspan="5" style="text-align:center; padding:3rem; color:var(--text-muted); opacity:0.6;">لا يوجد شفتات مسجلة لليوم</td></tr>';

    const currentMonthPrefix = todayStr.substring(0, 7); // e.g., "2026-03"
    const monthShifts = db.shifts.filter(s => s.date.startsWith(currentMonthPrefix));
    let monthHours = 0;
    monthShifts.forEach(s => monthHours += (s.hours || 0));

    const eToday = document.getElementById('shifts-today-hours');
    const eMonth = document.getElementById('shifts-month-hours');
    const eActive = document.getElementById('shifts-active-staff');

    if (eToday) eToday.innerText = todayHours.toFixed(1);
    if (eMonth) eMonth.innerText = monthHours.toFixed(1);
    if (eActive) eActive.innerText = activeStaffCount;
}

function handlePunchPassword() {
    try {
        const input = document.getElementById('shift-password-input');
        const resultDiv = document.getElementById('shift-action-result');
        if (!input || !resultDiv) return;

        const pin = input.value.trim();
        if (!pin) return showNotification('يرجى إدخال الرقم السري', 'warning');

        if (!db.staff) db.staff = [
            { id: 1, name: 'سكرتارية A', code: 'A', pin: 'a1234a' },
            { id: 2, name: 'سكرتارية B', code: 'B', pin: 'b1b234' },
            { id: 3, name: 'سكرتارية C', code: 'C', pin: 'c12c34' },
            { id: 4, name: 'سكرتارية D', code: 'D', pin: '12d34d' }
        ];

        const staff = db.staff.find(s => s.pin.trim().toLowerCase() === pin.toLowerCase());
        if (!staff) {
            resultDiv.style.display = 'block';
            resultDiv.style.color = 'var(--danger)';
            resultDiv.innerHTML = '<i class="fas fa-times-circle"></i> الرقم السري غير صحيح!';
            showNotification('❌ الرقم السري الذي أدخلته غير صحيح!', 'error');
            setTimeout(() => resultDiv.style.display = 'none', 3000);
            return;
        }

        const todayStr = new Date().toLocaleDateString('en-CA');
        if (!db.shifts) db.shifts = [];

        const openShift = db.shifts.find(s => s.staffId === staff.id && s.date === todayStr && !s.endTime);

        const nowTimeObj = new Date();
        const nowTime = nowTimeObj.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });

        if (openShift) {
            // Clock out
            openShift.endTime = nowTime;

            // Calculate work hours
            const tInObj = new Date(openShift.timestampIn);
            let diffMs = nowTimeObj - tInObj;
            if (isNaN(diffMs) || diffMs < 0) diffMs = 0;
            const hrs = (diffMs / (1000 * 60 * 60));
            openShift.hours = hrs;
            openShift.workHours = hrs.toFixed(2) + ' ساعة';

            resultDiv.style.color = 'var(--vibrant-orange)';
            resultDiv.innerHTML = `<i class="fas fa-sign-out-alt"></i> تم تسجيل خروج: ${staff.name} <br><small>المدة: ${openShift.workHours}</small>`;
            showNotification(`تم تسجيل الخروج للموظف ${staff.name}`, 'success');
        } else {
            // Clock in
            db.shifts.push({
                id: Date.now(),
                staffId: staff.id,
                date: todayStr,
                startTime: nowTime,
                timestampIn: nowTimeObj.toISOString(),
                endTime: null,
                workHours: 'جاري...',
                hours: 0,
                photoIn: null,
                photoOut: null
            });
            resultDiv.style.color = 'var(--accent)';
            resultDiv.innerHTML = `<i class="fas fa-check-circle"></i> تم تسجيل دخول: ${staff.name}`;
            showNotification(`تم تسجيل الدخول للموظف ${staff.name}`, 'success');
        }

        db.save();
        resultDiv.style.display = 'block';
        input.value = '';

        setTimeout(() => {
            resultDiv.style.display = 'none';
        }, 4000);

        renderShifts();
    } catch (err) {
        console.error('Punch Error:', err);
        showNotification('❌ فشل تسجيل الشفت، يرجى المحاولة مرة أخرى', 'error');
    }
}

function showShiftsStatsReport() {
    toggleModal('shifts-stats-modal', true);

    const list = document.getElementById('shifts-stats-list');
    if (!list) return;

    if (!db.staff || !db.shifts) return;

    const todayStr = new Date().toLocaleDateString('en-CA');
    const currentMonthPrefix = todayStr.substring(0, 7);

    list.innerHTML = db.staff.map(staff => {
        const staffShifts = db.shifts.filter(s => s.staffId === staff.id);

        let todayHours = 0;
        let monthHours = 0;
        let totalHours = 0;

        staffShifts.forEach(s => {
            const h = s.hours || 0;
            totalHours += h;
            if (s.date === todayStr) todayHours += h;
            if (s.date.startsWith(currentMonthPrefix)) monthHours += h;
        });

        return `
            <tr style="cursor:pointer; transition:background 0.2s;" onclick="showStaffProfile(${staff.id})">
                <td style="font-weight: 700; color:var(--primary);">${staff.name}</td>
                <td style="color: var(--accent); font-weight: 700;">${todayHours.toFixed(2)} س</td>
                <td style="color: var(--primary); font-weight: 700;">${monthHours.toFixed(2)} س</td>
                <td style="color: var(--text-main); font-weight: 700;">${totalHours.toFixed(2)} س</td>
            </tr>
        `;
    }).join('');
}

function toggleShiftsHistory() {
    showNotification('جاري تحميل سجل الأرشيف كاملاً...', 'info');
}

function showStaffProfile(staffId) {
    const staff = db.staff.find(s => s.id === staffId);
    if (!staff) return;

    toggleModal('staff-profile-modal', true);
    document.getElementById('staff-prof-name').innerText = staff.name;
    document.getElementById('staff-prof-code').innerText = `كود الموظف: ${staff.code || staff.id}`;

    const staffShifts = db.shifts.filter(s => s.staffId === staffId).sort((a, b) => b.id - a.id);

    const today = new Date().toLocaleDateString('en-CA');

    const yesterdayDate = new Date();
    yesterdayDate.setDate(yesterdayDate.getDate() - 1);
    const yesterday = yesterdayDate.toLocaleDateString('en-CA');

    const currentMonth = today.substring(0, 7);

    let hrsToday = 0;
    let hrsYesterday = 0;
    let hrsMonth = 0;

    staffShifts.forEach(s => {
        const h = s.hours || 0;
        if (s.date === today) hrsToday += h;
        if (s.date === yesterday) hrsYesterday += h;
        if (s.date.startsWith(currentMonth)) hrsMonth += h;
    });

    document.getElementById('staff-prof-today').innerText = hrsToday.toFixed(2);
    document.getElementById('staff-prof-yesterday').innerText = hrsYesterday.toFixed(2);
    document.getElementById('staff-prof-month').innerText = hrsMonth.toFixed(2);

    const historyBody = document.getElementById('staff-prof-history');
    const last5 = staffShifts.slice(0, 5);
    historyBody.innerHTML = last5.map(s => `
        <tr>
            <td>${s.date}</td>
            <td>${s.startTime}</td>
            <td>${s.endTime || '---'}</td>
            <td>${s.workHours || '---'}</td>
        </tr>
    `).join('') || '<tr><td colspan="4" style="text-align:center;">لا يوجد سجل</td></tr>';

    // Set print action
    document.getElementById('btn-print-staff-report').onclick = () => {
        printStaffReport(staffId);
    };
}

function printStaffReport(staffId) {
    const staff = db.staff.find(s => s.id === staffId);
    const printable = document.getElementById('staff-prof-printable-area').innerHTML;

    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
        <html>
            <head>
                <title>تقرير موظف - ${staff.name}</title>
                <link rel="stylesheet" href="style.css">
                <style>
                    body { direction: rtl; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 40px; }
                    .header { text-align: center; border-bottom: 2px solid #333; margin-bottom: 30px; padding-bottom: 10px; }
                    .card { border: 1px solid #ddd; padding: 15px; border-radius: 10px; margin-bottom: 10px; text-align: center; }
                    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
                    table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                    th, td { border: 1px solid #ddd; padding: 12px; text-align: center; }
                    .no-print { display: none; }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>تقرير ساعات عمل الموظف</h1>
                    <h3>${staff.name}</h3> 
                    <p>كود: ${staff.code || staff.id}</p>
                    <p>تاريخ التقرير: ${new Date().toLocaleString('ar-EG')}</p>
                </div>
                ${printable}
                <div style="margin-top: 50px; display: flex; justify-content: space-between;">
                    <p>توقيع الإدارة: ........................</p>
                    <p>توقيع الموظف: ........................</p>
                </div>
                <script>
                    setTimeout(() => { window.print(); window.close(); }, 500);
                </script>
            </body>
        </html>
    `);
    printWindow.document.close();
}

// --- PASSWORD MANAGEMENT CENTER ---
let activePasswordToEdit = null;

function openPasswordManagement() {
    // 1. Ensure settings has the passwords object
    if (!db._settings.globalPasswords) {
        db._settings.globalPasswords = {
            main: '2446',
            finance: '4321',
            unlockPayment: '100qwe',
            endSubscription: '01000'
        };
        db.save();
    }

    // 2. Ensure staff is initialized for management
    if (!db.staff || db.staff.length === 0) {
        db.staff = [
            { id: 1, name: 'سكرتارية A', code: 'A', pin: 'a1234a' },
            { id: 2, name: 'سكرتارية B', code: 'B', pin: 'b1b234' },
            { id: 3, name: 'سكرتارية C', code: 'C', pin: 'c12c34' },
            { id: 4, name: 'سكرتارية D', code: 'D', pin: '12d34d' }
        ];
        db.save('staff');
    }

    const container = document.getElementById('password-management-list');
    const passwords = db._settings.globalPasswords || { main: '2446', finance: '4321', unlockPayment: '100qwe', endSubscription: '01000' };

    let html = `
        <div style="background: #fff8f8; border: 1px solid #fee2e2; padding: 1.5rem; border-radius: 20px; margin-bottom: 1.5rem; box-shadow: var(--shadow-sm);">
            <h4 style="color: var(--danger); margin-bottom: 1rem; font-size: 1.1rem;"><i class="fas fa-lock"></i> كلمات مرور النظام الأساسية</h4>
            <div style="display: grid; gap: 0.8rem;">
                ${renderPasswordRow('دخول البرنامج الرئيسي', 'main', passwords.main)}
                ${renderPasswordRow('الخزينة والمالية', 'finance', passwords.finance)}
                ${renderPasswordRow('فك حماية حذف العمليات', 'unlockPayment', passwords.unlockPayment)}
                ${renderPasswordRow('إنهاء اشتراك الشهر', 'endSubscription', passwords.endSubscription)}
            </div>
        </div>

        <div style="background: #f0fdf4; border: 1px solid #dcfce7; padding: 1.5rem; border-radius: 20px; box-shadow: var(--shadow-sm);">
            <h4 style="color: var(--accent); margin-bottom: 1rem; font-size: 1.1rem;"><i class="fas fa-user-shield"></i> أكواد دخول الموظفين (Staff)</h4>
            <div style="display: grid; gap: 0.8rem;">
                ${(db.staff || []).map(s => renderPasswordRow(`كود الموظف: ${s.name}`, `staff_${s.id}`, s.pin)).join('')}
            </div>
        </div>
    `;

    container.innerHTML = html;
    toggleModal('password-management-modal', true);
}

function renderPasswordRow(label, key, currentVal) {
    return `
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 1rem; background: #fff; border-radius: 12px; border: 1px solid #f1f5f9; transition: all 0.2s; box-shadow: 0 2px 4px rgba(0,0,0,0.02);">
            <div style="text-align: right;">
                <span style="font-weight: 700; display: block; color: var(--text-main);">${label}</span>
                <span style="font-size: 0.75rem; color: var(--text-muted); font-family: monospace;">الرقم الحالي: ****</span>
            </div>
            <button class="btn" style="background: var(--bg-light); padding: 8px 20px; font-size: 0.85rem; border-radius: 10px; font-weight: 600; color: var(--text-main);" onclick="startEditPassword('${key}', '${label}')">
                <i class="fas fa-sync-alt" style="margin-left: 5px;"></i> تغيير
            </button>
        </div>
    `;
}

function startEditPassword(key, label) {
    activePasswordToEdit = key;
    document.getElementById('edit-password-title').innerText = `تغيير ${label}`;
    document.getElementById('old-password-input').value = '';
    document.getElementById('new-password-input').value = '';
    document.getElementById('password-verify-step').style.display = 'block';
    document.getElementById('password-update-step').style.display = 'none';
    toggleModal('edit-password-modal', true);
}

function verifyOldPassword() {
    const input = document.getElementById('old-password-input').value.trim();
    if (!input) return showNotification('يرجى إدخال كلمة المرور الحالية', 'warning');

    let correctPass = '';

    if (activePasswordToEdit.startsWith('staff_')) {
        const staffId = parseInt(activePasswordToEdit.split('_')[1]);
        const staff = db.staff.find(s => s.id === staffId);
        correctPass = staff ? staff.pin : '';
    } else {
        correctPass = (db._settings.globalPasswords && db._settings.globalPasswords[activePasswordToEdit]) || '';
        if (!correctPass) {
            const defaults = { main: '2446', finance: '4321', unlockPayment: '100qwe', endSubscription: '01000' };
            correctPass = defaults[activePasswordToEdit];
        }
    }

    if (input === correctPass) {
        document.getElementById('password-verify-step').style.display = 'none';
        document.getElementById('password-update-step').style.display = 'block';
        document.getElementById('new-password-input').focus();
    } else {
        showNotification('❌ كلمة المرور الحالية غير صحيحة!', 'error');
    }
}

function updateToNewPassword() {
    const newVal = document.getElementById('new-password-input').value.trim();
    if (!newVal) return showNotification('يرجى إدخال كلمة مرور جديدة', 'warning');

    if (activePasswordToEdit.startsWith('staff_')) {
        const staffId = parseInt(activePasswordToEdit.split('_')[1]);
        const staff = db.staff.find(s => s.id === staffId);
        if (staff) {
            staff.pin = newVal;
            db.save('staff');
        }
    } else {
        if (!db._settings.globalPasswords) db._settings.globalPasswords = { main: '2446', finance: '4321', unlockPayment: '100qwe', endSubscription: '01000' };
        db._settings.globalPasswords[activePasswordToEdit] = newVal;
        db.save();
    }

    showNotification('✅ تم تحديث كلمة المرور بنجاح', 'success');
    toggleModal('edit-password-modal', false);
    openPasswordManagement(); // Refresh list
}
