/** 
 * الأمين Permanent Data Backup - (data.js)
 * وقت الإنشاء: 2026-06-06
 * ملف البيانات المحلي - يتم تحميله تلقائياً عند بدء البرنامج
 */
window.edu_initial_data = {
    "students": [
        {
            "id": "STU_001",
            "name": "أحمد محمد",
            "qrCode": "QR001",
            "grade": "الأول الثانوي",
            "groupId": "G001",
            "phone": "01234567890",
            "status": "active",
            "enrollDate": "2026-01-15"
        },
        {
            "id": "STU_002",
            "name": "فاطمة علي",
            "qrCode": "QR002",
            "grade": "الأول الثانوي",
            "groupId": "G001",
            "phone": "01234567891",
            "status": "active",
            "enrollDate": "2026-01-15"
        },
        {
            "id": "STU_003",
            "name": "محمود سالم",
            "qrCode": "QR003",
            "grade": "الثاني الثانوي",
            "groupId": "G002",
            "phone": "01234567892",
            "status": "active",
            "enrollDate": "2026-02-01"
        }
    ],
    "groups": [
        {
            "id": "G001",
            "name": "المجموعة الأولى",
            "grade": "الأول الثانوي",
            "studentsCount": 2,
            "createdDate": "2026-01-01"
        },
        {
            "id": "G002",
            "name": "المجموعة الثانية",
            "grade": "الثاني الثانوي",
            "studentsCount": 1,
            "createdDate": "2026-01-01"
        }
    ],
    "attendance": [
        {
            "id": "ATT_001",
            "studentId": "STU_001",
            "date": "2026-06-01",
            "status": "present",
            "grade": "الأول الثانوي"
        },
        {
            "id": "ATT_002",
            "studentId": "STU_002",
            "date": "2026-06-01",
            "status": "present",
            "grade": "الأول الثانوي"
        }
    ],
    "exams": [],
    "scores": [],
    "expenses": [],
    "handouts": [],
    "studentHandouts": [],
    "materials": [],
    "quizzes": [],
    "rewards": [],
    "payments": [],
    "waQueue": [],
    "cycles": [],
    "absenceSessions": [],
    "dailyTreasuryArchives": [],
    "staff": [],
    "shifts": [],
    "courseCodes": [],
    "platformCourses": [
        {
            "id": "PCRS_001",
            "courseId": "course_11",
            "courseTitle": "أولى ثانوي - شهر 11",
            "grade": "1",
            "price": 100,
            "status": "active"
        },
        {
            "id": "PCRS_002",
            "courseId": "course_12",
            "courseTitle": "أولى ثانوي - شهر 12",
            "grade": "1",
            "price": 100,
            "status": "active"
        },
        {
            "id": "PCRS_003",
            "courseId": "course_review_final",
            "courseTitle": "مراجعة نهائية",
            "grade": "all",
            "price": 50,
            "status": "active"
        }
    ],
    "platformSubscriptions": [],
    "gradesList": [
        "الأول الثانوي",
        "الثاني الثانوي",
        "الثالث الثانوي"
    ],
    "exportDate": "2026-06-06T12:00:00.000Z",
    "activeGrade": "الأول الثانوي",
    "activeGroup": "G001",
    "settings": {
        "default": {
            "isMonthlyActive": true,
            "monthlyFee": 500,
            "centerCommissionPercent": 10,
            "monthlyCollected": 0,
            "activeCycle": null,
            "treasurySessionResetTime": {}
        }
    }
};
