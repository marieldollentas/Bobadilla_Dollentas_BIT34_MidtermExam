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



// Default profile pictures (embedded SVG data URIs so they load reliably offline)
const DEFAULT_ADMIN_AVATAR = "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMDAgMTAwIj4KICA8ZGVmcz4KICAgIDxsaW5lYXJHcmFkaWVudCBpZD0iYWZBZG1pbkJnIiB4MT0iMCUiIHkxPSIwJSIgeDI9IjEwMCUiIHkyPSIxMDAlIj4KICAgICAgPHN0b3Agb2Zmc2V0PSIwJSIgc3RvcC1jb2xvcj0iIzRhMzdiNCIvPgogICAgICA8c3RvcCBvZmZzZXQ9IjUwJSIgc3RvcC1jb2xvcj0iIzU4NDJjMyIvPgogICAgICA8c3RvcCBvZmZzZXQ9IjEwMCUiIHN0b3AtY29sb3I9IiM3MDU5ZGIiLz4KICAgIDwvbGluZWFyR3JhZGllbnQ+CiAgICA8bGluZWFyR3JhZGllbnQgaWQ9ImFmQWRtaW5Hb2xkIiB4MT0iMCUiIHkxPSIwJSIgeDI9IjEwMCUiIHkyPSIxMDAlIj4KICAgICAgPHN0b3Agb2Zmc2V0PSIwJSIgc3RvcC1jb2xvcj0iI2ZiYmYyNCIvPgogICAgICA8c3RvcCBvZmZzZXQ9IjEwMCUiIHN0b3AtY29sb3I9IiNmNTllMGIiLz4KICAgIDwvbGluZWFyR3JhZGllbnQ+CiAgPC9kZWZzPgogIDxjaXJjbGUgY3g9IjUwIiBjeT0iNTAiIHI9IjUwIiBmaWxsPSJ1cmwoI2FmQWRtaW5CZykiLz4KICA8Y2lyY2xlIGN4PSI1MCIgY3k9IjUwIiByPSI0OCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSJyZ2JhKDI1NSwyNTUsMjU1LDAuMikiIHN0cm9rZS13aWR0aD0iMiIvPgogIDxwYXRoIGQ9Ik0yMiA4OGMwLTE0IDEyLTI1IDI4LTI1czI4IDExIDI4IDI1djEySDIyVjg4eiIgZmlsbD0iIzFlMWI0YiIvPgogIDxwYXRoIGQ9Ik00MyA2M2w3IDggNy04IiBmaWxsPSJub25lIiBzdHJva2U9IiNlMGU3ZmYiIHN0cm9rZS13aWR0aD0iMyIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIi8+CiAgPHBhdGggZD0iTTQ4IDcxaDRsLTEgMTRoLTJ6IiBmaWxsPSJ1cmwoI2FmQWRtaW5Hb2xkKSIvPgogIDxjaXJjbGUgY3g9IjUwIiBjeT0iNDIiIHI9IjE4IiBmaWxsPSIjZmVkN2FhIi8+CiAgPHBhdGggZD0iTTMyIDM5YzAtMTAgOC0xOCAxOC0xOHMxOCA4IDE4IDE4YzAgMy0xIDYtMyA4LTIuNS01LjUtNy04LTE1LThzLTEyLjUgMi41LTE1IDhjLTItMi0zLTUtMy04eiIgZmlsbD0iIzMxMmU4MSIvPgogIDxjaXJjbGUgY3g9IjQzIiBjeT0iNDIiIHI9IjIuMiIgZmlsbD0iIzFlMWI0YiIvPgogIDxjaXJjbGUgY3g9IjU3IiBjeT0iNDIiIHI9IjIuMiIgZmlsbD0iIzFlMWI0YiIvPgogIDxwYXRoIGQ9Ik00NSA0OWMyIDIuNSA4IDIuNSAxMCAwIiBmaWxsPSJub25lIiBzdHJva2U9IiNjMjQxMGMiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIi8+CiAgPHBhdGggZD0iTTMwIDQwYTIwIDIwIDAgMCAxIDQwIDAiIGZpbGw9Im5vbmUiIHN0cm9rZT0iI2YxZjVmOSIgc3Ryb2tlLXdpZHRoPSIzLjUiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIvPgogIDxyZWN0IHg9IjI4IiB5PSIzNiIgd2lkdGg9IjUiIGhlaWdodD0iMTEiIHJ4PSIyLjUiIGZpbGw9IiNmMWY1ZjkiLz4KICA8cmVjdCB4PSI2NyIgeT0iMzYiIHdpZHRoPSI1IiBoZWlnaHQ9IjExIiByeD0iMi41IiBmaWxsPSIjZjFmNWY5Ii8+CiAgPHBhdGggZD0iTTY5IDQ1djdhNSA1IDAgMCAxLTUgNWgtNyIgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjZjFmNWY5IiBzdHJva2Utd2lkdGg9IjMiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIvPgogIDxjaXJjbGUgY3g9IjU1IiBjeT0iNTciIHI9IjMiIGZpbGw9IiMzOGJkZjgiLz4KICA8ZyB0cmFuc2Zvcm09InRyYW5zbGF0ZSg2NCwgNjQpIHNjYWxlKDAuMzIpIj4KICAgIDxjaXJjbGUgY3g9IjQ1IiBjeT0iNDUiIHI9IjQ0IiBmaWxsPSIjNGEzN2I0IiBzdHJva2U9IiNmZmYiIHN0cm9rZS13aWR0aD0iNiIvPgogICAgPHBhdGggZD0iTTQ1IDE4bDI0IDl2MThjMCAxNS0xMCAyOC0yNCAzMy0xNC01LTI0LTE4LTI0LTMzVjI3bDI0LTl6IiBmaWxsPSJ1cmwoI2FmQWRtaW5Hb2xkKSIvPgogICAgPHBhdGggZD0iTTQ1IDMydjI0TTMzIDQ0aDI0IiBzdHJva2U9IiNmZmYiIHN0cm9rZS13aWR0aD0iNSIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIi8+CiAgPC9nPgo8L3N2Zz4=";

const DEFAULT_USER_AVATAR = "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMDAgMTAwIj4KICA8ZGVmcz4KICAgIDxsaW5lYXJHcmFkaWVudCBpZD0iYWZVc2VyQmciIHgxPSIwJSIgeTE9IjAlIiB4Mj0iMTAwJSIgeTI9IjEwMCUiPgogICAgICA8c3RvcCBvZmZzZXQ9IjAlIiBzdG9wLWNvbG9yPSIjMDI4NGM3Ii8+CiAgICAgIDxzdG9wIG9mZnNldD0iNTAlIiBzdG9wLWNvbG9yPSIjMGVhNWU5Ii8+CiAgICAgIDxzdG9wIG9mZnNldD0iMTAwJSIgc3RvcC1jb2xvcj0iIzM4YmRmOCIvPgogICAgPC9saW5lYXJHcmFkaWVudD4KICAgIDxsaW5lYXJHcmFkaWVudCBpZD0iYWZVc2VyU2hpcnQiIHgxPSIwJSIgeTE9IjAlIiB4Mj0iMTAwJSIgeTI9IjEwMCUiPgogICAgICA8c3RvcCBvZmZzZXQ9IjAlIiBzdG9wLWNvbG9yPSIjMGYxNzJhIi8+CiAgICAgIDxzdG9wIG9mZnNldD0iMTAwJSIgc3RvcC1jb2xvcj0iIzFlMjkzYiIvPgogICAgPC9saW5lYXJHcmFkaWVudD4KICA8L2RlZnM+CiAgPGNpcmNsZSBjeD0iNTAiIGN5PSI1MCIgcj0iNTAiIGZpbGw9InVybCgjYWZVc2VyQmcpIi8+CiAgPGNpcmNsZSBjeD0iNTAiIGN5PSI1MCIgcj0iNDgiIGZpbGw9Im5vbmUiIHN0cm9rZT0icmdiYSgyNTUsMjU1LDI1NSwwLjI1KSIgc3Ryb2tlLXdpZHRoPSIyIi8+CiAgPHBhdGggZD0iTTIyIDg4YzAtMTQgMTItMjUgMjgtMjVzMjggMTEgMjggMjV2MTJIMjJWODh6IiBmaWxsPSJ1cmwoI2FmVXNlclNoaXJ0KSIvPgogIDxwYXRoIGQ9Ik0zOCA2M2MzIDYgMjEgNiAyNCAwIiBmaWxsPSJub25lIiBzdHJva2U9IiMzOGJkZjgiIHN0cm9rZS13aWR0aD0iMyIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIi8+CiAgPGNpcmNsZSBjeD0iNTAiIGN5PSI0MiIgcj0iMTgiIGZpbGw9IiNmZWQ3YWEiLz4KICA8cGF0aCBkPSJNMzEgMzhjMC0xMSA4LTE5IDE5LTE5czE5IDggMTkgMTljMCA0LTEgNy0zIDktMy02LTgtOS0xNi05cy0xMyAzLTE2IDljLTItMi0zLTUtMy05eiIgZmlsbD0iIzBmMTcyYSIvPgogIDxjaXJjbGUgY3g9IjQzIiBjeT0iNDIiIHI9IjIuMiIgZmlsbD0iIzBmMTcyYSIvPgogIDxjaXJjbGUgY3g9IjU3IiBjeT0iNDIiIHI9IjIuMiIgZmlsbD0iIzBmMTcyYSIvPgogIDxwYXRoIGQ9Ik00NSA0OWMyIDIuNSA4IDIuNSAxMCAwIiBmaWxsPSJub25lIiBzdHJva2U9IiNjMjQxMGMiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIi8+CiAgPGcgdHJhbnNmb3JtPSJ0cmFuc2xhdGUoNjQsIDY0KSBzY2FsZSgwLjMyKSI+CiAgICA8Y2lyY2xlIGN4PSI0NSIgY3k9IjQ1IiByPSI0NCIgZmlsbD0iIzAyODRjNyIgc3Ryb2tlPSIjZmZmIiBzdHJva2Utd2lkdGg9IjYiLz4KICAgIDxwb2x5Z29uIHBvaW50cz0iNDUsMTUgNTQsMzQgNzUsMzcgNjAsNTIgNjQsNzMgNDUsNjMgMjYsNzMgMzAsNTIgMTUsMzcgMzYsMzQiIGZpbGw9IiMzOGJkZjgiLz4KICA8L2c+Cjwvc3ZnPg==";

function isAvatarImage(value) {
    if (!value || typeof value !== "string") return false;
    const clean = value.trim();
    return clean.startsWith("data:image/") ||
        clean.startsWith("http://") ||
        clean.startsWith("https://") ||
        clean.startsWith("blob:");
}

function getAdminAvatar() {
    return DEFAULT_ADMIN_AVATAR;
}

function getCustomerAvatar(item, comment) {
    const username = (comment && comment.username) || (item && item.username);
    const authorName = (comment && comment.author) || (item && item.name);
    const email = (comment && comment.email) || (item && item.email);

    try {
        const customers = JSON.parse(localStorage.getItem("crmCustomers") || "[]");
        if (username) {
            const match = customers.find(c => c.username === username);
            if (match) {
                return isAvatarImage(match.avatar) ? match.avatar : DEFAULT_USER_AVATAR;
            }
        }
        if (authorName) {
            const clean = String(authorName).trim().toLowerCase();
            const match = customers.find(c => c.name && c.name.trim().toLowerCase() === clean);
            if (match) {
                return isAvatarImage(match.avatar) ? match.avatar : DEFAULT_USER_AVATAR;
            }
        }
        if (email) {
            const cleanEmail = String(email).trim().toLowerCase();
            const match = customers.find(c => c.email && c.email.trim().toLowerCase() === cleanEmail);
            if (match) {
                return isAvatarImage(match.avatar) ? match.avatar : DEFAULT_USER_AVATAR;
            }
        }
        if (sessionStorage.getItem("crmRole") === "customer") {
            const curUser = sessionStorage.getItem("crmCurrentUser");
            const match = customers.find(c => c.username === curUser);
            if (match) {
                if (!authorName || (match.name && match.name.trim().toLowerCase() === String(authorName).trim().toLowerCase())) {
                    return isAvatarImage(match.avatar) ? match.avatar : DEFAULT_USER_AVATAR;
                }
            }
        }
    } catch (e) { /* ignore parse error */ }

    if (comment && isAvatarImage(comment.avatar)) {
        return comment.avatar;
    }
    if (item && isAvatarImage(item.avatar)) {
        return item.avatar;
    }

    return DEFAULT_USER_AVATAR;
}

function updateCustomerInquiriesAvatar(username, name, newAvatar) {
    try {
        const inqList = JSON.parse(localStorage.getItem("crmInquiries") || "[]");
        let changed = false;
        const targetAvatar = isAvatarImage(newAvatar) ? newAvatar : "";
        inqList.forEach(inq => {
            const matches = (username && inq.username === username) ||
                            (name && inq.name && inq.name.trim().toLowerCase() === String(name).trim().toLowerCase());
            if (matches) {
                inq.avatar = targetAvatar;
                if (Array.isArray(inq.comments)) {
                    inq.comments.forEach(c => {
                        if (c.role === "customer") {
                            c.avatar = targetAvatar;
                        }
                    });
                }
                changed = true;
            }
        });
        if (changed) {
            localStorage.setItem("crmInquiries", JSON.stringify(inqList));
        }
    } catch (e) { /* ignore */ }
}

function getTicketComments(item) {
    if (!item) return [];
    if (Array.isArray(item.comments) && item.comments.length > 0) {
        return item.comments;
    }
    const initialText = item.message || item.issue;
    if (initialText) {
        const initial = [{
            author: item.name || "Customer",
            role: "customer",
            text: initialText,
            date: item.date || new Date().toISOString(),
            avatar: item.avatar || ""
        }];
        if (item.reply) {
            initial.push({
                author: "Support Staff",
                role: "staff",
                text: item.reply,
                date: item.date || new Date().toISOString(),
                avatar: getAdminAvatar()
            });
        }
        return initial;
    }
    return [];
}

// js-split:file=ui.js part=5of34
// Split from script.js - whole top-level blocks moved verbatim, no behavior change.
function commentsHTML(item) {
    if (!item) return '<p class="card-meta">No comments yet.</p>';
    const comments = getTicketComments(item);
    if (comments.length === 0) {
        return '<p class="card-meta">No comments yet.</p>';
    }
    return comments.map(c => {
        const isStaff = c.role === "staff";
        const authorName = c.author || (isStaff ? "Support Staff" : (item.name || "Customer"));
        const roleLabel = isStaff ? "Admin" : "User";
        const avatarUrl = isStaff ? getAdminAvatar(c) : getCustomerAvatar(item, c);
        const formattedDate = c.date ? formatDateLogged(c.date) : "";

        return `
            <div class="thread-comment ${isStaff ? "staff" : "customer"}">
                <div class="thread-avatar-wrap">
                    <div class="thread-avatar" title="${escapeHtml(authorName)} (${roleLabel})">
                        <img src="${escapeHtml(avatarUrl)}" alt="${escapeHtml(authorName)} profile picture" loading="lazy">
                    </div>
                </div>
                <div class="thread-content-wrap">
                    <div class="thread-comment-meta">
                        <span class="thread-author">${escapeHtml(authorName)}</span>
                        <span class="thread-role-badge ${isStaff ? "staff" : "customer"}">${roleLabel}</span>
                        <span class="thread-date">${formattedDate}</span>
                    </div>
                    <p>${escapeHtml(c.text)}</p>
                </div>
            </div>
        `;
    }).join("");
}

if (typeof window !== "undefined") {
    window.DEFAULT_ADMIN_AVATAR = DEFAULT_ADMIN_AVATAR;
    window.DEFAULT_USER_AVATAR = DEFAULT_USER_AVATAR;
    window.isAvatarImage = isAvatarImage;
    window.getAdminAvatar = getAdminAvatar;
    window.getCustomerAvatar = getCustomerAvatar;
    window.getTicketComments = getTicketComments;
    window.updateCustomerInquiriesAvatar = updateCustomerInquiriesAvatar;
    window.commentsHTML = commentsHTML;
}



// js-split:file=ui.js part=6of34
// Split from script.js - whole top-level blocks moved verbatim, no behavior change.
function commentsSummary(item) {
    const comments = getTicketComments(item);
    if (comments.length === 0) return "";
    const last = comments[comments.length - 1];
    return `<span class="ticket-reply">Last ${last.role === "staff" ? "comment from staff" : "comment"}: ${escapeHtml(last.text)}</span>`;
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
    const barY = 32;
    const barH = 34;
    const clipId = `chart-clip-${containerId}`;

    const svg = newChartSvg(width, height, opts.title);

    // A rounded clip keeps only the outer ends of the bar rounded
    const defs = svgNode("defs");
    const clip = svgNode("clipPath", { id: clipId });
    clip.appendChild(svgNode("rect", { x: 0, y: barY, width, height: barH, rx: 6 }));
    defs.appendChild(clip);
    svg.appendChild(defs);

    svg.appendChild(chartText(0, 18, `${total.toLocaleString("en-US")} ${opts.unit || "in total"}`, "chart-caption"));

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

    // Legend rows carry the exact counts the bar itself can only round to. The
    // row pitch is capped by the space left under the bar, so a fourth category
    // (the fourth priority) stays inside the chart instead of falling below it.
    const firstRow = barY + barH + 18;
    const rowH = Math.min(28, (height - firstRow - 10) / Math.max(1, data.length));
    data.forEach((item, index) => {
        const value = Number(item.value) || 0;
        const y = firstRow + index * rowH + rowH / 2;
        svg.appendChild(svgNode("rect", { x: 0, y: y - 5, width: 10, height: 10, fill: item.color || opts.color }));
        svg.appendChild(chartText(18, y + 1, shortenLabel(item.label, 26), "chart-label chart-label-strong"));
        svg.appendChild(chartText(width - 78, y + 1, value.toLocaleString("en-US"), "chart-value", "end"));
        svg.appendChild(chartText(width - 2, y + 1, chartPercent(value, total), "chart-share", "end"));
    });

    container.appendChild(svg);
}

// Stage bars — for the pipeline, where the stages are an ordered checklist and
// "Membership (Won)" / "Closed / Lost" are outcomes rather than the next step.
// Every stage gets one straight bar on the same scale, with the lead count and
// the monthly value in their own columns, so no stage is drawn as if it were
// measured against the stage above it.

// js-split:file=ui.js part=29of34
// Split from script.js - whole top-level blocks moved verbatim, no behavior change.
function renderStageBars(containerId, items, options) {
    const chart = beginChart(containerId, items, options);
    if (!chart) return;
    const { container, data, opts } = chart;

    // This card is full width, so the SVG is drawn 1:1 with its container
    // instead of being letterboxed inside a fixed 520-unit viewBox.
    const width = Math.max(360, Math.round(container.clientWidth || 0));
    const height = 184;
    const headH = 22;
    const rowH = (height - headH - 6) / data.length;
    const labelW = Math.min(190, Math.max(120, width * 0.19));
    const valueW = 78;                  // right-hand column for "$/mo"
    const countW = 46;                  // right-hand column for the lead count
    const zoneX = labelW + 14;
    const zoneW = Math.max(80, width - valueW - countW - zoneX);
    const barH = Math.max(9, Math.min(18, rowH - 12));
    const max = Math.max(...data.map(item => Number(item.value) || 0));
    const countX = zoneX + zoneW + 8;

    const svg = newChartSvg(width, height, opts.title);

    svg.appendChild(chartText(labelW, 12, "STAGE", "chart-caption", "end"));
    svg.appendChild(chartText(countX, 12, "LEADS", "chart-caption", "start"));
    svg.appendChild(chartText(width - 2, 12, "VALUE /MO", "chart-caption", "end"));

    data.forEach((item, index) => {
        const value = Number(item.value) || 0;
        const centerY = headH + rowH * index + rowH / 2;

        // Ghost bar first: it fixes the full width so every stage is read
        // against the same scale instead of against its neighbour.
        svg.appendChild(svgNode("rect", {
            x: zoneX, y: centerY - barH / 2, width: zoneW, height: barH, class: "chart-track"
        }));

        wrapLabel(item.label, Math.floor((labelW - 8) / 5.4)).forEach((line, lineIndex) => {
            svg.appendChild(chartText(labelW, centerY + (lineIndex === 0 ? 1 : 11),
                line, lineIndex === 0 ? "chart-label chart-label-strong" : "chart-label", "end"));
        });

        const barW = value === 0 ? 0 : Math.max(3, (value / max) * zoneW);
        const bar = svgNode("rect", {
            x: zoneX, y: centerY - barH / 2, width: barW, height: barH,
            fill: item.color || opts.color
        });
        bar.appendChild(chartTip(`${item.label}: ${value.toLocaleString("en-US")} lead${value === 1 ? "" : "s"}${item.note ? ` · ${item.note}` : ""}`));
        svg.appendChild(bar);

        svg.appendChild(chartText(countX, centerY + 4, value.toLocaleString("en-US"), "chart-value", "start"));
        svg.appendChild(chartText(width - 2, centerY + 4, item.note || "—", "chart-share", "end"));
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
    const content = `
        <span class="activity-icon ${type.tone}" aria-hidden="true">${type.icon}</span>
        <span class="activity-body">
            <span class="activity-title">${escapeHtml(activity.title)}</span>
            ${activity.meta ? `<span class="activity-meta">${escapeHtml(activity.meta)}</span>` : ""}
            <span class="activity-time">${escapeHtml(time)}</span>
        </span>
    `;

    const mainPart = activity.href
        ? `<a class="activity-item-main" href="${escapeHtml(activity.href)}">${content}</a>`
        : `<div class="activity-item-main">${content}</div>`;

    const actId = activity.id || `${activity.type}-${activity.at}-${activity.title}`;
    const dismissBtn = `<button type="button" class="activity-dismiss-btn" data-activity-id="${escapeHtml(actId)}" title="Dismiss notification" aria-label="Dismiss notification">&times;</button>`;

    return `<div class="activity-item" data-id="${escapeHtml(actId)}">${mainPart}${dismissBtn}</div>`;
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
