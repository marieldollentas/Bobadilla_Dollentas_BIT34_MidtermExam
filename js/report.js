const REPORT_CHART_STYLE = `
    svg { font-family: Helvetica, Arial, sans-serif; }
    .chart-label { font-family: Helvetica, Arial, sans-serif; font-size: 9px; fill: #8b8ba3; }
    .chart-label-strong { font-size: 10.5px; font-weight: 600; fill: #171735; }
    .chart-value { font-size: 11px; font-weight: 700; fill: #5b4bc4; }
    .chart-value-lg { font-size: 21px; letter-spacing: -.5px; }
    .chart-value-sm { font-size: 9.5px; }
    .chart-caption { font-size: 8.5px; font-weight: 600; letter-spacing: .6px; fill: #a3a1b8; }
    .chart-share { font-size: 10px; font-weight: 600; fill: #5f5f74; }
    .chart-inbar { font-size: 10px; font-weight: 700; fill: #ffffff; }
    .chart-track { fill: #f4f2fc; }
    .chart-track-ring { fill: none; stroke: #f2effb; }
    .chart-dot { stroke: #ffffff; stroke-width: 1.8; }
    .chart-line { fill: none; stroke-linecap: round; stroke-linejoin: round; stroke-width: 2.2; }
    .chart-grid { stroke: #f1eefa; }
    .chart-axis { stroke: #dfdaf3; }
    line { stroke: #eeedf7; }
    rect { rx: 5; }
`;

function reportNumber(value) {
    return (Number(value) || 0).toLocaleString("en-US");
}

function reportMoney(value) {
    return `PHP ${reportNumber(value)}`;
}

function reportDashboardData() {
    const today = todayStart();
    const rows = getActiveDirectoryCustomers();
    const countStatus = status => rows.filter(row => getMemberStatus(row, today) === status).length;
    const expiring = rows.filter(row => customerStatus(row.exp, today) === "Expiring Soon").length;

    const tickets = allTickets().filter(ticket => !ticket.archived);
    const openTickets = tickets.filter(ticket => {
        const status = String(ticket.status || "").toLowerCase();
        return status === "open" || status === "in progress";
    }).length;

    const leads = getPipelineLeads().filter(lead => !lead.archived);
    const won = leads.filter(lead => lead.stage === "won").length;
    const lost = leads.filter(lead => lead.stage === "lost").length;
    const openLeads = leads.filter(lead => lead.stage !== "won" && lead.stage !== "lost").length;
    const pipelineValue = leads
        .filter(lead => lead.stage !== "lost")
        .reduce((sum, lead) => sum + (Number(lead.monthlyValue) || 0), 0);
    const closed = won + lost;
    const conversion = closed ? Math.round((won / closed) * 1000) / 10 : 0;

    return {
        total: rows.length,
        active: countStatus("Active"),
        frozen: countStatus("Frozen"),
        expiring,
        expired: countStatus("Expired"),
        openTickets,
        totalTickets: tickets.length,
        totalLeads: leads.length,
        won,
        lost,
        openLeads,
        pipelineValue,
        conversion
    };
}

function reportReadStat(id, fallback) {
    const el = document.getElementById(id);
    const value = el ? String(el.textContent || "").trim() : "";
    return value || reportNumber(fallback);
}

function reportCaptureChart(containerId) {
    const container = document.getElementById(containerId);
    const svg = container ? container.querySelector("svg") : null;
    if (!svg) return Promise.resolve(null);

    const clone = svg.cloneNode(true);
    clone.setAttribute("xmlns", SVG_NS);
    clone.setAttribute("width", "100%");
    clone.setAttribute("height", "100%");

    const box = (clone.getAttribute("viewBox") || `0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`)
        .trim().split(/\s+/).map(Number);
    const width = box[2] || CHART_WIDTH;
    const height = box[3] || CHART_HEIGHT;

    const style = document.createElementNS(SVG_NS, "style");
    style.textContent = REPORT_CHART_STYLE;
    clone.insertBefore(style, clone.firstChild);

    const xml = new XMLSerializer().serializeToString(clone);
    const src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(xml)}`;

    return new Promise(resolve => {
        const image = new Image();
        image.onload = () => {
            const canvas = document.createElement("canvas");
            const scale = 2;
            canvas.width = Math.max(1, Math.round(width * scale));
            canvas.height = Math.max(1, Math.round(height * scale));
            const ctx = canvas.getContext("2d");
            ctx.fillStyle = "#ffffff";
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
            resolve({ dataUrl: canvas.toDataURL("image/png"), width, height });
        };
        image.onerror = () => resolve(null);
        image.src = src;
    });
}

function reportCaptureCharts() {
    return Promise.all([
        reportCaptureChart("chartMembersStatus"),
        reportCaptureChart("chartMembersTier"),
        reportCaptureChart("chartTicketVolume"),
        reportCaptureChart("chartTicketPriority"),
        reportCaptureChart("chartPipelineStages")
    ]).then(([membersStatus, membersTier, ticketVolume, ticketPriority, pipeline]) => ({
        membersStatus, membersTier, ticketVolume, ticketPriority, pipeline
    }));
}

function reportDrawLogo(doc, x, y, size, background, foreground) {
    doc.setFillColor(background[0], background[1], background[2]);
    doc.roundedRect(x, y, size, size, size * 0.26, size * 0.26, "F");

    const scale = size / 24;
    const px = value => x + value * scale;
    const py = value => y + value * scale;

    doc.setDrawColor(foreground[0], foreground[1], foreground[2]);
    doc.setLineWidth(size * 0.075);
    doc.setLineCap("round");
    doc.line(px(4), py(9), px(4), py(15));
    doc.line(px(20), py(9), px(20), py(15));
    doc.line(px(7), py(6.5), px(7), py(17.5));
    doc.line(px(17), py(6.5), px(17), py(17.5));
    doc.line(px(7), py(12), px(17), py(12));
}

function reportDrawHeader(doc, pageWidth, generatedAt) {
    const margin = 14;
    doc.setFillColor(91, 75, 196);
    doc.rect(0, 0, pageWidth, 27, "F");

    reportDrawLogo(doc, margin, 6.5, 14, [255, 255, 255], [91, 75, 196]);

    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.text("Anytime Fitness", margin + 18, 12.5);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(214, 210, 245);
    doc.text("Branch CRM Portal", margin + 18, 17.5);

    doc.setFontSize(7.5);
    doc.setTextColor(255, 255, 255);
    doc.text(`Generated: ${generatedAt}`, pageWidth - margin, 12.5, { align: "right" });
    doc.setTextColor(214, 210, 245);
    doc.text("Dashboard Report", pageWidth - margin, 17.5, { align: "right" });
}

function reportDrawContinuationHeader(doc, pageWidth, generatedAt) {
    const margin = 14;
    doc.setFillColor(91, 75, 196);
    doc.rect(0, 0, pageWidth, 14, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.text("Anytime Fitness \u2013 Branch CRM Dashboard Report", margin, 9);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(214, 210, 245);
    doc.text(generatedAt, pageWidth - margin, 9, { align: "right" });
}

function reportDrawKpiCard(doc, x, y, width, height, label, value, color) {
    doc.setFillColor(248, 247, 253);
    doc.setDrawColor(232, 232, 242);
    doc.setLineWidth(0.2);
    doc.roundedRect(x, y, width, height, 2.6, 2.6, "FD");

    doc.setFillColor(color[0], color[1], color[2]);
    doc.roundedRect(x + 3, y + 3.4, 1.6, height - 6.8, 0.8, 0.8, "F");

    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.8);
    doc.setTextColor(111, 111, 130);
    const lines = doc.splitTextToSize(label, width - 11).slice(0, 2);
    doc.text(lines, x + 6.5, y + 6.2);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(15);
    doc.setTextColor(color[0], color[1], color[2]);
    doc.text(String(value), x + 6.5, y + height - 5.2);
}

function reportDrawSectionTitle(doc, text, y, margin) {
    doc.setFillColor(91, 75, 196);
    doc.roundedRect(margin, y, 2.2, 6, 1.1, 1.1, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(23, 23, 53);
    doc.text(text, margin + 5, y + 4.7);
    return y + 9;
}

function reportDrawChartPanel(doc, x, y, width, height, title, image) {
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(232, 232, 242);
    doc.setLineWidth(0.25);
    doc.roundedRect(x, y, width, height, 3, 3, "FD");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.2);
    doc.setTextColor(23, 23, 53);
    doc.text(title, x + 5, y + 6.2);

    const innerX = x + 4;
    const innerY = y + 9.2;
    const innerW = width - 8;
    const innerH = height - 13.2;

    if (image && image.dataUrl) {
        const scale = Math.min(innerW / image.width, innerH / image.height);
        const drawW = image.width * scale;
        const drawH = image.height * scale;
        doc.addImage(
            image.dataUrl, "PNG",
            innerX + (innerW - drawW) / 2,
            innerY + (innerH - drawH) / 2,
            drawW, drawH, undefined, "FAST"
        );
    } else {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.setTextColor(139, 139, 163);
        doc.text("No chart data available.", x + width / 2, y + height / 2, { align: "center" });
    }
}

function reportDrawMiniStat(doc, x, y, width, height, label, value) {
    doc.setFillColor(248, 247, 253);
    doc.setDrawColor(232, 232, 242);
    doc.setLineWidth(0.2);
    doc.roundedRect(x, y, width, height, 2.4, 2.4, "FD");

    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.5);
    doc.setTextColor(111, 111, 130);
    doc.text(label, x + 4, y + 5.6);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(11.5);
    doc.setTextColor(23, 23, 53);
    doc.text(String(value), x + 4, y + height - 4.6);
}

function reportSummaryLines(data, kpis) {
    const total = Number(kpis.total) || data.total;
    const active = Number(kpis.active) || data.active;
    const frozen = Number(kpis.frozen) || data.frozen;
    const expiring = Number(kpis.expiring) || data.expiring;
    const open = Number(kpis.open) || data.openTickets;
    const activeShare = total ? Math.round((active / total) * 100) : 0;

    return [
        `Member base: ${reportNumber(total)} records on file, ${reportNumber(active)} active (${activeShare}%), ${reportNumber(frozen)} frozen, ${reportNumber(expiring)} expiring within 30 days and ${reportNumber(data.expired)} already expired.`,
        `Front desk: ${reportNumber(open)} open or in-progress tickets, with ${reportNumber(data.totalTickets)} tickets logged in total.`,
        `Sales pipeline: ${reportNumber(data.totalLeads)} leads across all stages, ${reportNumber(data.won)} converted to membership and ${reportNumber(data.lost)} closed or lost (${data.conversion}% conversion). Open pipeline value is ${reportMoney(data.pipelineValue)} per month.`
    ];
}

function reportDrawSummary(doc, lines, x, y, width) {
    const padding = 6;
    const lineHeight = 4.3;
    const wrapped = lines.map(line => doc.splitTextToSize(line, width - padding * 2));
    const height = wrapped.reduce((sum, block) => sum + block.length * lineHeight, 0) + padding * 2 + 2;

    doc.setFillColor(248, 247, 253);
    doc.setDrawColor(232, 232, 242);
    doc.setLineWidth(0.25);
    doc.roundedRect(x, y, width, height, 3, 3, "FD");

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.3);
    doc.setTextColor(95, 95, 116);

    let cursor = y + padding + 2.5;
    wrapped.forEach(block => {
        doc.text(block, x + padding, cursor);
        cursor += block.length * lineHeight;
    });

    return height;
}

function reportDrawFooter(doc, pageWidth, pageHeight) {
    const total = doc.getNumberOfPages();
    for (let page = 1; page <= total; page++) {
        doc.setPage(page);
        doc.setDrawColor(232, 232, 242);
        doc.setLineWidth(0.2);
        doc.line(14, pageHeight - 10, pageWidth - 14, pageHeight - 10);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7);
        doc.setTextColor(139, 139, 163);
        doc.text("Anytime Fitness \u2013 Branch CRM Dashboard Report", 14, pageHeight - 6);
        doc.text(`Page ${page} of ${total}`, pageWidth - 14, pageHeight - 6, { align: "right" });
    }
}

async function exportDashboardReportPdf(button) {
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
        const gap = 3;
        const generatedAt = new Date().toLocaleString("en-US", {
            year: "numeric", month: "long", day: "numeric",
            hour: "numeric", minute: "2-digit"
        });

        const data = reportDashboardData();
        const kpis = {
            total: reportReadStat("statTotal", data.total),
            active: reportReadStat("statActive", data.active),
            frozen: reportReadStat("statFrozen", data.frozen),
            expiring: reportReadStat("statExpiring", data.expiring),
            open: reportReadStat("statOpenTickets", data.openTickets)
        };
        const charts = await reportCaptureCharts();

        reportDrawHeader(doc, pageWidth, generatedAt);

        doc.setFont("helvetica", "bold");
        doc.setFontSize(17);
        doc.setTextColor(23, 23, 53);
        doc.text("Anytime Fitness \u2013 Branch CRM Dashboard Report", margin, 39);

        doc.setFont("helvetica", "normal");
        doc.setFontSize(8.5);
        doc.setTextColor(95, 95, 116);
        doc.text("Membership health, front desk workload and sales pipeline", margin, 45);

        let y = 53;
        const cardWidth = (contentWidth - gap * 4) / 5;
        const kpiCards = [
            ["Total Members", kpis.total, [91, 75, 196]],
            ["Active Members", kpis.active, [85, 200, 120]],
            ["Frozen Members", kpis.frozen, [245, 185, 66]],
            ["Expiring Memberships", kpis.expiring, [245, 185, 66]],
            ["Open Inquiries / Tickets", kpis.open, [232, 93, 117]]
        ];
        kpiCards.forEach((card, index) => {
            reportDrawKpiCard(doc, margin + index * (cardWidth + gap), y, cardWidth, 24, card[0], card[1], card[2]);
        });

        const ensureSpace = needed => {
            if (y + needed > pageHeight - 16) {
                doc.addPage();
                reportDrawContinuationHeader(doc, pageWidth, generatedAt);
                y = 22;
            }
        };

        y = 86;
        ensureSpace(70);
        y = reportDrawSectionTitle(doc, "Membership Overview", y, margin);
        const panelWidth = (contentWidth - 5) / 2;
        reportDrawChartPanel(doc, margin, y, panelWidth, 61, "Members by Status", charts.membersStatus);
        reportDrawChartPanel(doc, margin + panelWidth + 5, y, panelWidth, 61, "Members by Membership Tier", charts.membersTier);
        y += 71;

        ensureSpace(70);
        y = reportDrawSectionTitle(doc, "Support & Ticket Load", y, margin);
        reportDrawChartPanel(doc, margin, y, panelWidth, 61, "Tickets Logged per Month", charts.ticketVolume);
        reportDrawChartPanel(doc, margin + panelWidth + 5, y, panelWidth, 61, "Tickets by Priority", charts.ticketPriority);
        y += 71;

        ensureSpace(73);
        y = reportDrawSectionTitle(doc, "Sales Pipeline", y, margin);
        reportDrawChartPanel(doc, margin, y, contentWidth, 64, "Pipeline Leads by Stage", charts.pipeline);
        y += 70;

        ensureSpace(23);
        const leadCards = [
            ["Total Leads", reportNumber(data.totalLeads)],
            ["Open Leads", reportNumber(data.openLeads)],
            ["Members Won", reportNumber(data.won)],
            ["Closed / Lost", reportNumber(data.lost)],
            ["Conversion", `${data.conversion}%`],
            ["Monthly Value", reportMoney(data.pipelineValue)]
        ];
        const leadCardWidth = (contentWidth - gap * 3) / 4;
        leadCards.forEach((card, index) => {
            const col = index % 4;
            const row = Math.floor(index / 4);
            reportDrawMiniStat(doc, margin + col * (leadCardWidth + gap), y + row * 22, leadCardWidth, 19, card[0], card[1]);
        });
        y += leadCards.length > 4 ? 47 : 25;

        ensureSpace(35);
        y = reportDrawSectionTitle(doc, "Data Summary", y, margin);
        const summaryHeight = reportDrawSummary(doc, reportSummaryLines(data, kpis), margin, y, contentWidth);
        y += summaryHeight + 6;

        reportDrawFooter(doc, pageWidth, pageHeight);

        const stamp = new Date().toISOString().slice(0, 10);
        doc.save(`Anytime-Fitness-Dashboard-Report-${stamp}.pdf`);
    } catch (error) {
        console.error("Dashboard PDF export failed:", error);
        alert("The dashboard report could not be generated. Please try again.");
    } finally {
        if (button) {
            button.disabled = false;
            button.innerHTML = originalLabel;
        }
    }
}

document.addEventListener("DOMContentLoaded", () => {
    const button = document.getElementById("exportPdfBtn");
    if (!button) return;

    button.addEventListener("click", () => {
        if (button.disabled) return;
        exportDashboardReportPdf(button);
    });
});
