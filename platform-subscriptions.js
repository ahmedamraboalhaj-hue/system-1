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
 * يجلب جميع الكورسات من Firebase ويحفظها محلياً.
 *
 * ── استراتيجية الجلب (بالترتيب) ──────────────────────────────────
 *  1. يجرب Collection  'platform_courses'  (المسار الأصلي).
 *  2. إذا رجعت صفر نتائج يجرب 'courses' (اسم بديل شائع).
 *  3. إذا رجعت صفر نتائج ينتقل لـ Fallback:
 *     يبني الكورسات الفريدة من course_codes المحفوظة محلياً
 *     (التي تحتوي courseId + courseTitle + grade + price بالفعل).
 *
 * ── لماذا course_codes كـ Fallback؟ ──────────────────────────────
 *  • course_codes تُجلب بنجاح وتحتوي بيانات كل كورس (id, title, grade, price).
 *  • نستخرج الكورسات الفريدة منها مباشرة بدلاً من ترك القائمة فارغة.
 */
async function refreshPlatformCourses() {
    const btn = document.getElementById('btn-refresh-platform-courses');
    try {
        const online = await isReallyOnline();
        if (!online) {
            // offline: حاول البناء من course_codes المحلية
            const built = _buildCoursesFromCourseCodes();
            if (built.length) {
                db.platformCourses = built;
                await StorageEngine.save('platformCourses', built);
                showNotification(`لا يوجد إنترنت — تم بناء ${built.length} كورس من الأكواد المحلية.`, 'warning');
                if (typeof populateCycleCourseSelect === 'function') populateCycleCourseSelect();
                return true;
            }
            showNotification('لا يوجد اتصال بالإنترنت. سيتم استخدام آخر نسخة محفوظة من الكورسات.', 'warning');
            return false;
        }

        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري تحديث الكورسات...';
        }

        let courses = [];
        let sourceUsed = '';

        // ─── المحاولة 1: platform_courses ───────────────────────────
        try {
            const snap1 = await window.db.collection('platform_courses').get();
            if (!snap1.empty) {
                snap1.forEach(doc => {
                    const d = doc.data();
                    courses.push({
                        id: doc.id,
                        courseId: d.courseId || d.id || doc.id,
                        courseTitle: d.courseTitle || d.title || d.name || 'كورس بدون اسم',
                        grade: d.grade || d.gradeId || '',
                        price: Number(d.price || d.unitPrice || d.cost || 0),
                        status: d.status || 'active'
                    });
                });
                sourceUsed = 'platform_courses';
                console.log('[COURSES] platform_courses ✅', courses.length);
            } else {
                console.warn('[COURSES] platform_courses فارغة — جاري تجربة مسار بديل...');
            }
        } catch (e) {
            console.warn('[COURSES] platform_courses خطأ:', e.message);
        }

        // ─── المحاولة 2: courses ─────────────────────────────────────
        if (!courses.length) {
            try {
                const snap2 = await window.db.collection('courses').get();
                if (!snap2.empty) {
                    snap2.forEach(doc => {
                        const d = doc.data();
                        courses.push({
                            id: doc.id,
                            courseId: d.courseId || d.id || doc.id,
                            courseTitle: d.courseTitle || d.title || d.name || 'كورس بدون اسم',
                            grade: d.grade || d.gradeId || '',
                            price: Number(d.price || d.unitPrice || d.cost || 0),
                            status: d.status || 'active'
                        });
                    });
                    sourceUsed = 'courses';
                    console.log('[COURSES] courses ✅', courses.length);
                } else {
                    console.warn('[COURSES] courses فارغة أيضاً.');
                }
            } catch (e) {
                console.warn('[COURSES] courses خطأ:', e.message);
            }
        }

        // ─── Fallback: بناء من course_codes ──────────────────────────
        if (!courses.length) {
            console.warn('[COURSES] لا توجد كورسات من Firebase — سيتم البناء من course_codes.');
            // تحديث course_codes من Firebase أولاً
            try {
                const codesSnap = await window.db.collection('course_codes').get();
                if (!codesSnap.empty) {
                    const freshCodes = [];
                    codesSnap.forEach(doc => freshCodes.push({ id: doc.id, ...doc.data() }));
                    db.courseCodes = freshCodes;
                    await StorageEngine.save('courseCodes', freshCodes);
                    console.log('[COURSES] course_codes محدّثة:', freshCodes.length);
                }
            } catch (e) {
                console.warn('[COURSES] تعذّر تحديث course_codes:', e.message);
            }
            courses = _buildCoursesFromCourseCodes();
            sourceUsed = 'course_codes (fallback)';
            console.log('[COURSES] courses مبنية من course_codes:', courses.length);
        }

        db.platformCourses = courses;
        await StorageEngine.save('platformCourses', courses);

        if (courses.length) {
            showNotification(
                `✅ تم تحديث ${courses.length} كورس من (${sourceUsed}). يمكنك الاختيار الآن.`,
                'success'
            );
        } else {
            showNotification(
                '⚠️ لا توجد كورسات في قاعدة البيانات. تأكد من إضافة الكورسات على المنصة.',
                'warning'
            );
        }

        if (typeof populateCycleCourseSelect === 'function') populateCycleCourseSelect();
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

/**
 * يبني قائمة كورسات فريدة من db.courseCodes المحفوظة محلياً.
 * السعر = أول قيمة price/unitPrice/discountedPrice في أكواد نفس الكورس.
 */
function _buildCoursesFromCourseCodes() {
    const codes = db.courseCodes || [];
    if (!codes.length) return [];
    const map = new Map();
    codes.forEach(c => {
        const cid = String(c.courseId || '').trim();
        if (!cid) return;
        if (!map.has(cid)) {
            map.set(cid, {
                id: cid,
                courseId: cid,
                courseTitle: c.courseTitle || c.title || 'كورس بدون اسم',
                grade: String(c.grade || ''),
                price: Number(c.price || c.unitPrice || c.discountedPrice || 0),
                status: 'active'
            });
        } else {
            const existing = map.get(cid);
            if (!existing.courseTitle || existing.courseTitle === 'كورس بدون اسم')
                existing.courseTitle = c.courseTitle || c.title || existing.courseTitle;
            if (!existing.grade) existing.grade = String(c.grade || '');
            if (!existing.price) existing.price = Number(c.price || c.unitPrice || c.discountedPrice || 0);
        }
    });
    return Array.from(map.values());
}

// ============================================
// 1.5 إعدادات "بدء الاشتراك" - نوع الاشتراك وكورس المنصة
// ============================================

/**
 * تُستدعى عند تغيير "نوع الاشتراك" في شاشة الخزنة والمالية → بدء الاشتراك.
 * تُظهر/تُخفي قائمة اختيار كورس المنصة بحسب النوع المختار.
 */
function onCycleSubscriptionTypeChange() {
    const typeSelect = document.getElementById('cycle-subscription-type');
    const courseWrapper = document.getElementById('cycle-platform-course-wrapper');
    const feeInput = document.getElementById('monthly-fee-input');
    if (!typeSelect || !courseWrapper) return;

    const type = typeSelect.value;
    const needsCourse = (type === 'platform' || type === 'both');
    courseWrapper.style.display = needsCourse ? 'block' : 'none';

    if (needsCourse) {
        populateCycleCourseSelect();
    }

    // اشتراك المنصة فقط لا يتطلب قيمة اشتراك للدرس
    if (feeInput) {
        feeInput.placeholder = (type === 'platform') ? 'غير مطلوب لاشتراك المنصة فقط' : 'مثلاً: 100';
    }
}

/**
 * يملأ القائمة المنسدلة لاختيار كورس المنصة في شاشة "بدء الاشتراك"
 * من الكورسات المحفوظة محلياً (db.platformCourses) للصف الحالي.
 */
/**
 * يملأ قائمة الكورسات في شاشة "بدء الاشتراك".
 * — يعرض جميع الكورسات بدون فلترة الصف.
 * — إذا كانت القائمة فارغة يحاول البناء من course_codes أو الجلب من Firebase.
 * — السعر يُعرض تلقائياً من بيانات الكورس (data-price attribute).
 */
function populateCycleCourseSelect() {
    const select = document.getElementById('cycle-platform-course');
    if (!select) return;

    // اعرض جميع الكورسات بدون فلترة صف
    let courses = db.platformCourses || [];

    // إذا كانت فارغة — ابنِها من course_codes المحلية
    if (!courses.length && (db.courseCodes || []).length) {
        courses = _buildCoursesFromCourseCodes();
        if (courses.length) {
            db.platformCourses = courses;
            StorageEngine.save('platformCourses', courses);
        }
    }

    console.log('[COURSES] populateCycleCourseSelect — كورسات:', courses.length,
        ' | أكواد:', (db.courseCodes || []).length);

    const currentValue = select.value;

    if (!courses.length) {
        select.innerHTML = `<option value="">-- لا توجد كورسات، اضغط "تحديث الكورسات" أولاً --</option>`;
        // جلب تلقائي إذا كان الإنترنت متاحاً
        if (navigator.onLine && typeof refreshPlatformCourses === 'function') {
            refreshPlatformCourses().then(() => populateCycleCourseSelect());
        }
        return;
    }

    select.innerHTML = `<option value="">-- اختر الكورس --</option>` +
        courses.map(c => {
            const priceLabel = c.price ? ` — ${c.price} ج.م` : '';
            return `<option value="${c.courseId}" data-price="${c.price || 0}">${c.courseTitle}${priceLabel}</option>`;
        }).join('');

    if (courses.some(c => String(c.courseId) === String(currentValue))) {
        select.value = currentValue;
    }
}

/**
 * تُستدعى عند اختيار كورس من قائمة "كورس المنصة المطلوب".
 * تقرأ سعر الكورس من data-price attribute وتعرضه تلقائياً.
 * تحدّث أيضاً الحقل المخفي platform-fee-input بالقيمة الصحيحة.
 */
function onPlatformCourseSelected(selectEl) {
    const selectedOption = selectEl.options[selectEl.selectedIndex];
    const price = Number(selectedOption ? selectedOption.getAttribute('data-price') || 0 : 0);
    const courseTitle = selectedOption ? selectedOption.text : '';

    // تحديث العرض التلقائي للسعر
    const priceDisplay = document.getElementById('platform-fee-value');
    const hiddenInput = document.getElementById('platform-fee-input');

    if (selectEl.value && price > 0) {
        if (priceDisplay) priceDisplay.textContent = `${price} ج.م`;
        if (hiddenInput) hiddenInput.value = price;
    } else if (selectEl.value && price === 0) {
        if (priceDisplay) priceDisplay.textContent = 'مجاني (0 ج.م)';
        if (hiddenInput) hiddenInput.value = 0;
    } else {
        if (priceDisplay) priceDisplay.textContent = 'اختر كورساً أولاً';
        if (hiddenInput) hiddenInput.value = 0;
    }
}

// ============================================
// 2. شاشة دفع الاشتراك - اختيار نوع الاشتراك
// ============================================

/**
 * يفتح نافذة اختيار نوع الاشتراك (الدرس / المنصة / الاثنين)
 * تُستدعى من البطاقة الذكية للطالب بدلاً من recordQuickAction('payment') مباشرة
 *
 * الكورس المرتبط باشتراك المنصة يُحدَّد مرة واحدة من "الخزنة والمالية → بدء الاشتراك"
 * ولا يُطلب من المستخدم اختياره مرة أخرى هنا.
 */
function openSubscriptionTypeModal(studentId) {
    const s = db.students.find(x => x.id == studentId);
    if (!s) return;

    platformSubModalStudentId = studentId;

    currentGrade = localStorage.getItem('edu_active_grade') || currentGrade;
    currentGroupId = localStorage.getItem('edu_active_group') || currentGroupId;

    const lessonFee = db.settings.monthlyFee || 0;
    const cycleType = db.settings.cycleSubscriptionType || 'lesson';
    const platformCourse = db.settings.activePlatformCourse || null;

    const showLessonOption = cycleType === 'lesson' || cycleType === 'both';
    const showPlatformOption = (cycleType === 'platform' || cycleType === 'both') && !!platformCourse;

    const hasLessonPaid = db.payments.some(p =>
        p.studentId == s.id &&
        p.category === 'اشتراك شهري' &&
        p.cycleId == db.settings.activeCycle
    );

    const hasPlatformSubThisCycle = (db.platformSubscriptions || []).some(ps =>
        String(ps.student_id) == String(s.id) &&
        platformCourse &&
        String(ps.course_id) === String(platformCourse.courseId) &&
        ps.cycleId == db.settings.activeCycle
    );

    const container = document.getElementById('subscription-type-content');
    if (!container) return;

    if (!showLessonOption && !showPlatformOption) {
        container.innerHTML = `
            <div style="text-align:center; padding:2rem; color:var(--text-muted);">
                <i class="fas fa-exclamation-circle" style="font-size:2rem; margin-bottom:0.5rem; display:block;"></i>
                لا يوجد نوع اشتراك مفعّل لهذه الدورة. يرجى ضبط "نوع الاشتراك" من الخزنة والمالية → بدء الاشتراك.
            </div>`;
        toggleModal('subscription-type-modal', true);
        return;
    }

    container.innerHTML = `
        <div style="text-align:center; margin-bottom:1.5rem;">
            <h3 style="margin-bottom:0.3rem;">${s.name}</h3>
            <p style="color:var(--text-muted); font-size:0.9rem;">اختر نوع الاشتراك الذي سيتم دفعه</p>
        </div>

        <div style="display:flex; flex-direction:column; gap:0.75rem;">
            ${showLessonOption ? `
            <label class="sub-type-option">
                <input type="checkbox" id="sub-type-lesson" ${hasLessonPaid ? 'disabled checked' : ''}>
                <div class="sub-type-box">
                    <div class="sub-type-title">
                        <i class="fas fa-chalkboard-teacher"></i> اشتراك الدرس
                        ${hasLessonPaid ? '<span class="status-badge" style="background:#dcfce7; color:#166534;">مدفوع ✅</span>' : ''}
                    </div>
                    <div class="sub-type-price">${lessonFee} ج.م</div>
                </div>
            </label>` : ''}

            ${showPlatformOption ? `
            <label class="sub-type-option">
                <input type="checkbox" id="sub-type-platform" ${hasPlatformSubThisCycle ? 'disabled checked' : ''}>
                <div class="sub-type-box">
                    <div class="sub-type-title">
                        <i class="fas fa-laptop-code"></i> اشتراك المنصة: ${platformCourse.courseTitle}
                        ${hasPlatformSubThisCycle ? '<span class="status-badge" style="background:#dbeafe; color:#1e40af;">مشترك بالفعل ✅</span>' : ''}
                    </div>
                    <div class="sub-type-price">${platformCourse.price} ج.م</div>
                </div>
            </label>` : ''}
        </div>

        <div style="margin-top:1.5rem; padding-top:1rem; border-top:1px solid var(--border); display:flex; justify-content:space-between; align-items:center;">
            <strong>الإجمالي</strong>
            <strong id="sub-type-total" style="font-size:1.3rem; color:var(--accent);">0 ج.م</strong>
        </div>

        <button class="btn btn-primary" style="width:100%; height:55px; border-radius:12px; margin-top:1.5rem; font-size:1.05rem;"
            onclick="confirmSubscriptionSelection(${s.id})">
            <i class="fas fa-check-circle"></i> متابعة
        </button>
    `;

    const lessonCheckbox = document.getElementById('sub-type-lesson');
    const platformCheckbox = document.getElementById('sub-type-platform');

    if (lessonCheckbox) lessonCheckbox.addEventListener('change', updateSubscriptionTotal);
    if (platformCheckbox) platformCheckbox.addEventListener('change', updateSubscriptionTotal);

    updateSubscriptionTotal();
    toggleModal('subscription-type-modal', true);
}

function updateSubscriptionTotal() {
    const lessonChecked = document.getElementById('sub-type-lesson')?.checked;
    const platformChecked = document.getElementById('sub-type-platform')?.checked;

    const lessonFee = lessonChecked ? (db.settings.monthlyFee || 0) : 0;
    const platformFee = platformChecked && db.settings.activePlatformCourse
        ? (Number(db.settings.activePlatformCourse.price) || 0)
        : 0;

    const total = lessonFee + platformFee;
    const totalEl = document.getElementById('sub-type-total');
    if (totalEl) totalEl.innerText = `${total} ج.م`;
}



/**
 * يُنفَّذ عند الضغط على "متابعة" في نافذة اختيار نوع الاشتراك.
 * يقرأ اختيار المستخدم (الدرس / المنصة) ويسجل الدفعات المناسبة.
 * اشتراك المنصة يُربط تلقائياً بالكورس المحدد مسبقاً في "بدء الاشتراك" دون أي خطوة إضافية.
 */
async function confirmSubscriptionSelection(studentId) {
    const s = db.students.find(x => x.id == studentId);
    if (!s) return;

    const lessonCheckbox = document.getElementById('sub-type-lesson');
    const platformCheckbox = document.getElementById('sub-type-platform');
    const lessonChecked = lessonCheckbox ? lessonCheckbox.checked : false;
    const platformChecked = platformCheckbox ? platformCheckbox.checked : false;

    if (!lessonChecked && !platformChecked) {
        return showNotification('يرجى تحديد نوع اشتراك واحد على الأقل', 'warning');
    }

    const platformCourse = db.settings.activePlatformCourse;
    if (platformChecked && !platformCourse) {
        return showNotification('لا يوجد كورس منصة محدد لهذه الدورة. يرجى ضبطه من الخزنة والمالية', 'error');
    }

    let lessonResult = null;
    let platformResult = null;

    // --- 1. اشتراك الدرس ---
    if (lessonChecked && !lessonCheckbox.disabled) {
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

    // --- 2. اشتراك المنصة (الكورس محدد تلقائياً من إعدادات الدورة) ---
    if (platformChecked && platformCourse && !(platformCheckbox && platformCheckbox.disabled)) {
        platformResult = await recordPlatformSubscription(s, platformCourse);
    }

    await db.save();

    // --- إشعار ---
    const parts = [];
    if (lessonResult) parts.push(`اشتراك الدرس (${lessonResult.amount} ج.م)`);
    if (platformResult) parts.push(`اشتراك المنصة - ${platformCourse.courseTitle} (${platformResult.totalAmount} ج.م)`);

    if (parts.length) {
        showNotification(`✅ تم تسجيل: ${parts.join(' + ')} لـ ${s.name}`, 'success');
        playSound('success');
        if (platformResult) {
            showNotification(`✅ تم اشتراك الطالب في كورس "${platformCourse.courseTitle}"`, 'success');
        }
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
 * يسجل اشتراك منصة لطالب في الكورس المحدد مسبقاً للدورة الحالية.
 * - يحفظ السجل محلياً دائماً (Offline-First)
 * - لو متصل بالإنترنت: يرفع مباشرة لـ Firebase ويربط الطالب بالكورس
 * - لو غير متصل: يضعه في جدول platform_subscriptions بحالة sync_status = 0
 */
async function recordPlatformSubscription(student, course) {
    const online = await isReallyOnline();
    const now = new Date().toISOString();
    const amount = Number(course.price) || 0;

    const record = {
        id: `PSUB_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        student_id: student.id,
        studentCode: student.qrCode,
        course_id: course.courseId,
        course_title: course.courseTitle,
        amount: amount,
        payment_date: now,
        sync_status: 0, // 0 = لم تتم المزامنة, 1 = تمت المزامنة
        created_at: now,
        cycleId: db.settings.activeCycle || 'misc'
    };

    // 1. الحفظ المحلي دائماً أولاً
    db.platformSubscriptions = db.platformSubscriptions || [];
    db.platformSubscriptions.push(record);
    await StorageEngine.save('platformSubscriptions', [record]);

    // 2. تسجيل عملية دفع داخلية لإظهارها في الخزينة والمالية
    const financePayment = {
        id: Date.now() + 2,
        studentId: student.id,
        amount: amount,
        date: now,
        category: 'اشتراك المنصة',
        cycleId: db.settings.activeCycle || 'misc',
        platformCourseId: course.courseId,
        platformCourseTitle: course.courseTitle
    };
    db.payments.push(financePayment);

    // 3. لو متصل بالإنترنت: نحاول المزامنة فوراً
    if (online) {
        const syncResult = await syncPlatformSubscriptionRecords([record]);
        if (syncResult.success) {
            showNotification(`🌐 تم ربط ${student.name} بكورس "${course.courseTitle}" على المنصة فوراً`, 'success');
        } else {
            showNotification('⚠️ تم الحفظ محلياً، وسيتم رفع الاشتراك تلقائياً عند تحسن الاتصال', 'warning');
        }
    } else {
        showNotification(`📴 تم تسجيل اشتراك المنصة محلياً لـ ${student.name}. سيتم رفعه تلقائياً عند توفر الإنترنت`, 'warning');
    }

    return { records: [record], totalAmount: amount, online };
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
                    studentCode: record.studentCode,
                    courseId: record.course_id,
                    courseTitle: record.course_title,
                    amount: record.amount,
                    subscriptionDate: record.payment_date.split('T')[0],
                    paid: true,
                    offlineStudentId: record.student_id,
                    createdAt: record.created_at
                }, { merge: true });

                // إضافة الطالب لقائمة المشتركين في الكورس
                await window.db.collection('platform_courses').doc(String(record.course_id))
                    .collection('subscribers').doc(String(record.studentCode)).set({
                        studentCode: record.studentCode,
                        subscriptionDate: record.payment_date.split('T')[0],
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
// 5.5 عرض الكورسات المستلمة (المحفوظة محلياً)
// ============================================

/**
 * يعرض في نافذة منبثقة كل الكورسات المحفوظة محلياً في db.platformCourses
 * للتأكد من أن "تحديث الكورسات" نزّل كل الكورسات من المنصة بنجاح.
 */
function showReceivedPlatformCourses() {
    let modal = document.getElementById('platform-received-courses-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'platform-received-courses-modal';
        modal.className = 'modal-overlay';
        modal.style.display = 'none';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 620px; border-radius: 24px;">
                <button class="modal-close-btn" onclick="toggleModal('platform-received-courses-modal', false)">
                    <i class="fas fa-times"></i>
                </button>
                <h3 style="margin-bottom:0.5rem; text-align:center;"><i class="fas fa-graduation-cap"></i> الكورسات المستلمة من المنصة</h3>
                <p id="platform-received-courses-count" style="text-align:center; color:var(--text-muted); font-size:0.85rem; margin-bottom:1rem;"></p>
                <div id="platform-received-courses-list" style="max-height: 450px; overflow-y:auto; display:flex; flex-direction:column; gap:0.5rem;"></div>
                <div style="margin-top:1rem; text-align:center;">
                    <button class="btn btn-primary" onclick="syncWithPlatform(); toggleModal('platform-received-courses-modal', false);"
                        style="height:44px; border-radius:12px; padding:0 1.5rem;">
                        <i class="fas fa-sync-alt"></i> مزامنة مع المنصة لتحديث القائمة
                    </button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }

    // محاولة تحميل الكورسات من الذاكرة أو من التخزين المحلي
    let courses = db.platformCourses || [];

    const countEl = document.getElementById('platform-received-courses-count');
    const list = document.getElementById('platform-received-courses-list');

    if (countEl) countEl.innerText = courses.length > 0
        ? `إجمالي الكورسات المحفوظة محلياً: ${courses.length}`
        : 'لم يتم استلام أي كورسات بعد';

    if (!list) {
        toggleModal('platform-received-courses-modal', true);
        return;
    }

    if (!courses.length) {
        list.innerHTML = `
            <div style="text-align:center; padding:2.5rem; color:var(--text-muted);">
                <i class="fas fa-box-open" style="font-size:2.5rem; margin-bottom:0.75rem; display:block; opacity:0.5;"></i>
                <strong style="display:block; margin-bottom:0.5rem; color:var(--text-color);">لا توجد كورسات مستلمة حالياً</strong>
                <p style="font-size:0.85rem; margin:0;">اضغط "مزامنة مع المنصة" عند توفر الإنترنت لاستلام الكورسات.</p>
            </div>`;
    } else {
        list.innerHTML = courses.map(c => `
            <div class="sub-type-box" style="display:flex; justify-content:space-between; align-items:center; padding:0.8rem 1rem; border-radius:12px; background:var(--bg-light); border:1px solid var(--border);">
                <div>
                    <div style="font-weight:700; margin-bottom:0.25rem;">${c.courseTitle || 'كورس بدون اسم'}</div>
                    <div style="display:flex; gap:0.5rem; flex-wrap:wrap;">
                        <span class="status-badge" style="background:#e0e7ff; color:#3730a3; font-size:0.75rem;">${c.grade ? 'الصف: ' + c.grade : 'عام'}</span>
                        <span class="status-badge" style="background:${c.status === 'active' ? '#dcfce7' : '#fee2e2'}; color:${c.status === 'active' ? '#166534' : '#991b1b'}; font-size:0.75rem;">${c.status === 'active' ? 'نشط' : (c.status || 'غير محدد')}</span>
                    </div>
                </div>
                <div style="font-weight:800; font-size:1.1rem; color:var(--primary); white-space:nowrap;">${c.price || 0} ج.م</div>
            </div>
        `).join('');
    }

    toggleModal('platform-received-courses-modal', true);
}

// ============================================
// 6. التهيئة والمزامنة التلقائية
// ============================================

// ============================================
// 7. زر "مزامنة مع المنصة" الشامل
// ============================================

/**
 * ينفذ جميع عمليات المزامنة بالترتيب:
 * 1. تحديث الكورسات
 * 2. مزامنة الاشتراكات المعلّقة
 * 3. استلام الأكواد من المنصة
 * 4. تحديث البيانات المطلوبة
 * ثم يعرض تقريراً بالنتائج.
 */
async function syncWithPlatform() {
    const btn = document.getElementById('btn-sync-platform');
    const results = [];
    const errors = [];

    // إظهار مؤشر التحميل
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري المزامنة...';
    }

    // التحقق من الاتصال
    const online = await isReallyOnline();
    if (!online) {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-sync-alt"></i> مزامنة مع المنصة';
        }
        showNotification('❌ لا يوجد اتصال بالإنترنت. تأكد من الاتصال وحاول مجدداً.', 'error');
        return;
    }

    // ─── الخطوة 1: تحديث الكورسات (مع fallback تلقائي) ───
    try {
        if (btn) btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> (1/4) تحديث الكورسات...';
        // نستخدم refreshPlatformCourses التي تجرب مسارات متعددة تلقائياً
        const didRefresh = await refreshPlatformCourses();
        const count = (db.platformCourses || []).length;
        results.push(`✅ تم تحديث ${count} كورس بنجاح`);
    } catch (err) {
        console.error('Step 1 failed', err);
        errors.push(`❌ تحديث الكورسات: ${err.message}`);
    }

    // ─── الخطوة 2: مزامنة الاشتراكات المعلّقة ───
    try {
        if (btn) btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> (2/4) مزامنة الاشتراكات...';
        const pending = (db.platformSubscriptions || []).filter(r => r.sync_status === 0);
        if (pending.length > 0) {
            const syncResult = await syncPlatformSubscriptionRecords(pending);
            if (syncResult.syncedCount > 0) {
                results.push(`✅ تم مزامنة ${syncResult.syncedCount} اشتراك معلّق`);
            }
            if (syncResult.syncedCount < pending.length) {
                errors.push(`⚠️ تبقى ${pending.length - syncResult.syncedCount} اشتراك لم يُزامَن`);
            }
        } else {
            results.push(`✅ لا توجد اشتراكات معلّقة (كل شيء محدّث)`);
        }
        updatePendingSyncBadge();
    } catch (err) {
        console.error('Step 2 failed', err);
        errors.push(`❌ مزامنة الاشتراكات: ${err.message}`);
    }

    // ─── الخطوة 3: استلام الأكواد من المنصة ───
    try {
        if (btn) btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> (3/4) استلام الأكواد...';
        const codesSnapshot = await window.db.collection('course_codes').get();
        const imported = [];
        codesSnapshot.forEach(doc => imported.push({ id: doc.id, ...doc.data() }));
        db.courseCodes = imported;
        await StorageEngine.save('courseCodes', imported);
        if (typeof renderPlatformCodesSection === 'function') renderPlatformCodesSection();
        results.push(`✅ تم استلام ${imported.length} كود من المنصة`);
    } catch (err) {
        console.error('Step 3 failed', err);
        errors.push(`❌ استلام الأكواد: ${err.message}`);
    }

    // ─── الخطوة 4: تحديث البيانات المطلوبة ───
    try {
        if (btn) btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> (4/4) تحديث البيانات...';
        await db.save();
        if (typeof updateDashboardStats === 'function') updateDashboardStats();
        if (typeof renderPlatformCodesSection === 'function') renderPlatformCodesSection();
        results.push(`✅ تم تحديث بيانات المنصة`);
    } catch (err) {
        console.error('Step 4 failed', err);
        errors.push(`❌ تحديث البيانات: ${err.message}`);
    }

    // ─── إعادة الزر ───
    if (btn) {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-sync-alt"></i> مزامنة مع المنصة';
    }

    // ─── عرض تقرير النتائج ───
    showSyncResultsModal(results, errors);
}

/**
 * يعرض نافذة تقرير نتائج المزامنة
 */
function showSyncResultsModal(results, errors) {
    let modal = document.getElementById('sync-results-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'sync-results-modal';
        modal.className = 'modal-overlay';
        modal.style.cssText = 'display:none;';
        document.body.appendChild(modal);
    }

    const allItems = [...results, ...errors];
    const hasErrors = errors.length > 0;

    modal.innerHTML = `
        <div class="modal-content" style="max-width:500px; border-radius:24px; text-align:center;">
            <div style="font-size:3rem; margin-bottom:1rem;">${hasErrors ? '⚠️' : '🎉'}</div>
            <h3 style="margin-bottom:0.5rem; font-size:1.4rem;">
                ${hasErrors ? 'اكتملت المزامنة مع تنبيهات' : 'اكتملت المزامنة بنجاح!'}
            </h3>
            <p style="color:var(--text-muted); margin-bottom:1.5rem; font-size:0.9rem;">
                نتائج عمليات المزامنة مع المنصة
            </p>
            <div style="text-align:right; display:flex; flex-direction:column; gap:0.6rem; margin-bottom:1.5rem;">
                ${allItems.map(item => `
                    <div style="
                        padding:0.7rem 1rem;
                        border-radius:10px;
                        font-size:0.95rem;
                        font-weight:600;
                        background:${item.startsWith('✅') ? '#f0fdf4' : item.startsWith('⚠️') ? '#fffbeb' : '#fef2f2'};
                        color:${item.startsWith('✅') ? '#166534' : item.startsWith('⚠️') ? '#92400e' : '#991b1b'};
                        border:1px solid ${item.startsWith('✅') ? '#bbf7d0' : item.startsWith('⚠️') ? '#fde68a' : '#fecaca'};
                    ">${item}</div>
                `).join('')}
            </div>
            <button class="btn btn-primary" onclick="toggleModal('sync-results-modal', false)"
                style="width:100%; height:48px; border-radius:12px;">
                <i class="fas fa-check"></i> حسناً
            </button>
        </div>
    `;

    toggleModal('sync-results-modal', true);
}

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
});

// ============================================
// Exports
// ============================================
window.refreshPlatformCourses = refreshPlatformCourses;
window.openSubscriptionTypeModal = openSubscriptionTypeModal;
window.updateSubscriptionTotal = updateSubscriptionTotal;
window.confirmSubscriptionSelection = confirmSubscriptionSelection;
window.recordPlatformSubscription = recordPlatformSubscription;
window.syncPendingPlatformSubscriptions = syncPendingPlatformSubscriptions;
window.syncPlatformSubscriptionRecords = syncPlatformSubscriptionRecords;
window.updatePendingSyncBadge = updatePendingSyncBadge;
window.onCycleSubscriptionTypeChange = onCycleSubscriptionTypeChange;
window.populateCycleCourseSelect = populateCycleCourseSelect;
window.onPlatformCourseSelected   = onPlatformCourseSelected;
window._buildCoursesFromCourseCodes = _buildCoursesFromCourseCodes;
window.showReceivedPlatformCourses = showReceivedPlatformCourses;
window.getAvailablePlatformCourses = getAvailablePlatformCourses;
window.syncWithPlatform = syncWithPlatform;
window.showSyncResultsModal = showSyncResultsModal;

