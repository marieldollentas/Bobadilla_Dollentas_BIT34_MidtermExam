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

function exportDashboardReportCsv() {
    const today = typeof todayStart === "function" ? todayStart() : new Date();
    const data = typeof reportDashboardData === "function" ? reportDashboardData() : {};

    const kpis = {
        total: reportReadStat("statTotal", data.total || 0),
        active: reportReadStat("statActive", data.active || 0),
        frozen: reportReadStat("statFrozen", data.frozen || 0),
        expiring: reportReadStat("statExpiring", data.expiring || 0),
        open: reportReadStat("statOpenTickets", data.openTickets || 0)
    };

    const now = new Date();
    const dateStr = now.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
    const timeStr = now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    const generatedAt = `${dateStr} at ${timeStr}`;

    const escapeCsv = val => {
        const str = String(val === null || val === undefined ? "" : val);
        if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
            return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
    };

    const formatCurrency = val => `PHP ${(Number(val) || 0).toLocaleString("en-US")}`;

    const dividerDouble = "====================================================================================================";
    const dividerSingle = "----------------------------------------------------------------------------------------------------";

    // Document Header & Executive Top-Level KPIs
    const reportHeaders = [
        escapeCsv("ANYTIME FITNESS — EXECUTIVE BRANCH DASHBOARD REPORT"),
        escapeCsv("Branch CRM Portal | Operations, Membership & Sales Intelligence"),
        escapeCsv(dividerDouble),
        [escapeCsv("Report Generated:"), escapeCsv(generatedAt), escapeCsv("Branch:"), escapeCsv("Anytime Fitness Central"), escapeCsv("Scope:"), escapeCsv("Complete Branch Overview"), escapeCsv("Format:"), escapeCsv("CSV Spreadsheet")].join(","),
        escapeCsv(dividerSingle),
        escapeCsv("EXECUTIVE TOP-LEVEL KPIS:"),
        [escapeCsv("Metric"), escapeCsv("Count / Value"), escapeCsv("Status / Operational Note")].join(","),
        [escapeCsv("Total Registered Members"), escapeCsv(kpis.total), escapeCsv("Complete customer directory on file")].join(","),
        [escapeCsv("Active Members"), escapeCsv(kpis.active), escapeCsv("Members in good standing")].join(","),
        [escapeCsv("Frozen Members"), escapeCsv(kpis.frozen), escapeCsv("Memberships temporarily paused")].join(","),
        [escapeCsv("Expiring Memberships"), escapeCsv(kpis.expiring), escapeCsv("Renewals due within 30 days")].join(","),
        [escapeCsv("Expired Memberships"), escapeCsv(data.expired || 0), escapeCsv("Lapsed memberships awaiting renewal")].join(","),
        [escapeCsv("Open Inquiries / Support Tickets"), escapeCsv(kpis.open), escapeCsv("Walk-in tickets and inquiries in queue")].join(","),
        [escapeCsv("Total Support Tickets Logged"), escapeCsv(data.totalTickets || 0), escapeCsv("All-time support tickets across branch")].join(","),
        [escapeCsv("Total Sales Pipeline Leads"), escapeCsv(data.totalLeads || 0), escapeCsv("Prospecting records in sales funnel")].join(","),
        [escapeCsv("Members Won (Converted)"), escapeCsv(data.won || 0), escapeCsv("Leads converted to full membership")].join(","),
        [escapeCsv("Closed / Lost Leads"), escapeCsv(data.lost || 0), escapeCsv("Prospects closed without conversion")].join(","),
        [escapeCsv("Active Open Pipeline Leads"), escapeCsv(data.openLeads || 0), escapeCsv("In-progress prospecting leads")].join(","),
        [escapeCsv("Lead Conversion Rate"), escapeCsv(`${data.conversion || 0}%`), escapeCsv("Won / Closed conversion percentage")].join(","),
        [escapeCsv("Open Pipeline Monthly Value"), escapeCsv(formatCurrency(data.pipelineValue || 0)), escapeCsv("Estimated recurring monthly value")].join(","),
        escapeCsv(dividerDouble),
        ""
    ];

    // Section 1: Membership Status & Tier Distribution
    const memberTotalNum = Number(kpis.total) || data.total || 0;
    const members = typeof memberChartData === "function" ? memberChartData() : { byStatus: [], byTier: [] };

    const statusCounts = {
        "Active": Number(kpis.active) || data.active || 0,
        "Frozen": Number(kpis.frozen) || data.frozen || 0,
        "Expiring Soon": Number(kpis.expiring) || data.expiring || 0,
        "Expired": Number(data.expired) || 0
    };

    const membershipStatusRows = [
        escapeCsv("--- SECTION 1: MEMBERSHIP STATUS & PLAN DISTRIBUTION ---"),
        escapeCsv("Membership Status Breakdown:"),
        [escapeCsv("Status Category"), escapeCsv("Member Count"), escapeCsv("Share of Total"), escapeCsv("Operational Status")].join(",")
    ];

    Object.keys(statusCounts).forEach(statusKey => {
        const count = statusCounts[statusKey];
        const pct = memberTotalNum ? `${Math.round((count / memberTotalNum) * 100)}%` : "0%";
        const note = statusKey === "Active" ? "Good Standing"
            : statusKey === "Frozen" ? "Paused Membership"
            : statusKey === "Expiring Soon" ? "Renewal Due (Next 30 Days)"
            : "Lapsed / Follow-up";
        membershipStatusRows.push([
            escapeCsv(statusKey),
            escapeCsv(count),
            escapeCsv(pct),
            escapeCsv(note)
        ].join(","));
    });

    membershipStatusRows.push("");
    membershipStatusRows.push(escapeCsv("Membership Tier Distribution:"));
    membershipStatusRows.push([escapeCsv("Tier Plan Name"), escapeCsv("Commitment Term"), escapeCsv("Monthly Rate"), escapeCsv("Member Count"), escapeCsv("Share of Total"), escapeCsv("Est. Monthly Revenue")].join(","));

    const tierRates = {
        "6-Month Membership": { rate: 2500, term: "6 Months" },
        "12-Month Membership": { rate: 2200, term: "12 Months" },
        "18-Month Membership": { rate: 1950, term: "18 Months" }
    };

    if (Array.isArray(members.byTier) && members.byTier.length > 0) {
        members.byTier.forEach(item => {
            const meta = tierRates[item.label] || { rate: 0, term: "Standard" };
            const pct = memberTotalNum ? `${Math.round((item.value / memberTotalNum) * 100)}%` : "0%";
            const revenue = meta.rate ? formatCurrency(item.value * meta.rate) : "—";
            const rateStr = meta.rate ? formatCurrency(meta.rate) : (item.note || "—");
            membershipStatusRows.push([
                escapeCsv(item.label),
                escapeCsv(meta.term),
                escapeCsv(rateStr),
                escapeCsv(item.value),
                escapeCsv(pct),
                escapeCsv(revenue)
            ].join(","));
        });
    } else {
        membershipStatusRows.push([escapeCsv("No membership tiers recorded"), "—", "—", "0", "0%", "—"].join(","));
    }
    membershipStatusRows.push(escapeCsv(dividerSingle));
    membershipStatusRows.push("");

    // Section 2: Support & Helpdesk Tickets
    const ticketsData = typeof ticketChartData === "function" ? ticketChartData(6) : { byPriority: [], byMonth: [] };
    const ticketTotalNum = data.totalTickets || 0;

    const ticketSectionRows = [
        escapeCsv("--- SECTION 2: FRONT DESK & SUPPORT TICKET ANALYTICS ---"),
        escapeCsv("Support Tickets by Priority:"),
        [escapeCsv("Priority Level"), escapeCsv("Ticket Count"), escapeCsv("Share of Total"), escapeCsv("Urgency Standard")].join(",")
    ];

    if (Array.isArray(ticketsData.byPriority) && ticketsData.byPriority.length > 0) {
        ticketsData.byPriority.forEach(item => {
            const pct = ticketTotalNum ? `${Math.round((item.value / ticketTotalNum) * 100)}%` : "0%";
            const urgency = item.label === "High" ? "High Priority (< 12 hrs)"
                : item.label === "Medium" ? "Standard Queue (< 24 hrs)"
                : item.label === "Low" ? "Low Priority (< 48 hrs)"
                : "General Attention";
            ticketSectionRows.push([
                escapeCsv(item.label),
                escapeCsv(item.value),
                escapeCsv(pct),
                escapeCsv(urgency)
            ].join(","));
        });
    } else {
        ticketSectionRows.push([escapeCsv("No tickets on file"), "0", "0%", "—"].join(","));
    }

    ticketSectionRows.push("");
    ticketSectionRows.push(escapeCsv("Ticket Inflow Volume (Last 6 Months):"));
    ticketSectionRows.push([escapeCsv("Period"), escapeCsv("Month"), escapeCsv("Tickets Logged")].join(","));

    if (Array.isArray(ticketsData.byMonth) && ticketsData.byMonth.length > 0) {
        ticketsData.byMonth.forEach(item => {
            ticketSectionRows.push([
                escapeCsv(item.key || "—"),
                escapeCsv(item.label || item.key || "—"),
                escapeCsv(item.value || 0)
            ].join(","));
        });
    } else {
        ticketSectionRows.push([escapeCsv("—"), escapeCsv("No recent ticket trends"), "0"].join(","));
    }
    ticketSectionRows.push(escapeCsv(dividerSingle));
    ticketSectionRows.push("");

    // Section 3: Sales Pipeline Performance
    const pipelineData = typeof pipelineChartData === "function" ? pipelineChartData() : [];
    const pipelineSectionRows = [
        escapeCsv("--- SECTION 3: SALES PIPELINE & PROSPECTING INTELLIGENCE ---"),
        escapeCsv("Pipeline Leads by Stage:"),
        [escapeCsv("Stage Name"), escapeCsv("Lead Count"), escapeCsv("Est. Monthly Value"), escapeCsv("Stage Classification")].join(",")
    ];

    if (Array.isArray(pipelineData) && pipelineData.length > 0) {
        pipelineData.forEach(item => {
            const classification = item.label.includes("Won") ? "Outcome (Converted)"
                : item.label.includes("Lost") ? "Outcome (Closed)"
                : "Active Funnel Stage";
            pipelineSectionRows.push([
                escapeCsv(item.label),
                escapeCsv(item.value || 0),
                escapeCsv(item.note && item.note !== "—" ? item.note : "—"),
                escapeCsv(classification)
            ].join(","));
        });
    } else {
        pipelineSectionRows.push([escapeCsv("No pipeline data available"), "0", "—", "—"].join(","));
    }
    pipelineSectionRows.push(escapeCsv(dividerSingle));
    pipelineSectionRows.push("");

    // Section 4: Branch Operations (Marketing Campaigns & Coaching)
    const campaigns = typeof getCampaigns === "function" ? getCampaigns() : [];
    const scheduledCount = campaigns.filter(c => c.status === "Scheduled").length;
    const runningCount = campaigns.filter(c => c.status === "Running").length;
    const completedCount = campaigns.filter(c => c.status === "Completed").length;

    const coaches = typeof getCoaches === "function" ? getCoaches() : [];
    const activeCoaches = coaches.filter(c => !c.archived);
    const availableCoaches = activeCoaches.filter(c => c.status === "Available");

    const sessions = typeof getCoachSessions === "function" ? getCoachSessions() : [];
    const todayStr = (typeof dateToIso === "function" ? dateToIso(today) : new Date().toISOString().split("T")[0]);
    const sessionsToday = sessions.filter(s => s.date === todayStr && !s.archived).length;

    const operationsRows = [
        escapeCsv("--- SECTION 4: BRANCH OPERATIONS (MARKETING CAMPAIGNS & COACHING) ---"),
        escapeCsv("Social Media Marketing Campaigns Summary:"),
        [escapeCsv("Scheduled Campaigns"), escapeCsv("Running Now"), escapeCsv("Completed"), escapeCsv("Total Campaigns")].join(","),
        [escapeCsv(scheduledCount), escapeCsv(runningCount), escapeCsv(completedCount), escapeCsv(campaigns.length)].join(","),
        ""
    ];

    if (campaigns.length > 0) {
        operationsRows.push(escapeCsv("Marketing Campaign Details:"));
        operationsRows.push([escapeCsv("#"), escapeCsv("Campaign Title"), escapeCsv("Platform"), escapeCsv("Status"), escapeCsv("Post Link")].join(","));
        campaigns.forEach((c, idx) => {
            operationsRows.push([
                escapeCsv(idx + 1),
                escapeCsv(c.title || "—"),
                escapeCsv(c.platform || "—"),
                escapeCsv(c.status || "—"),
                escapeCsv(c.postUrl || c.url || "—")
            ].join(","));
        });
        operationsRows.push("");
    }

    operationsRows.push(escapeCsv("Coaching Staff & Availability Overview:"));
    operationsRows.push([escapeCsv("Total Coaches"), escapeCsv("Active Coaches"), escapeCsv("Available Now"), escapeCsv("Sessions Today")].join(","));
    operationsRows.push([escapeCsv(coaches.length), escapeCsv(activeCoaches.length), escapeCsv(availableCoaches.length), escapeCsv(sessionsToday)].join(","));
    operationsRows.push(escapeCsv(dividerDouble));
    operationsRows.push("");

    // Report Footer
    const reportFooter = [
        escapeCsv("--- END OF EXECUTIVE DASHBOARD REPORT ---"),
        [escapeCsv("Report Classification:"), escapeCsv("Official Anytime Fitness Executive Dashboard Analytics")].join(","),
        [escapeCsv("Export Timestamp (ISO):"), escapeCsv(now.toISOString())].join(","),
        [escapeCsv("Branch:"), escapeCsv("Anytime Fitness Central | CRM Front Desk Portal")].join(","),
        [escapeCsv("Confidentiality Notice:"), escapeCsv("This document contains proprietary branch operations, revenue estimates, and CRM records. Unauthorized duplication or distribution is prohibited.")].join(","),
        escapeCsv(dividerDouble)
    ];

    const fullContent = [
        ...reportHeaders,
        ...membershipStatusRows,
        ...ticketSectionRows,
        ...pipelineSectionRows,
        ...operationsRows,
        ...reportFooter
    ].join("\r\n");

    const csvContent = "\uFEFF" + fullContent;
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const stamp = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `Anytime-Fitness-Dashboard-Report-${stamp}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function initDashboardExportDropdown() {
    const csvBtn = document.getElementById("exportDashboardCsvBtn");
    const pdfBtn = document.getElementById("exportDashboardPdfBtn") || document.getElementById("exportPdfBtn");
    const dropdownBtn = document.getElementById("exportDropdownBtn");
    const dropdownMenu = document.getElementById("headerExportMenu");

    // Only run if on a page where dashboard export buttons are present
    if (!csvBtn && !pdfBtn) return;

    if (dropdownBtn && dropdownMenu && !dropdownBtn.dataset.boundDropdown) {
        dropdownBtn.dataset.boundDropdown = "1";
        dropdownBtn.addEventListener("click", e => {
            e.stopPropagation();
            const isHidden = dropdownMenu.hidden;
            dropdownMenu.hidden = !isHidden;
            dropdownBtn.setAttribute("aria-expanded", String(isHidden));
        });

        document.addEventListener("click", e => {
            if (!dropdownMenu.contains(e.target) && !dropdownBtn.contains(e.target)) {
                dropdownMenu.hidden = true;
                dropdownBtn.setAttribute("aria-expanded", "false");
            }
        });

        document.addEventListener("keydown", e => {
            if (e.key === "Escape" && !dropdownMenu.hidden) {
                dropdownMenu.hidden = true;
                dropdownBtn.setAttribute("aria-expanded", "false");
                dropdownBtn.focus();
            }
        });
    }

    if (csvBtn && !csvBtn.dataset.boundExport) {
        csvBtn.dataset.boundExport = "1";
        csvBtn.addEventListener("click", () => {
            if (dropdownMenu) dropdownMenu.hidden = true;
            if (dropdownBtn) dropdownBtn.setAttribute("aria-expanded", "false");
            if (csvBtn.disabled || (dropdownBtn && dropdownBtn.disabled)) return;
            exportDashboardReportCsv();
        });
    }

    if (pdfBtn && !pdfBtn.dataset.boundExport) {
        pdfBtn.dataset.boundExport = "1";
        pdfBtn.addEventListener("click", () => {
            if (dropdownMenu) dropdownMenu.hidden = true;
            if (dropdownBtn) dropdownBtn.setAttribute("aria-expanded", "false");
            if (pdfBtn.disabled || (dropdownBtn && dropdownBtn.disabled)) return;
            exportDashboardReportPdf(dropdownBtn || pdfBtn);
        });
    }
}
window.initDashboardExportDropdown = initDashboardExportDropdown;
window.exportDashboardReportCsv = exportDashboardReportCsv;
window.exportDashboardReportPdf = exportDashboardReportPdf;

document.addEventListener("DOMContentLoaded", () => {
    initDashboardExportDropdown();
});
