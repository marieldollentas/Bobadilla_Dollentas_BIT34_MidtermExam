// js-split:file=ui.js part=1of34
// Split from script.js - whole top-level blocks moved verbatim, no behavior change.
function statusClass(status) {
    const s = String(status || "").toLowerCase();
    if (s === "resolved") return "active";
    if (s === "in progress") return "warning";
    return "open";
}

// A portal inquiry arrives untriaged: the member neither chooses a priority nor
// supplies contact details. Priority stays "Not Defined" until support staff
// rank it from the ticket details dialog, so the queue shows honestly what has
// not been looked at yet.


// js-split:file=ui.js part=2of34
// Split from script.js - whole top-level blocks moved verbatim, no behavior change.
function priorityClass(priority) {
    if (priority === "High") return "danger";
    if (priority === "Low") return "active";
    if (priority === PRIORITY_NOT_DEFINED) return "open";
    return "warning";
}

// Campaign fields are staff-editable free text and are rendered into HTML, so
// escape them before interpolation to keep stored values inert.


// js-split:file=ui.js part=3of34
// Split from script.js - whole top-level blocks moved verbatim, no behavior change.
function tableFilters() {
    const search = (document.getElementById("ticketSearch") || {}).value || "";
    const priority = (document.getElementById("filterPriority") || {}).value || "all";
    const status = (document.getElementById("filterStatus") || {}).value || "all";
    const source = (document.getElementById("filterSource") || {}).value || "all";
    const hideResolved = !!(document.getElementById("hideResolved") || {}).checked;
    return { search: search.trim().toLowerCase(), priority, status, source, hideResolved };
}



// js-split:file=ui.js part=4of34
// Split from script.js - whole top-level blocks moved verbatim, no behavior change.
function matchesFilters(item, filters, source, extraText) {
    if (filters.source !== "all" && filters.source !== source) return false;
    if (filters.status !== "all" && String(item.status || "").toLowerCase() !== filters.status.toLowerCase()) return false;
    if (filters.priority !== "all" && item.priority !== filters.priority) return false;
    if (filters.hideResolved && String(item.status || "").toLowerCase() === "resolved") return false;
    if (filters.search) {
        const hay = [item.name, item.contact, item.issue, item.message, item.priority, item.status, extraText]
            .filter(Boolean).join(" ").toLowerCase();
        if (!hay.includes(filters.search)) return false;
    }
    return true;
}



// js-split:file=ui.js part=5of34
// Split from script.js - whole top-level blocks moved verbatim, no behavior change.
function commentsHTML(item) {
    const comments = Array.isArray(item.comments) ? item.comments : [];
    if (comments.length === 0) {
        return '<p class="card-meta">No comments yet.</p>';
    }
    return comments.map(c => `
        <div class="thread-comment ${c.role === "staff" ? "staff" : "customer"}">
            <span class="thread-author">${c.author || (c.role === "staff" ? "Support Staff" : "Customer")}</span>
            <span class="thread-date">${c.date ? formatDateLogged(c.date) : ""}</span>
            <p>${c.text}</p>
        </div>
    `).join("");
}



// js-split:file=ui.js part=6of34
// Split from script.js - whole top-level blocks moved verbatim, no behavior change.
function commentsSummary(item) {
    const comments = Array.isArray(item.comments) ? item.comments : [];
    if (comments.length === 0) return "";
    const last = comments[comments.length - 1];
    return `<span class="ticket-reply">Last ${last.role === "staff" ? "comment from staff" : "comment"}: ${last.text}</span>`;
}



// js-split:file=ui.js part=7of34
// Split from script.js - whole top-level blocks moved verbatim, no behavior change.
function leadHeatBadge(heat) {
    const cls = heat === "Hot" ? "danger" : heat === "Warm" ? "warning" : "open";
    const label = heat === "Cold" ? "Cold" : `${heat} Lead`;
    return `<span class="badge ${cls}">[${label}]</span>`;
}

// Inline staff selector shown on a lead card. Saving goes through the same
// pipeline storage the Add/Edit form uses, so the card, the filter bar and the
// Edit form all show the same assigned staff.


// js-split:file=ui.js part=8of34
// Split from script.js - whole top-level blocks moved verbatim, no behavior change.
function campaignStatusBadge(status) {
    const meta = CAMPAIGN_STATUSES.find(s => s.value === status) || CAMPAIGN_STATUSES[0];
    return `<span class="badge ${meta.badge}">${escapeHtml(meta.value)}</span>`;
}

// Platforms outside the known dropdown list are edited through the "Other" option


// js-split:file=ui.js part=9of34
// Split from script.js - whole top-level blocks moved verbatim, no behavior change.
function campaignPlatformOption(platform) {
    return CAMPAIGN_PLATFORMS.includes(platform) ? platform : "Other";
}

// ---- Social post embeds (Instagram / Facebook) ----
// Neither platform exposes post content to a browser page directly, so a pasted
// link is all we can read here. The URL is therefore parsed into the canonical
// permalink each platform's official embed script expects, and the embed itself
// is requested from that script only when a user asks for it.
//
// Recognised shapes return { ok: true, platform, url, embeddable, note }.
// Anything else returns { ok: false, reason } so the caller can explain the
// problem in the campaign form instead of silently dropping the input.



// js-split:file=ui.js part=10of34
// Split from script.js - whole top-level blocks moved verbatim, no behavior change.
function campaignPlatformChip(platform) {
    if (!platform) return "";
    const tint = CAMPAIGN_PLATFORM_TINTS[platform] || "generic";
    return `<span class="social-platform social-platform-${tint}">${escapeHtml(platform)}</span>`;
}

// The embedded post is unusable inside a 190px dashboard column, so an expanded
// card takes the full width of the grid instead of stretching a single column.


// js-split:file=ui.js part=11of34
// Split from script.js - whole top-level blocks moved verbatim, no behavior change.
const SVG_NS = "http://www.w3.org/2000/svg";


// js-split:file=ui.js part=12of34
// Split from script.js - whole top-level blocks moved verbatim, no behavior change.
const CHART_COLORS = { brand: "#5b4bc4", tier: "#8b7bf0", active: "#55c878", warning: "#f5b942", danger: "#e85d75", info: "#4f8df7" };

// Charts sit in a fixed-height box and scale up to fill the card, so the canvas
// is wider than the plot it holds. This is the unit width of the fixed-size
// charts; anything sized to the full card width measures the container instead.


// js-split:file=ui.js part=13of34
// Split from script.js - whole top-level blocks moved verbatim, no behavior change.
const CHART_WIDTH = 520;


// js-split:file=ui.js part=14of34
// Split from script.js - whole top-level blocks moved verbatim, no behavior change.
const CHART_HEIGHT = 184;



// js-split:file=ui.js part=15of34
// Split from script.js - whole top-level blocks moved verbatim, no behavior change.
function svgNode(name, attrs) {
    const node = document.createElementNS(SVG_NS, name);
    Object.entries(attrs || {}).forEach(([key, value]) => node.setAttribute(key, String(value)));
    return node;
}



// js-split:file=ui.js part=16of34
// Split from script.js - whole top-level blocks moved verbatim, no behavior change.
function shortenLabel(value, max) {
    const text = String(value || "");
    return text.length > max ? text.slice(0, Math.max(1, max - 1)) + "…" : text;
}

// Category names are long ("18-Month Membership", "Trial / Tour Completed"), so
// break them onto two lines under the bar rather than truncating them to noise.


// js-split:file=ui.js part=17of34
// Split from script.js - whole top-level blocks moved verbatim, no behavior change.
function wrapLabel(value, maxChars) {
    const words = String(value || "").split(/\s+/).filter(Boolean);
    if (words.length === 0) return [""];

    const lines = [];
    let current = "";
    words.forEach(word => {
        if (current && (current + " " + word).length > maxChars) {
            lines.push(current);
            current = word;
        } else {
            current = current ? current + " " + word : word;
        }
    });
    if (current) lines.push(current);

    if (lines.length > 2) {
        lines[1] = shortenLabel(lines.slice(1).join(" "), maxChars);
        lines.length = 2;
    }
    return lines.map(line => shortenLabel(line, maxChars));
}

// Shared setup for every renderer: clears the container, handles the
// "nothing to show yet" case once, and hands back sized data to draw.


// js-split:file=ui.js part=18of34
// Split from script.js - whole top-level blocks moved verbatim, no behavior change.
function beginChart(containerId, items, options) {
    const container = document.getElementById(containerId);
    if (!container) return null;

    const opts = Object.assign({
        title: "Chart",
        color: CHART_COLORS.brand,
        emptyText: "No data to chart yet."
    }, options || {});

    container.innerHTML = "";
    const data = (items || []).filter(Boolean);
    const total = data.reduce((sum, item) => sum + (Number(item.value) || 0), 0);
    if (data.length === 0 || total === 0) {
        const p = document.createElement("p");
        p.className = "card-meta";
        p.textContent = opts.emptyText;
        container.appendChild(p);
        return null;
    }
    return { container, data, total, opts };
}



// js-split:file=ui.js part=19of34
// Split from script.js - whole top-level blocks moved verbatim, no behavior change.
function newChartSvg(width, height, title) {
    const svg = svgNode("svg", {
        viewBox: `0 0 ${width} ${height}`, role: "img",
        "aria-label": title, preserveAspectRatio: "xMidYMid meet"
    });
    const titleNode = svgNode("title");
    titleNode.textContent = title;
    svg.appendChild(titleNode);
    return svg;
}



// js-split:file=ui.js part=20of34
// Split from script.js - whole top-level blocks moved verbatim, no behavior change.
function chartText(x, y, text, className, anchor) {
    const node = svgNode("text", { x, y, class: className || "chart-label" });
    if (anchor) node.setAttribute("text-anchor", anchor);
    node.textContent = text;
    return node;
}

// Native <title> on a shape is the hover tooltip and the accessible name.


// js-split:file=ui.js part=21of34
// Split from script.js - whole top-level blocks moved verbatim, no behavior change.
function chartTip(text) {
    const tip = svgNode("title");
    tip.textContent = text;
    return tip;
}



// js-split:file=ui.js part=22of34
// Split from script.js - whole top-level blocks moved verbatim, no behavior change.
function chartPercent(value, total) {
    if (!total) return "0%";
    return `${Math.round((value / total) * 100)}%`;
}

// Rounds an axis maximum up to a friendly 1/2/5 x 10^n so gridline labels land
// on round numbers instead of whatever the data happened to peak at.


// js-split:file=ui.js part=23of34
// Split from script.js - whole top-level blocks moved verbatim, no behavior change.
function niceCeil(value) {
    if (!(value > 0)) return 1;
    const magnitude = Math.pow(10, Math.floor(Math.log10(value)));
    const scaled = value / magnitude;
    const step = scaled <= 1 ? 1 : scaled <= 2 ? 2 : scaled <= 5 ? 5 : 10;
    return step * magnitude;
}



// js-split:file=ui.js part=24of34
// Split from script.js - whole top-level blocks moved verbatim, no behavior change.
function chartTick(value) {
    const rounded = Math.round(value * 10) / 10;
    return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

// Donut — for a part-to-whole split (member statuses). Each state reads as a
// slice of one ring, so "how much of the base is active" is immediate, and the
// hole carries the total instead of the legend repeating it three times.


// js-split:file=ui.js part=25of34
// Split from script.js - whole top-level blocks moved verbatim, no behavior change.
function renderDonutChart(containerId, items, options) {
    const chart = beginChart(containerId, items, options);
    if (!chart) return;
    const { container, data, total, opts } = chart;

    const width = CHART_WIDTH;
    const height = CHART_HEIGHT;
    const cx = 112;
    const cy = height / 2;
    const ring = 72;                 // radius of the band centre line
    const thickness = 26;
    const circumference = 2 * Math.PI * ring;

    const svg = newChartSvg(width, height, opts.title);

    // Faint full ring first, so a state with zero members leaves a visible gap
    svg.appendChild(svgNode("circle", {
        cx, cy, r: ring, class: "chart-track-ring", "stroke-width": thickness
    }));

    let drawn = 0;
    data.forEach(item => {
        const value = Number(item.value) || 0;
        if (value <= 0) return;
        const sweep = (value / total) * circumference;
        const gap = Math.max(1, sweep - 3);
        const slice = svgNode("circle", {
            cx, cy, r: ring, fill: "none",
            stroke: item.color || opts.color,
            "stroke-width": thickness,
            "stroke-dasharray": `${gap} ${circumference - gap}`,
            "stroke-dashoffset": -drawn,
            transform: `rotate(-90 ${cx} ${cy})`
        });
        slice.appendChild(chartTip(`${item.label}: ${value.toLocaleString("en-US")} (${chartPercent(value, total)})`));
        svg.appendChild(slice);
        drawn += sweep;
    });

    svg.appendChild(chartText(cx, cy + 2, total.toLocaleString("en-US"), "chart-value chart-value-lg", "middle"));
    svg.appendChild(chartText(cx, cy + 19, opts.centerLabel || "Total", "chart-label", "middle"));

    // Legend doubles as a table: colour chip, category, share of the ring
    const legendX = 212;
    const rowH = data.length > 4 ? 28 : 34;
    const firstRow = cy - ((data.length - 1) * rowH) / 2;
    data.forEach((item, index) => {
        const value = Number(item.value) || 0;
        const y = firstRow + index * rowH;
        svg.appendChild(svgNode("rect", { x: legendX, y: y - 8, width: 10, height: 10, fill: item.color || opts.color }));
        svg.appendChild(chartText(legendX + 17, y + 1, shortenLabel(item.label, 26), "chart-label chart-label-strong"));
        svg.appendChild(chartText(width - 2, y + 1, chartPercent(value, total), "chart-share", "end"));
    });

    container.appendChild(svg);
}

// Ranked horizontal bars — for comparing categories whose names are long
// ("18-Month Membership"). The labels get their own column, so nothing has to
// be truncated into "18-Mont…" underneath a vertical bar.


// js-split:file=ui.js part=26of34
// Split from script.js - whole top-level blocks moved verbatim, no behavior change.
function renderRankedBars(containerId, items, options) {
    const chart = beginChart(containerId, items, options);
    if (!chart) return;
    const { container, data, opts } = chart;

    const width = CHART_WIDTH;
    const height = CHART_HEIGHT;
    const padY = 10;
    const labelW = 150;
    const valueW = 36;                // right-hand column for the count
    const plotW = width - labelW - valueW;
    const rowH = (height - padY * 2) / data.length;
    const barH = Math.max(9, Math.min(20, rowH * 0.5));
    const max = Math.max(...data.map(item => Number(item.value) || 0));

    const svg = newChartSvg(width, height, opts.title);

    data.forEach((item, index) => {
        const value = Number(item.value) || 0;
        const centerY = padY + rowH * index + rowH / 2;

        // Full-width ghost bar keeps every row on the same scale
        svg.appendChild(svgNode("rect", {
            x: labelW, y: centerY - barH / 2, width: plotW, height: barH, class: "chart-track"
        }));

        // item.note is the optional second line under the label (the tier price)
        const lines = item.note
            ? [shortenLabel(item.label, 19), shortenLabel(item.note, 19)]
            : [shortenLabel(item.label, 19)];
        lines.forEach((line, lineIndex) => {
            svg.appendChild(chartText(labelW - 10, centerY + (lines.length === 1 ? 4 : lineIndex * 11),
                line, lineIndex === 0 ? "chart-label chart-label-strong" : "chart-label", "end"));
        });

        const barW = value === 0 ? 0 : Math.max(3, (value / max) * plotW);
        const bar = svgNode("rect", {
            x: labelW, y: centerY - barH / 2, width: barW, height: barH,
            fill: item.color || opts.color
        });
        bar.appendChild(chartTip(`${item.label}: ${value.toLocaleString("en-US")}`));
        svg.appendChild(bar);

        svg.appendChild(chartText(width - 2, centerY + 4, value.toLocaleString("en-US"), "chart-value", "end"));
    });

    container.appendChild(svg);
}

// Area + line — for a time series (tickets per month). A bar per month hides
// the trend, while the slope and the shaded area make month-to-month movement
// the thing you actually see.


// js-split:file=ui.js part=27of34
// Split from script.js - whole top-level blocks moved verbatim, no behavior change.
function renderTrendChart(containerId, items, options) {
    const chart = beginChart(containerId, items, options);
    if (!chart) return;
    const { container, data, opts } = chart;

    const width = CHART_WIDTH;
    const height = CHART_HEIGHT;
    const padLeft = 28;
    const padRight = 12;
    const padTop = 22;
    const padBottom = 26;
    const plotW = width - padLeft - padRight;
    const plotH = height - padTop - padBottom;
    const baseline = padTop + plotH;

    const values = data.map(item => Number(item.value) || 0);
    const peak = niceCeil(Math.max(...values));
    const color = opts.color || CHART_COLORS.info;
    const pointX = index => data.length === 1
        ? padLeft + plotW / 2
        : padLeft + (plotW / (data.length - 1)) * index;
    const pointY = value => padTop + plotH - (value / peak) * plotH;

    const svg = newChartSvg(width, height, opts.title);

    // Fade the fill out downwards so the line itself stays the focus
    const fillId = `chart-fill-${containerId}`;
    const defs = svgNode("defs");
    const gradient = svgNode("linearGradient", { id: fillId, x1: 0, y1: 0, x2: 0, y2: 1 });
    gradient.appendChild(svgNode("stop", { offset: "0%", "stop-color": color, "stop-opacity": ".26" }));
    gradient.appendChild(svgNode("stop", { offset: "100%", "stop-color": color, "stop-opacity": "0" }));
    defs.appendChild(gradient);
    svg.appendChild(defs);

    [0, 0.5, 1].forEach(fraction => {
        const y = padTop + plotH * (1 - fraction);
        svg.appendChild(svgNode("line", {
            x1: padLeft, y1: y, x2: width - padRight, y2: y,
            class: fraction === 0 ? "chart-axis" : "chart-grid", "stroke-width": 1
        }));
        svg.appendChild(chartText(padLeft - 6, y + 3, chartTick(peak * fraction), "chart-label", "end"));
    });

    const points = values.map((value, index) => `${pointX(index)},${pointY(value)}`).join(" ");
    if (data.length > 1) {
        svg.appendChild(svgNode("polygon", {
            points: `${pointX(0)},${baseline} ${points} ${pointX(data.length - 1)},${baseline}`,
            fill: `url(#${fillId})`
        }));
        svg.appendChild(svgNode("polyline", { points, class: "chart-line", stroke: color }));
    }

    data.forEach((item, index) => {
        const value = values[index];
        const x = pointX(index);
        const y = pointY(value);

        const dot = svgNode("circle", { cx: x, cy: y, r: 3.4, fill: color, class: "chart-dot" });
        dot.appendChild(chartTip(`${item.label}: ${value.toLocaleString("en-US")}`));
        svg.appendChild(dot);

        svg.appendChild(chartText(x, baseline + 16, item.label, "chart-label", "middle"));
        if (String(value).length <= 3) {
            svg.appendChild(chartText(x, y - 9, String(value), "chart-value chart-value-sm", "middle"));
        }
    });

    container.appendChild(svg);
}

// Single mix bar — for "how the whole splits across a few priorities". One
// 100% bar says "one queue, these three severities" without three bars all
// restating the same total.


// js-split:file=ui.js part=28of34
// Split from script.js - whole top-level blocks moved verbatim, no behavior change.
function renderMixBar(containerId, items, options) {
    const chart = beginChart(containerId, items, options);
    if (!chart) return;
    const { container, data, total, opts } = chart;

    const width = CHART_WIDTH;
    const height = CHART_HEIGHT;
    const barY = 44;
    const barH = 44;
    const clipId = `chart-clip-${containerId}`;

    const svg = newChartSvg(width, height, opts.title);

    // A rounded clip keeps only the outer ends of the bar rounded
    const defs = svgNode("defs");
    const clip = svgNode("clipPath", { id: clipId });
    clip.appendChild(svgNode("rect", { x: 0, y: barY, width, height: barH, rx: 6 }));
    defs.appendChild(clip);
    svg.appendChild(defs);

    svg.appendChild(chartText(0, 24, `${total.toLocaleString("en-US")} ${opts.unit || "in total"}`, "chart-caption"));

    const segments = svgNode("g", { "clip-path": `url(#${clipId})` });
    let cursor = 0;
    data.forEach(item => {
        const value = Number(item.value) || 0;
        if (value <= 0) return;
        const segmentW = (value / total) * width;
        const segment = svgNode("rect", { x: cursor, y: barY, width: segmentW, height: barH, fill: item.color || opts.color });
        segment.appendChild(chartTip(`${item.label}: ${value.toLocaleString("en-US")} (${chartPercent(value, total)})`));
        segments.appendChild(segment);
        if (segmentW > 34) {
            segments.appendChild(chartText(cursor + segmentW / 2, barY + barH / 2 + 4,
                chartPercent(value, total), "chart-inbar", "middle"));
        }
        cursor += segmentW;
    });
    svg.appendChild(segments);

    // Legend rows carry the exact counts the bar itself can only round to
    const rowH = 28;
    const firstRow = barY + barH + 20;
    data.forEach((item, index) => {
        const value = Number(item.value) || 0;
        const y = firstRow + index * rowH;
        svg.appendChild(svgNode("rect", { x: 0, y: y - 8, width: 10, height: 10, fill: item.color || opts.color }));
        svg.appendChild(chartText(18, y + 1, shortenLabel(item.label, 26), "chart-label chart-label-strong"));
        svg.appendChild(chartText(width - 78, y + 1, value.toLocaleString("en-US"), "chart-value", "end"));
        svg.appendChild(chartText(width - 2, y + 1, chartPercent(value, total), "chart-share", "end"));
    });

    container.appendChild(svg);
}

// Funnel — for ordered pipeline stages. Each stage is a band that tapers into
// the width of the next one, so the whole card reads as a funnel instead of a
// bar chart, and every row is annotated with its drop-off from the stage above,
// which is the number a pipeline is actually read for.


// js-split:file=ui.js part=29of34
// Split from script.js - whole top-level blocks moved verbatim, no behavior change.
function renderFunnelChart(containerId, items, options) {
    const chart = beginChart(containerId, items, options);
    if (!chart) return;
    const { container, data, opts } = chart;

    // This card is full width, so the SVG is drawn 1:1 with its container
    // instead of being letterboxed inside a fixed 340-unit viewBox.
    const width = Math.max(360, Math.round(container.clientWidth || 0));
    const height = 184;
    const headH = 22;
    const rowH = (height - headH - 6) / data.length;
    const labelW = Math.min(210, Math.max(130, width * 0.2));
    const valueW = 96;
    const zoneX = labelW + 14;
    const zoneW = Math.max(80, width - valueW - zoneX);
    const centerX = zoneX + zoneW / 2;
    const max = Math.max(...data.map(item => Number(item.value) || 0));
    const bandFor = value => value <= 0 ? 0 : Math.max(6, (value / max) * zoneW);

    const svg = newChartSvg(width, height, opts.title);

    svg.appendChild(chartText(labelW, 12, "STAGE", "chart-caption", "end"));
    svg.appendChild(chartText(width - 52, 12, "LEADS", "chart-caption", "end"));
    svg.appendChild(chartText(width - 2, 12, "vs PREV", "chart-caption", "end"));

    data.forEach((item, index) => {
        const value = Number(item.value) || 0;
        const topY = headH + rowH * index + 2;
        const bottomY = headH + rowH * (index + 1) - 2;
        const centerY = (topY + bottomY) / 2;
        const isLast = index === data.length - 1;

        // The band tapers into the next stage; the final one closes straight.
        const topW = bandFor(value);
        const bottomW = isLast ? topW * 0.72 : bandFor(Number(data[index + 1].value) || 0);

        const band = svgNode("polygon", {
            points: `${centerX - topW / 2},${topY} ${centerX + topW / 2},${topY} `
                + `${centerX + bottomW / 2},${bottomY} ${centerX - bottomW / 2},${bottomY}`,
            fill: item.color || opts.color,
            class: "chart-band"
        });
        band.appendChild(chartTip(`${item.label}: ${value.toLocaleString("en-US")}`));
        svg.appendChild(band);

        wrapLabel(item.label, Math.floor((labelW - 8) / 5.4)).forEach((line, lineIndex) => {
            svg.appendChild(chartText(labelW, centerY + (lineIndex === 0 ? 1 : 11),
                line, lineIndex === 0 ? "chart-label chart-label-strong" : "chart-label", "end"));
        });

        const previous = index > 0 ? Number(data[index - 1].value) || 0 : 0;
        svg.appendChild(chartText(width - 52, centerY + 4, value.toLocaleString("en-US"), "chart-value", "end"));
        svg.appendChild(chartText(width - 2, centerY + 4,
            index === 0 || previous === 0 ? "—" : chartPercent(value, previous), "chart-share", "end"));
    });

    container.appendChild(svg);
}

// Members split by membership status and by tier, from the Customer Directory.
// Archived members are left out: the charts describe the current membership.


// js-split:file=ui.js part=30of34
// Split from script.js - whole top-level blocks moved verbatim, no behavior change.
function activityRowHtml(activity) {
    const type = ACTIVITY_TYPES[activity.type] || ACTIVITY_TYPES.ticket;
    const time = activity.timeLabel || relativeTime(activity.at);
    const body = `
        <span class="activity-icon ${type.tone}" aria-hidden="true">${type.icon}</span>
        <span class="activity-body">
            <span class="activity-title">${escapeHtml(activity.title)}</span>
            ${activity.meta ? `<span class="activity-meta">${escapeHtml(activity.meta)}</span>` : ""}
            <span class="activity-time">${escapeHtml(time)}</span>
        </span>
    `;

    return activity.href
        ? `<a class="activity-item" href="${escapeHtml(activity.href)}">${body}</a>`
        : `<div class="activity-item">${body}</div>`;
}



// js-split:file=ui.js part=31of34
// Split from script.js - whole top-level blocks moved verbatim, no behavior change.
function coachStatusBadge(status) {
    const cls = status === "Active" ? "active" : "warning";
    return `<span class="badge ${cls}">${escapeHtml(status || "—")}</span>`;
}



// js-split:file=ui.js part=32of34
// Split from script.js - whole top-level blocks moved verbatim, no behavior change.
function sessionStatusBadge(status) {
    const cls = status === "Completed" ? "active"
        : status === "Missed" ? "danger"
            : status === "Cancelled" ? "warning"
                : "open";
    return `<span class="badge ${cls}">${escapeHtml(status || "—")}</span>`;
}

// Membership state comes from the Customer Directory so the coach
// module can never disagree with the Customer Directory page. A record
// without a tier is treated as inactive.


// js-split:file=ui.js part=33of34
// Split from script.js - whole top-level blocks moved verbatim, no behavior change.
function membershipBadge(status) {
    const cls = status === "Active" ? "active"
        : status === "Expiring Soon" ? "warning"
            : status === "Expired" ? "danger"
                : status === "Frozen" ? "warning"
                    : status === "Archived" ? "open" : "open";
    return `<span class="badge ${cls}">${escapeHtml(status)}</span>`;
}



// js-split:file=ui.js part=34of34
// Split from script.js - whole top-level blocks moved verbatim, no behavior change.
function ratingStarsHtml(average) {
    const rounded = Math.round(Number(average) || 0);
    return "★★★★★".slice(0, rounded) + "☆☆☆☆☆".slice(0, 5 - rounded);
}

// Newest written reviews kept per coach. ratingSum / ratingCount stay the tally
// so the average keeps working on records created before feedback existed.
