// js-split:file=data.js part=1of59
// Split from script.js - whole top-level blocks moved verbatim, no behavior change.
// One-time cleanup: older versions seeded demo customers/tickets into localStorage.
// Remove those exact seeded records (matched by name + contact) without touching real data.
(function purgeSeededDemoData() {
    try {
        if (localStorage.getItem("crmPurgedDemoSeed1")) return;

        const demo = [
            ["Alice Johnson", "555-1234"],
            ["Mark Taylor", "555-5678"],
            ["Sarah Connor", "555-9012"],
            ["David Lee", "555-3456"],
            ["Chris Evans", "555-7890"],
            ["Tom Hardy", "555-1111"],
            ["John Doe", "john@example.com"],
            ["Jane Smith", "jane@example.com"]
        ];

        const isDemo = (item) => demo.some(([name, marker]) => {
            if (String(item.name || "") !== name) return false;
            const contact = [item.contact, item.email, item.phone].filter(Boolean).join(" | ");
            return contact.includes(marker);
        });

        ["crmDirectory", "crmPipelineLeads", "crmStaffTickets", "crmInquiries"].forEach(key => {
            try {
                const list = JSON.parse(localStorage.getItem(key) || "[]");
                if (!Array.isArray(list)) return;
                const kept = list.filter(item => !isDemo(item));
                if (kept.length !== list.length) {
                    localStorage.setItem(key, JSON.stringify(kept));
                }
            } catch (e) { /* skip malformed storage */ }
        });

        localStorage.setItem("crmPurgedDemoSeed1", "1");
    } catch (e) { /* non-critical */ }
})();


// js-split:file=data.js part=2of59
// Split from script.js - whole top-level blocks moved verbatim, no behavior change.
const PRIORITY_NOT_DEFINED = "Not Defined";



// js-split:file=data.js part=3of59
// Split from script.js - whole top-level blocks moved verbatim, no behavior change.
function getTicketStorage(source) {
    return JSON.parse(localStorage.getItem(source === "staff" ? "crmStaffTickets" : "crmInquiries") || "[]");
}



// js-split:file=data.js part=4of59
// Split from script.js - whole top-level blocks moved verbatim, no behavior change.
function saveTicketStorage(source, list) {
    localStorage.setItem(source === "staff" ? "crmStaffTickets" : "crmInquiries", JSON.stringify(list));
}



// js-split:file=data.js part=5of59
// Split from script.js - whole top-level blocks moved verbatim, no behavior change.
const PIPELINE_KEY = "crmPipelineLeads";



// js-split:file=data.js part=6of59
// Split from script.js - whole top-level blocks moved verbatim, no behavior change.
const PIPELINE_STAGES = [
    { id: "new-lead", title: "New Lead", goal: "Goal: Respond within 5 minutes." },
    { id: "contacted", title: "Contacted", goal: "Goal: Book a gym tour." },
    { id: "visit", title: "Visit Scheduled", goal: "Goal: Send an automated text reminder." },
    { id: "trial", title: "Trial / Tour Completed", goal: "Goal: Present a tailored membership offer on the spot." },
    { id: "won", title: "Membership (Won)", goal: "Goal: Trigger onboarding and welcome sequence." },
    { id: "lost", title: "Closed / Lost", goal: "Goal: Move to a long-term re-engagement email list." }
];

// Single source of truth for pipeline staff. Both the filter bar and the
// Add/Edit Prospecting Client form are populated from this list so the
// available staff can never drift apart between the two.


// js-split:file=data.js part=7of59
// Split from script.js - whole top-level blocks moved verbatim, no behavior change.
const PIPELINE_STAFF = ["Coach Joeff", "Agent Mariel"];

// Legacy names kept so leads saved before the staff rename still resolve to a
// valid option instead of appearing as an unassigned staff member.


// js-split:file=data.js part=8of59
// Split from script.js - whole top-level blocks moved verbatim, no behavior change.
const PIPELINE_STAFF_ALIASES = {
    "Coach Mike": "Coach Joeff",
    "Agent Sarah": "Agent Mariel"
};



// js-split:file=data.js part=9of59
// Split from script.js - whole top-level blocks moved verbatim, no behavior change.
const PIPELINE_TIERS = [
    { value: "6-Month Membership", label: "6-Month Membership ($45/mo)", price: 45, months: 6 },
    { value: "12-Month Membership", label: "12-Month Membership ($40/mo)", price: 40, months: 12 },
    { value: "18-Month Membership", label: "18-Month Membership ($35/mo)", price: 35, months: 18 }
];



// js-split:file=data.js part=10of59
// Split from script.js - whole top-level blocks moved verbatim, no behavior change.
function getPipelineLeads() {
    return JSON.parse(localStorage.getItem(PIPELINE_KEY) || "[]").map(l => {
        const tier = normalizePipelineTier(l.tier);
        const hasValue = l.monthlyValue !== undefined && l.monthlyValue !== null && l.monthlyValue !== "";
        return {
            ...l,
            tier,
            staff: normalizePipelineStaff(l.staff),
            monthlyValue: hasValue ? Number(l.monthlyValue) : pipelineTierPrice(tier)
        };
    });
}



// js-split:file=data.js part=11of59
// Split from script.js - whole top-level blocks moved verbatim, no behavior change.
function savePipelineLeads(list) {
    localStorage.setItem(PIPELINE_KEY, JSON.stringify(list));
}



// js-split:file=data.js part=12of59
// Split from script.js - whole top-level blocks moved verbatim, no behavior change.
const CAMPAIGN_KEY = "crmCampaigns";



// js-split:file=data.js part=13of59
// Split from script.js - whole top-level blocks moved verbatim, no behavior change.
const CAMPAIGN_PLATFORMS = ["Instagram", "Facebook", "Twitter", "TikTok", "Other"];

// Badge colour per campaign status, reusing the shared .badge palette


// js-split:file=data.js part=14of59
// Split from script.js - whole top-level blocks moved verbatim, no behavior change.
const CAMPAIGN_STATUSES = [
    { value: "Scheduled", badge: "warning" },
    { value: "Running", badge: "active" },
    { value: "Completed", badge: "open" }
];

// Fallback artwork so a campaign saved without an image URL still renders a card


// js-split:file=data.js part=15of59
// Split from script.js - whole top-level blocks moved verbatim, no behavior change.
const CAMPAIGN_PLACEHOLDER_IMAGE = "https://images.unsplash.com/photo-1517838277536-f5f99be501cd?w=400&q=80";



// js-split:file=data.js part=16of59
// Split from script.js - whole top-level blocks moved verbatim, no behavior change.
function getCampaigns() {
    return JSON.parse(localStorage.getItem(CAMPAIGN_KEY) || "[]");
}



// js-split:file=data.js part=17of59
// Split from script.js - whole top-level blocks moved verbatim, no behavior change.
function saveCampaigns(list) {
    localStorage.setItem(CAMPAIGN_KEY, JSON.stringify(list));
}



// js-split:file=data.js part=18of59
// Split from script.js - whole top-level blocks moved verbatim, no behavior change.
const INSTAGRAM_HOSTS = ["instagram.com", "www.instagram.com", "m.instagram.com"];


// js-split:file=data.js part=19of59
// Split from script.js - whole top-level blocks moved verbatim, no behavior change.
const FACEBOOK_HOSTS = ["facebook.com", "www.facebook.com", "m.facebook.com", "web.facebook.com", "mbasic.facebook.com"];

// Short hosts that stand in for a facebook.com permalink. Facebook does not
// accept them in the XFBML plugin, so the card links out instead of embedding.


// js-split:file=data.js part=20of59
// Split from script.js - whole top-level blocks moved verbatim, no behavior change.
const FACEBOOK_SHORT_HOSTS = ["fb.watch", "fb.com"];



// js-split:file=data.js part=21of59
// Split from script.js - whole top-level blocks moved verbatim, no behavior change.
const CAMPAIGN_PLATFORM_TINTS = {
    Instagram: "instagram",
    Facebook: "facebook",
    Twitter: "twitter",
    TikTok: "tiktok"
};

// Platform chip drawn over the thumbnail. The chip text also keeps the card
// searchable by platform name through the existing topbar filter.


// js-split:file=data.js part=22of59
// Split from script.js - whole top-level blocks moved verbatim, no behavior change.
const CAMPAIGN_EMBED_SCRIPTS = {};



// js-split:file=data.js part=23of59
// Split from script.js - whole top-level blocks moved verbatim, no behavior change.
const INSTAGRAM_EMBED_SRC = "https://www.instagram.com/embed.js";


// js-split:file=data.js part=24of59
// Split from script.js - whole top-level blocks moved verbatim, no behavior change.
const FACEBOOK_EMBED_SRC = "https://connect.facebook.net/en_US/sdk.js#xfbml=1&version=v19.0";

// A preview should never leave a card spinning, so a vendor script that stalls is
// treated the same as one that fails outright.


// js-split:file=data.js part=25of59
// Split from script.js - whole top-level blocks moved verbatim, no behavior change.
const CAMPAIGN_EMBED_TIMEOUT = 8000;



// js-split:file=data.js part=26of59
// Split from script.js - whole top-level blocks moved verbatim, no behavior change.
const DIRECTORY_KEY = "crmDirectory";



// js-split:file=data.js part=27of59
// Split from script.js - whole top-level blocks moved verbatim, no behavior change.
function getDirectoryCustomers() {
    const staff = JSON.parse(localStorage.getItem(DIRECTORY_KEY) || "[]");
    const registered = JSON.parse(localStorage.getItem("crmCustomers") || "[]")
        .map(c => {
            const months = tierDurationMonths(c.tier);
            const exp = c.exp || (months && c.joined ? computeExpirationDate(months, new Date(c.joined + "T00:00:00")) : "");
                return {
                    id: "reg-" + c.username,
                    name: c.name,
                    contact: [c.email, c.phone].filter(Boolean).join(" / ") || "—",
                    keyFob: c.keyFob || c.username,
                    tier: c.tier,
                    joined: c.joined || "—",
                    exp,
                    status: c.status || "Active",
                    freezeStartDate: c.freezeStartDate || null,
                    freezeEndDate: c.freezeEndDate || null,
                    freezeMonths: c.freezeMonths || null,
                    originalExpirationDate: c.originalExpirationDate || c.exp || null,
                    updatedExpirationDate: c.updatedExpirationDate || exp || null,
                    // Archived is part of the projection: a registered account is
                    // whitelisted field by field here, so leaving it out would
                    // silently un-archive the member everywhere it is read.
                    archived: Boolean(c.archived),
                    archivedAt: c.archivedAt || null
                };
        });
    return [...staff, ...registered];
}

// One rule for "needs attention": anything inside this many days of its
// expiration date is expiring, everything past it is expired.


// js-split:file=data.js part=28of59
// Split from script.js - whole top-level blocks moved verbatim, no behavior change.
const RENEWAL_WINDOW_DAYS = 30;



// js-split:file=data.js part=29of59
// Split from script.js - whole top-level blocks moved verbatim, no behavior change.
function getActiveDirectoryCustomers() {
    return getDirectoryCustomers().filter(c => !memberIsArchived(c));
}



// js-split:file=data.js part=30of59
// Split from script.js - whole top-level blocks moved verbatim, no behavior change.
function getArchivedDirectoryCustomers() {
    return getDirectoryCustomers()
        .filter(memberIsArchived)
        .sort((a, b) => String(b.archivedAt || "").localeCompare(String(a.archivedAt || "")));
}

// Applies a change to whichever store owns the record: a registered account
// (crmCustomers, keyed "reg-<username>") or a front desk directory entry
// (crmDirectory). Returns false when no record matches.


// js-split:file=data.js part=31of59
// Split from script.js - whole top-level blocks moved verbatim, no behavior change.
function allTickets() {
    return [
        ...JSON.parse(localStorage.getItem("crmStaffTickets") || "[]"),
        ...JSON.parse(localStorage.getItem("crmInquiries") || "[]")
    ];
}



// js-split:file=data.js part=32of59
// Split from script.js - whole top-level blocks moved verbatim, no behavior change.
const ACTIVITY_KEY = "crmActivities";


// js-split:file=data.js part=33of59
// Split from script.js - whole top-level blocks moved verbatim, no behavior change.
const ACTIVITY_LOG_LIMIT = 80;        // newest entries kept in storage


// js-split:file=data.js part=34of59
// Split from script.js - whole top-level blocks moved verbatim, no behavior change.
const ACTIVITY_PREVIEW_COUNT = 6;     // rows shown before "View All"


// js-split:file=data.js part=35of59
// Split from script.js - whole top-level blocks moved verbatim, no behavior change.
const ACTIVITY_FULL_COUNT = 30;       // rows shown after "View All"


// js-split:file=data.js part=36of59
// Split from script.js - whole top-level blocks moved verbatim, no behavior change.
const ACTIVITY_EXPIRING_LIMIT = 4;    // nearest renewals surfaced in the feed

// Icons match the stroke style of the existing nav / stat icons, and the tone
// reuses the shared status palette so each activity type reads at a glance.


// js-split:file=data.js part=37of59
// Split from script.js - whole top-level blocks moved verbatim, no behavior change.
const ACTIVITY_TYPES = {
    member: {
        tone: "brand",
        icon: '<svg viewBox="0 0 24 24"><path d="M15.5 19v-1.5a3.5 3.5 0 0 0-3.5-3.5H6.5A3.5 3.5 0 0 0 3 17.5V19"/><circle cx="9.2" cy="7.5" r="3.2"/><path d="M21 19v-1.5a3.5 3.5 0 0 0-2.6-3.38"/><path d="M16 4.3a3.2 3.2 0 0 1 0 6.2"/></svg>'
    },
    ticket: {
        tone: "blue",
        icon: '<svg viewBox="0 0 24 24"><path d="M20.5 12.5c0 3.6-3.8 6.5-8.5 6.5a9.7 9.7 0 0 1-2.6-.35L4.5 20.5l1.2-3.4A6.3 6.3 0 0 1 3.5 12.5C3.5 8.9 7.3 6 12 6s8.5 2.9 8.5 6.5Z"/><path d="M9 12.5h.01M12 12.5h.01M15 12.5h.01"/></svg>'
    },
    membership: {
        tone: "green",
        icon: '<svg viewBox="0 0 24 24"><path d="M20 11a8 8 0 1 0-2.2 6"/><path d="M20 6v5h-5"/></svg>'
    },
    frozen: {
        tone: "blue",
        icon: '<svg viewBox="0 0 24 24"><path d="M12 3v18M4.2 7.5l15.6 9M19.8 7.5l-15.6 9"/><path d="M12 7.2 9.8 5M12 7.2 14.2 5M12 16.8 9.8 19M12 16.8l2.2 2.2"/></svg>'
    },
    renewal: {
        tone: "brand",
        icon: '<svg viewBox="0 0 24 24"><path d="M20 11a8 8 0 1 0-2.2 6"/><path d="M20 6v5h-5"/></svg>'
    },
    followup: {
        tone: "brand",
        icon: '<svg viewBox="0 0 24 24"><rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M8 3v4M16 3v4M3.5 10h17"/><path d="M12 13.5h.01"/></svg>'
    },
    won: {
        tone: "green",
        icon: '<svg viewBox="0 0 24 24"><path d="m12 3.6 2.2 4.9 5.3.7-3.9 3.6 1 5.2-4.6-2.6-4.6 2.6 1-5.2L4.5 9.2l5.3-.7L12 3.6Z"/></svg>'
    },
    expiring: {
        tone: "amber",
        icon: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/></svg>'
    },
    expired: {
        tone: "rose",
        icon: '<svg viewBox="0 0 24 24"><path d="M12 4.5 21 19.5H3z"/><path d="M12 10v3.5"/><path d="M12 16.6h.01"/></svg>'
    },
    resolved: {
        tone: "green",
        icon: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5"/><path d="M8 12.3l2.7 2.7L16.2 9.5"/></svg>'
    },
    assignment: {
        tone: "blue",
        icon: '<svg viewBox="0 0 24 24"><path d="M4 20h4l10-10-4-4L4 16v4Z"/><path d="M13.5 6.5l4 4"/></svg>'
    },
    lead: {
        tone: "brand",
        icon: '<svg viewBox="0 0 24 24"><path d="M6.5 19v-1.5a3.5 3.5 0 0 1 3.5-3.5h3a3.5 3.5 0 0 1 3.5 3.5V19"/><circle cx="12" cy="8" r="3.5"/></svg>'
    },
    campaign: {
        tone: "blue",
        icon: '<svg viewBox="0 0 24 24"><path d="M17 10.5V7a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-3.5l4 4v-11l-4 4Z"/></svg>'
    },
    coach: {
        tone: "brand",
        icon: '<svg viewBox="0 0 24 24"><path d="M4 20h4l10-10-4-4L4 16v4Z"/><path d="M13.5 6.5l4 4"/></svg>'
    }
};

// Deep link into a module that already supports a search box, so an activity
// click lands on the matching record instead of on a brand new page.


// js-split:file=data.js part=38of59
// Split from script.js - whole top-level blocks moved verbatim, no behavior change.
function getActivities() {
    try {
        const list = JSON.parse(localStorage.getItem(ACTIVITY_KEY) || "[]");
        return Array.isArray(list) ? list.filter(entry => entry && entry.title) : [];
    } catch (e) {
        return [];
    }
}

// Appends one activity. Every field is a display string composed by the caller,
// which keeps the renderer trivial. A storage failure must never interrupt the
// CRM action that triggered it, so the whole body is defensive.


// js-split:file=data.js part=39of59
// Split from script.js - whole top-level blocks moved verbatim, no behavior change.
const COACH_KEY = "crmCoaches";


// js-split:file=data.js part=40of59
// Split from script.js - whole top-level blocks moved verbatim, no behavior change.
const COACH_ASSIGNMENT_KEY = "crmCoachAssignments";


// js-split:file=data.js part=41of59
// Split from script.js - whole top-level blocks moved verbatim, no behavior change.
const COACH_SESSION_KEY = "crmCoachSessions";

// A coach can hold more than one specialization, so the record keeps a
// list. The picker is a fixed catalogue to keep filtering predictable.


// js-split:file=data.js part=42of59
// Split from script.js - whole top-level blocks moved verbatim, no behavior change.
const COACH_SPECIALIZATIONS = [
    "Strength Training",
    "Weight Loss",
    "HIIT",
    "Cardio",
    "Muscle Building",
    "General Fitness"
];

// A coach either works the floor or is away: there is no third state, and
// both non-Active cases are barred from taking sessions.


// js-split:file=data.js part=43of59
// Split from script.js - whole top-level blocks moved verbatim, no behavior change.
const COACH_STATUSES = ["Active", "On Leave"];

// Shared by the live check while typing and the check on save, so the two
// can never disagree about what counts as an address.


// js-split:file=data.js part=44of59
// Split from script.js - whole top-level blocks moved verbatim, no behavior change.
const COACH_EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;


// js-split:file=data.js part=45of59
// Split from script.js - whole top-level blocks moved verbatim, no behavior change.
const COACH_PHONE_DIGITS = 11;



// js-split:file=data.js part=46of59
// Split from script.js - whole top-level blocks moved verbatim, no behavior change.
const COACH_SESSION_STATUSES = ["Scheduled", "Completed", "Missed", "Cancelled"];

// JS getDay(): 0 = Sunday. Kept as numbers so a coach record stays small.


// js-split:file=data.js part=47of59
// Split from script.js - whole top-level blocks moved verbatim, no behavior change.
const COACH_WEEKDAYS = [
    { value: 0, short: "Sun", full: "Sunday" },
    { value: 1, short: "Mon", full: "Monday" },
    { value: 2, short: "Tue", full: "Tuesday" },
    { value: 3, short: "Wed", full: "Wednesday" },
    { value: 4, short: "Thu", full: "Thursday" },
    { value: 5, short: "Fri", full: "Friday" },
    { value: 6, short: "Sat", full: "Saturday" }
];

// Weekly grid + shift picker share one range so a booked slot always
// falls inside a day the coach actually works.


// js-split:file=data.js part=48of59
// Split from script.js - whole top-level blocks moved verbatim, no behavior change.
const COACH_SLOT_START = 6;


// js-split:file=data.js part=49of59
// Split from script.js - whole top-level blocks moved verbatim, no behavior change.
const COACH_SLOT_END = 20;

// One training session occupies a one-hour block, which is what the
// conflict check compares against.


// js-split:file=data.js part=50of59
// Split from script.js - whole top-level blocks moved verbatim, no behavior change.
const COACH_SESSION_MINUTES = 60;



// js-split:file=data.js part=51of59
// Split from script.js - whole top-level blocks moved verbatim, no behavior change.
function getCoaches() {
    return JSON.parse(localStorage.getItem(COACH_KEY) || "[]").map(normalizeCoach);
}



// js-split:file=data.js part=52of59
// Split from script.js - whole top-level blocks moved verbatim, no behavior change.
function saveCoaches(list) {
    localStorage.setItem(COACH_KEY, JSON.stringify(list));
}



// js-split:file=data.js part=53of59
// Split from script.js - whole top-level blocks moved verbatim, no behavior change.
function getCoachAssignments() {
    return JSON.parse(localStorage.getItem(COACH_ASSIGNMENT_KEY) || "[]");
}



// js-split:file=data.js part=54of59
// Split from script.js - whole top-level blocks moved verbatim, no behavior change.
function saveCoachAssignments(list) {
    localStorage.setItem(COACH_ASSIGNMENT_KEY, JSON.stringify(list));
}



// js-split:file=data.js part=55of59
// Split from script.js - whole top-level blocks moved verbatim, no behavior change.
function getCoachSessions() {
    return JSON.parse(localStorage.getItem(COACH_SESSION_KEY) || "[]");
}



// js-split:file=data.js part=56of59
// Split from script.js - whole top-level blocks moved verbatim, no behavior change.
function saveCoachSessions(list) {
    localStorage.setItem(COACH_SESSION_KEY, JSON.stringify(list));
}

// Records saved before coaches could hold several specializations carry a
// single `specialization` string, so every read goes through here and the
// list is rebuilt from whichever shape is in storage. The employment status
// is migrated the same way: "Inactive" is gone, and a coach who was not
// working is now recorded as On Leave. Phone numbers are stored the way the
// form accepts them, so an older spaced number stays editable.


// js-split:file=data.js part=57of59
// Split from script.js - whole top-level blocks moved verbatim, no behavior change.
const COACH_FEEDBACK_LIMIT = 20;



// js-split:file=data.js part=58of59
// Split from script.js - whole top-level blocks moved verbatim, no behavior change.
const RENEWAL_REQUEST_KIND = "renewal";



// js-split:file=data.js part=59of59
// Split from script.js - whole top-level blocks moved verbatim, no behavior change.
function getRenewalRequests() {
    return JSON.parse(localStorage.getItem("crmInquiries") || "[]")
        .filter(inq => inq && inq.kind === RENEWAL_REQUEST_KIND);
}

// An open request blocks a second one; a resolved request leaves the member
// free to ask again once the term is close to ending again.
