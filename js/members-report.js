const MEMBERSHIP_REPORT_STATUS_ORDER = ["Active", "Expiring Soon", "Frozen", "Expired"];

const MEMBERSHIP_REPORT_STATUS_TONES = {
    "Active": { fill: [232, 248, 238], text: [28, 128, 67], chart: [85, 200, 120] },
    "Expiring Soon": { fill: [255, 244, 224], text: [161, 100, 8], chart: [245, 185, 66] },
    "Frozen": { fill: [255, 244, 224], text: [161, 100, 8], chart: [245, 185, 66] },
    "Expired": { fill: [253, 232, 237], text: [190, 52, 82], chart: [232, 93, 117] }
};

const MEMBERSHIP_REPORT_TIER_COLORS = [
    [91, 75, 196],
    [139, 123, 240],
    [79, 141, 247],
    [150, 150, 165]
];

function membershipReportData(customRows) {
    const today = todayStart();
    const rows = Array.isArray(customRows) ? customRows : getActiveDirectoryCustomers();

    const counts = {};
    MEMBERSHIP_REPORT_STATUS_ORDER.forEach(status => { counts[status] = 0; });
    rows.forEach(row => {
        const status = getMemberStatus(row, today);
        counts[status] = (counts[status] || 0) + 1;
    });

    const statusItems = MEMBERSHIP_REPORT_STATUS_ORDER.map(status => ({
        label: status,
        value: counts[status] || 0,
        color: MEMBERSHIP_REPORT_STATUS_TONES[status].chart
    }));

    const knownTiers = new Set(PIPELINE_TIERS.map(tier => tier.value));
    const tierItems = PIPELINE_TIERS.map((tier, index) => ({
        label: tier.value,
        value: rows.filter(row => row.tier === tier.value).length,
        price: tier.price,
        color: MEMBERSHIP_REPORT_TIER_COLORS[index % MEMBERSHIP_REPORT_TIER_COLORS.length]
    }));

    const otherTiers = rows.filter(row => !knownTiers.has(row.tier)).length;
    if (otherTiers > 0) {
        tierItems.push({
            label: "Other / Unassigned",
            value: otherTiers,
            price: null,
            color: MEMBERSHIP_REPORT_TIER_COLORS[MEMBERSHIP_REPORT_TIER_COLORS.length - 1]
        });
    }

    return {
        rows,
        today,
        total: rows.length,
        counts,
        statusItems,
        tierItems
    };
}

function membershipReportPercent(value, total) {
    return total ? `${Math.round((value / total) * 100)}%` : "0%";
}

function membershipReportDateLabel(value) {
    const raw = String(value || "").trim();
    if (!raw) return "-";
    const parsed = new Date(/^\d{4}-\d{2}-\d{2}$/.test(raw) ? `${raw}T00:00:00` : raw);
    if (isNaN(parsed.getTime())) return raw;
    return parsed.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function membershipReportDrawHeader(doc, pageWidth, generatedAt) {
    const margin = 14;
    doc.setFillColor(91, 75, 196);
    doc.rect(0, 0, pageWidth, 30, "F");

    reportDrawLogo(doc, margin, 7, 16, [255, 255, 255], [91, 75, 196]);

    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text("Anytime Fitness", margin + 21, 14);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.8);
    doc.setTextColor(214, 210, 245);
    doc.text("Branch CRM Portal", margin + 21, 19.5);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(255, 255, 255);
    doc.text("Customer Directory & Membership Report", pageWidth - margin, 13, { align: "right" });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.3);
    doc.setTextColor(214, 210, 245);
    doc.text(`Generated: ${generatedAt}`, pageWidth - margin, 19, { align: "right" });
}

function membershipReportDrawContinuationHeader(doc, pageWidth, generatedAt) {
    const margin = 14;
    doc.setFillColor(91, 75, 196);
    doc.rect(0, 0, pageWidth, 14, "F");

    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.text("Anytime Fitness \u2013 Customer Directory & Membership Report", margin, 9);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(214, 210, 245);
    doc.text(generatedAt, pageWidth - margin, 9, { align: "right" });
}

function membershipReportDrawChartPanel(doc, x, y, width, height, title, items, total) {
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(232, 232, 242);
    doc.setLineWidth(0.25);
    doc.roundedRect(x, y, width, height, 3, 3, "FD");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.2);
    doc.setTextColor(23, 23, 53);
    doc.text(title, x + 5, y + 6.2);

    if (!total) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.setTextColor(139, 139, 163);
        doc.text("No member records in the directory.", x + width / 2, y + height / 2, { align: "center" });
        return;
    }

    const innerX = x + 5;
    const innerW = width - 10;
    const labelW = 27;
    const valueW = 18;
    const barX = innerX + labelW;
    const barMaxW = Math.max(10, innerW - labelW - valueW - 2);
    const top = y + 13;
    const rowH = (height - 17) / Math.max(1, items.length);
    const max = Math.max(1, ...items.map(item => Number(item.value) || 0));

    items.forEach((item, index) => {
        const value = Number(item.value) || 0;
        const centerY = top + index * rowH + rowH / 2;
        const barH = Math.min(5, Math.max(3.2, rowH * 0.42));
        const barY = centerY - barH / 2;

        doc.setFillColor(item.color[0], item.color[1], item.color[2]);
        doc.roundedRect(innerX, centerY - 1.4, 2.8, 2.8, 0.7, 0.7, "F");

        doc.setFont("helvetica", "normal");
        doc.setFontSize(7.1);
        doc.setTextColor(75, 75, 94);
        doc.text(item.label, innerX + 4.6, centerY + 1.05);

        doc.setFillColor(244, 242, 252);
        doc.roundedRect(barX, barY, barMaxW, barH, barH / 2, barH / 2, "F");

        const barW = value > 0 ? Math.max(1.4, barMaxW * (value / max)) : 0;
        if (barW > 0) {
            doc.setFillColor(item.color[0], item.color[1], item.color[2]);
            doc.roundedRect(barX, barY, barW, barH, barH / 2, barH / 2, "F");
        }

        doc.setFont("helvetica", "bold");
        doc.setFontSize(7);
        doc.setTextColor(23, 23, 53);
        doc.text(`${value} (${membershipReportPercent(value, total)})`, barX + barMaxW + 2, centerY + 1.05);
    });
}

function membershipReportSummaryLines(data) {
    const percent = value => membershipReportPercent(value, data.total);
    const topTier = data.tierItems
        .filter(tier => tier.value > 0)
        .sort((a, b) => b.value - a.value)[0];
    const tierBreakdown = data.tierItems
        .filter(tier => tier.value > 0)
        .map(tier => `${tier.label}: ${tier.value} (${percent(tier.value)})`)
        .join(", ") || "no membership tiers assigned";

    return [
        `Member base: ${reportNumber(data.total)} current member records, ${reportNumber(data.counts.Active)} active (${percent(data.counts.Active)}), ${reportNumber(data.counts.Frozen)} frozen, ${reportNumber(data.counts["Expiring Soon"])} expiring within 30 days and ${reportNumber(data.counts.Expired)} expired.`,
        `Membership tiers: ${tierBreakdown}.${topTier ? ` ${topTier.label} is the most common plan.` : ""}`,
        `Frozen memberships: ${reportNumber(data.counts.Frozen)} member${data.counts.Frozen === 1 ? "" : "s"} currently paused. Freeze end dates are reflected in each member's recorded expiration date, and frozen members are included in the directory below.`
    ];
}

function membershipReportColumns(contentWidth) {
    const specs = [
        { key: "name", label: "Full Name", units: 33 },
        { key: "contact", label: "Contact Info", units: 44 },
        { key: "keyFob", label: "Key Fob", units: 20 },
        { key: "tier", label: "Membership Tier", units: 30 },
        { key: "joined", label: "Date Joined", units: 18 },
        { key: "expiration", label: "Expiration", units: 19 },
        { key: "status", label: "Status", units: 18 }
    ];
    const totalUnits = specs.reduce((sum, spec) => sum + spec.units, 0);
    return specs.map(spec => ({
        key: spec.key,
        label: spec.label,
        width: contentWidth * (spec.units / totalUnits)
    }));
}

function membershipReportDrawTableHeader(doc, margin, y, columns) {
    const height = 8;
    const totalWidth = columns.reduce((sum, column) => sum + column.width, 0);

    doc.setFillColor(244, 242, 252);
    doc.rect(margin, y, totalWidth, height, "F");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.1);
    doc.setTextColor(91, 75, 196);

    let x = margin;
    columns.forEach(column => {
        doc.text(column.label, x + 1.8, y + 5.2);
        x += column.width;
    });

    doc.setDrawColor(223, 218, 243);
    doc.setLineWidth(0.25);
    doc.line(margin, y + height, margin + totalWidth, y + height);

    return height;
}

function membershipReportCellValue(row, key) {
    switch (key) {
        case "name": return row.name || "-";
        case "contact": return row.contact || "-";
        case "keyFob": return row.keyFob || "-";
        case "tier": return row.tier || "-";
        case "joined": return membershipReportDateLabel(row.joined);
        case "expiration": return membershipReportDateLabel(row.updatedExpirationDate || row.exp || "");
        case "status": return getMemberStatus(row);
        default: return "";
    }
}

function membershipReportBuildRow(doc, row, columns) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);

    const cells = columns.map(column => {
        const value = membershipReportCellValue(row, column.key);
        const isStatus = column.key === "status";
        const lines = isStatus ? [value] : doc.splitTextToSize(value, column.width - 3);
        return { column, value, lines, isStatus };
    });

    const maxLines = Math.max(1, ...cells.filter(cell => !cell.isStatus).map(cell => cell.lines.length));
    return { cells, height: Math.max(7, maxLines * 3.2 + 3) };
}

function membershipReportDrawMemberRow(doc, layout, index, x, y, totalWidth) {
    if (index % 2 === 1) {
        doc.setFillColor(250, 249, 254);
        doc.rect(x, y, totalWidth, layout.height, "F");
    }

    doc.setDrawColor(238, 237, 247);
    doc.setLineWidth(0.15);
    doc.line(x, y + layout.height, x + totalWidth, y + layout.height);

    let cursorX = x;
    layout.cells.forEach(cell => {
        if (cell.isStatus) {
            const tone = MEMBERSHIP_REPORT_STATUS_TONES[cell.value] || MEMBERSHIP_REPORT_STATUS_TONES.Active;
            const pillW = Math.min(cell.column.width - 2.4, 17);

            doc.setFillColor(tone.fill[0], tone.fill[1], tone.fill[2]);
            doc.roundedRect(cursorX + 1.2, y + 1.25, pillW, 4.7, 1.2, 1.2, "F");

            doc.setFont("helvetica", "bold");
            doc.setFontSize(6.2);
            doc.setTextColor(tone.text[0], tone.text[1], tone.text[2]);
            doc.text(cell.value, cursorX + 1.2 + pillW / 2, y + 4.45, { align: "center" });
        } else {
            const isName = cell.column.key === "name";
            doc.setFont("helvetica", isName ? "bold" : "normal");
            doc.setFontSize(isName ? 7.1 : 6.9);
            doc.setTextColor(isName ? 23 : 75, isName ? 23 : 75, isName ? 53 : 94);
            cell.lines.forEach((line, lineIndex) => {
                doc.text(line, cursorX + 1.6, y + 4.1 + lineIndex * 3.1);
            });
        }
        cursorX += cell.column.width;
    });
}

function membershipReportDrawFooter(doc, pageWidth, pageHeight) {
    const total = doc.getNumberOfPages();

    for (let page = 1; page <= total; page++) {
        doc.setPage(page);
        doc.setDrawColor(232, 232, 242);
        doc.setLineWidth(0.2);
        doc.line(14, pageHeight - 10, pageWidth - 14, pageHeight - 10);

        doc.setFont("helvetica", "normal");
        doc.setFontSize(7);
        doc.setTextColor(139, 139, 163);
        doc.text("Anytime Fitness \u2013 Customer Directory & Membership Report", 14, pageHeight - 6);
        doc.text(`Page ${page} of ${total}`, pageWidth - 14, pageHeight - 6, { align: "right" });
    }
}

async function exportMembershipReportPdf(button, customRows, customTitle) {
    if (!window.jspdf || !window.jspdf.jsPDF) {
        alert("The PDF library could not be loaded. Check your connection and try again.");
        return;
    }

    const originalLabel = button ? button.innerHTML : "";
    if (button) {
        button.disabled = true;
        button.textContent = "Preparing PDF...";
    }

    try {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait", compress: true });
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const margin = 14;
        const contentWidth = pageWidth - margin * 2;
        const generatedAt = new Date().toLocaleString("en-US", {
            year: "numeric", month: "long", day: "numeric",
            hour: "numeric", minute: "2-digit"
        });

        const data = membershipReportData(customRows);

        membershipReportDrawHeader(doc, pageWidth, generatedAt);

        doc.setFont("helvetica", "bold");
        doc.setFontSize(15.5);
        doc.setTextColor(23, 23, 53);
        const headingText = customTitle ? `Anytime Fitness \u2013 ${customTitle}` : "Anytime Fitness \u2013 Customer Directory & Membership Report";
        doc.text(headingText, margin, 41);

        doc.setFont("helvetica", "normal");
        doc.setFontSize(8.3);
        doc.setTextColor(95, 95, 116);
        doc.text(`Generated on ${generatedAt}`, margin, 47);
        const subText = customRows ? `Export of ${data.total} selected member record${data.total === 1 ? "" : "s"}` : "Membership status, tier distribution and complete member directory";
        doc.text(subText, margin, 52);

        let y = 60;
        const gap = 3;
        const cardWidth = (contentWidth - gap * 4) / 5;
        const kpiCards = [
            ["Total Members", data.total, [91, 75, 196]],
            ["Active Members", data.counts.Active, [85, 200, 120]],
            ["Frozen Members", data.counts.Frozen, [245, 185, 66]],
            ["Expiring Soon", data.counts["Expiring Soon"], [245, 185, 66]],
            ["Expired Members", data.counts.Expired, [232, 93, 117]]
        ];
        kpiCards.forEach((card, index) => {
            reportDrawKpiCard(doc, margin + index * (cardWidth + gap), y, cardWidth, 24, card[0], card[1], card[2]);
        });

        const ensureSpace = needed => {
            if (y + needed > pageHeight - 16) {
                doc.addPage();
                membershipReportDrawContinuationHeader(doc, pageWidth, generatedAt);
                y = 22;
            }
        };

        y = 92;
        ensureSpace(70);
        y = reportDrawSectionTitle(doc, "Membership Overview", y, margin);
        const panelWidth = (contentWidth - 5) / 2;
        membershipReportDrawChartPanel(doc, margin, y, panelWidth, 61, "Membership Status Distribution", data.statusItems, data.total);
        membershipReportDrawChartPanel(doc, margin + panelWidth + 5, y, panelWidth, 61, "Membership Tier Distribution", data.tierItems, data.total);
        y += 71;

        ensureSpace(48);
        y = reportDrawSectionTitle(doc, "Membership Statistics Summary", y, margin);
        const summaryHeight = reportDrawSummary(doc, membershipReportSummaryLines(data), margin, y, contentWidth);
        y += summaryHeight + 8;

        if (data.rows.length > 0) {
            doc.addPage();
            membershipReportDrawContinuationHeader(doc, pageWidth, generatedAt);
            y = 22;
        } else {
            ensureSpace(32);
        }

        y = reportDrawSectionTitle(doc, "Member Directory", y, margin);
        const columns = membershipReportColumns(contentWidth);

        if (data.rows.length === 0) {
            doc.setFont("helvetica", "normal");
            doc.setFontSize(8.5);
            doc.setTextColor(139, 139, 163);
            doc.text("No member records in the directory.", margin, y + 8);
        } else {
            y += membershipReportDrawTableHeader(doc, margin, y, columns);

            data.rows.forEach((row, index) => {
                const layout = membershipReportBuildRow(doc, row, columns);

                if (y + layout.height > pageHeight - 16) {
                    doc.addPage();
                    membershipReportDrawContinuationHeader(doc, pageWidth, generatedAt);
                    y = 22;
                    y += membershipReportDrawTableHeader(doc, margin, y, columns);
                }

                membershipReportDrawMemberRow(doc, layout, index, margin, y, contentWidth);
                y += layout.height;
            });
        }

        membershipReportDrawFooter(doc, pageWidth, pageHeight);

        const stamp = new Date().toISOString().slice(0, 10);
        const fileName = customRows ? `Anytime-Fitness-Selected-Members-${stamp}.pdf` : `Anytime-Fitness-Membership-Report-${stamp}.pdf`;
        doc.save(fileName);
    } catch (error) {
        console.error("Membership PDF export failed:", error);
        alert("The membership report could not be generated. Please try again.");
    } finally {
        if (button) {
            button.disabled = false;
            button.innerHTML = originalLabel;
        }
    }
}
window.exportMembershipReportPdf = exportMembershipReportPdf;

document.addEventListener("DOMContentLoaded", () => {
    const button = document.getElementById("exportMembersPdfBtn");
    if (!button) return;

    button.addEventListener("click", () => {
        if (button.disabled) return;
        exportMembershipReportPdf(button);
    });
});
