
function showCycleArchive() {
    const list = document.getElementById('archive-list');
    if (!list) return;

    // Filter cycles by both grade and current group for isolation
    const gradeCycles = db.cycles.filter(c => c.grade == currentGrade && (c.groupId == currentGroupId || !c.groupId)).reverse();

    list.innerHTML = gradeCycles.map(c => `
        <tr>
            <td><strong>${c.title}</strong></td>
            <td>${new Date(c.date).toLocaleDateString('ar-EG')}</td>
            <td>${c.fee} ج.م</td>
            <td>
                <button class="btn btn-primary" style="background:var(--accent); padding:5px 15px;" onclick="viewArchivedCycle(${c.id})">
                    عرض التقرير <i class="fas fa-file-invoice"></i>
                </button>
            </td>
        </tr>
    `).join('') || '<tr><td colspan="4" style="text-align:center; padding:2rem;">لا يوجد دورات مؤرشفة بعد</td></tr>';

    toggleModal('archive-modal', true);
}

function viewArchivedCycle(cycleId) {
    const cycle = db.cycles.find(c => c.id == cycleId);
    if (!cycle) return;

    // Filter students by both grade and current group
    const gradeStudents = db.students.filter(s => s.grade == currentGrade && String(s.groupId) === String(currentGroupId));
    const cyclePayments = db.payments.filter(p => p.cycleId == cycleId);
    const groupPayments = cyclePayments.filter(p => gradeStudents.some(s => s.id == p.studentId));

    const paidList = [];
    const unpaidList = [];

    gradeStudents.forEach(s => {
        const p = groupPayments.find(pay => pay.studentId == s.id);
        if (p) paidList.push({ name: s.name, code: s.qrCode, date: p.date });
        else unpaidList.push({ name: s.name, code: s.qrCode });
    });

    const totalCollected = groupPayments.reduce((sum, p) => sum + p.amount, 0);
    const centerCut = Math.round(totalCollected * (cycle.centerPercent || 0) / 100);

    const reportHtml = `
        <html dir="rtl">
        <head>
            <title>تقرير أرشيف: ${cycle.title}</title>
            <style>
                @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;700&display=swap');
                body { font-family: 'Tajawal', sans-serif; padding: 20px; color: #333; }
                .header { text-align: center; border-bottom: 2px solid #4f46e5; padding-bottom: 10px; margin-bottom: 30px; }
                .stats { display: flex; justify-content: space-around; margin-bottom: 30px; background: #f8fafc; padding: 20px; border-radius: 10px; }
                table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
                th, td { border: 1px solid #ddd; padding: 10px; text-align: right; }
                th { background: #f1f5f9; }
                .section-title { background: #4f46e5; color: white; padding: 10px; border-radius: 5px; margin-bottom: 15px; }
                .paid-row { color: #10b981; }
                .unpaid-row { color: #ef4444; }
                @media print { .no-print { display: none; } }
            </style>
        </head>
        <body>
            <div class="header">
                <h1>تقرير اشتراكات: ${cycle.title}</h1>
                <p>تاريخ الأرشفة: ${new Date(cycle.date).toLocaleString('ar-EG')}</p>
            </div>

            <div class="stats">
                <div><strong>قيمة الاشتراك:</strong> ${cycle.fee} ج.م</div>
                <div><strong>إجمالي المحصل:</strong> ${totalCollected} ج.م</div>
                <div><strong>نسبة السنتر:</strong> ${centerCut} ج.م (${cycle.centerPercent || 0}%)</div>
                <div><strong>عدد الطلاب:</strong> ${gradeStudents.length}</div>
            </div>

            <div class="section-title">✅ طلاب تم الدفع (${paidList.length})</div>
            <table>
                <thead>
                    <tr><th>الاسم</th><th>الكود</th><th>تاريخ الدفع</th></tr>
                </thead>
                <tbody>
                    ${paidList.map(s => `<tr><td>${s.name}</td><td>${s.code}</td><td>${new Date(s.date).toLocaleDateString('ar-EG')}</td></tr>`).join('')}
                </tbody>
            </table>

            <div class="section-title" style="background:#ef4444;">❌ طلاب لم يتم الدفع (${unpaidList.length})</div>
            <table>
                <thead>
                    <tr><th>الاسم</th><th>الكود</th></tr>
                </thead>
                <tbody>
                    ${unpaidList.map(s => `<tr><td>${s.name}</td><td>${s.code}</td></tr>`).join('')}
                </tbody>
            </table>

            <div style="text-align:center; margin-top:50px;" class="no-print">
                <button onclick="window.print()" style="padding:10px 30px; background:#4f46e5; color:white; border:none; border-radius:5px; cursor:pointer;">طباعة التقرير</button>
            </div>
        </body>
        </html>
    `;

    const win = window.open('', '_blank');
    win.document.write(reportHtml);
    win.document.close();
}
