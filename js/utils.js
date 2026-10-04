// js-split:file=utils.js part=1of33
// Split from script.js - whole top-level blocks moved verbatim, no behavior change.
function escapeHtml(value) {
    const chars = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
    return String(value || "").replace(/[&<>"']/g, ch => chars[ch]);
}

// Campaign image/post links come from free-text inputs. Only http(s) is kept so a
// "javascript:" value can never become a live href/src when a card is rendered.


// js-split:file=utils.js part=2of33
// Split from script.js - whole top-level blocks moved verbatim, no behavior change.
function safeUrl(value) {
    const raw = String(value || "").trim();
    if (!raw) return "";
    try {
        const parsed = new URL(raw);
        return parsed.protocol === "http:" || parsed.protocol === "https:" ? raw : "";
    } catch (e) {
        return "";
    }
}

// Organize a stored date into a readable date + time label.
// Handles full ISO datetimes and legacy date-only (yyyy-mm-dd) values.


// js-split:file=utils.js part=3of33
// Split from script.js - whole top-level blocks moved verbatim, no behavior change.
function formatDateLogged(value) {
    if (!value) return "—";
    const raw = String(value).trim();
    const hasTime = raw.includes("T") || /\d{1,2}:\d{2}/.test(raw);
    const d = new Date(hasTime ? raw : raw + "T00:00:00");
    if (isNaN(d.getTime())) return raw;
    return d.toLocaleString("en-US", hasTime
        ? { year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }
        : { year: "numeric", month: "short", day: "numeric" });
}



// js-split:file=utils.js part=4of33
// Split from script.js - whole top-level blocks moved verbatim, no behavior change.
function normalizePipelineStaff(staff) {
    if (!staff) return PIPELINE_STAFF[0];
    return PIPELINE_STAFF_ALIASES[staff] || staff;
}

// Fills a staff <select> with the shared list. "all" adds the All Staff option.


// js-split:file=utils.js part=5of33
// Split from script.js - whole top-level blocks moved verbatim, no behavior change.
function tierDurationMonths(tier) {
    const t = PIPELINE_TIERS.find(t => t.value === tier);
    return t ? t.months : 0;
}

// Expiration date = base date + membership term, as yyyy-mm-dd


// js-split:file=utils.js part=6of33
// Split from script.js - whole top-level blocks moved verbatim, no behavior change.
function computeExpirationDate(months, base) {
    const d = new Date(base);
    d.setMonth(d.getMonth() + months);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
}

// Random, unique 8-digit Key Fob Number used as the customer's username


// js-split:file=utils.js part=7of33
// Split from script.js - whole top-level blocks moved verbatim, no behavior change.
function generateKeyFob() {
    const customers = JSON.parse(localStorage.getItem("crmCustomers") || "[]");
    let fob;
    do {
        fob = String(Math.floor(10000000 + Math.random() * 90000000));
    } while (customers.some(c => c.username === fob || c.keyFob === fob));
    return fob;
}



// js-split:file=utils.js part=8of33
// Split from script.js - whole top-level blocks moved verbatim, no behavior change.
function normalizePipelineTier(tier) {
    if (PIPELINE_TIERS.some(t => t.value === tier)) return tier;
    // Legacy/unknown tiers fall back to the base 6-month membership
    return "6-Month Membership";
}



// js-split:file=utils.js part=9of33
// Split from script.js - whole top-level blocks moved verbatim, no behavior change.
function pipelineTierPrice(tier) {
    const t = PIPELINE_TIERS.find(t => t.value === normalizePipelineTier(tier));
    return t ? t.price : 0;
}



// js-split:file=utils.js part=10of33
// Split from script.js - whole top-level blocks moved verbatim, no behavior change.
function serviceTierLabel(tier) {
    const t = PIPELINE_TIERS.find(t => t.value === normalizePipelineTier(tier));
    return t ? t.label : tier;
}



// js-split:file=utils.js part=11of33
// Split from script.js - whole top-level blocks moved verbatim, no behavior change.
function hostMatches(host, list) {
    return list.indexOf(host.toLowerCase()) !== -1;
}

// Instagram permalinks are /p|reel|reels|tv/<shortcode>. The username segment
// some shared URLs carry is dropped so the embed script always gets the shape it
// documents, and the trailing slash is added back as the canonical form.


// js-split:file=utils.js part=12of33
// Split from script.js - whole top-level blocks moved verbatim, no behavior change.
function parseInstagramPermalink(pathname) {
    const match = pathname.match(/^\/(?:[\w.%-]+\/)?(p|reel|reels|tv)\/([\w-]+)\/?$/);
    if (!match) return null;
    return `https://www.instagram.com/${match[1]}/${match[2]}/`;
}

// Facebook exposes the same post under many URLs. Reduce them to the documented
// permalink forms: the page posts path, and the photo/video/permalink endpoints.


// js-split:file=utils.js part=13of33
// Split from script.js - whole top-level blocks moved verbatim, no behavior change.
function parseFacebookPermalink(url) {
    const path = url.pathname.replace(/\/+$/, "");
    const query = url.searchParams;

    if (path === "/permalink.php" && query.get("story_fbid")) {
        const id = query.get("id") || "";
        return `https://www.facebook.com/permalink.php?story_fbid=${encodeURIComponent(query.get("story_fbid"))}${id ? `&id=${encodeURIComponent(id)}` : ""}`;
    }

    const postMatch = path.match(/\/posts\/(\d+)$/);
    if (postMatch) return `https://www.facebook.com${path}/`;

    const fbid = query.get("fbid");
    if (fbid) return `https://www.facebook.com/photo.php?fbid=${encodeURIComponent(fbid)}`;

    const video = query.get("v");
    if (video) return `https://www.facebook.com/video.php?v=${encodeURIComponent(video)}`;

    const videoMatch = path.match(/\/videos\/(\d+)$/);
    if (videoMatch) return `https://www.facebook.com${path}/`;

    return null;
}



// js-split:file=utils.js part=14of33
// Split from script.js - whole top-level blocks moved verbatim, no behavior change.
function parseSocialPostUrl(raw) {
    const value = String(raw || "").trim();
    if (!value) return { ok: false, reason: "" };

    // Accept links pasted without a scheme, which browsers treat as relative
    let candidate = value;
    if (!/^https?:\/\//i.test(candidate)) candidate = `https://${candidate}`;

    let parsed;
    try {
        parsed = new URL(candidate);
    } catch (e) {
        return { ok: false, reason: "That does not look like a valid web address." };
    }

    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        return { ok: false, reason: "Only http and https addresses can be previewed." };
    }

    const host = parsed.hostname;

    if (hostMatches(host, INSTAGRAM_HOSTS)) {
        const url = parseInstagramPermalink(parsed.pathname);
        if (!url) {
            return { ok: false, reason: "Use an Instagram post link such as instagram.com/p/XXXXXX. Stories and profile pages cannot be embedded." };
        }
        return { ok: true, platform: "Instagram", url, embeddable: true, note: "Instagram post recognised. It will render as a live embed." };
    }

    if (hostMatches(host, FACEBOOK_HOSTS)) {
        const url = parseFacebookPermalink(parsed);
        if (!url) {
            return { ok: false, reason: "Use a link to a specific Facebook post, photo, video or reel. Facebook pages cannot be embedded." };
        }
        return { ok: true, platform: "Facebook", url, embeddable: true, note: "Facebook post recognised. It will render as a live embed." };
    }

    if (hostMatches(host, FACEBOOK_SHORT_HOSTS)) {
        return {
            ok: true,
            platform: "Facebook",
            url: parsed.href,
            embeddable: false,
            note: "Facebook share links open the post but cannot be embedded. Paste the full facebook.com post link to preview it here."
        };
    }

    if (hostMatches(host, ["twitter.com", "www.twitter.com", "x.com", "www.x.com"])) {
        return { ok: true, platform: "Twitter", url: parsed.href, embeddable: false, note: "Twitter posts link out only." };
    }

    if (hostMatches(host, ["tiktok.com", "www.tiktok.com", "vm.tiktok.com"])) {
        return { ok: true, platform: "TikTok", url: parsed.href, embeddable: false, note: "TikTok posts link out only." };
    }

    return { ok: false, reason: "Only Instagram and Facebook post links can be embedded here." };
}

// Reads the saved post link of a campaign and returns the same shape as
// parseSocialPostUrl so the card renderer never has to re-check for failures.


// js-split:file=utils.js part=15of33
// Split from script.js - whole top-level blocks moved verbatim, no behavior change.
function campaignSocialInfo(campaign) {
    const raw = safeUrl(campaign.postUrl);
    if (!raw) return { ok: false, reason: "", platform: campaign.platform || "", url: "", embeddable: false };
    return parseSocialPostUrl(raw);
}



// js-split:file=utils.js part=16of33
// Split from script.js - whole top-level blocks moved verbatim, no behavior change.
function customerStatus(expDate, today) {
    if (!expDate) return "Active";
    const d = new Date(expDate);
    if (isNaN(d.getTime())) return "Active";
    const diffDays = (d - today) / (24 * 60 * 60 * 1000);
    if (diffDays < 0) return "Expired";
    if (diffDays <= RENEWAL_WINDOW_DAYS) return "Expiring Soon";
    return "Active";
}

// Add freeze-aware status helper


// js-split:file=utils.js part=17of33
// Split from script.js - whole top-level blocks moved verbatim, no behavior change.
function getMemberStatus(member, today = todayStart()) {
    if (!member) return "Active";
    const now = today || todayStart();
    // Archiving outranks every membership rule: a past member stays a past
    // member, and a freeze that lapses on an archived record does not revive it.
    if (member.archived) return "Archived";
    if (member.status === "Frozen" && member.freezeEndDate) {
        const end = new Date(member.freezeEndDate + "T00:00:00");
        if (!isNaN(end.getTime()) && now >= end) {
            unfreezeMemberById(member.id);
            return "Active";
        }
        return "Frozen";
    }
    return customerStatus(member.exp || member.expirationDate || member.updatedExpirationDate, now);
}

// Archiving is how the gym retires a membership: the record, and everything
// hanging off it (sessions, ratings, tickets, activity), stays on file and the
// member leaves the active directory. Nothing is deleted.


// js-split:file=utils.js part=18of33
// Split from script.js - whole top-level blocks moved verbatim, no behavior change.
function memberIsArchived(member) {
    return Boolean(member && member.archived);
}

// Current members only. Historical views (session history, activity links) keep
// using getDirectoryCustomers() so an archived member can still be read.


// js-split:file=utils.js part=19of33
// Split from script.js - whole top-level blocks moved verbatim, no behavior change.
function todayStart() {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    return date;
}

// Whole days from today to an expiration date, or null when the record has no
// usable date. Negative once the term has lapsed.


// js-split:file=utils.js part=20of33
// Split from script.js - whole top-level blocks moved verbatim, no behavior change.
function daysUntilExpiration(expDate, today) {
    if (!expDate) return null;
    const target = new Date(expDate);
    if (isNaN(target.getTime())) return null;
    return Math.round((target - (today || todayStart())) / 86400000);
}

// "Expires in 5 days" / "Expires today" / "Expired 12 days ago"


// js-split:file=utils.js part=21of33
// Split from script.js - whole top-level blocks moved verbatim, no behavior change.
function addMonthsSafe(dateStr, months) {
    const d = new Date(dateStr + "T00:00:00");
    if (isNaN(d.getTime())) return "";
    const originalDay = d.getDate();
    d.setMonth(d.getMonth() + months);
    if (d.getDate() < originalDay) {
        d.setDate(0);
    }
    return d.toISOString().split("T")[0];
}



// js-split:file=utils.js part=22of33
// Split from script.js - whole top-level blocks moved verbatim, no behavior change.
function activityHref(page, term) {
    const text = String(term || "").trim();
    return text ? `${page}?q=${encodeURIComponent(text)}` : page;
}

// Short, human ticket reference derived from the stored ticket id


// js-split:file=utils.js part=23of33
// Split from script.js - whole top-level blocks moved verbatim, no behavior change.
function activityTicketRef(id) {
    const raw = String(id === undefined || id === null ? "" : id);
    // Trim the trailing run of zeros a millisecond timestamp ends with so the
    // reference stays readable, e.g. 1788123456789 -> #6789
    const trimmed = raw.replace(/0+$/, "");
    return `#${(trimmed || raw).slice(-4)}`;
}

// Turns a free-text inquiry into a compact subject line: the first sentence,
// capped so the meta row stays on one line.


// js-split:file=utils.js part=24of33
// Split from script.js - whole top-level blocks moved verbatim, no behavior change.
function activityTopic(text) {
    const firstSentence = String(text || "").trim().split(/[.!?\n]/)[0].trim();
    return shortenLabel(firstSentence, 36);
}



// js-split:file=utils.js part=25of33
// Split from script.js - whole top-level blocks moved verbatim, no behavior change.
function activityStageTitle(stageId) {
    const stage = PIPELINE_STAGES.find(s => s.id === stageId);
    return stage ? stage.title : "Pipeline";
}

// "5 minutes ago" / "1 hour ago", falling back to the shared date format


// js-split:file=utils.js part=26of33
// Split from script.js - whole top-level blocks moved verbatim, no behavior change.
function relativeTime(value) {
    const stamp = new Date(value);
    if (isNaN(stamp.getTime())) return "";

    const minutes = Math.round((Date.now() - stamp.getTime()) / 60000);
    if (minutes < 1) return "just now";
    if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;

    const hours = Math.round(minutes / 60);
    if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;

    const days = Math.round(hours / 24);
    if (days < 8) return `${days} day${days === 1 ? "" : "s"} ago`;
    return formatDateLogged(value);
}



// js-split:file=utils.js part=27of33
// Split from script.js - whole top-level blocks moved verbatim, no behavior change.
function localISODate(date) {
    const d = date || new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
}



// js-split:file=utils.js part=28of33
// Split from script.js - whole top-level blocks moved verbatim, no behavior change.
function todayISO() {
    return localISODate(new Date());
}



// js-split:file=utils.js part=29of33
// Split from script.js - whole top-level blocks moved verbatim, no behavior change.
function formatHourLabel(hour) {
    const h = Number(hour);
    const display = h % 12 === 0 ? 12 : h % 12;
    return `${display}:00 ${h >= 12 ? "PM" : "AM"}`;
}

// "14:30" -> "2:30 PM"


// js-split:file=utils.js part=30of33
// Split from script.js - whole top-level blocks moved verbatim, no behavior change.
function formatClock(value) {
    const raw = String(value || "").trim();
    const match = raw.match(/^(\d{1,2}):(\d{2})$/);
    if (!match) return raw || "—";
    const hour = Number(match[1]);
    const display = hour % 12 === 0 ? 12 : hour % 12;
    return `${display}:${match[2]} ${hour >= 12 ? "PM" : "AM"}`;
}



// js-split:file=utils.js part=31of33
// Split from script.js - whole top-level blocks moved verbatim, no behavior change.
function clockToMinutes(value) {
    const match = String(value || "").match(/^(\d{1,2}):(\d{2})$/);
    if (!match) return NaN;
    return Number(match[1]) * 60 + Number(match[2]);
}



// js-split:file=utils.js part=32of33
// Split from script.js - whole top-level blocks moved verbatim, no behavior change.
function sessionDayLabel(dateISO) {
    if (!dateISO) return "—";
    if (dateISO === todayISO()) return "Today";
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    if (dateISO === localISODate(tomorrow)) return "Tomorrow";
    return formatDateLogged(dateISO);
}



// js-split:file=utils.js part=33of33
// Split from script.js - whole top-level blocks moved verbatim, no behavior change.
function sessionSortValue(session) {
    const minutes = clockToMinutes(session.time);
    return `${session.date || ""} ${isNaN(minutes) ? 0 : String(minutes).padStart(4, "0")}`;
}

// Every place that reads a coach's specializations goes through these, so
// the list is formatted the same way in the table, dialogs and activity feed.
