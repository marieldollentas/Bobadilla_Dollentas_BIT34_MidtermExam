// js-split:file=dashboard.js part=1of30
// Split from script.js - whole top-level blocks moved verbatim, no behavior change.
function setCampaignEmbedded(card, expanded) {
    if (!card) return;
    card.classList.toggle("is-embedded", !!expanded);
    const panel = card.querySelector(".campaign-embed");
    if (panel) panel.hidden = !expanded;
    const toggle = card.querySelector(".social-embed-toggle");
    if (toggle) {
        toggle.textContent = expanded ? "Hide Post" : "Preview Post";
        toggle.setAttribute("aria-expanded", expanded ? "true" : "false");
    }
}



// js-split:file=dashboard.js part=2of30
// Split from script.js - whole top-level blocks moved verbatim, no behavior change.
function buildCampaignCard(campaign) {
    const div = document.createElement("div");
    div.className = "campaign-card";
    div.setAttribute("data-id", campaign.id);

    const info = campaignSocialInfo(campaign);
    const imageUrl = safeUrl(campaign.imageUrl);
    const label = escapeHtml(info.ok && info.embeddable ? "Open Post" : "View Post");
    const link = info.url
        ? `<a href="${escapeHtml(info.url)}" target="_blank" rel="noopener" class="social-link">${label}</a>`
        : "";

    // A saved link that no longer parses is surfaced on the card rather than
    // dropped, so the staff member who added it can see why it stopped working.
    const note = !info.ok && campaign.postUrl
        ? `<p class="campaign-note">Link not previewed: ${escapeHtml(info.reason)}</p>`
        : (info.ok && info.note && !info.embeddable
            ? `<p class="campaign-note">${escapeHtml(info.note)}</p>`
            : "");

    const toggle = info.ok && info.embeddable
        ? `<button class="btn-view social-embed-toggle" aria-expanded="false" onclick="toggleCampaignEmbed(${Number(campaign.id)})">Preview Post</button>`
        : "";

    div.innerHTML = `
        <div class="campaign-media">
            <img src="${escapeHtml(imageUrl || CAMPAIGN_PLACEHOLDER_IMAGE)}" alt="${escapeHtml(campaign.title)}" class="campaign-img">
            ${campaignPlatformChip(info.ok ? info.platform : campaign.platform)}
        </div>
        <h4>${escapeHtml(campaign.title)}</h4>
        ${note}
        ${link}
        ${campaignStatusBadge(campaign.status)}
        <div class="kanban-card-actions">
            <button class="btn-view" onclick="openEditCampaign(${Number(campaign.id)})">Edit</button>
            ${toggle}
            <button class="btn-delete" onclick="requestDeleteCampaign(${Number(campaign.id)})">Delete</button>
        </div>
        <div class="campaign-embed" hidden></div>
    `;
    return div;
}



// js-split:file=dashboard.js part=3of30
// Split from script.js - whole top-level blocks moved verbatim, no behavior change.
function renderCampaigns() {
    const container = document.getElementById("campaignCards");
    if (!container) return;

    container.innerHTML = "";
    const campaigns = getCampaigns();
    if (campaigns.length === 0) {
        const p = document.createElement("p");
        p.className = "card-meta";
        p.textContent = "No campaigns yet. Use \"+ Add Campaign\" to create one.";
        container.appendChild(p);
        return;
    }
    campaigns.forEach(c => container.appendChild(buildCampaignCard(c)));
}

// Official embed scripts are loaded at most once per page, but only after a user
// opens a preview. They are keyed so Instagram and Facebook each get their own
// entry and a card that is reopened does not fetch the vendor code again.


// js-split:file=dashboard.js part=4of30
// Split from script.js - whole top-level blocks moved verbatim, no behavior change.
function loadCampaignEmbedScript(key, src) {
    if (CAMPAIGN_EMBED_SCRIPTS[key]) return CAMPAIGN_EMBED_SCRIPTS[key];

    const pending = new Promise((resolve, reject) => {
        const script = document.createElement("script");
        script.src = src;
        script.async = true;
        script.onload = () => resolve();
        script.onerror = () => reject(new Error(`The ${key} embed script could not be reached.`));
        document.head.appendChild(script);
    });

    CAMPAIGN_EMBED_SCRIPTS[key] = pending;

    // Clearing the cache on failure lets a user retry after coming back online
    // instead of being stuck with a permanently broken preview.
    pending.catch(() => {
        if (CAMPAIGN_EMBED_SCRIPTS[key] === pending) delete CAMPAIGN_EMBED_SCRIPTS[key];
    });

    return pending;
}



// js-split:file=dashboard.js part=5of30
// Split from script.js - whole top-level blocks moved verbatim, no behavior change.
function withCampaignEmbedTimeout(promise, label) {
    return Promise.race([
        promise,
        new Promise((_, reject) => setTimeout(() => reject(new Error(label)), CAMPAIGN_EMBED_TIMEOUT))
    ]);
}

// Shared shell for an open preview: a heading with a permanent link out, so a
// visitor is never trapped behind a vendor script that failed to render.


// js-split:file=dashboard.js part=6of30
// Split from script.js - whole top-level blocks moved verbatim, no behavior change.
function buildCampaignEmbedPanel(platform, url) {
    const panel = document.createElement("div");
    panel.className = "campaign-embed-panel";

    const head = document.createElement("div");
    head.className = "campaign-embed-head";

    const title = document.createElement("span");
    title.className = "campaign-embed-title";
    title.textContent = `${platform} preview`;

    const link = document.createElement("a");
    link.className = "social-link";
    link.href = url;
    link.target = "_blank";
    link.rel = "noopener";
    link.textContent = "Open Post ↗";

    head.appendChild(title);
    head.appendChild(link);

    const frame = document.createElement("div");
    frame.className = "campaign-embed-frame";

    panel.appendChild(head);
    panel.appendChild(frame);
    return { panel, frame };
}



// js-split:file=dashboard.js part=7of30
// Split from script.js - whole top-level blocks moved verbatim, no behavior change.
function campaignEmbedFailed(panel, message) {
    const frame = panel.querySelector(".campaign-embed-frame");
    if (!frame) return;

    frame.innerHTML = "";
    const note = document.createElement("p");
    note.className = "campaign-note";
    note.textContent = message;
    frame.appendChild(note);
    panel.dataset.state = "error";
}

// Instagram renders through a blockquote placeholder that embed.js upgrades into
// an iframe. The blockquote content is the documented no-script fallback.


// js-split:file=dashboard.js part=8of30
// Split from script.js - whole top-level blocks moved verbatim, no behavior change.
function mountInstagramEmbed(panel, url) {
    const { panel: shell, frame } = buildCampaignEmbedPanel("Instagram", url);
    panel.appendChild(shell);

    const quote = document.createElement("blockquote");
    quote.className = "instagram-media campaign-embed-post";
    quote.setAttribute("data-instgrm-permalink", url);
    quote.setAttribute("data-instgrm-version", "14");
    quote.setAttribute("data-instgrm-captioned", "");

    const fallback = document.createElement("a");
    fallback.href = url;
    fallback.target = "_blank";
    fallback.rel = "noopener";
    fallback.textContent = "View this post on Instagram";
    quote.appendChild(fallback);

    frame.appendChild(quote);

    return loadCampaignEmbedScript("Instagram", INSTAGRAM_EMBED_SRC)
        .then(() => {
            if (window.instgrm && window.instgrm.Embeds) {
                window.instgrm.Embeds.process(quote);
                panel.dataset.state = "ready";
                return;
            }
            throw new Error("Instagram's embed script loaded without its embedder.");
        })
        .catch((error) => campaignEmbedFailed(panel, error.message));
}

// Facebook uses the XFBML plugin, which reads data-href off a plain container and
// swaps in an iframe of its own.


// js-split:file=dashboard.js part=9of30
// Split from script.js - whole top-level blocks moved verbatim, no behavior change.
function mountFacebookEmbed(panel, url) {
    const { panel: shell, frame } = buildCampaignEmbedPanel("Facebook", url);
    panel.appendChild(shell);

    const post = document.createElement("div");
    post.className = "fb-post";
    post.setAttribute("data-href", url);
    post.setAttribute("data-width", "500");
    post.setAttribute("data-show-text", "true");
    frame.appendChild(post);

    return loadCampaignEmbedScript("Facebook", FACEBOOK_EMBED_SRC)
        .then(() => {
            if (window.FB && window.FB.XFBML) {
                window.FB.XFBML.parse(frame);
                panel.dataset.state = "ready";
                return;
            }
            throw new Error("Facebook's embed script loaded without its plugin.");
        })
        .catch((error) => campaignEmbedFailed(panel, error.message));
}



// js-split:file=dashboard.js part=10of30
// Split from script.js - whole top-level blocks moved verbatim, no behavior change.
function requestCampaignEmbed(panel, info) {
    panel.dataset.state = "pending";

    const note = document.createElement("p");
    // Neutral tone while waiting: the warning note is reserved for real failures.
    note.className = "campaign-embed-loading";
    note.textContent = `Loading ${info.platform} post…`;
    panel.appendChild(note);

    const mount = info.platform === "Instagram" ? mountInstagramEmbed : mountFacebookEmbed;
    return withCampaignEmbedTimeout(mount(panel, info.url), "The post took too long to load. Use Open Post to view it on the platform.")
        .then(() => note.remove())
        .catch((error) => {
            note.remove();
            campaignEmbedFailed(panel, error.message);
        });
}

// Expands or collapses the embedded post on one campaign card. Embeds are never
// requested on page load so the dashboard keeps its existing weight and the
// cards stay a fast, scannable summary.


// js-split:file=dashboard.js part=11of30
// Split from script.js - whole top-level blocks moved verbatim, no behavior change.
function toggleCampaignEmbed(id) {
    const card = document.querySelector(`.campaign-card[data-id="${id}"]`);
    if (!card) return;

    const panel = card.querySelector(".campaign-embed");
    if (!panel) return;

    const wasExpanded = !panel.hidden;
    if (wasExpanded) {
        setCampaignEmbedded(card, false);
        return;
    }

    setCampaignEmbedded(card, true);
    if (panel.dataset.state === "ready" || panel.dataset.state === "pending") return;

    const campaign = getCampaigns().find(c => String(c.id) === String(id));
    const info = campaign && campaignSocialInfo(campaign);
    if (!info || !info.ok || !info.embeddable) {
        setCampaignEmbedded(card, false);
        return;
    }

    panel.innerHTML = "";
    requestCampaignEmbed(panel, info);
}



// js-split:file=dashboard.js part=12of30
// Split from script.js - whole top-level blocks moved verbatim, no behavior change.
function openEditCampaign(id) {
    const campaign = getCampaigns().find(c => String(c.id) === String(id));
    const modal = document.getElementById("campaignModal");
    if (!campaign || !modal) return;

    const platform = campaignPlatformOption(campaign.platform);

    document.getElementById("campaignId").value = campaign.id;
    document.getElementById("campaignTitle").value = campaign.title || "";
    document.getElementById("campaignPlatform").value = platform;
    document.getElementById("campaignPlatformOther").value = platform === "Other" ? (campaign.platform || "") : "";
    document.getElementById("campaignStatus").value = campaign.status || "Scheduled";
    document.getElementById("campaignPostUrl").value = campaign.postUrl || "";
    document.getElementById("campaignImageUrl").value = campaign.imageUrl || "";

    const group = document.getElementById("otherPlatformGroup");
    if (group) group.style.display = platform === "Other" ? "block" : "none";

    document.getElementById("campaignModalTitle").textContent = "Edit Marketing Campaign";
    document.getElementById("campaignForm").querySelector('button[type="submit"]').textContent = "Update Campaign";
    modal.style.display = "flex";
}



// js-split:file=dashboard.js part=13of30
// Split from script.js - whole top-level blocks moved verbatim, no behavior change.
function requestDeleteCampaign(id) {
    if (!confirm("Delete this marketing campaign? This cannot be undone.")) return;
    const campaigns = getCampaigns();
    const campaign = campaigns.find(c => String(c.id) === String(id));
    saveCampaigns(campaigns.filter(c => String(c.id) !== String(id)));
    renderCampaigns();
    if (campaign) {
        logActivity({
            type: "campaign",
            title: `Social media marketing campaign deleted: ${campaign.title}`,
            meta: `${campaign.platform || ""}`,
            href: activityHref("index.html", campaign.title)
        });
    }
}

// ---- Customer Directory ----
// Single source of truth: staff-managed directory entries + registered accounts (crmCustomers)


// js-split:file=dashboard.js part=14of30
// Split from script.js - whole top-level blocks moved verbatim, no behavior change.
function memberChartData() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const rows = getActiveDirectoryCustomers();

    const statusCounts = { "Active": 0, "Expiring Soon": 0, "Expired": 0 };
    const tierCounts = {};
    rows.forEach(c => {
        const status = customerStatus(c.exp, today);
        if (statusCounts[status] === undefined) statusCounts[status] = 0;
        statusCounts[status]++;

        const tier = c.tier || "Unassigned";
        tierCounts[tier] = (tierCounts[tier] || 0) + 1;
    });

    const byStatus = ["Active", "Expiring Soon", "Expired"].map((label, index) => ({
        label,
        value: statusCounts[label] || 0,
        color: [CHART_COLORS.active, CHART_COLORS.warning, CHART_COLORS.danger][index]
    }));

    // The tier price rides along as the second line of the ranked-bar label,
    // so the plan and what it costs are read together.
    const byTier = PIPELINE_TIERS.map(tier => ({
        label: tier.value,
        note: `$${tier.price}/mo`,
        value: tierCounts[tier.value] || 0
    }));
    const knownTiers = PIPELINE_TIERS.map(tier => tier.value);
    const otherTotal = Object.keys(tierCounts)
        .filter(tier => !knownTiers.includes(tier))
        .reduce((sum, tier) => sum + tierCounts[tier], 0);
    if (otherTotal > 0) byTier.push({ label: "Other", value: otherTotal });

    return { byStatus, byTier };
}

// Month buckets ending with the current month, used by the ticket histogram.


// js-split:file=dashboard.js part=15of30
// Split from script.js - whole top-level blocks moved verbatim, no behavior change.
function recentMonthBuckets(count) {
    const buckets = [];
    const now = new Date();
    for (let back = count - 1; back >= 0; back--) {
        const d = new Date(now.getFullYear(), now.getMonth() - back, 1);
        buckets.push({
            key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
            label: d.toLocaleString("en-US", { month: "short" })
        });
    }
    return buckets;
}

// Both staff tickets and customer portal inquiries, matching the open-ticket stat.


// js-split:file=dashboard.js part=16of30
// Split from script.js - whole top-level blocks moved verbatim, no behavior change.
function ticketChartData(monthsBack) {
    const tickets = allTickets().filter(t => !t.archived);
    const buckets = recentMonthBuckets(monthsBack || 6);
    buckets.forEach(bucket => { bucket.value = 0; });

    tickets.forEach(ticket => {
        const key = String(ticket.date || "").slice(0, 7);
        const bucket = buckets.find(b => b.key === key);
        if (bucket) bucket.value++;
    });

    // Untriaged portal inquiries get their own slice so the queue never hides the
// work that has not been ranked yet.


// js-split:file=dashboard.js part=17of30
// Split from script.js - whole top-level blocks moved verbatim, no behavior change.
const byPriority = [PRIORITY_NOT_DEFINED, "High", "Medium", "Low"].map(priority => {
        const cls = priorityClass(priority);
        const color = priority === PRIORITY_NOT_DEFINED ? CHART_COLORS.info
            : cls === "danger" ? CHART_COLORS.danger
                : cls === "active" ? CHART_COLORS.active : CHART_COLORS.warning;
        return {
            label: priority,
            value: tickets.filter(t => String(t.priority || "").toLowerCase() === priority.toLowerCase()).length,
            color
        };
    });

    return { byMonth: buckets, byPriority };
}



// js-split:file=dashboard.js part=18of30
// Split from script.js - whole top-level blocks moved verbatim, no behavior change.
function pipelineChartData() {
    const leads = getPipelineLeads().filter(l => !l.archived);
    return PIPELINE_STAGES.map(stage => ({
        label: stage.title,
        value: leads.filter(l => l.stage === stage.id).length,
        color: stage.id === "won" ? CHART_COLORS.active
            : stage.id === "lost" ? CHART_COLORS.danger
                : CHART_COLORS.brand
    }));
}

// One renderer per metric, picked to match the shape of the data: a donut for
// the member-status split, ranked bars for tiers (long names), a trend line for
// ticket volume over time, a mix bar for priority share, a funnel for stages.


// js-split:file=dashboard.js part=19of30
// Split from script.js - whole top-level blocks moved verbatim, no behavior change.
function renderDashboardCharts() {
    if (!document.getElementById("chartMembersStatus")) return;

    const members = memberChartData();
    renderDonutChart("chartMembersStatus", members.byStatus, {
        title: "Members by membership status",
        centerLabel: "Members",
        emptyText: "No members in the directory yet."
    });
    renderRankedBars("chartMembersTier", members.byTier, {
        title: "Members by membership tier",
        emptyText: "No members in the directory yet.",
        color: CHART_COLORS.tier
    });

    const tickets = ticketChartData(6);
    renderTrendChart("chartTicketVolume", tickets.byMonth, {
        title: "Tickets logged per month over the last 6 months",
        emptyText: "No tickets logged in the last 6 months.",
        color: CHART_COLORS.info
    });
    renderMixBar("chartTicketPriority", tickets.byPriority, {
        title: "Tickets by priority",
        unit: "tickets",
        emptyText: "No tickets recorded yet."
    });

    renderFunnelChart("chartPipelineStages", pipelineChartData(), {
        title: "Pipeline leads by stage",
        emptyText: "No pipeline leads yet."
    });
}

// =============================================================
// Dashboard presentation extras (additive only)
// The redesigned cards below are filled from the same localStorage data the
// modules above already use, so every number is real rather than placeholder.
// No existing ID, storage key, listener, function or validation rule is
// changed, and every element is optional, so all pages still boot as before.
// =============================================================


// js-split:file=dashboard.js part=20of30
// Split from script.js - whole top-level blocks moved verbatim, no behavior change.
document.addEventListener("DOMContentLoaded", () => {
    const setText = (id, value) => {
        const el = document.getElementById(id);
        if (el) el.textContent = value;
    };

    const formatNumber = (value) => (Number(value) || 0).toLocaleString("en-US");

    const ticketsByStatus = (status) => allTickets()
        .filter(t => String(t.status || "").toLowerCase() === status).length;

    // Header chrome: avatar initials, role label and today's date
    function renderTopbarChrome() {
        const role = sessionStorage.getItem("crmRole");
        const user = sessionStorage.getItem("crmCurrentUser") || "";
        setText("userAvatar", (user.slice(0, 2) || "AF").toUpperCase());
        setText("userRole", role === "admin"
            ? "Front Desk Staff"
            : role === "customer" ? "Gym Member" : "Signed out");
        setText("topbarDate", new Date().toLocaleDateString("en-US", {
            weekday: "short", month: "short", day: "numeric", year: "numeric"
        }));
    }

    // Dashboard: the supporting line under each KPI card
    function renderKpiNotes() {
        const rows = getActiveDirectoryCustomers();
        const today = todayStart();

        let active = 0;
        let expiring = 0;
        let expired = 0;
        let frozen = 0;
        rows.forEach(c => {
            const status = getMemberStatus(c, today);
            if (status === "Active") active++;
            if (status === "Frozen") frozen++;
            if (status === "Expiring Soon") expiring++;
            if (status === "Expired") expired++;
        });

        const open = ticketsByStatus("open");
        const progress = ticketsByStatus("in progress");

        if (document.getElementById("statTotal")) setText("statTotal", formatNumber(rows.length));
        setText("statActiveNote", `${formatNumber(active)} of ${formatNumber(rows.length)} member record${rows.length === 1 ? "" : "s"} active`);
        if (document.getElementById("statFrozen")) setText("statFrozen", formatNumber(frozen));
        // Expired memberships are renewable too, so the renewal workload is
        // spelled out instead of leaving lapsed terms off the card.
        setText("statExpiringNote", [
            expiring ? `${formatNumber(expiring)} renewal${expiring === 1 ? "" : "s"} due within 30 days` : "No renewals due in the next 30 days",
            expired ? `${formatNumber(expired)} expired` : ""
        ].filter(Boolean).join(" · "));
        setText("statOpenNote", `${formatNumber(open)} open · ${formatNumber(progress)} in progress`);
    }

    // Dashboard: one counter per status under the marketing campaign cards
    function renderCampaignTotals() {
        const campaigns = getCampaigns();

        // Driven by the same list that colours the card badges, so the counters
        // and the status pills cannot drift apart.
        CAMPAIGN_STATUSES.forEach((meta) => {
            const count = campaigns.filter(c => String(c.status || "") === meta.value).length;
            setText(`campaignStat${meta.value}`, formatNumber(count));
        });
    }

    // Customer Directory: the three directory statistic cards
    function renderDirectoryStats() {
        if (!document.getElementById("memberStatTotal")) return;

        const today = todayStart();
        const rows = getActiveDirectoryCustomers();
        const withStatus = (status) => rows.filter(c => getMemberStatus(c, today) === status).length;

        const expiring = withStatus("Expiring Soon");
        const expired = withStatus("Expired");
        const frozen = withStatus("Frozen");

        setText("memberStatTotal", formatNumber(rows.length));
        setText("memberStatActive", formatNumber(withStatus("Active")));
        if (document.getElementById("memberStatFrozen")) setText("memberStatFrozen", formatNumber(frozen));
        setText("memberStatExpiring", formatNumber(expiring));
        if (document.getElementById("memberStatArchived")) {
            setText("memberStatArchived", formatNumber(getArchivedDirectoryCustomers().length));
        }
        setText("memberStatExpiringNote", [
            expiring ? `Renewals to collect within 30 days` : "No renewals due in the next 30 days",
            expired ? `${formatNumber(expired)} expired` : ""
        ].filter(Boolean).join(" · "));
    }

    // Support module: the three ticket statistic cards
    function renderTicketStats() {
        if (!document.getElementById("ticketStatOpen")) return;

        setText("ticketStatOpen", formatNumber(ticketsByStatus("open")));
        setText("ticketStatProgress", formatNumber(ticketsByStatus("in progress")));
        setText("ticketStatResolved", formatNumber(ticketsByStatus("resolved")));
    }

    // The header search mirrors the page's own search field so there is a single
    // filter instead of two. On the dashboard it filters the campaign cards.
    const TOPBAR_SEARCH_TARGETS = ["searchCustomer", "ticketSearch", "pipelineSearch", "coachSearch"];

    function filterCampaignCards(term) {
        const wrap = document.getElementById("campaignCards");
        if (!wrap) return;

        const query = term.trim().toLowerCase();
        Array.from(wrap.children).forEach(child => {
            if (!child.classList.contains("campaign-card")) {
                child.style.display = query ? "none" : "";
                return;
            }
            child.style.display = !query || child.textContent.toLowerCase().includes(query) ? "" : "none";
        });
    }

    function wireTopbarSearch() {
        const bar = document.getElementById("topbarSearch");
        if (!bar) return;

        const target = TOPBAR_SEARCH_TARGETS
            .map(id => document.getElementById(id))
            .find(el => el) || null;

        if (target) {
            bar.addEventListener("input", () => {
                if (target.value === bar.value) return;
                target.value = bar.value;
                target.dispatchEvent(new Event("input", { bubbles: true }));
            });
            target.addEventListener("input", () => {
                if (bar.value !== target.value) bar.value = target.value;
            });
            return;
        }

        bar.addEventListener("input", () => filterCampaignCards(bar.value));
    }

    renderTopbarChrome();
    renderKpiNotes();
    renderCampaignTotals();
    renderDirectoryStats();
    renderTicketStats();
    wireTopbarSearch();

    // Keep the campaign totals in step with add / edit / delete in this tab
    const campaignCards = document.getElementById("campaignCards");
    if (campaignCards && typeof MutationObserver === "function") {
        new MutationObserver(() => renderCampaignTotals()).observe(campaignCards, { childList: true });
    }

    // Likewise for the support statistics, which re-render whenever either
    // ticket table is repainted by the module above
    ["staffTicketsBody", "customerInquiriesBody"].forEach(id => {
        const tbody = document.getElementById(id);
        if (tbody && typeof MutationObserver === "function") {
            new MutationObserver(() => renderTicketStats()).observe(tbody, { childList: true });
        }
    });

    // And for the directory statistics, so an added, edited or removed member
    // immediately refreshes the member count cards
    const directoryTableBody = document.getElementById("customerTableBody");
    if (directoryTableBody && typeof MutationObserver === "function") {
        new MutationObserver(() => renderDirectoryStats()).observe(directoryTableBody, { childList: true });
    }

    // Another tab writing to localStorage refreshes the derived totals too
    window.addEventListener("storage", () => {
        renderKpiNotes();
        renderCampaignTotals();
        renderDirectoryStats();
        renderTicketStats();
    });
});

// =============================================================
// Recent Activity (additive only)
// A lightweight activity feed kept under one localStorage key, so the
// dashboard can show what happened most recently without introducing a new
// module or reshaping any existing record.
//
// The feed is a merge of two sources:
//   1. entries appended by logActivity() from the existing action handlers
//      (member registration, ticket creation / update / resolution, lead
//      creation, stage change, staff assignment and follow-up scheduling);
//   2. "membership expiring" / "membership expired" renewal rows derived on
//      the fly from the Customer Directory, which is already the source of
//      truth for renewals.
// Nothing here removes or renames an existing key, function or element, and
// every new function is guarded so the feed can never block a CRM action.
// =============================================================


// js-split:file=dashboard.js part=21of30
// Split from script.js - whole top-level blocks moved verbatim, no behavior change.
function logActivity(entry) {
    try {
        const list = getActivities();
        list.unshift({
            id: `act-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            at: new Date().toISOString(),
            type: "ticket",
            title: "",
            meta: "",
            timeLabel: "",
            href: "",
            ...(entry || {})
        });
        localStorage.setItem(ACTIVITY_KEY, JSON.stringify(list.slice(0, ACTIVITY_LOG_LIMIT)));
    } catch (e) { /* the activity feed must never block a CRM action */ }
}

// Like logActivity, but first drops the existing rows for the same record so the
// feed carries one current row instead of a duplicate per interaction. `href`
// identifies the record, because it is built from that record's own name.


// js-split:file=dashboard.js part=22of30
// Split from script.js - whole top-level blocks moved verbatim, no behavior change.
function replaceActivityForLead(entry, href) {
    try {
        const kept = getActivities().filter(row => !(row.type === entry.type && row.href === href));
        localStorage.setItem(ACTIVITY_KEY, JSON.stringify(kept));
        logActivity(entry);
    } catch (e) { /* the activity feed must never block a CRM action */ }
}

// Lead lifecycle: a new lead, a stage move, the follow-up it carries and the
// staff who owns it. `previous` is the stored lead before the edit, or null
// when the lead is new.


// js-split:file=dashboard.js part=23of30
// Split from script.js - whole top-level blocks moved verbatim, no behavior change.
function logLeadActivity(previous, lead, isNew) {
    const staff = normalizePipelineStaff(lead.staff);
    const stageTitle = activityStageTitle(lead.stage);
    const tier = serviceTierLabel(lead.tier);
    const href = activityHref("pipeline.html", lead.name);

    const won = lead.stage === "won";
    if (isNew || (previous && previous.stage !== lead.stage)) {
        logActivity({
            type: won ? "won" : "lead",
            title: won
                ? `${staff} converted ${lead.name} into a member`
                : isNew
                    ? `${lead.name} was added to the pipeline`
                    : `${lead.name} moved to ${stageTitle}`,
            meta: previous && previous.stage
                ? `${activityStageTitle(previous.stage)} → ${stageTitle}`
                : `${tier} • ${stageTitle}`,
            href
        });
    }

    if (lead.followUp && (!previous || previous.followUp !== lead.followUp)) {
        logActivity({
            type: "followup",
            title: `${staff} scheduled a follow-up with ${lead.name}`,
            meta: `${stageTitle} • ${formatDateLogged(lead.followUp)}`,
            href
        });
    }

    if (isNew || (previous && normalizePipelineStaff(previous.staff) !== staff)) {
        replaceActivityForLead({
            type: "assignment",
            title: `${staff} was assigned to ${isNew ? "a new lead" : "a lead"}`,
            meta: `${lead.name} • ${stageTitle}`,
            href
        }, href);
    }
}

// An assignment is a current fact about a lead, not a history of clicks, so the
// lead's earlier assignment row is replaced instead of stacked underneath. That
// is what stops reassigning one client from listing them repeatedly in the feed.


// js-split:file=dashboard.js part=24of30
// Split from script.js - whole top-level blocks moved verbatim, no behavior change.
function logLeadStaffAssigned(lead, staff) {
    const href = activityHref("pipeline.html", lead.name);
    replaceActivityForLead({
        type: "assignment",
        title: `${staff} was assigned to a lead`,
        meta: `${lead.name} • ${activityStageTitle(lead.stage)}`,
        href
    }, href);
}

// Renewals are not a separate event, so the nearest expiring memberships are
// derived from the Customer Directory instead of being logged. Lapsed terms
// count as renewal work too, so a member whose membership has run out still
// shows up here. Row ids stay stable across renders, so a renewal never
// produces a duplicate row.


// js-split:file=dashboard.js part=25of30
// Split from script.js - whole top-level blocks moved verbatim, no behavior change.
function membershipExpiryActivities() {
    const today = todayStart();

    // Archived members are never nudged for a renewal: they are not renewing.
    return getActiveDirectoryCustomers()
        .map(member => ({ member, days: daysUntilExpiration(member.exp, today) }))
        .filter(row => row.days !== null && row.days <= RENEWAL_WINDOW_DAYS)
        .sort((a, b) => a.days - b.days)
        .slice(0, ACTIVITY_EXPIRING_LIMIT)
        .map(({ member, days }) => ({
            id: `expiring-${member.id}-${member.exp}`,
            type: days < 0 ? "expired" : "expiring",
            title: days < 0
                ? `${member.name}'s membership expired ${Math.abs(days)} day${Math.abs(days) === 1 ? "" : "s"} ago`
                : `${member.name}'s membership expires in ${days} day${days === 1 ? "" : "s"}`,
            meta: `${member.tier || "Membership"} • ${days < 0 ? "Renewal due" : "Expiring Soon"}`,
            timeLabel: "Today",
            at: today.toISOString(),
            href: activityHref("members.html", member.name)
        }));
}

// Logged actions plus the derived renewal nudges, newest first


// js-split:file=dashboard.js part=26of30
// Split from script.js - whole top-level blocks moved verbatim, no behavior change.
function recentActivityFeed() {
    const seen = new Set();

    return [...membershipExpiryActivities(), ...getActivities()]
        .filter(entry => {
            const key = entry.id || `${entry.type}-${entry.at}-${entry.title}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        })
        .sort((a, b) => new Date(b.at || 0) - new Date(a.at || 0));
}



// js-split:file=dashboard.js part=27of30
// Split from script.js - whole top-level blocks moved verbatim, no behavior change.
let activityExpanded = false;



// js-split:file=dashboard.js part=28of30
// Split from script.js - whole top-level blocks moved verbatim, no behavior change.
function renderRecentActivity() {
    const list = document.getElementById("recentActivityList");
    if (!list) return;

    const feed = recentActivityFeed();
    const visible = feed.slice(0, activityExpanded ? ACTIVITY_FULL_COUNT : ACTIVITY_PREVIEW_COUNT);

    list.innerHTML = "";
    if (visible.length === 0) {
        list.innerHTML = '<p class="card-meta">No activity recorded yet.</p>';
    } else {
        visible.forEach(activity => {
            const row = document.createElement("div");
            row.innerHTML = activityRowHtml(activity);
            list.appendChild(row.firstElementChild);
        });
    }

    const viewAllBtn = document.getElementById("activityViewAll");
    if (viewAllBtn) {
        viewAllBtn.hidden = feed.length <= ACTIVITY_PREVIEW_COUNT;
        viewAllBtn.textContent = activityExpanded ? "Show Less ↑" : "View All →";
        viewAllBtn.setAttribute("aria-expanded", String(activityExpanded));
    }
}

// Activity links carry ?q= so the module page opens with its own search box
// pre-filled. The page's existing input listener does the filtering.


// js-split:file=dashboard.js part=29of30
// Split from script.js - whole top-level blocks moved verbatim, no behavior change.
function applyActivityDeepLink() {
    const term = (new URLSearchParams(window.location.search).get("q") || "").trim();
    if (!term) return;

    const field = ["searchCustomer", "ticketSearch", "pipelineSearch", "coachSearch"]
        .map(id => document.getElementById(id))
        .find(el => el);
    if (!field) return;

    field.value = term;
    field.dispatchEvent(new Event("input", { bubbles: true }));
}



// js-split:file=dashboard.js part=30of30
// Split from script.js - whole top-level blocks moved verbatim, no behavior change.
document.addEventListener("DOMContentLoaded", () => {
    applyActivityDeepLink();

    if (document.getElementById("recentActivityList")) {
        renderRecentActivity();

        const viewAllBtn = document.getElementById("activityViewAll");
        if (viewAllBtn) {
            viewAllBtn.addEventListener("click", () => {
                activityExpanded = !activityExpanded;
                renderRecentActivity();
            });
        }

        // Another tab logging an action refreshes this feed
        window.addEventListener("storage", renderRecentActivity);
    }
});

// =============================================================
// Coach Tracker (additive only)
// A coaching module layered on top of the existing CRM instead of
// beside it. It never introduces a second customer database: assigned
// clients and membership state come from getDirectoryCustomers() /
// getMemberStatus(), i.e. the same Customer Directory the rest of the
// portal uses, and every action is appended to the shared activity
// feed through logActivity().
//
// Three additive localStorage keys hold the coaching data:
//   crmCoaches           coach records (contact, specializations, status,
//                        working days + hours, client rating total)
//   crmCoachAssignments  coachId <-> customerId links with a date
//   crmCoachSessions     training sessions (date, time, type, status,
//                        notes)
//
// Every renderer, dialog and listener below is guarded by an element
// check, so pages without the Coach Tracker behave exactly as before.
// =============================================================
