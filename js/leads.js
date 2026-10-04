// js-split:file=leads.js part=1of8
// Split from script.js - whole top-level blocks moved verbatim, no behavior change.
function renderStaffOptions(select, includeAll) {
    if (!select) return;
    const options = [];
    if (includeAll) options.push({ value: "all", label: "All Staff" });
    PIPELINE_STAFF.forEach(name => options.push({ value: name, label: name }));
    select.innerHTML = options.map(o =>
        `<option value="${escapeHtml(o.value)}">${escapeHtml(o.label)}</option>`
    ).join("");
}

// Anytime Fitness membership tiers (term-based) — matches "Membership Tiers Info"
// in the Customer Directory (members.html). Each tier has a fixed membership term.


// js-split:file=leads.js part=2of8
// Split from script.js - whole top-level blocks moved verbatim, no behavior change.
function pipelineFilters() {
    return {
        search: ((document.getElementById("pipelineSearch") || {}).value || "").trim().toLowerCase(),
        staff: (document.getElementById("filterStaff") || {}).value || "all",
        tier: (document.getElementById("filterTier") || {}).value || "all"
    };
}



// js-split:file=leads.js part=3of8
// Split from script.js - whole top-level blocks moved verbatim, no behavior change.
function staffSelectHtml(lead) {
    const options = PIPELINE_STAFF.map(name =>
        `<option value="${escapeHtml(name)}"${name === lead.staff ? " selected" : ""}>${escapeHtml(name)}</option>`
    ).join("");
    return `
        <label class="staff-inline">
            <span class="staff-inline-label">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h4l10-10-4-4L4 16v4Z"/><path d="M13.5 6.5l4 4"/></svg>
                Assigned Staff
            </span>
            <select class="staff-inline-select" onchange="updateLeadStaff(${lead.id}, this.value)" aria-label="Assigned staff for ${escapeHtml(lead.name)}">${options}</select>
        </label>
    `;
}

// Reassigns a lead's staff without touching any other field, then re-renders so
// the card text, the staff filter and the Edit form stay consistent.
// Re-picking the staff the lead already has is a no-op: nothing is written and
// no activity row is added, so browsing the dropdown cannot pile up feed rows.


// js-split:file=leads.js part=4of8
// Split from script.js - whole top-level blocks moved verbatim, no behavior change.
function updateLeadStaff(id, staff) {
    const leads = getPipelineLeads();
    const idx = leads.findIndex(l => String(l.id) === String(id));
    if (idx === -1) return;

    const nextStaff = normalizePipelineStaff(staff);
    if (normalizePipelineStaff(leads[idx].staff) === nextStaff) return;

    leads[idx] = { ...leads[idx], staff: nextStaff };
    savePipelineLeads(leads);
    logLeadStaffAssigned(leads[idx], nextStaff);
    renderPipelineBoard();
}



// js-split:file=leads.js part=5of8
// Split from script.js - whole top-level blocks moved verbatim, no behavior change.
function buildLeadCard(lead) {
    const div = document.createElement("div");
    div.className = "kanban-card";
    div.setAttribute("data-id", lead.id);
    div.setAttribute("data-staff", lead.staff);
    div.setAttribute("data-tier", lead.tier);

    const followUp = lead.followUp ? `Next Follow-up: ${lead.followUp}` : "Next Follow-up: —";

    let meta2 = `Assigned: ${escapeHtml(lead.staff)} | ${followUp}`;
    if (lead.stage === "won") meta2 = `Assigned: ${escapeHtml(lead.staff)} | Membership active`;
    if (lead.stage === "lost" && lead.reason) meta2 = `Reason: ${escapeHtml(lead.reason)}`;

    const value = Number(lead.monthlyValue) || 0;
    const tierPrice = pipelineTierPrice(lead.tier);
    const tierText = tierPrice ? `${lead.tier} ($${tierPrice}/mo)` : lead.tier;
    const valueSuffix = lead.stage === "won" && value > 0 ? ` | $${value}/mo` : "";

    const contactLine = [lead.phone ? `📞 ${escapeHtml(lead.phone)}` : null, lead.email ? `✉️ ${escapeHtml(lead.email)}` : null].filter(Boolean).join(" | ");
    div.innerHTML = `
        <strong>${escapeHtml(lead.name)}</strong> ${leadHeatBadge(lead.heat)}
        <p class="card-meta">${contactLine || "—"} | Target: ${escapeHtml(tierText)}${valueSuffix}</p>
        <p class="card-meta">${meta2}</p>
        ${lead.notes ? `<p class="card-meta">📝 ${escapeHtml(lead.notes)}</p>` : ""}
        ${staffSelectHtml(lead)}
        <div class="kanban-card-actions">
            <button class="btn-view" onclick="openEditPipelineLead(${lead.id})">Edit</button>
            <button class="btn-delete" onclick="requestDeletePipelineLead(${lead.id})">Delete</button>
        </div>
    `;
    return div;
}



// js-split:file=leads.js part=6of8
// Split from script.js - whole top-level blocks moved verbatim, no behavior change.
function renderPipelineBoard() {
    const board = document.getElementById("pipelineBoard");
    if (!board) return;

    const filters = pipelineFilters();
    const leads = getPipelineLeads();

    board.querySelectorAll(".kanban-column").forEach(col => {
        const stage = col.getAttribute("data-stage");
        const container = col.querySelector(".kanban-cards");
        if (!container) return;

        const stageLeads = leads.filter(l => l.stage === stage);
        const totalValue = stageLeads.reduce((sum, l) => sum + (Number(l.monthlyValue) || 0), 0);
        const meta = PIPELINE_STAGES.find(s => s.id === stage);

        const titleEl = col.querySelector("h3");
        if (titleEl && meta) {
            titleEl.innerHTML = `${meta.title} <span class="stage-count">(${stageLeads.length} ${stageLeads.length === 1 ? "lead" : "leads"}${totalValue ? " - $" + totalValue + "/mo" : ""})</span>`;
        }

        const visible = stageLeads.filter(lead => {
            const matchesStaff = filters.staff === "all" || lead.staff === filters.staff;
            const matchesTier = filters.tier === "all" || lead.tier === filters.tier;
            const tierLabel = serviceTierLabel(lead.tier);
            const searchText = [lead.name, lead.phone, lead.email, lead.tier, tierLabel, lead.staff, lead.reason, lead.notes].filter(Boolean).join(" ").toLowerCase();
            const matchesSearch = !filters.search || searchText.includes(filters.search);
            return matchesStaff && matchesTier && matchesSearch;
        });

        container.innerHTML = "";
        if (visible.length === 0) {
            const p = document.createElement("p");
            p.className = "card-meta";
            p.textContent = stageLeads.length === 0 ? "No leads in this stage." : "No matching leads.";
            container.appendChild(p);
            return;
        }
        visible.forEach(lead => container.appendChild(buildLeadCard(lead)));
    });
}



// js-split:file=leads.js part=7of8
// Split from script.js - whole top-level blocks moved verbatim, no behavior change.
function openEditPipelineLead(id) {
    const lead = getPipelineLeads().find(l => String(l.id) === String(id));
    const modal = document.getElementById("pipelineModal");
    if (!lead || !modal) return;

    document.getElementById("leadId").value = lead.id;
    document.getElementById("leadName").value = lead.name;
    document.getElementById("leadPhone").value = lead.phone || "";
    (document.getElementById("leadEmail") || {}).value = lead.email || "";
    document.getElementById("leadTier").value = lead.tier;
    document.getElementById("leadStaff").value = lead.staff;
    document.getElementById("leadHeat").value = lead.heat || "Warm";
    document.getElementById("leadStage").value = lead.stage;
    document.getElementById("leadFollowUp").value = lead.followUp || "";
    (document.getElementById("leadNotes") || {}).value = lead.notes || "";
    if (typeof syncLeadValue === "function") syncLeadValue();
    document.getElementById("leadLostReason").value = lead.reason || "";

    const group = document.getElementById("lostReasonGroup");
    if (group) group.style.display = lead.stage === "lost" ? "block" : "none";

    document.getElementById("pipelineModalTitle").textContent = "Edit Prospecting Client";
    document.getElementById("pipelineForm").querySelector('button[type="submit"]').textContent = "Update Client";
    modal.style.display = "flex";
}



// js-split:file=leads.js part=8of8
// Split from script.js - whole top-level blocks moved verbatim, no behavior change.
function requestDeletePipelineLead(id) {
    if (!confirm("Delete this lead from the pipeline? This cannot be undone.")) return;
    const leads = getPipelineLeads().filter(l => String(l.id) !== String(id));
    savePipelineLeads(leads);
    renderPipelineBoard();
}

// ---- Marketing Campaigns (Social Media) ----
