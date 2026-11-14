/**
 * Archive Page Bulk Actions Management
 * Handles bulk actions for:
 * 1. Archived Members
 * 2. Archived Coaches
 * 3. Archived Walk-in Tickets
 * 4. Archived Portal Inquiries
 * 5. Archived Pipeline Leads
 * 6. Archived Sessions
 *
 * Provides:
 * - Hidden toolbar when selection is empty, visible when rows selected
 * - Row click selection delegation
 * - Master header checkbox with checked/indeterminate/unchecked states
 * - "Select all matching" and "Clear selection" controls
 * - Bulk Restore & Bulk Permanent Delete
 * - Strictly NO CSV and NO PDF exports
 */

// Initialize selection sets on window
window.selectedArchivedMemberIds = window.selectedArchivedMemberIds || new Set();
window.selectedArchivedCoachIds = window.selectedArchivedCoachIds || new Set();
window.selectedArchivedStaffTicketIds = window.selectedArchivedStaffTicketIds || new Set();
window.selectedArchivedCustomerInquiryIds = window.selectedArchivedCustomerInquiryIds || new Set();
window.selectedArchivedLeadIds = window.selectedArchivedLeadIds || new Set();
window.selectedArchivedSessionIds = window.selectedArchivedSessionIds || new Set();

// ---------------------------------------------------------------------------
// Bulk Action Handlers
// ---------------------------------------------------------------------------

// 1. Archived Members
window.bulkRestoreArchivedMembers = function() {
    const selected = Array.from(window.selectedArchivedMemberIds);
    if (selected.length === 0) {
        alert("Please select at least one archived member to restore.");
        return;
    }
    const label = selected.length === 1 ? "1 member" : `${selected.length} members`;
    if (!confirm(`Restore ${label} back to the active directory?`)) return;

    let restoredCount = 0;
    selected.forEach(id => {
        if (typeof restoreMemberById === "function" && restoreMemberById(id)) {
            restoredCount++;
        }
    });

    if (typeof logActivity === "function") {
        logActivity({
            type: "membership",
            title: `Restored ${restoredCount} member(s) from archive`,
            meta: `${restoredCount} record(s) restored`,
            href: "members.html"
        });
    }

    window.selectedArchivedMemberIds.clear();
    if (typeof renderArchivedMembers === "function") renderArchivedMembers();
    if (typeof renderCustomerDirectory === "function") renderCustomerDirectory();
    if (typeof countExpiringMembers === "function") countExpiringMembers();
    if (typeof countActiveMembers === "function") countActiveMembers();
};

window.bulkDeleteArchivedMembers = function() {
    if (sessionStorage.getItem("crmRole") !== "admin") {
        alert("Only staff can permanently delete members.");
        return;
    }
    const selected = Array.from(window.selectedArchivedMemberIds);
    if (selected.length === 0) {
        alert("Please select at least one archived member to delete.");
        return;
    }
    const label = selected.length === 1 ? "1 archived member" : `${selected.length} archived members`;
    if (!confirm(`Permanently delete ${label}? This cannot be undone.`)) return;

    let deletedCount = 0;
    selected.forEach(id => {
        if (typeof permanentlyDeleteMemberById === "function" && permanentlyDeleteMemberById(id)) {
            deletedCount++;
        }
    });

    if (typeof logActivity === "function") {
        logActivity({
            type: "membership",
            title: `Permanently deleted ${deletedCount} archived member record(s)`,
            meta: `${deletedCount} record(s) removed`,
            href: "archive.html"
        });
    }

    window.selectedArchivedMemberIds.clear();
    if (typeof renderArchivedMembers === "function") renderArchivedMembers();
    if (typeof countExpiringMembers === "function") countExpiringMembers();
    if (typeof countActiveMembers === "function") countActiveMembers();
};

// 2. Archived Coaches
window.bulkRestoreArchivedCoaches = function() {
    const selected = Array.from(window.selectedArchivedCoachIds);
    if (selected.length === 0) {
        alert("Please select at least one archived coach to restore.");
        return;
    }
    const label = selected.length === 1 ? "1 coach" : `${selected.length} coaches`;
    if (!confirm(`Restore ${label} back to the coach directory?`)) return;

    let restoredCount = 0;
    selected.forEach(id => {
        if (typeof restoreCoachById === "function" && restoreCoachById(id)) {
            restoredCount++;
        }
    });

    if (typeof logActivity === "function") {
        logActivity({
            type: "coach",
            title: `Restored ${restoredCount} coach(es) from archive`,
            meta: `${restoredCount} record(s) restored`,
            href: "coach.html"
        });
    }

    window.selectedArchivedCoachIds.clear();
    if (typeof refreshCoachViews === "function") {
        refreshCoachViews();
    } else if (typeof renderArchivedCoaches === "function") {
        renderArchivedCoaches();
    }
};

window.bulkDeleteArchivedCoaches = function() {
    if (sessionStorage.getItem("crmRole") !== "admin") {
        alert("Only staff can permanently delete coaches.");
        return;
    }
    const selected = Array.from(window.selectedArchivedCoachIds);
    if (selected.length === 0) {
        alert("Please select at least one archived coach to delete.");
        return;
    }
    const label = selected.length === 1 ? "1 archived coach record" : `${selected.length} archived coach records`;
    if (!confirm(`Permanently delete ${label}? This cannot be undone.`)) return;

    let deletedCount = 0;
    selected.forEach(id => {
        if (typeof permanentlyDeleteCoachById === "function" && permanentlyDeleteCoachById(id)) {
            deletedCount++;
        }
    });

    if (typeof logActivity === "function") {
        logActivity({
            type: "coach",
            title: `Permanently deleted ${deletedCount} archived coach record(s)`,
            meta: `${deletedCount} record(s) removed`,
            href: "archive.html"
        });
    }

    window.selectedArchivedCoachIds.clear();
    if (typeof refreshCoachViews === "function") {
        refreshCoachViews();
    } else if (typeof renderArchivedCoaches === "function") {
        renderArchivedCoaches();
    }
};

// 3. Archived Walk-in Tickets
window.bulkRestoreArchivedStaffTickets = function() {
    if (sessionStorage.getItem("crmRole") !== "admin") {
        alert("Only staff can restore tickets.");
        return;
    }
    const selected = Array.from(window.selectedArchivedStaffTicketIds);
    if (selected.length === 0) {
        alert("Please select at least one archived walk-in ticket to restore.");
        return;
    }
    const label = selected.length === 1 ? "1 ticket" : `${selected.length} tickets`;
    if (!confirm(`Restore ${label} back to the active queue?`)) return;

    const all = typeof getTicketStorage === "function" ? getTicketStorage("staff") : [];
    const selSet = new Set(selected.map(String));
    let restoredCount = 0;
    all.forEach(t => {
        if (selSet.has(String(t.id))) {
            delete t.archived;
            delete t.archivedAt;
            restoredCount++;
        }
    });
    if (typeof saveTicketStorage === "function") saveTicketStorage("staff", all);

    if (typeof logActivity === "function") {
        logActivity({
            type: "ticket",
            title: `Restored ${restoredCount} staff walk-in ticket(s) from archive`,
            meta: `${restoredCount} ticket(s) returned to active queue`,
            href: "tickets.html"
        });
    }

    window.selectedArchivedStaffTicketIds.clear();
    if (typeof renderArchivedTickets === "function") renderArchivedTickets();
    if (typeof renderStaffTickets === "function") renderStaffTickets();
    if (typeof getOpenTicketsCount === "function") getOpenTicketsCount();
};

window.bulkDeleteArchivedStaffTickets = function() {
    if (sessionStorage.getItem("crmRole") !== "admin") {
        alert("Only staff can permanently delete tickets.");
        return;
    }
    const selected = Array.from(window.selectedArchivedStaffTicketIds);
    if (selected.length === 0) {
        alert("Please select at least one archived walk-in ticket to delete.");
        return;
    }
    const label = selected.length === 1 ? "1 archived walk-in ticket" : `${selected.length} archived walk-in tickets`;
    if (!confirm(`Permanently delete ${label}? This cannot be undone.`)) return;

    const selSet = new Set(selected.map(String));
    const kept = (typeof getTicketStorage === "function" ? getTicketStorage("staff") : []).filter(t => !selSet.has(String(t.id)));
    if (typeof saveTicketStorage === "function") saveTicketStorage("staff", kept);

    if (typeof logActivity === "function") {
        logActivity({
            type: "ticket",
            title: `Permanently deleted ${selected.length} archived staff ticket(s)`,
            meta: `${selected.length} record(s) removed`,
            href: "archive.html"
        });
    }

    window.selectedArchivedStaffTicketIds.clear();
    if (typeof renderArchivedTickets === "function") renderArchivedTickets();
    if (typeof renderStaffTickets === "function") renderStaffTickets();
    if (typeof getOpenTicketsCount === "function") getOpenTicketsCount();
};

// 4. Archived Customer Portal Inquiries
window.bulkRestoreArchivedCustomerInquiries = function() {
    if (sessionStorage.getItem("crmRole") !== "admin") {
        alert("Only staff can restore inquiries.");
        return;
    }
    const selected = Array.from(window.selectedArchivedCustomerInquiryIds);
    if (selected.length === 0) {
        alert("Please select at least one archived portal inquiry to restore.");
        return;
    }
    const label = selected.length === 1 ? "1 inquiry" : `${selected.length} inquiries`;
    if (!confirm(`Restore ${label} back to the active queue?`)) return;

    const all = typeof getTicketStorage === "function" ? getTicketStorage("customer") : [];
    const selSet = new Set(selected.map(String));
    let restoredCount = 0;
    all.forEach(i => {
        if (selSet.has(String(i.id))) {
            delete i.archived;
            delete i.archivedAt;
            restoredCount++;
        }
    });
    if (typeof saveTicketStorage === "function") saveTicketStorage("customer", all);

    if (typeof logActivity === "function") {
        logActivity({
            type: "ticket",
            title: `Restored ${restoredCount} customer portal inquiry(s) from archive`,
            meta: `${restoredCount} inquiry(s) returned to active queue`,
            href: "tickets.html"
        });
    }

    window.selectedArchivedCustomerInquiryIds.clear();
    if (typeof renderArchivedTickets === "function") renderArchivedTickets();
    if (typeof renderCustomerInquiries === "function") renderCustomerInquiries();
    if (typeof getOpenTicketsCount === "function") getOpenTicketsCount();
};

window.bulkDeleteArchivedCustomerInquiries = function() {
    if (sessionStorage.getItem("crmRole") !== "admin") {
        alert("Only staff can permanently delete inquiries.");
        return;
    }
    const selected = Array.from(window.selectedArchivedCustomerInquiryIds);
    if (selected.length === 0) {
        alert("Please select at least one archived portal inquiry to delete.");
        return;
    }
    const label = selected.length === 1 ? "1 archived portal inquiry" : `${selected.length} archived portal inquiries`;
    if (!confirm(`Permanently delete ${label}? This cannot be undone.`)) return;

    const selSet = new Set(selected.map(String));
    const kept = (typeof getTicketStorage === "function" ? getTicketStorage("customer") : []).filter(i => !selSet.has(String(i.id)));
    if (typeof saveTicketStorage === "function") saveTicketStorage("customer", kept);

    if (typeof logActivity === "function") {
        logActivity({
            type: "ticket",
            title: `Permanently deleted ${selected.length} archived customer inquiry(s)`,
            meta: `${selected.length} record(s) removed`,
            href: "archive.html"
        });
    }

    window.selectedArchivedCustomerInquiryIds.clear();
    if (typeof renderArchivedTickets === "function") renderArchivedTickets();
    if (typeof renderCustomerInquiries === "function") renderCustomerInquiries();
    if (typeof getOpenTicketsCount === "function") getOpenTicketsCount();
};

// 5. Archived Pipeline Leads
window.bulkRestoreArchivedLeads = function() {
    const selected = Array.from(window.selectedArchivedLeadIds);
    if (selected.length === 0) {
        alert("Please select at least one archived lead to restore.");
        return;
    }
    const label = selected.length === 1 ? "1 lead" : `${selected.length} leads`;
    if (!confirm(`Restore ${label} back to the pipeline?`)) return;

    const leads = typeof getPipelineLeads === "function" ? getPipelineLeads() : [];
    const selSet = new Set(selected.map(String));
    let restoredCount = 0;
    leads.forEach(l => {
        if (selSet.has(String(l.id))) {
            delete l.archived;
            delete l.archivedAt;
            restoredCount++;
        }
    });
    if (typeof savePipelineLeads === "function") savePipelineLeads(leads);

    if (typeof logActivity === "function") {
        logActivity({
            type: "lead",
            title: `Restored ${restoredCount} lead(s) from archive`,
            meta: `${restoredCount} record(s) restored`,
            href: "pipeline.html"
        });
    }

    window.selectedArchivedLeadIds.clear();
    if (typeof renderArchivedLeads === "function") renderArchivedLeads();
    if (typeof renderPipelineBoard === "function") renderPipelineBoard();
    if (typeof renderStaffDirectory === "function") renderStaffDirectory();
};

window.bulkDeleteArchivedLeads = function() {
    if (sessionStorage.getItem("crmRole") !== "admin") {
        alert("Only staff can permanently delete leads.");
        return;
    }
    const selected = Array.from(window.selectedArchivedLeadIds);
    if (selected.length === 0) {
        alert("Please select at least one archived lead to delete.");
        return;
    }
    const label = selected.length === 1 ? "1 archived lead" : `${selected.length} archived leads`;
    if (!confirm(`Permanently delete ${label}? This cannot be undone.`)) return;

    const selSet = new Set(selected.map(String));
    const kept = (typeof getPipelineLeads === "function" ? getPipelineLeads() : []).filter(l => !selSet.has(String(l.id)));
    if (typeof savePipelineLeads === "function") savePipelineLeads(kept);

    if (typeof logActivity === "function") {
        logActivity({
            type: "lead",
            title: `Permanently deleted ${selected.length} archived lead(s)`,
            meta: `${selected.length} record(s) removed`,
            href: "archive.html"
        });
    }

    window.selectedArchivedLeadIds.clear();
    if (typeof renderArchivedLeads === "function") renderArchivedLeads();
    if (typeof renderPipelineBoard === "function") renderPipelineBoard();
    if (typeof renderStaffDirectory === "function") renderStaffDirectory();
};

// 6. Archived Sessions
window.bulkRestoreArchivedSessions = function() {
    const selected = Array.from(window.selectedArchivedSessionIds);
    if (selected.length === 0) {
        alert("Please select at least one archived session to restore.");
        return;
    }
    const label = selected.length === 1 ? "1 session" : `${selected.length} sessions`;
    if (!confirm(`Restore ${label} back to the schedule?`)) return;

    const sessions = typeof getCoachSessions === "function" ? getCoachSessions() : [];
    const selSet = new Set(selected.map(String));
    let restoredCount = 0;
    sessions.forEach(s => {
        if (selSet.has(String(s.id))) {
            delete s.archived;
            delete s.archivedAt;
            restoredCount++;
        }
    });
    if (typeof saveCoachSessions === "function") saveCoachSessions(sessions);

    if (typeof logActivity === "function") {
        logActivity({
            type: "coach",
            title: `Restored ${restoredCount} session(s) from archive`,
            meta: `${restoredCount} session(s) returned to schedule`,
            href: "coach.html"
        });
    }

    window.selectedArchivedSessionIds.clear();
    if (typeof renderArchivedSessions === "function") renderArchivedSessions();
    if (typeof renderSessions === "function") renderSessions();
    if (typeof renderCoachSummaryStats === "function") renderCoachSummaryStats();
    if (typeof renderUpcomingAppointments === "function") renderUpcomingAppointments();
};

window.bulkDeleteArchivedSessions = function() {
    if (sessionStorage.getItem("crmRole") !== "admin") {
        alert("Only staff can permanently delete sessions.");
        return;
    }
    const selected = Array.from(window.selectedArchivedSessionIds);
    if (selected.length === 0) {
        alert("Please select at least one archived session to delete.");
        return;
    }
    const label = selected.length === 1 ? "1 archived session" : `${selected.length} archived sessions`;
    if (!confirm(`Permanently delete ${label}? This cannot be undone.`)) return;

    const selSet = new Set(selected.map(String));
    const kept = (typeof getCoachSessions === "function" ? getCoachSessions() : []).filter(s => !selSet.has(String(s.id)));
    if (typeof saveCoachSessions === "function") saveCoachSessions(kept);

    if (typeof logActivity === "function") {
        logActivity({
            type: "coach",
            title: `Permanently deleted ${selected.length} archived session(s)`,
            meta: `${selected.length} record(s) removed`,
            href: "archive.html"
        });
    }

    window.selectedArchivedSessionIds.clear();
    if (typeof renderArchivedSessions === "function") renderArchivedSessions();
    if (typeof renderSessions === "function") renderSessions();
    if (typeof renderCoachSummaryStats === "function") renderCoachSummaryStats();
    if (typeof renderUpcomingAppointments === "function") renderUpcomingAppointments();
};

// ---------------------------------------------------------------------------
// Section Configurations
// ---------------------------------------------------------------------------

const ARCHIVE_SECTIONS = [
    {
        key: "Members",
        singular: "member",
        plural: "members",
        barId: "archivedMembersBulkActionBar",
        selectAllId: "selectAllArchivedMembers",
        selectedCountId: "archivedMembersBulkSelectedCount",
        selectedLabelId: "archivedMembersBulkSelectedLabel",
        matchingCountId: "archivedMembersBulkTotalMatchingCount",
        selectAllMatchingBtnId: "archivedMembersBulkSelectAllMatchingBtn",
        deselectBtnId: "archivedMembersBulkDeselectBtn",
        closeBtnId: "archivedMembersBulkBarCloseBtn",
        restoreBtnId: "bulkArchivedMembersRestoreBtn",
        deleteBtnId: "bulkArchivedMembersDeleteBtn",
        tbodyId: "archivedTableBody",
        checkboxClass: "archived-member-select-checkbox",
        searchInputId: "archiveMemberSearch",
        setKey: "selectedArchivedMemberIds",
        onRestore: () => window.bulkRestoreArchivedMembers(),
        onDelete: () => window.bulkDeleteArchivedMembers()
    },
    {
        key: "Coaches",
        singular: "coach",
        plural: "coaches",
        barId: "archivedCoachesBulkActionBar",
        selectAllId: "selectAllArchivedCoaches",
        selectedCountId: "archivedCoachesBulkSelectedCount",
        selectedLabelId: "archivedCoachesBulkSelectedLabel",
        matchingCountId: "archivedCoachesBulkTotalMatchingCount",
        selectAllMatchingBtnId: "archivedCoachesBulkSelectAllMatchingBtn",
        deselectBtnId: "archivedCoachesBulkDeselectBtn",
        closeBtnId: "archivedCoachesBulkBarCloseBtn",
        restoreBtnId: "bulkArchivedCoachesRestoreBtn",
        deleteBtnId: "bulkArchivedCoachesDeleteBtn",
        tbodyId: "archivedCoachesBody",
        checkboxClass: "archived-coach-select-checkbox",
        searchInputId: "archiveCoachSearch",
        setKey: "selectedArchivedCoachIds",
        onRestore: () => window.bulkRestoreArchivedCoaches(),
        onDelete: () => window.bulkDeleteArchivedCoaches()
    },
    {
        key: "StaffTickets",
        singular: "ticket",
        plural: "tickets",
        barId: "archivedStaffTicketsBulkActionBar",
        selectAllId: "selectAllArchivedStaffTickets",
        selectedCountId: "archivedStaffTicketsBulkSelectedCount",
        selectedLabelId: "archivedStaffTicketsBulkSelectedLabel",
        matchingCountId: "archivedStaffTicketsBulkTotalMatchingCount",
        selectAllMatchingBtnId: "archivedStaffTicketsBulkSelectAllMatchingBtn",
        deselectBtnId: "archivedStaffTicketsBulkDeselectBtn",
        closeBtnId: "archivedStaffTicketsBulkBarCloseBtn",
        restoreBtnId: "bulkArchivedStaffTicketsRestoreBtn",
        deleteBtnId: "bulkArchivedStaffTicketsDeleteBtn",
        tbodyId: "archivedStaffTicketsBody",
        checkboxClass: "archived-staff-ticket-select-checkbox",
        searchInputId: "archiveStaffTicketSearch",
        setKey: "selectedArchivedStaffTicketIds",
        onRestore: () => window.bulkRestoreArchivedStaffTickets(),
        onDelete: () => window.bulkDeleteArchivedStaffTickets()
    },
    {
        key: "CustomerInquiries",
        singular: "inquiry",
        plural: "inquiries",
        barId: "archivedCustomerInquiriesBulkActionBar",
        selectAllId: "selectAllArchivedCustomerInquiries",
        selectedCountId: "archivedCustomerInquiriesBulkSelectedCount",
        selectedLabelId: "archivedCustomerInquiriesBulkSelectedLabel",
        matchingCountId: "archivedCustomerInquiriesBulkTotalMatchingCount",
        selectAllMatchingBtnId: "archivedCustomerInquiriesBulkSelectAllMatchingBtn",
        deselectBtnId: "archivedCustomerInquiriesBulkDeselectBtn",
        closeBtnId: "archivedCustomerInquiriesBulkBarCloseBtn",
        restoreBtnId: "bulkArchivedCustomerInquiriesRestoreBtn",
        deleteBtnId: "bulkArchivedCustomerInquiriesDeleteBtn",
        tbodyId: "archivedCustomerInquiriesBody",
        checkboxClass: "archived-customer-inquiry-select-checkbox",
        searchInputId: "archiveCustomerInquirySearch",
        setKey: "selectedArchivedCustomerInquiryIds",
        onRestore: () => window.bulkRestoreArchivedCustomerInquiries(),
        onDelete: () => window.bulkDeleteArchivedCustomerInquiries()
    },
    {
        key: "Leads",
        singular: "lead",
        plural: "leads",
        barId: "archivedLeadsBulkActionBar",
        selectAllId: "selectAllArchivedLeads",
        selectedCountId: "archivedLeadsBulkSelectedCount",
        selectedLabelId: "archivedLeadsBulkSelectedLabel",
        matchingCountId: "archivedLeadsBulkTotalMatchingCount",
        selectAllMatchingBtnId: "archivedLeadsBulkSelectAllMatchingBtn",
        deselectBtnId: "archivedLeadsBulkDeselectBtn",
        closeBtnId: "archivedLeadsBulkBarCloseBtn",
        restoreBtnId: "bulkArchivedLeadsRestoreBtn",
        deleteBtnId: "bulkArchivedLeadsDeleteBtn",
        tbodyId: "archivedLeadsBody",
        checkboxClass: "archived-lead-select-checkbox",
        searchInputId: "archiveLeadSearch",
        setKey: "selectedArchivedLeadIds",
        onRestore: () => window.bulkRestoreArchivedLeads(),
        onDelete: () => window.bulkDeleteArchivedLeads()
    },
    {
        key: "Sessions",
        singular: "session",
        plural: "sessions",
        barId: "archivedSessionsBulkActionBar",
        selectAllId: "selectAllArchivedSessions",
        selectedCountId: "archivedSessionsBulkSelectedCount",
        selectedLabelId: "archivedSessionsBulkSelectedLabel",
        matchingCountId: "archivedSessionsBulkTotalMatchingCount",
        selectAllMatchingBtnId: "archivedSessionsBulkSelectAllMatchingBtn",
        deselectBtnId: "archivedSessionsBulkDeselectBtn",
        closeBtnId: "archivedSessionsBulkBarCloseBtn",
        restoreBtnId: "bulkArchivedSessionsRestoreBtn",
        deleteBtnId: "bulkArchivedSessionsDeleteBtn",
        tbodyId: "archivedSessionsBody",
        checkboxClass: "archived-session-select-checkbox",
        searchInputId: "archiveSessionSearch",
        setKey: "selectedArchivedSessionIds",
        onRestore: () => window.bulkRestoreArchivedSessions(),
        onDelete: () => window.bulkDeleteArchivedSessions()
    }
];

// Helper to get visible row IDs for an entity
function getVisibleRowIds(config) {
    const tbody = document.getElementById(config.tbodyId);
    if (!tbody) return [];
    return Array.from(tbody.rows)
        .filter(r => !r.querySelector("td[colspan]") && r.style.display !== "none")
        .map(r => {
            const cb = r.querySelector("." + config.checkboxClass);
            return cb ? String(cb.dataset.id) : (r.dataset.id ? String(r.dataset.id) : null);
        })
        .filter(Boolean);
}

// Helper to sync checkboxes and row highlight classes
function syncRows(config) {
    const tbody = document.getElementById(config.tbodyId);
    if (!tbody) return;
    const set = window[config.setKey];
    Array.from(tbody.rows).forEach(tr => {
        if (tr.querySelector("td[colspan]")) return;
        const cb = tr.querySelector("." + config.checkboxClass);
        const id = cb ? String(cb.dataset.id) : (tr.dataset.id ? String(tr.dataset.id) : null);
        if (!id) return;
        const isChecked = set.has(id);
        if (cb) cb.checked = isChecked;
        tr.classList.toggle("is-selected", isChecked);
    });
}

// Update toolbar and master checkbox state for an entity
function updateSectionBar(config) {
    const bar = document.getElementById(config.barId);
    if (!bar) return;

    const selectAllCheckbox = document.getElementById(config.selectAllId);
    const selectedBadge = document.getElementById(config.selectedCountId);
    const selectedLabel = document.getElementById(config.selectedLabelId);
    const matchingBadge = document.getElementById(config.matchingCountId);

    const set = window[config.setKey];
    const visibleIds = getVisibleRowIds(config);
    const selectedCount = set ? set.size : 0;
    const matchingCount = visibleIds.length;

    if (selectedBadge) selectedBadge.textContent = String(selectedCount);
    if (selectedLabel) selectedLabel.textContent = selectedCount === 1 ? `${config.singular} selected` : `${config.plural} selected`;
    if (matchingBadge) matchingBadge.textContent = String(matchingCount);

    if (selectedCount === 0) {
        bar.hidden = true;
        bar.style.display = "none";
        bar.classList.remove("visible");
        if (selectAllCheckbox) {
            selectAllCheckbox.checked = false;
            selectAllCheckbox.indeterminate = false;
        }
    } else {
        bar.hidden = false;
        bar.style.display = "flex";
        bar.classList.add("visible");

        if (selectAllCheckbox) {
            if (matchingCount === 0) {
                selectAllCheckbox.checked = false;
                selectAllCheckbox.indeterminate = false;
            } else {
                const visibleSelectedCount = visibleIds.filter(id => set.has(id)).length;
                if (visibleSelectedCount === matchingCount) {
                    selectAllCheckbox.checked = true;
                    selectAllCheckbox.indeterminate = false;
                } else if (visibleSelectedCount > 0) {
                    selectAllCheckbox.checked = false;
                    selectAllCheckbox.indeterminate = true;
                } else {
                    selectAllCheckbox.checked = false;
                    selectAllCheckbox.indeterminate = false;
                }
            }
        }
    }
}

// Initialize listeners for an entity
function initSectionBulkActions(config) {
    const bar = document.getElementById(config.barId);
    const tbody = document.getElementById(config.tbodyId);
    const selectAllCheckbox = document.getElementById(config.selectAllId);

    if (!bar) return;

    // Ensure hidden state on initial setup if 0 selected
    if (!window[config.setKey] || window[config.setKey].size === 0) {
        bar.hidden = true;
        bar.style.display = "none";
        bar.classList.remove("visible");
    }

    if (bar.dataset.bulkBound !== "1") {
        bar.dataset.bulkBound = "1";

        const selectAllMatchingBtn = document.getElementById(config.selectAllMatchingBtnId);
        if (selectAllMatchingBtn) {
            selectAllMatchingBtn.addEventListener("click", () => {
                const visibleIds = getVisibleRowIds(config);
                visibleIds.forEach(id => window[config.setKey].add(id));
                syncRows(config);
                updateSectionBar(config);
            });
        }

        const deselectBtn = document.getElementById(config.deselectBtnId);
        if (deselectBtn) {
            deselectBtn.addEventListener("click", () => {
                window[config.setKey].clear();
                syncRows(config);
                updateSectionBar(config);
            });
        }

        const closeBtn = document.getElementById(config.closeBtnId);
        if (closeBtn) {
            closeBtn.addEventListener("click", () => {
                window[config.setKey].clear();
                syncRows(config);
                updateSectionBar(config);
            });
        }

        const restoreBtn = document.getElementById(config.restoreBtnId);
        if (restoreBtn) {
            restoreBtn.addEventListener("click", () => config.onRestore());
        }

        const deleteBtn = document.getElementById(config.deleteBtnId);
        if (deleteBtn) {
            deleteBtn.addEventListener("click", () => config.onDelete());
        }
    }

    if (selectAllCheckbox && selectAllCheckbox.dataset.bulkBound !== "1") {
        selectAllCheckbox.dataset.bulkBound = "1";
        selectAllCheckbox.addEventListener("change", () => {
            const visibleIds = getVisibleRowIds(config);
            if (selectAllCheckbox.checked) {
                visibleIds.forEach(id => window[config.setKey].add(id));
            } else {
                visibleIds.forEach(id => window[config.setKey].delete(id));
            }
            syncRows(config);
            updateSectionBar(config);
        });
    }

    if (tbody && tbody.dataset.bulkBound !== "1") {
        tbody.dataset.bulkBound = "1";

        // Row click delegation
        tbody.addEventListener("click", e => {
            const tr = e.target.closest("tr");
            if (!tr || tr.querySelector("td[colspan]")) return;
            if (e.target.closest("button, a, input[type='text'], select, textarea")) return;

            const cb = tr.querySelector("." + config.checkboxClass);
            if (!cb) return;
            const id = String(cb.dataset.id || tr.dataset.id || "");
            if (!id) return;

            if (e.target === cb) {
                if (cb.checked) {
                    window[config.setKey].add(id);
                } else {
                    window[config.setKey].delete(id);
                }
            } else {
                if (window[config.setKey].has(id)) {
                    window[config.setKey].delete(id);
                } else {
                    window[config.setKey].add(id);
                }
            }
            syncRows(config);
            updateSectionBar(config);
        });

        tbody.addEventListener("change", e => {
            if (e.target && e.target.classList.contains(config.checkboxClass)) {
                const cb = e.target;
                const tr = cb.closest("tr");
                const id = String(cb.dataset.id || (tr && tr.dataset.id) || "");
                if (!id) return;
                if (cb.checked) {
                    window[config.setKey].add(id);
                } else {
                    window[config.setKey].delete(id);
                }
                syncRows(config);
                updateSectionBar(config);
            }
        });
    }

    const searchInput = document.getElementById(config.searchInputId);
    if (searchInput && searchInput.dataset.bulkBound !== "1") {
        searchInput.dataset.bulkBound = "1";
        searchInput.addEventListener("input", () => {
            setTimeout(() => {
                updateSectionBar(config);
            }, 0);
        });
    }

    updateSectionBar(config);
}

// Expose individual bar updaters globally
window.updateArchivedMembersBulkActionBar = () => updateSectionBar(ARCHIVE_SECTIONS[0]);
window.updateArchivedCoachesBulkActionBar = () => updateSectionBar(ARCHIVE_SECTIONS[1]);
window.updateArchivedStaffTicketsBulkActionBar = () => updateSectionBar(ARCHIVE_SECTIONS[2]);
window.updateArchivedCustomerInquiriesBulkActionBar = () => updateSectionBar(ARCHIVE_SECTIONS[3]);
window.updateArchivedLeadsBulkActionBar = () => updateSectionBar(ARCHIVE_SECTIONS[4]);
window.updateArchivedSessionsBulkActionBar = () => updateSectionBar(ARCHIVE_SECTIONS[5]);

// Expose individual initializers globally
window.initArchivedMembersBulkActions = () => initSectionBulkActions(ARCHIVE_SECTIONS[0]);
window.initArchivedCoachesBulkActions = () => initSectionBulkActions(ARCHIVE_SECTIONS[1]);
window.initArchivedStaffTicketsBulkActions = () => initSectionBulkActions(ARCHIVE_SECTIONS[2]);
window.initArchivedCustomerInquiriesBulkActions = () => initSectionBulkActions(ARCHIVE_SECTIONS[3]);
window.initArchivedLeadsBulkActions = () => initSectionBulkActions(ARCHIVE_SECTIONS[4]);
window.initArchivedSessionsBulkActions = () => initSectionBulkActions(ARCHIVE_SECTIONS[5]);

// Initialize all archive sections
window.initAllArchiveBulkActions = function() {
    ARCHIVE_SECTIONS.forEach(config => initSectionBulkActions(config));
};

// Auto-run on DOMContentLoaded or immediately if already loaded
if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => window.initAllArchiveBulkActions());
} else {
    window.initAllArchiveBulkActions();
}
