// js-split:file=leads.js part=1of8
// Split from script.js - whole top-level blocks moved verbatim, no behavior change.
function renderStaffOptions(select, includeAll, selectedStaff) {
    if (!select) return;
    const staffList = (typeof getPipelineStaffList === "function") ? getPipelineStaffList() : [];

    if (includeAll) {
        // Staff filter bar (top of pipeline page)
        const currentVal = selectedStaff !== undefined ? selectedStaff : select.value;
        const options = [{ value: "all", label: "All Staff" }];
        staffList.forEach(s => {
            const staffName = s.name || (typeof combineNameParts === "function" ? combineNameParts(s.firstName, s.middleName, s.lastName) : "Staff Member");
            const label = s.status === "Active" ? staffName : `${staffName} (${s.status})`;
            options.push({ value: staffName, label });
        });
        select.innerHTML = options.map(o =>
            `<option value="${escapeHtml(o.value)}">${escapeHtml(o.label)}</option>`
        ).join("");
        if (currentVal && options.some(o => o.value === currentVal)) {
            select.value = currentVal;
        }
        return;
    }

    // Lead assignment dropdown (e.g. #leadStaff modal)
    // Only Active staff are eligible for assignment!
    // Staff who are Inactive or On Leave must NOT be selectable.
    const activeStaff = staffList.filter(s => s && s.status === "Active");
    const options = activeStaff.map(s => {
        const staffName = s.name || (typeof combineNameParts === "function" ? combineNameParts(s.firstName, s.middleName, s.lastName) : "Staff Member");
        return {
            value: staffName,
            label: staffName,
            disabled: false
        };
    });

    // If an existing lead is being edited and is assigned to a staff member who is now On Leave or Inactive:
    // Only show that inactive/on-leave staff member if selectedStaff was explicitly provided!
    if (selectedStaff && !activeStaff.some(s => s.name === selectedStaff)) {
        const currentRecord = staffList.find(s => s.name === selectedStaff || (typeof normalizePipelineStaff === "function" && normalizePipelineStaff(s.name) === normalizePipelineStaff(selectedStaff)));
        const statusText = currentRecord ? currentRecord.status : "Unavailable";
        options.unshift({
            value: selectedStaff,
            label: `${selectedStaff} (${statusText} — Cannot be assigned)`,
            disabled: true
        });
    }

    if (options.length === 0) {
        options.push({
            value: "",
            label: "No active staff available (All on leave or inactive)",
            disabled: true
        });
    }

    select.innerHTML = options.map(o =>
        `<option value="${escapeHtml(o.value)}"${o.disabled ? " disabled" : ""}>${escapeHtml(o.label)}</option>`
    ).join("");

    const targetVal = selectedStaff !== undefined ? selectedStaff : select.value;
    if (targetVal && options.some(o => o.value === targetVal && !o.disabled)) {
        select.value = targetVal;
    } else if (activeStaff.length > 0) {
        select.value = activeStaff[0].name;
    } else if (selectedStaff) {
        select.value = selectedStaff;
    }
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
    const staffList = (typeof getPipelineStaffList === "function") ? getPipelineStaffList() : [];
    const activeStaff = staffList.filter(s => s && s.status === "Active");

    const currentStaffMember = staffList.find(s => s.name === lead.staff || (typeof normalizePipelineStaff === "function" && normalizePipelineStaff(s.name) === normalizePipelineStaff(lead.staff)));
    const isCurrentActive = currentStaffMember ? currentStaffMember.status === "Active" : activeStaff.some(s => s.name === lead.staff);

    const options = [];

    // If current staff is On Leave or Inactive, display as current assignment, disabled with status tag
    if (!isCurrentActive && lead.staff) {
        const statusLabel = currentStaffMember ? currentStaffMember.status : "Unavailable";
        options.push(`
            <option value="${escapeHtml(lead.staff)}" selected disabled>
                ${escapeHtml(lead.staff)} (${escapeHtml(statusLabel)} — Reassign)
            </option>
        `);
    }

    // Only active staff can be chosen for assignment
    activeStaff.forEach(s => {
        const staffName = s.name || (typeof combineNameParts === "function" ? combineNameParts(s.firstName, s.middleName, s.lastName) : "Staff Member");
        const isSelected = isCurrentActive && (staffName === lead.staff || (typeof normalizePipelineStaff === "function" && normalizePipelineStaff(staffName) === normalizePipelineStaff(lead.staff)));
        options.push(`
            <option value="${escapeHtml(staffName)}"${isSelected ? " selected" : ""}>
                ${escapeHtml(staffName)}
            </option>
        `);
    });

    if (options.length === 0) {
        options.push(`<option value="" disabled selected>No active staff available</option>`);
    }

    const warningClass = (!isCurrentActive && lead.staff) ? " staff-on-leave" : "";

    return `
        <label class="staff-inline${warningClass}">
            <span class="staff-inline-label">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h4l10-10-4-4L4 16v4Z"/><path d="M13.5 6.5l4 4"/></svg>
                Assigned Staff
            </span>
            <select class="staff-inline-select" onchange="updateLeadStaff(${lead.id}, this.value)" aria-label="Assigned staff for ${escapeHtml(lead.name)}">${options.join("")}</select>
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

    // Strict validation: Inactive or On Leave staff CANNOT be assigned with a lead
    const staffList = (typeof getPipelineStaffList === "function") ? getPipelineStaffList() : [];
    const targetStaff = staffList.find(s => s.name === staff || (typeof normalizePipelineStaff === "function" && normalizePipelineStaff(s.name) === normalizePipelineStaff(staff)));

    if (targetStaff && targetStaff.status !== "Active") {
        alert(`Cannot assign lead to "${targetStaff.name}" because their status is currently "${targetStaff.status}". Staff who are inactive or on leave cannot be assigned with a lead.`);
        renderPipelineBoard();
        return;
    }

    const nextStaff = normalizePipelineStaff(staff);
    if (normalizePipelineStaff(leads[idx].staff) === nextStaff) return;

    leads[idx] = { ...leads[idx], staff: nextStaff };
    savePipelineLeads(leads);
    logLeadStaffAssigned(leads[idx], nextStaff);
    renderPipelineBoard();
    if (typeof renderStaffDirectory === "function") renderStaffDirectory();
}



// One labelled row per field, so a long tier name, email or note can never run
// into a single block of text: the label column keeps the values scannable.
function leadDetailRow(label, value) {
    return `<div class="lead-detail"><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`;
}

// js-split:file=leads.js part=5of8
// Split from script.js - whole top-level blocks moved verbatim, no behavior change.
function buildLeadCard(lead) {
    const div = document.createElement("div");
    div.className = "kanban-card";
    div.setAttribute("data-id", lead.id);
    div.setAttribute("data-staff", lead.staff);
    div.setAttribute("data-tier", lead.tier);

    const value = Number(lead.monthlyValue) || 0;

    const rows = [];
    if (lead.phone) rows.push(leadDetailRow("Phone", lead.phone));
    if (lead.email) rows.push(leadDetailRow("Email", lead.email));
    rows.push(leadDetailRow("Target", lead.tier || "—"));
    if (value > 0) rows.push(leadDetailRow("Value", `$${value}/mo`));
    // Only one closing line per card: a won lead has no follow-up left, and a
    // lost one is explained by the reason the staff recorded.
    if (lead.stage === "won") {
        rows.push(leadDetailRow("Status", "Membership active"));
    } else if (lead.stage === "lost" && lead.reason) {
        rows.push(leadDetailRow("Reason", lead.reason));
    } else {
        rows.push(leadDetailRow("Follow-up", lead.followUp ? formatDateLogged(lead.followUp) : "Not scheduled"));
    }

    const notes = lead.notes
        ? `<p class="lead-notes" title="${escapeHtml(lead.notes)}"><span class="lead-notes-label">Notes</span>${escapeHtml(lead.notes)}</p>`
        : "";

    div.innerHTML = `
        <div class="lead-card-head">
            <strong>${escapeHtml(lead.name)}</strong>
            ${leadHeatBadge(lead.heat)}
        </div>
        <div class="lead-card-body">
            <dl class="lead-details">${rows.join("")}</dl>
            ${notes}
        </div>
        ${staffSelectHtml(lead)}
        <div class="kanban-card-actions">
            <button class="btn-view" onclick="openEditPipelineLead(${lead.id})">Edit</button>
            <button class="btn-archive" onclick="archiveLead(${lead.id})">Archive</button>
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
    const leads = getPipelineLeads().filter(l => !l.archived);

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



// Follow-ups are limited to the next 10 years and can never be dated in the
// past. The date picker gets these as min/max so the calendar itself cannot
// navigate beyond the allowed range.
function leadFollowUpBounds() {
    const now = new Date();
    return {
        min: localISODate(now),
        max: localISODate(new Date(now.getFullYear() + 10, now.getMonth(), now.getDate()))
    };
}

function applyLeadFollowUpBounds(followUp) {
    const input = document.getElementById("leadFollowUp");
    if (!input) return;
    const bounds = leadFollowUpBounds();
    input.min = bounds.min;
    input.max = bounds.max;
    // An existing follow-up outside the window stays editable, otherwise its
    // unchanged date would fail the browser's min/max validation on save.
    if (followUp) {
        if (followUp < bounds.min) input.min = followUp;
        if (followUp > bounds.max) input.max = followUp;
    }
}


// js-split:file=leads.js part=7of8
// Split from script.js - whole top-level blocks moved verbatim, no behavior change.
function openEditPipelineLead(id) {
    const lead = getPipelineLeads().find(l => String(l.id) === String(id));
    const modal = document.getElementById("pipelineModal");
    if (!lead || !modal) return;

    document.getElementById("leadId").value = lead.id;
    fillNameInputs("lead", lead);
    document.getElementById("leadPhone").value = phPhoneNationalDigits(lead.phone || "");
    (document.getElementById("leadEmail") || {}).value = lead.email || "";
    document.getElementById("leadTier").value = lead.tier;
    const leadStaffSelect = document.getElementById("leadStaff");
    if (leadStaffSelect) {
        renderStaffOptions(leadStaffSelect, false, lead.staff);
        leadStaffSelect.value = lead.staff;
    }
    document.getElementById("leadHeat").value = lead.heat || "Warm";
    document.getElementById("leadStage").value = lead.stage;
    applyLeadFollowUpBounds(lead.followUp);
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
// Archive a lead instead of deleting it: the record leaves the board but
// stays on file in the Archive page, where it can be restored or deleted.
function archiveLead(id) {
    const leads = getPipelineLeads();
    const lead = leads.find(l => String(l.id) === String(id));
    if (!lead) return;
    if (!confirm(`Archive ${lead.name} from the pipeline? The record is kept and can be restored later.`)) return;
    lead.archived = true;
    lead.archivedAt = new Date().toISOString();
    savePipelineLeads(leads);

    logActivity({
        type: "lead",
        title: `${lead.name} was archived from the pipeline`,
        meta: `${lead.tier || "No tier"} • ${lead.staff || "Unassigned"}`,
        href: activityHref("pipeline.html", lead.name)
    });

    renderPipelineBoard();
    renderArchivedLeads();
    if (typeof renderStaffDirectory === "function") renderStaffDirectory();
}

function restoreLead(id) {
    const leads = getPipelineLeads();
    const lead = leads.find(l => String(l.id) === String(id));
    if (!lead) return;
    if (!confirm(`Restore ${lead.name} back to the pipeline?`)) return;
    delete lead.archived;
    delete lead.archivedAt;
    savePipelineLeads(leads);

    logActivity({
        type: "lead",
        title: `${lead.name} was restored from the archive`,
        meta: `${lead.tier || "No tier"} • ${lead.staff || "Unassigned"}`,
        href: activityHref("pipeline.html", lead.name)
    });

    if (window.selectedArchivedLeadIds) {
        window.selectedArchivedLeadIds.delete(String(id));
    }

    renderPipelineBoard();
    renderArchivedLeads();
    if (typeof renderStaffDirectory === "function") renderStaffDirectory();
}

function permanentlyDeleteLead(id) {
    if (sessionStorage.getItem("crmRole") !== "admin") {
        alert("Only staff can permanently delete leads.");
        return;
    }
    if (!confirm("Permanently delete this archived lead? This cannot be undone.")) return;
    savePipelineLeads(getPipelineLeads().filter(l => String(l.id) !== String(id)));

    if (window.selectedArchivedLeadIds) {
        window.selectedArchivedLeadIds.delete(String(id));
    }

    renderPipelineBoard();
    renderArchivedLeads();
    if (typeof renderStaffDirectory === "function") renderStaffDirectory();
}

function renderArchivedLeads() {
    const tbody = document.getElementById("archivedLeadsBody");
    if (!tbody) return;

    if (window.selectedArchivedLeadIds) {
        const archivedIds = new Set(getPipelineLeads().filter(l => l.archived).map(l => String(l.id)));
        for (const id of Array.from(window.selectedArchivedLeadIds)) {
            if (!archivedIds.has(id)) window.selectedArchivedLeadIds.delete(id);
        }
    }

    const rows = getPipelineLeads()
        .filter(l => l.archived)
        .sort((a, b) => String(b.id) - String(a.id));
    tbody.innerHTML = "";
    if (rows.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8">No archived leads yet.</td></tr>';
        if (typeof updateArchivedLeadsBulkActionBar === "function") updateArchivedLeadsBulkActionBar();
        return;
    }
    rows.forEach(lead => {
        const isChecked = window.selectedArchivedLeadIds && window.selectedArchivedLeadIds.has(String(lead.id));
        const tr = document.createElement("tr");
        tr.dataset.id = String(lead.id);
        if (isChecked) tr.classList.add("is-selected");
        tr.innerHTML = `
            <td class="td-checkbox">
                <input type="checkbox" class="archived-lead-select-checkbox" data-id="${escapeHtml(lead.id)}" ${isChecked ? "checked" : ""} aria-label="Select lead ${escapeHtml(lead.name)}">
            </td>
            <td>${escapeHtml(lead.name)}</td>
            <td>${escapeHtml(lead.staff || "—")}</td>
            <td>${escapeHtml(serviceTierLabel(lead.tier) || lead.tier || "—")}</td>
            <td>${escapeHtml(lead.stage || "—")}</td>
            <td>${escapeHtml(lead.followUp || "—")}</td>
            <td><span class="badge open">Archived</span></td>
            <td>
                <div class="row-actions">
                    <button class="btn-restore" onclick="restoreLead(${lead.id})">Restore</button>
                    <button class="btn-delete" onclick="permanentlyDeleteLead(${lead.id})">Delete Permanently</button>
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });

    if (typeof updateArchivedLeadsBulkActionBar === "function") {
        updateArchivedLeadsBulkActionBar();
    }
}

// ============================================================================
// Sales Staff & Agents Directory (Option A: Stacked below the Kanban board)
// ============================================================================

function refreshAllPipelineStaffViews() {
    if (typeof syncPipelineStaffArray === "function") {
        syncPipelineStaffArray();
    }
    const filterStaff = document.getElementById("filterStaff");
    const leadStaff = document.getElementById("leadStaff");
    if (filterStaff) renderStaffOptions(filterStaff, true);
    if (leadStaff) renderStaffOptions(leadStaff, false);
    if (typeof renderPipelineBoard === "function") renderPipelineBoard();
    renderStaffDirectory();
}

function getStaffInitials(name) {
    if (!name) return "ST";
    const parts = String(name).trim().split(/\s+/).filter(Boolean);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function formatDisplayPhone(phone) {
    if (!phone) return "—";
    const digits = (typeof phPhoneNationalDigits === "function") ? phPhoneNationalDigits(phone) : String(phone).replace(/\D/g, "");
    if (digits.length === 10) {
        return `+63 ${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`;
    }
    return phone;
}

function clearStaffFormErrors() {
    const errorEl = document.getElementById("staffFormError");
    if (errorEl) {
        errorEl.textContent = "";
        delete errorEl.dataset.field;
    }
    ["staffFirstName", "staffMiddleName", "staffLastName", "staffRole", "staffEmail", "staffPhone", "staffStatus"].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.remove("input-invalid");
    });
}

function setStaffFieldError(fieldId, message) {
    const errorEl = document.getElementById("staffFormError");
    if (errorEl) {
        errorEl.textContent = message;
        errorEl.dataset.field = fieldId;
    }
    const el = document.getElementById(fieldId);
    if (el) {
        el.classList.add("input-invalid");
        el.focus();
    }
    return false;
}

// ============================================================================
// Sales Staff Bulk Actions & Directory Management
// ============================================================================

window.selectedStaffIds = window.selectedStaffIds || new Set();

function getFilteredStaffList() {
    const staffList = (typeof getPipelineStaffList === "function") ? getPipelineStaffList() : [];
    const searchEl = document.getElementById("searchStaff");
    const roleEl = document.getElementById("filterStaffRole");
    const statusEl = document.getElementById("filterStaffStatus");
    const searchQuery = (searchEl ? searchEl.value : "").trim().toLowerCase();
    const roleFilter = (roleEl && roleEl.value) ? roleEl.value : "all";
    const statusFilter = (statusEl && statusEl.value) ? statusEl.value : "all";

    return staffList.filter(staff => {
        if (roleFilter !== "all" && staff.role !== roleFilter) return false;
        if (statusFilter !== "all" && staff.status !== statusFilter) return false;
        if (searchQuery) {
            const haystack = [
                staff.name,
                staff.firstName,
                staff.middleName,
                staff.lastName,
                staff.role,
                staff.email,
                staff.phone,
                staff.status
            ].filter(Boolean).join(" ").toLowerCase();
            if (!haystack.includes(searchQuery)) return false;
        }
        return true;
    });
}
window.getFilteredStaffList = getFilteredStaffList;

function getSelectedStaffList() {
    const staffList = (typeof getPipelineStaffList === "function") ? getPipelineStaffList() : [];
    const selectedIds = window.selectedStaffIds || new Set();
    return staffList.filter(s => selectedIds.has(String(s.id)));
}
window.getSelectedStaffList = getSelectedStaffList;

function updateStaffBulkActionBar(filteredStaff) {
    const bar = document.getElementById("staffBulkActionBar");
    const countEl = document.getElementById("staffBulkSelectedCount");
    const labelEl = document.getElementById("staffBulkSelectedLabel");
    const totalMatchingEl = document.getElementById("staffBulkTotalMatchingCount");
    const selectAllCheckbox = document.getElementById("selectAllStaff");

    if (!bar) return;

    const filtered = Array.isArray(filteredStaff) ? filteredStaff : getFilteredStaffList();
    const selectedCount = window.selectedStaffIds ? window.selectedStaffIds.size : 0;
    const visibleCount = filtered.length;

    if (countEl) countEl.textContent = String(selectedCount);
    if (labelEl) labelEl.textContent = selectedCount === 1 ? "staff member selected" : "staff members selected";
    if (totalMatchingEl) totalMatchingEl.textContent = String(visibleCount);

    if (selectedCount > 0) {
        bar.hidden = false;
        bar.style.display = "flex";
        bar.classList.add("visible");
        if (countEl) countEl.textContent = String(selectedCount);
        if (labelEl) labelEl.textContent = selectedCount === 1 ? "staff member selected" : "staff members selected";
    } else {
        bar.hidden = true;
        bar.style.display = "none";
        bar.classList.remove("visible");
    }

    if (selectAllCheckbox) {
        let matchingSelectedCount = 0;
        filtered.forEach(s => {
            if (window.selectedStaffIds && window.selectedStaffIds.has(String(s.id))) {
                matchingSelectedCount++;
            }
        });

        if (visibleCount > 0 && matchingSelectedCount === visibleCount) {
            selectAllCheckbox.checked = true;
            selectAllCheckbox.indeterminate = false;
        } else if (matchingSelectedCount > 0) {
            selectAllCheckbox.checked = false;
            selectAllCheckbox.indeterminate = true;
        } else {
            selectAllCheckbox.checked = false;
            selectAllCheckbox.indeterminate = false;
        }
    }
}
window.updateStaffBulkActionBar = updateStaffBulkActionBar;

function initStaffBulkActions() {
    const bar = document.getElementById("staffBulkActionBar");
    const tbody = document.getElementById("staffTableBody");
    const selectAllCheckbox = document.getElementById("selectAllStaff");

    if (!bar || bar.dataset.bulkBound === "1") return;
    bar.dataset.bulkBound = "1";

    if (!window.selectedStaffIds || window.selectedStaffIds.size === 0) {
        bar.hidden = true;
        bar.style.display = "none";
        bar.classList.remove("visible");
    }

    // Master checkbox toggles all visible rows
    if (selectAllCheckbox && selectAllCheckbox.dataset.bound !== "1") {
        selectAllCheckbox.dataset.bound = "1";
        selectAllCheckbox.addEventListener("change", () => {
            const filtered = getFilteredStaffList();
            if (selectAllCheckbox.checked) {
                filtered.forEach(s => window.selectedStaffIds.add(String(s.id)));
            } else {
                filtered.forEach(s => window.selectedStaffIds.delete(String(s.id)));
            }
            if (tbody) {
                const checkboxes = tbody.querySelectorAll(".staff-select-checkbox");
                checkboxes.forEach(cb => {
                    const id = decodeURIComponent(cb.dataset.staffId || "");
                    const checked = window.selectedStaffIds.has(id);
                    cb.checked = checked;
                    const row = cb.closest("tr");
                    if (row) row.classList.toggle("is-selected", checked);
                });
            }
            updateStaffBulkActionBar(filtered);
        });
    }

    // Row selection delegation on staffTableBody
    if (tbody && tbody.dataset.bulkDelegated !== "1") {
        tbody.dataset.bulkDelegated = "1";

        tbody.addEventListener("change", e => {
            if (e.target.classList.contains("staff-select-checkbox")) {
                const id = decodeURIComponent(e.target.dataset.staffId || "");
                if (e.target.checked) {
                    window.selectedStaffIds.add(id);
                } else {
                    window.selectedStaffIds.delete(id);
                }
                const row = e.target.closest("tr");
                if (row) row.classList.toggle("is-selected", e.target.checked);
                updateStaffBulkActionBar();
            }
        });

        // Click anywhere on a row toggles row selection (except on action buttons, links, or inputs)
        tbody.addEventListener("click", e => {
            if (e.target.closest("button, a, select, textarea, label")) return;
            if (e.target.tagName === "INPUT") return;

            const row = e.target.closest("tr");
            if (!row) return;

            const cb = row.querySelector(".staff-select-checkbox");
            if (cb) {
                cb.checked = !cb.checked;
                const id = decodeURIComponent(cb.dataset.staffId || "");
                if (cb.checked) {
                    window.selectedStaffIds.add(id);
                } else {
                    window.selectedStaffIds.delete(id);
                }
                row.classList.toggle("is-selected", cb.checked);
                updateStaffBulkActionBar();
            }
        });
    }

    // Quick selection buttons
    const selectAllMatchingBtn = document.getElementById("staffBulkSelectAllMatchingBtn");
    if (selectAllMatchingBtn) {
        selectAllMatchingBtn.addEventListener("click", () => {
            const filtered = getFilteredStaffList();
            filtered.forEach(s => window.selectedStaffIds.add(String(s.id)));
            if (tbody) {
                tbody.querySelectorAll(".staff-select-checkbox").forEach(cb => {
                    cb.checked = true;
                    const row = cb.closest("tr");
                    if (row) row.classList.add("is-selected");
                });
            }
            updateStaffBulkActionBar(filtered);
        });
    }

    const deselectBtn = document.getElementById("staffBulkDeselectBtn");
    if (deselectBtn) {
        deselectBtn.addEventListener("click", () => {
            window.selectedStaffIds.clear();
            if (tbody) {
                tbody.querySelectorAll(".staff-select-checkbox").forEach(cb => {
                    cb.checked = false;
                    const row = cb.closest("tr");
                    if (row) row.classList.remove("is-selected");
                });
            }
            updateStaffBulkActionBar();
        });
    }

    const closeBarBtn = document.getElementById("staffBulkBarCloseBtn");
    if (closeBarBtn) {
        closeBarBtn.addEventListener("click", () => {
            window.selectedStaffIds.clear();
            if (tbody) {
                tbody.querySelectorAll(".staff-select-checkbox").forEach(cb => {
                    cb.checked = false;
                    const row = cb.closest("tr");
                    if (row) row.classList.remove("is-selected");
                });
            }
            updateStaffBulkActionBar();
        });
    }

    // Bulk action toolbar buttons
    const statusBtn = document.getElementById("bulkStaffStatusBtn");
    if (statusBtn) statusBtn.addEventListener("click", () => window.openBulkStaffStatusModal());

    const roleBtn = document.getElementById("bulkStaffRoleBtn");
    if (roleBtn) roleBtn.addEventListener("click", () => window.openBulkStaffRoleModal());

    const reassignBtn = document.getElementById("bulkStaffReassignBtn");
    if (reassignBtn) reassignBtn.addEventListener("click", () => window.openBulkStaffReassignModal());

    const deleteBtn = document.getElementById("bulkStaffDeleteBtn");
    if (deleteBtn) deleteBtn.addEventListener("click", () => window.bulkDeleteStaffMembers());

    // Modal close & backdrop handlers
    const setupModalDismiss = (modalId, closeBtnId, cancelBtnId) => {
        const modal = document.getElementById(modalId);
        const closeBtn = document.getElementById(closeBtnId);
        const cancelBtn = document.getElementById(cancelBtnId);
        const hide = () => { if (modal) modal.style.display = "none"; };
        if (closeBtn) closeBtn.addEventListener("click", hide);
        if (cancelBtn) cancelBtn.addEventListener("click", hide);
        if (modal) {
            modal.addEventListener("click", e => {
                if (e.target === modal) hide();
            });
        }
    };

    setupModalDismiss("bulkStaffStatusModal", "closeBulkStaffStatusModal", "cancelBulkStaffStatusModal");
    setupModalDismiss("bulkStaffRoleModal", "closeBulkStaffRoleModal", "cancelBulkStaffRoleModal");
    setupModalDismiss("bulkStaffReassignModal", "closeBulkStaffReassignModal", "cancelBulkStaffReassignModal");
}
window.initStaffBulkActions = initStaffBulkActions;

// Bulk Status Modal
window.openBulkStaffStatusModal = function() {
    const selected = getSelectedStaffList();
    if (selected.length === 0) {
        alert("Please select at least one staff member to change status.");
        return;
    }
    const summaryEl = document.getElementById("bulkStaffStatusSummary");
    if (summaryEl) {
        const namesPreview = selected.map(s => escapeHtml(s.name || `${s.firstName || ""} ${s.lastName || ""}`.trim())).slice(0, 4).join(", ");
        const moreCount = selected.length > 4 ? ` and ${selected.length - 4} more` : "";
        summaryEl.innerHTML = `Updating employment status for <strong>${selected.length}</strong> staff member${selected.length === 1 ? "" : "s"}: <em>${namesPreview}${moreCount}</em>.`;
    }
    const errEl = document.getElementById("bulkStaffStatusError");
    if (errEl) errEl.textContent = "";

    const modal = document.getElementById("bulkStaffStatusModal");
    if (modal) modal.style.display = "flex";
};

window.confirmBulkStaffStatus = function() {
    const selected = getSelectedStaffList();
    if (selected.length === 0) {
        alert("No staff members selected.");
        return;
    }
    const selectEl = document.getElementById("bulkStaffStatusSelect");
    const newStatus = selectEl ? selectEl.value : "Active";
    const errEl = document.getElementById("bulkStaffStatusError");

    const validStatuses = ["Active", "On Leave", "Inactive"];
    if (!validStatuses.includes(newStatus)) {
        if (errEl) errEl.textContent = "Please select a valid employment status.";
        return;
    }

    const staffList = (typeof getPipelineStaffList === "function") ? getPipelineStaffList() : [];
    const selectedIds = new Set(selected.map(s => String(s.id)));
    staffList.forEach(s => {
        if (selectedIds.has(String(s.id))) {
            s.status = newStatus;
            s.updatedAt = new Date().toISOString();
        }
    });

    if (typeof savePipelineStaffList === "function") {
        savePipelineStaffList(staffList);
    }

    if (typeof logActivity === "function") {
        logActivity({
            type: "lead",
            title: `Updated status to "${newStatus}" for ${selected.length} staff member${selected.length === 1 ? "" : "s"}`,
            meta: selected.map(s => s.name).slice(0, 3).join(", ") + (selected.length > 3 ? "..." : ""),
            href: "pipeline.html"
        });
    }

    const modal = document.getElementById("bulkStaffStatusModal");
    if (modal) modal.style.display = "none";

    window.selectedStaffIds.clear();
    refreshAllPipelineStaffViews();
};

// Bulk Role Modal
window.openBulkStaffRoleModal = function() {
    const selected = getSelectedStaffList();
    if (selected.length === 0) {
        alert("Please select at least one staff member to change role.");
        return;
    }
    const summaryEl = document.getElementById("bulkStaffRoleSummary");
    if (summaryEl) {
        const namesPreview = selected.map(s => escapeHtml(s.name || `${s.firstName || ""} ${s.lastName || ""}`.trim())).slice(0, 4).join(", ");
        const moreCount = selected.length > 4 ? ` and ${selected.length - 4} more` : "";
        summaryEl.innerHTML = `Updating role / position for <strong>${selected.length}</strong> staff member${selected.length === 1 ? "" : "s"}: <em>${namesPreview}${moreCount}</em>.`;
    }
    const errEl = document.getElementById("bulkStaffRoleError");
    if (errEl) errEl.textContent = "";

    const modal = document.getElementById("bulkStaffRoleModal");
    if (modal) modal.style.display = "flex";
};

window.confirmBulkStaffRole = function() {
    const selected = getSelectedStaffList();
    if (selected.length === 0) {
        alert("No staff members selected.");
        return;
    }
    const selectEl = document.getElementById("bulkStaffRoleSelect");
    const newRole = selectEl ? selectEl.value : "";
    const errEl = document.getElementById("bulkStaffRoleError");

    if (!newRole) {
        if (errEl) errEl.textContent = "Please select a valid role.";
        return;
    }

    const staffList = (typeof getPipelineStaffList === "function") ? getPipelineStaffList() : [];
    const selectedIds = new Set(selected.map(s => String(s.id)));
    staffList.forEach(s => {
        if (selectedIds.has(String(s.id))) {
            s.role = newRole;
            s.updatedAt = new Date().toISOString();
        }
    });

    if (typeof savePipelineStaffList === "function") {
        savePipelineStaffList(staffList);
    }

    if (typeof logActivity === "function") {
        logActivity({
            type: "lead",
            title: `Updated role to "${newRole}" for ${selected.length} staff member${selected.length === 1 ? "" : "s"}`,
            meta: selected.map(s => s.name).slice(0, 3).join(", ") + (selected.length > 3 ? "..." : ""),
            href: "pipeline.html"
        });
    }

    const modal = document.getElementById("bulkStaffRoleModal");
    if (modal) modal.style.display = "none";

    window.selectedStaffIds.clear();
    refreshAllPipelineStaffViews();
};

// Bulk Reassign Leads Modal
window.openBulkStaffReassignModal = function() {
    const selected = getSelectedStaffList();
    if (selected.length === 0) {
        alert("Please select at least one staff member to reassign leads.");
        return;
    }

    const allLeads = (typeof getPipelineLeads === "function") ? getPipelineLeads().filter(l => !l.archived) : [];
    const selectedNormNames = new Set(selected.map(s => (typeof normalizePipelineStaff === "function" ? normalizePipelineStaff(s.name) : s.name)));

    const assignedLeads = allLeads.filter(l => {
        const norm = (typeof normalizePipelineStaff === "function") ? normalizePipelineStaff(l.staff) : l.staff;
        return selectedNormNames.has(norm);
    });

    const activeDeals = assignedLeads.filter(l => l.stage !== "lost");
    const totalPipelineValue = activeDeals.reduce((sum, l) => sum + (Number(l.monthlyValue) || 0), 0);

    const summaryEl = document.getElementById("bulkStaffReassignSummary");
    if (summaryEl) {
        const namesPreview = selected.map(s => escapeHtml(s.name || `${s.firstName || ""} ${s.lastName || ""}`.trim())).slice(0, 4).join(", ");
        const moreCount = selected.length > 4 ? ` +${selected.length - 4} more` : "";
        summaryEl.innerHTML = `
            <div style="font-size: 13px; line-height: 1.5;">
                <div>Selected staff: <strong>${selected.length}</strong> (${namesPreview}${moreCount})</div>
                <div style="margin-top: 4px;">Active leads affected: <strong>${assignedLeads.length}</strong> (Pipeline value: <strong>₱${totalPipelineValue.toLocaleString()}</strong>/mo)</div>
            </div>
        `;
    }

    // Populate target staff dropdown
    const targetSelect = document.getElementById("bulkStaffReassignTarget");
    if (targetSelect) {
        targetSelect.innerHTML = "";
        // Option 1: Unassigned
        const unassignedOpt = document.createElement("option");
        unassignedOpt.value = "Unassigned";
        unassignedOpt.textContent = "Unassigned (General Pool)";
        targetSelect.appendChild(unassignedOpt);

        // Option 2..N: Other staff members
        const allStaff = (typeof getPipelineStaffList === "function") ? getPipelineStaffList() : [];
        const selectedIdSet = new Set(selected.map(s => String(s.id)));
        const candidateStaff = allStaff.filter(s => !selectedIdSet.has(String(s.id)));

        if (candidateStaff.length > 0) {
            const optgroup = document.createElement("optgroup");
            optgroup.label = "Available Sales Staff";
            candidateStaff.forEach(s => {
                const opt = document.createElement("option");
                opt.value = s.name;
                opt.textContent = `${s.name} (${s.role || "Staff"} • ${s.status || "Active"})`;
                optgroup.appendChild(opt);
            });
            targetSelect.appendChild(optgroup);
        }
    }

    const errEl = document.getElementById("bulkStaffReassignError");
    if (errEl) errEl.textContent = "";

    const modal = document.getElementById("bulkStaffReassignModal");
    if (modal) modal.style.display = "flex";
};

window.confirmBulkStaffReassign = function() {
    const selected = getSelectedStaffList();
    if (selected.length === 0) {
        alert("No staff members selected.");
        return;
    }

    const targetSelect = document.getElementById("bulkStaffReassignTarget");
    const targetStaff = targetSelect ? targetSelect.value : "";
    const errEl = document.getElementById("bulkStaffReassignError");

    if (!targetStaff) {
        if (errEl) errEl.textContent = "Please select a destination for the reassigned leads.";
        return;
    }

    const allLeads = (typeof getPipelineLeads === "function") ? getPipelineLeads() : [];
    const selectedNormNames = new Set(selected.map(s => (typeof normalizePipelineStaff === "function" ? normalizePipelineStaff(s.name) : s.name)));

    let reassignedCount = 0;
    allLeads.forEach(lead => {
        const norm = (typeof normalizePipelineStaff === "function") ? normalizePipelineStaff(lead.staff) : lead.staff;
        if (selectedNormNames.has(norm)) {
            lead.staff = targetStaff;
            reassignedCount++;
        }
    });

    if (typeof savePipelineLeads === "function") {
        savePipelineLeads(allLeads);
    }

    if (typeof logActivity === "function") {
        logActivity({
            type: "lead",
            title: `Reassigned ${reassignedCount} lead${reassignedCount === 1 ? "" : "s"} to ${targetStaff}`,
            meta: `Transferred from ${selected.length} staff member${selected.length === 1 ? "" : "s"}`,
            href: (typeof activityHref === "function") ? activityHref("pipeline.html", targetStaff) : "pipeline.html"
        });
    }

    const modal = document.getElementById("bulkStaffReassignModal");
    if (modal) modal.style.display = "none";

    window.selectedStaffIds.clear();
    refreshAllPipelineStaffViews();
};

// Bulk Delete Staff
window.bulkDeleteStaffMembers = function() {
    const selected = getSelectedStaffList();
    if (selected.length === 0) {
        alert("Please select at least one staff member to delete.");
        return;
    }

    const allLeads = (typeof getPipelineLeads === "function") ? getPipelineLeads().filter(l => !l.archived) : [];
    const selectedNormNames = new Set(selected.map(s => (typeof normalizePipelineStaff === "function" ? normalizePipelineStaff(s.name) : s.name)));

    const assignedLeads = allLeads.filter(l => {
        const norm = (typeof normalizePipelineStaff === "function") ? normalizePipelineStaff(l.staff) : l.staff;
        return selectedNormNames.has(norm);
    });

    if (assignedLeads.length > 0) {
        const confirmMsg = `You are about to delete ${selected.length} staff member${selected.length === 1 ? "" : "s"}.\n\nA total of ${assignedLeads.length} active lead${assignedLeads.length === 1 ? "" : "s"} currently assigned to them will be unassigned (moved to Unassigned).\n\nDo you wish to proceed?`;
        if (!confirm(confirmMsg)) return;

        // Reassign leads to Unassigned
        if (typeof savePipelineLeads === "function") {
            const rawLeads = getPipelineLeads();
            rawLeads.forEach(l => {
                const norm = (typeof normalizePipelineStaff === "function") ? normalizePipelineStaff(l.staff) : l.staff;
                if (selectedNormNames.has(norm)) {
                    l.staff = "Unassigned";
                }
            });
            savePipelineLeads(rawLeads);
        }
    } else {
        if (!confirm(`Are you sure you want to remove ${selected.length} selected staff member${selected.length === 1 ? "" : "s"} from the directory? This cannot be undone.`)) {
            return;
        }
    }

    const staffList = (typeof getPipelineStaffList === "function") ? getPipelineStaffList() : [];
    const selectedIdSet = new Set(selected.map(s => String(s.id)));
    const updatedStaffList = staffList.filter(s => !selectedIdSet.has(String(s.id)));

    if (typeof savePipelineStaffList === "function") {
        savePipelineStaffList(updatedStaffList);
    }

    if (typeof logActivity === "function") {
        logActivity({
            type: "lead",
            title: `${selected.length} staff member${selected.length === 1 ? "" : "s"} removed from the Sales Staff Directory`,
            meta: selected.map(s => s.name).slice(0, 3).join(", ") + (selected.length > 3 ? "..." : ""),
            href: "pipeline.html"
        });
    }

    window.selectedStaffIds.clear();
    refreshAllPipelineStaffViews();
};

function renderStaffDirectory() {
    const tbody = document.getElementById("staffTableBody");
    if (!tbody) return;

    if (typeof initStaffBulkActions === "function") {
        initStaffBulkActions();
    }

    const staffList = (typeof getPipelineStaffList === "function") ? getPipelineStaffList() : [];

    // Prune stale IDs from selection
    if (window.selectedStaffIds) {
        const existingIds = new Set(staffList.map(s => String(s.id)));
        for (const id of Array.from(window.selectedStaffIds)) {
            if (!existingIds.has(id)) {
                window.selectedStaffIds.delete(id);
            }
        }
    }

    const filtered = getFilteredStaffList();

    const countEl = document.getElementById("staffDirectoryCount");
    if (countEl) {
        if (staffList.length === 0) {
            countEl.textContent = "0 staff members";
        } else if (filtered.length === staffList.length) {
            countEl.textContent = `${staffList.length} staff member${staffList.length === 1 ? "" : "s"}`;
        } else {
            countEl.textContent = `Showing ${filtered.length} of ${staffList.length} staff member${staffList.length === 1 ? "" : "s"}`;
        }
    }

    tbody.innerHTML = "";
    if (staffList.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" style="text-align: center; padding: 32px 16px; color: var(--text-secondary);">No sales staff registered yet. Click <strong>+ Add Staff Member</strong> to get started.</td></tr>';
        updateStaffBulkActionBar(filtered);
        return;
    }

    if (filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" style="text-align: center; padding: 32px 16px; color: var(--text-secondary);">No staff members match your filter criteria. <button type="button" onclick="resetStaffFilters()" style="color: var(--primary); text-decoration: underline; background: none; border: none; font-weight: 600; cursor: pointer;">Reset filters</button></td></tr>';
        updateStaffBulkActionBar(filtered);
        return;
    }

    const allLeads = (typeof getPipelineLeads === "function") ? getPipelineLeads().filter(l => !l.archived) : [];

    filtered.forEach(staff => {
        const staffName = staff.name || (typeof combineNameParts === "function" ? combineNameParts(staff.firstName, staff.middleName, staff.lastName) : `${staff.firstName || ""} ${staff.lastName || ""}`.trim());
        const staffRole = staff.role || "Sales Consultant";
        const staffStatus = staff.status || "Active";
        const staffPhone = staff.phone || "";
        const staffEmail = staff.email || "";

        // Deals calculation
        const assignedLeads = allLeads.filter(l => {
            const leadStaffNorm = (typeof normalizePipelineStaff === "function") ? normalizePipelineStaff(l.staff) : l.staff;
            const staffNorm = (typeof normalizePipelineStaff === "function") ? normalizePipelineStaff(staffName) : staffName;
            return leadStaffNorm === staffNorm || l.staff === staffName;
        });

        const activeDeals = assignedLeads.filter(l => l.stage !== "lost");
        const wonDeals = assignedLeads.filter(l => l.stage === "won");
        const pipelineValue = activeDeals.reduce((sum, l) => sum + (Number(l.monthlyValue) || 0), 0);

        // Status badge tone
        const statusCls = staffStatus === "Active" ? "active" : (staffStatus === "On Leave" ? "warning" : "danger");

        const isChecked = window.selectedStaffIds && window.selectedStaffIds.has(String(staff.id));

        const tr = document.createElement("tr");
        if (isChecked) tr.classList.add("is-selected");
        tr.innerHTML = `
            <td class="td-checkbox">
                <input type="checkbox" class="staff-select-checkbox" data-staff-id="${encodeURIComponent(staff.id)}" ${isChecked ? "checked" : ""} title="Select ${escapeHtml(staffName)}" aria-label="Select ${escapeHtml(staffName)}">
            </td>
            <td>
                <strong>${escapeHtml(staffName)}</strong>
            </td>
            <td><strong>${escapeHtml(staffRole)}</strong></td>
            <td>
                ${escapeHtml(formatDisplayPhone(staffPhone))}
                <br>
                <small style="color: var(--text-muted);">${staffEmail ? `<a href="mailto:${escapeHtml(staffEmail)}" style="color: inherit; text-decoration: underline;">${escapeHtml(staffEmail)}</a>` : "—"}</small>
            </td>
            <td style="text-align: center;">
                <span class="badge ${activeDeals.length > 0 ? 'active' : 'open'}">${activeDeals.length} ${activeDeals.length === 1 ? 'deal' : 'deals'}</span>
            </td>
            <td style="text-align: center;">
                <span class="badge ${wonDeals.length > 0 ? 'active' : 'open'}">${wonDeals.length} won</span>
            </td>
            <td style="text-align: right;">
                <strong>₱${pipelineValue.toLocaleString()}</strong><small style="color: var(--text-muted); font-size: 11px;">/mo</small>
            </td>
            <td style="text-align: center;">
                <span class="badge ${statusCls}">${escapeHtml(staffStatus)}</span>
            </td>
            <td style="text-align: right;">
                <div class="row-actions" style="justify-content: flex-end; gap: 6px;">
                    <button type="button" class="btn-view" onclick="openEditStaff('${encodeURIComponent(staff.id)}')">Edit</button>
                    <button type="button" class="btn-delete" onclick="deleteStaffMember('${encodeURIComponent(staff.id)}')">Delete</button>
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });

    updateStaffBulkActionBar(filtered);
}

function resetStaffFilters() {
    const searchInput = document.getElementById("searchStaff");
    const roleFilter = document.getElementById("filterStaffRole");
    const statusFilter = document.getElementById("filterStaffStatus");
    if (searchInput) searchInput.value = "";
    if (roleFilter) roleFilter.value = "all";
    if (statusFilter) statusFilter.value = "all";
    renderStaffDirectory();
}

function openAddStaff() {
    clearStaffFormErrors();
    const form = document.getElementById("staffForm");
    if (form) form.reset();
    document.getElementById("staffId").value = "";
    document.getElementById("staffStatus").value = "Active";

    document.getElementById("staffModalTitle").textContent = "Add Sales Staff Member";
    const saveBtn = document.getElementById("saveStaffBtn");
    if (saveBtn) saveBtn.textContent = "Save Staff Member";
    const modal = document.getElementById("staffModal");
    if (modal) modal.style.display = "flex";
}

function openEditStaff(encodedId) {
    clearStaffFormErrors();
    const id = decodeURIComponent(encodedId || "");
    const staffList = (typeof getPipelineStaffList === "function") ? getPipelineStaffList() : [];
    const staff = staffList.find(s => String(s.id) === String(id));
    if (!staff) {
        alert("Staff member not found. They may have been removed.");
        return;
    }

    document.getElementById("staffId").value = staff.id;
    if (typeof fillNameInputs === "function") {
        fillNameInputs("staff", staff);
    } else {
        document.getElementById("staffFirstName").value = staff.firstName || "";
        document.getElementById("staffMiddleName").value = staff.middleName || "";
        document.getElementById("staffLastName").value = staff.lastName || "";
    }

    // Fallback if record only had single name
    if (!document.getElementById("staffFirstName").value && staff.name) {
        const parts = staff.name.split(" ");
        document.getElementById("staffFirstName").value = parts[0] || "";
        document.getElementById("staffLastName").value = parts.slice(1).join(" ") || parts[0];
    }

    document.getElementById("staffRole").value = staff.role || "Sales Consultant";
    document.getElementById("staffEmail").value = staff.email || "";
    document.getElementById("staffPhone").value = (typeof phPhoneNationalDigits === "function") ? phPhoneNationalDigits(staff.phone || "") : (staff.phone || "");
    document.getElementById("staffStatus").value = staff.status || "Active";

    document.getElementById("staffModalTitle").textContent = `Edit Staff: ${staff.name || "Member"}`;
    const saveBtn = document.getElementById("saveStaffBtn");
    if (saveBtn) saveBtn.textContent = "Update Staff Member";
    const modal = document.getElementById("staffModal");
    if (modal) modal.style.display = "flex";
}

function validateAndSaveStaff(e) {
    if (e && typeof e.preventDefault === "function") e.preventDefault();
    clearStaffFormErrors();

    const id = String(document.getElementById("staffId") ? document.getElementById("staffId").value : "").trim();
    const names = (typeof readNameInputs === "function")
        ? readNameInputs("staff")
        : {
            firstName: (document.getElementById("staffFirstName").value || "").trim(),
            middleName: (document.getElementById("staffMiddleName").value || "").trim(),
            lastName: (document.getElementById("staffLastName").value || "").trim(),
            name: `${(document.getElementById("staffFirstName").value || "").trim()} ${(document.getElementById("staffLastName").value || "").trim()}`.trim()
        };

    const role = (document.getElementById("staffRole").value || "").trim();
    const email = (document.getElementById("staffEmail").value || "").trim().toLowerCase();
    const phoneInput = (document.getElementById("staffPhone").value || "").trim();
    const phoneDigits = (typeof phPhoneNationalDigits === "function") ? phPhoneNationalDigits(phoneInput) : phoneInput.replace(/\D/g, "");
    const phoneLocal = (typeof phLocalNumber === "function") ? phLocalNumber(phoneInput) : (phoneDigits ? "0" + phoneDigits : "");
    const status = (document.getElementById("staffStatus").value || "").trim();

    // Field 1: First Name Validation
    if (!names.firstName) {
        return setStaffFieldError("staffFirstName", "Please enter the staff member's first name.");
    }
    if (names.firstName.length < 2) {
        return setStaffFieldError("staffFirstName", "First name must be at least 2 characters.");
    }
    if (typeof isValidPersonName === "function" && !isValidPersonName(names.firstName)) {
        return setStaffFieldError("staffFirstName", "First name may only contain letters and spaces (ñ/Ñ allowed).");
    }

    // Field 2: Middle Name Validation (Optional)
    if (names.middleName && typeof isValidPersonName === "function" && !isValidPersonName(names.middleName)) {
        return setStaffFieldError("staffMiddleName", "Middle name may only contain letters and spaces (ñ/Ñ allowed).");
    }

    // Field 3: Last Name Validation
    if (!names.lastName) {
        return setStaffFieldError("staffLastName", "Please enter the staff member's last name.");
    }
    if (names.lastName.length < 2) {
        return setStaffFieldError("staffLastName", "Last name must be at least 2 characters.");
    }
    if (typeof isValidPersonName === "function" && !isValidPersonName(names.lastName)) {
        return setStaffFieldError("staffLastName", "Last name may only contain letters and spaces (ñ/Ñ allowed).");
    }

    // Field 4: Role Validation
    const allowedRoles = (typeof PIPELINE_STAFF_ROLES !== "undefined") ? PIPELINE_STAFF_ROLES : [
        "Sales Consultant",
        "Membership Advisor",
        "Front Desk Agent",
        "Sales Manager",
        "Fitness Coach"
    ];
    if (!role || !allowedRoles.includes(role)) {
        return setStaffFieldError("staffRole", "Please select a valid role / position.");
    }

    // Field 5: Email Validation
    if (!email) {
        return setStaffFieldError("staffEmail", "Please enter an email address.");
    }
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(email)) {
        return setStaffFieldError("staffEmail", "Please enter a valid email address (e.g. staff@anytimefitness.ph).");
    }

    const staffList = (typeof getPipelineStaffList === "function") ? getPipelineStaffList() : [];
    const duplicateEmail = staffList.find(s => String(s.id) !== String(id) && String(s.email || "").trim().toLowerCase() === email);
    if (duplicateEmail) {
        return setStaffFieldError("staffEmail", `A staff member with this email already exists: ${duplicateEmail.name || "Staff"}.`);
    }

    // Field 6: Phone Validation
    if (!phoneDigits) {
        return setStaffFieldError("staffPhone", "Please enter a contact mobile number.");
    }
    if (phoneDigits.length !== 10) {
        return setStaffFieldError("staffPhone", "Enter the 10-digit mobile number after +63 (e.g. 912 345 6789).");
    }
    const duplicatePhone = staffList.find(s => {
        if (String(s.id) === String(id)) return false;
        const sPhone = (typeof phLocalNumber === "function") ? phLocalNumber(s.phone) : s.phone;
        return sPhone === phoneLocal;
    });
    if (duplicatePhone) {
        return setStaffFieldError("staffPhone", `A staff member with this phone number already exists: ${duplicatePhone.name || "Staff"}.`);
    }

    // Field 7: Status Validation
    const allowedStatuses = (typeof PIPELINE_STAFF_STATUSES !== "undefined") ? PIPELINE_STAFF_STATUSES : ["Active", "On Leave", "Inactive"];
    if (!status || !allowedStatuses.includes(status)) {
        return setStaffFieldError("staffStatus", "Please select a valid employment status.");
    }

    // Field 8: Full Name Uniqueness Check
    const duplicateName = staffList.find(s => {
        if (String(s.id) === String(id)) return false;
        const firstMatches = String(s.firstName || "").trim().toLowerCase() === names.firstName.toLowerCase();
        const lastMatches = String(s.lastName || "").trim().toLowerCase() === names.lastName.toLowerCase();
        const fullMatches = String(s.name || "").trim().toLowerCase() === names.name.toLowerCase();
        return (firstMatches && lastMatches) || fullMatches;
    });
    if (duplicateName) {
        return setStaffFieldError("staffFirstName", `A staff member named "${names.name}" already exists in the directory.`);
    }

    // All validations passed! Save data
    const isEditing = Boolean(id);
    let oldStaffName = null;

    if (isEditing) {
        const existingIdx = staffList.findIndex(s => String(s.id) === String(id));
        if (existingIdx === -1) {
            return setStaffFieldError("staffFirstName", "Staff record not found.");
        }
        oldStaffName = staffList[existingIdx].name;
        staffList[existingIdx] = {
            ...staffList[existingIdx],
            name: names.name,
            firstName: names.firstName,
            middleName: names.middleName,
            lastName: names.lastName,
            role,
            email,
            phone: phoneLocal,
            status,
            updatedAt: new Date().toISOString()
        };

        // If staff was renamed, update leads currently assigned to oldStaffName
        if (oldStaffName && oldStaffName !== names.name && typeof getPipelineLeads === "function" && typeof savePipelineLeads === "function") {
            const leads = getPipelineLeads();
            let leadsUpdated = false;
            leads.forEach(lead => {
                if (lead.staff === oldStaffName) {
                    lead.staff = names.name;
                    leadsUpdated = true;
                }
            });
            if (leadsUpdated) {
                savePipelineLeads(leads);
            }
        }

        if (typeof logActivity === "function") {
            logActivity({
                type: "lead",
                title: `${names.name}'s staff details were updated`,
                meta: `${role} • ${status}`,
                href: (typeof activityHref === "function") ? activityHref("pipeline.html", names.name) : "pipeline.html"
            });
        }
    } else {
        const newStaff = {
            id: Date.now(),
            name: names.name,
            firstName: names.firstName,
            middleName: names.middleName,
            lastName: names.lastName,
            role,
            email,
            phone: phoneLocal,
            status,
            createdAt: new Date().toISOString()
        };
        staffList.push(newStaff);

        if (typeof logActivity === "function") {
            logActivity({
                type: "lead",
                title: `${names.name} was added to the Sales Staff Directory`,
                meta: `${role} • ${status}`,
                href: (typeof activityHref === "function") ? activityHref("pipeline.html", names.name) : "pipeline.html"
            });
        }
    }

    if (typeof savePipelineStaffList === "function") {
        savePipelineStaffList(staffList);
    }

    const modal = document.getElementById("staffModal");
    if (modal) modal.style.display = "none";

    refreshAllPipelineStaffViews();
}

function deleteStaffMember(encodedId) {
    const id = decodeURIComponent(encodedId || "");
    const staffList = (typeof getPipelineStaffList === "function") ? getPipelineStaffList() : [];
    const staff = staffList.find(s => String(s.id) === String(id));
    if (!staff) {
        alert("Staff member not found. They may have already been removed.");
        return;
    }

    const allLeads = (typeof getPipelineLeads === "function") ? getPipelineLeads().filter(l => !l.archived) : [];
    const assignedLeads = allLeads.filter(l => {
        const leadStaffNorm = (typeof normalizePipelineStaff === "function") ? normalizePipelineStaff(l.staff) : l.staff;
        const staffNorm = (typeof normalizePipelineStaff === "function") ? normalizePipelineStaff(staff.name) : staff.name;
        return leadStaffNorm === staffNorm || l.staff === staff.name;
    });

    if (assignedLeads.length > 0) {
        const confirmMsg = `"${staff.name}" is currently assigned to ${assignedLeads.length} active lead${assignedLeads.length === 1 ? "" : "s"} in the pipeline.\n\nDeleting this staff member will unassign their leads. Do you wish to continue?`;
        if (!confirm(confirmMsg)) return;

        // Reassign leads to Unassigned
        if (typeof savePipelineLeads === "function") {
            const rawLeads = getPipelineLeads();
            rawLeads.forEach(l => {
                if (l.staff === staff.name) {
                    l.staff = "Unassigned";
                }
            });
            savePipelineLeads(rawLeads);
        }
    } else {
        if (!confirm(`Are you sure you want to remove ${staff.name} from the Sales Staff Directory?`)) {
            return;
        }
    }

    const updatedList = staffList.filter(s => String(s.id) !== String(id));
    if (typeof savePipelineStaffList === "function") {
        savePipelineStaffList(updatedList);
    }

    if (window.selectedStaffIds) {
        window.selectedStaffIds.delete(String(id));
    }

    if (typeof logActivity === "function") {
        logActivity({
            type: "lead",
            title: `${staff.name} was removed from the Sales Staff Directory`,
            meta: `${staff.role || "Staff Member"}`,
            href: "pipeline.html"
        });
    }

    refreshAllPipelineStaffViews();
}

function initStaffDirectory() {
    const openBtn = document.getElementById("openStaffModal");
    const closeBtn = document.getElementById("closeStaffModal");
    const cancelBtn = document.getElementById("cancelStaffModal");
    const modal = document.getElementById("staffModal");
    const form = document.getElementById("staffForm");

    if (openBtn) openBtn.addEventListener("click", openAddStaff);
    if (closeBtn) closeBtn.addEventListener("click", () => { if (modal) modal.style.display = "none"; });
    if (cancelBtn) cancelBtn.addEventListener("click", () => { if (modal) modal.style.display = "none"; });

    if (modal) {
        modal.addEventListener("click", e => {
            if (e.target === modal) modal.style.display = "none";
        });
    }

    if (form) {
        form.addEventListener("submit", validateAndSaveStaff);
    }

    // Input sanitization and live error reset
    ["staffFirstName", "staffMiddleName", "staffLastName"].forEach(fieldId => {
        const input = document.getElementById(fieldId);
        if (!input) return;
        input.addEventListener("input", () => {
            if (typeof sanitizePersonNameInput === "function") sanitizePersonNameInput(input);
            input.classList.remove("input-invalid");
            const err = document.getElementById("staffFormError");
            if (err && err.dataset.field === fieldId) {
                err.textContent = "";
                delete err.dataset.field;
            }
        });
        input.addEventListener("blur", () => {
            if (typeof sanitizePersonNameInput === "function") sanitizePersonNameInput(input);
        });
    });

    const phoneInput = document.getElementById("staffPhone");
    if (phoneInput) {
        if (typeof bindPhPhoneInput === "function") bindPhPhoneInput(phoneInput);
        phoneInput.addEventListener("input", () => {
            phoneInput.classList.remove("input-invalid");
            const err = document.getElementById("staffFormError");
            if (err && err.dataset.field === "staffPhone") {
                err.textContent = "";
                delete err.dataset.field;
            }
        });
    }

    ["staffRole", "staffEmail", "staffStatus"].forEach(fieldId => {
        const el = document.getElementById(fieldId);
        if (!el) return;
        const resetThis = () => {
            el.classList.remove("input-invalid");
            const err = document.getElementById("staffFormError");
            if (err && err.dataset.field === fieldId) {
                err.textContent = "";
                delete err.dataset.field;
            }
        };
        el.addEventListener("input", resetThis);
        el.addEventListener("change", resetThis);
    });

    // Filters
    const searchInput = document.getElementById("searchStaff");
    const roleSelect = document.getElementById("filterStaffRole");
    const statusSelect = document.getElementById("filterStaffStatus");
    const resetBtn = document.getElementById("resetStaffFilters");

    if (searchInput) searchInput.addEventListener("input", renderStaffDirectory);
    if (roleSelect) roleSelect.addEventListener("change", renderStaffDirectory);
    if (statusSelect) statusSelect.addEventListener("change", renderStaffDirectory);
    if (resetBtn) resetBtn.addEventListener("click", resetStaffFilters);

    renderStaffDirectory();
}

// Global exposure
window.renderStaffDirectory = renderStaffDirectory;
window.openAddStaff = openAddStaff;
window.openEditStaff = openEditStaff;
window.deleteStaffMember = deleteStaffMember;
window.resetStaffFilters = resetStaffFilters;
window.initStaffDirectory = initStaffDirectory;
window.refreshAllPipelineStaffViews = refreshAllPipelineStaffViews;
window.updateStaffBulkActionBar = updateStaffBulkActionBar;
window.initStaffBulkActions = initStaffBulkActions;
window.openBulkStaffStatusModal = openBulkStaffStatusModal;
window.confirmBulkStaffStatus = confirmBulkStaffStatus;
window.openBulkStaffRoleModal = openBulkStaffRoleModal;
window.confirmBulkStaffRole = confirmBulkStaffRole;
window.openBulkStaffReassignModal = openBulkStaffReassignModal;
window.confirmBulkStaffReassign = confirmBulkStaffReassign;
window.bulkDeleteStaffMembers = bulkDeleteStaffMembers;
window.getFilteredStaffList = getFilteredStaffList;
window.getSelectedStaffList = getSelectedStaffList;

// Automatic initialization on pipeline page load
document.addEventListener("DOMContentLoaded", () => {
    if (document.getElementById("staffTableBody")) {
        initStaffDirectory();
    }
});

// ---- Marketing Campaigns (Social Media) ----
