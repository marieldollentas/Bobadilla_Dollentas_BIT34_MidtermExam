// js-split:file=tickets.js part=1of10
// Split from script.js - whole top-level blocks moved verbatim, no behavior change.
let pendingTicket = null;


// js-split:file=tickets.js part=2of10
// Split from script.js - whole top-level blocks moved verbatim, no behavior change.
let pendingArchive = null;



// Interactive stat cards filter for Support Tickets (Open, In Progress, Resolved)
function updateTicketStatCardActiveState() {
    const statusEl = document.getElementById("filterStatus");
    const currentStatus = (statusEl ? statusEl.value : "all").toLowerCase();
    document.querySelectorAll(".stats-grid .stat-card[data-status-filter]").forEach(card => {
        const filterVal = (card.dataset.statusFilter || "").toLowerCase();
        const isActive = (filterVal === currentStatus && currentStatus !== "all");
        card.classList.toggle("is-active", isActive);
    });
}
window.updateTicketStatCardActiveState = updateTicketStatCardActiveState;

function initTicketStatFilters() {
    const statusEl = document.getElementById("filterStatus");
    if (!statusEl) return;

    // Interactive stat cards filter (Open, In Progress, Resolved)
    document.querySelectorAll(".stats-grid .stat-card[data-status-filter]").forEach(card => {
        if (card.dataset.statBound === "1") return;
        card.dataset.statBound = "1";

        card.addEventListener("click", () => {
            const targetStatus = card.dataset.statusFilter || "all";
            const currentStatus = statusEl.value;

            // Toggle off to "all" if clicking the already active status card
            if (currentStatus.toLowerCase() === targetStatus.toLowerCase()) {
                statusEl.value = "all";
            } else {
                statusEl.value = targetStatus;
                // If filtering by Resolved, ensure "Hide Resolved" is unchecked so they are visible
                if (targetStatus.toLowerCase() === "resolved") {
                    const hideResolvedEl = document.getElementById("hideResolved");
                    if (hideResolvedEl && hideResolvedEl.checked) {
                        hideResolvedEl.checked = false;
                    }
                }
            }

            updateTicketStatCardActiveState();
            statusEl.dispatchEvent(new Event("change", { bubbles: true }));
        });

        card.addEventListener("keydown", (e) => {
            if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                card.click();
            }
        });
    });

    if (statusEl.dataset.statusBound !== "1") {
        statusEl.dataset.statusBound = "1";
        statusEl.addEventListener("change", () => {
            updateTicketStatCardActiveState();
        });
    }

    // Reset filters button
    const resetBtn = document.getElementById("resetTicketFilters");
    if (resetBtn && resetBtn.dataset.filterBound !== "1") {
        resetBtn.dataset.filterBound = "1";
        resetBtn.addEventListener("click", () => {
            const searchEl = document.getElementById("ticketSearch");
            const priorityEl = document.getElementById("filterPriority");
            const sourceEl = document.getElementById("filterSource");
            const hideResolvedEl = document.getElementById("hideResolved");

            if (searchEl) searchEl.value = "";
            if (priorityEl) priorityEl.value = "all";
            if (sourceEl) sourceEl.value = "all";
            if (hideResolvedEl) hideResolvedEl.checked = false;
            statusEl.value = "all";

            updateTicketStatCardActiveState();
            statusEl.dispatchEvent(new Event("change", { bubbles: true }));
        });
    }

    updateTicketStatCardActiveState();
}
window.initTicketStatFilters = initTicketStatFilters;

// Bulk Actions for Support & Inquiries
window.selectedStaffTicketIds = window.selectedStaffTicketIds || new Set();
window.selectedCustomerInquiryIds = window.selectedCustomerInquiryIds || new Set();

function getFilteredStaffTicketList() {
    const filters = typeof tableFilters === "function" ? tableFilters() : { search: "", priority: "all", status: "all", source: "all", hideResolved: false };
    return getTicketStorage("staff")
        .filter(t => !t.archived)
        .filter(t => typeof matchesFilters === "function" ? matchesFilters(t, filters, "Staff", t.contact) : true)
        .sort((a, b) => String(b.id) - String(a.id));
}
window.getFilteredStaffTicketList = getFilteredStaffTicketList;

function getSelectedStaffTicketList() {
    const all = getTicketStorage("staff");
    const selectedIds = window.selectedStaffTicketIds || new Set();
    return all.filter(t => selectedIds.has(String(t.id)));
}
window.getSelectedStaffTicketList = getSelectedStaffTicketList;

function updateStaffTicketBulkActionBar(visibleTickets) {
    const bar = document.getElementById("staffTicketBulkActionBar");
    const countEl = document.getElementById("staffTicketBulkSelectedCount");
    const labelEl = document.getElementById("staffTicketBulkSelectedLabel");
    const totalMatchingEl = document.getElementById("staffTicketBulkTotalMatchingCount");
    const selectAllCheckbox = document.getElementById("selectAllStaffTickets");

    if (!bar) return;

    const visible = Array.isArray(visibleTickets) ? visibleTickets : getFilteredStaffTicketList();
    const selectedCount = window.selectedStaffTicketIds ? window.selectedStaffTicketIds.size : 0;
    const visibleCount = visible.length;

    if (totalMatchingEl) totalMatchingEl.textContent = String(visibleCount);

    if (selectedCount > 0) {
        bar.hidden = false;
        bar.style.display = "flex";
        bar.classList.add("visible");
        if (countEl) countEl.textContent = String(selectedCount);
        if (labelEl) labelEl.textContent = selectedCount === 1 ? "ticket selected" : "tickets selected";
    } else {
        bar.hidden = true;
        bar.style.display = "none";
        bar.classList.remove("visible");
    }

    if (selectAllCheckbox) {
        let matchingSelectedCount = 0;
        visible.forEach(t => {
            if (window.selectedStaffTicketIds && window.selectedStaffTicketIds.has(String(t.id))) {
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
window.updateStaffTicketBulkActionBar = updateStaffTicketBulkActionBar;

function initStaffTicketBulkActions() {
    const bar = document.getElementById("staffTicketBulkActionBar");
    const tbody = document.getElementById("staffTicketsBody");
    const selectAllCheckbox = document.getElementById("selectAllStaffTickets");

    if (!bar || bar.dataset.bulkBound === "1") return;
    bar.dataset.bulkBound = "1";

    if (!window.selectedStaffTicketIds || window.selectedStaffTicketIds.size === 0) {
        bar.hidden = true;
        bar.style.display = "none";
        bar.classList.remove("visible");
    }

    if (selectAllCheckbox && selectAllCheckbox.dataset.bound !== "1") {
        selectAllCheckbox.dataset.bound = "1";
        selectAllCheckbox.addEventListener("change", () => {
            const visible = getFilteredStaffTicketList();
            if (selectAllCheckbox.checked) {
                visible.forEach(t => window.selectedStaffTicketIds.add(String(t.id)));
            } else {
                visible.forEach(t => window.selectedStaffTicketIds.delete(String(t.id)));
            }
            if (tbody) {
                tbody.querySelectorAll(".staff-ticket-select-checkbox").forEach(cb => {
                    const id = decodeURIComponent(cb.dataset.ticketId || "");
                    const checked = window.selectedStaffTicketIds.has(id);
                    cb.checked = checked;
                    const row = cb.closest("tr");
                    if (row) row.classList.toggle("is-selected", checked);
                });
            }
            updateStaffTicketBulkActionBar(visible);
        });
    }

    if (tbody && tbody.dataset.bulkDelegated !== "1") {
        tbody.dataset.bulkDelegated = "1";

        tbody.addEventListener("change", e => {
            if (e.target.classList.contains("staff-ticket-select-checkbox")) {
                const id = decodeURIComponent(e.target.dataset.ticketId || "");
                if (e.target.checked) {
                    window.selectedStaffTicketIds.add(id);
                } else {
                    window.selectedStaffTicketIds.delete(id);
                }
                const row = e.target.closest("tr");
                if (row) row.classList.toggle("is-selected", e.target.checked);
                updateStaffTicketBulkActionBar();
            }
        });

        tbody.addEventListener("click", e => {
            if (e.target.closest("button, a, select, textarea, label")) return;
            if (e.target.tagName === "INPUT") return;

            const row = e.target.closest("tr");
            if (!row) return;

            const cb = row.querySelector(".staff-ticket-select-checkbox");
            if (cb) {
                cb.checked = !cb.checked;
                const id = decodeURIComponent(cb.dataset.ticketId || "");
                if (cb.checked) {
                    window.selectedStaffTicketIds.add(id);
                } else {
                    window.selectedStaffTicketIds.delete(id);
                }
                row.classList.toggle("is-selected", cb.checked);
                updateStaffTicketBulkActionBar();
            }
        });
    }

    const selectAllMatchingBtn = document.getElementById("staffTicketBulkSelectAllMatchingBtn");
    if (selectAllMatchingBtn) {
        selectAllMatchingBtn.addEventListener("click", () => {
            const visible = getFilteredStaffTicketList();
            visible.forEach(t => window.selectedStaffTicketIds.add(String(t.id)));
            if (tbody) {
                tbody.querySelectorAll(".staff-ticket-select-checkbox").forEach(cb => {
                    cb.checked = true;
                    const row = cb.closest("tr");
                    if (row) row.classList.add("is-selected");
                });
            }
            updateStaffTicketBulkActionBar(visible);
        });
    }

    const deselectBtn = document.getElementById("staffTicketBulkDeselectBtn");
    if (deselectBtn) {
        deselectBtn.addEventListener("click", () => {
            window.selectedStaffTicketIds.clear();
            if (tbody) {
                tbody.querySelectorAll(".staff-ticket-select-checkbox").forEach(cb => {
                    cb.checked = false;
                    const row = cb.closest("tr");
                    if (row) row.classList.remove("is-selected");
                });
            }
            updateStaffTicketBulkActionBar();
        });
    }

    const closeBarBtn = document.getElementById("staffTicketBulkBarCloseBtn");
    if (closeBarBtn) {
        closeBarBtn.addEventListener("click", () => {
            window.selectedStaffTicketIds.clear();
            if (tbody) {
                tbody.querySelectorAll(".staff-ticket-select-checkbox").forEach(cb => {
                    cb.checked = false;
                    const row = cb.closest("tr");
                    if (row) row.classList.remove("is-selected");
                });
            }
            updateStaffTicketBulkActionBar();
        });
    }

    const statusBtn = document.getElementById("bulkStaffTicketStatusBtn");
    if (statusBtn) statusBtn.addEventListener("click", () => window.openBulkStaffTicketStatusModal());

    const priorityBtn = document.getElementById("bulkStaffTicketPriorityBtn");
    if (priorityBtn) priorityBtn.addEventListener("click", () => window.openBulkStaffTicketPriorityModal());

    const archiveBtn = document.getElementById("bulkStaffTicketArchiveBtn");
    if (archiveBtn) archiveBtn.addEventListener("click", () => window.bulkArchiveStaffTickets());

    const statusModal = document.getElementById("bulkStaffTicketStatusModal");
    const closeStatusBtn = document.getElementById("closeBulkStaffTicketStatusModal");
    const cancelStatusBtn = document.getElementById("cancelBulkStaffTicketStatusModal");
    const hideStatus = () => { if (statusModal) statusModal.style.display = "none"; };
    if (closeStatusBtn) closeStatusBtn.addEventListener("click", hideStatus);
    if (cancelStatusBtn) cancelStatusBtn.addEventListener("click", hideStatus);
    if (statusModal) {
        statusModal.addEventListener("click", e => {
            if (e.target === statusModal) hideStatus();
        });
    }

    const priorityModal = document.getElementById("bulkStaffTicketPriorityModal");
    const closePriorityBtn = document.getElementById("closeBulkStaffTicketPriorityModal");
    const cancelPriorityBtn = document.getElementById("cancelBulkStaffTicketPriorityModal");
    const hidePriority = () => { if (priorityModal) priorityModal.style.display = "none"; };
    if (closePriorityBtn) closePriorityBtn.addEventListener("click", hidePriority);
    if (cancelPriorityBtn) cancelPriorityBtn.addEventListener("click", hidePriority);
    if (priorityModal) {
        priorityModal.addEventListener("click", e => {
            if (e.target === priorityModal) hidePriority();
        });
    }
}
window.initStaffTicketBulkActions = initStaffTicketBulkActions;

window.openBulkStaffTicketStatusModal = function() {
    const selected = getSelectedStaffTicketList();
    if (selected.length === 0) {
        alert("Please select at least one staff ticket to change status.");
        return;
    }
    const summaryEl = document.getElementById("bulkStaffTicketStatusSummary");
    if (summaryEl) {
        const preview = selected.map(t => escapeHtml(t.name || "Customer")).slice(0, 4).join(", ");
        const moreCount = selected.length > 4 ? ` +${selected.length - 4} more` : "";
        summaryEl.innerHTML = `
            <div style="font-size: 13px; line-height: 1.5;">
                <div>Selected staff tickets: <strong>${selected.length}</strong></div>
                <div style="color: var(--text-muted); font-size: 12px; margin-top: 4px;">${preview}${moreCount}</div>
            </div>
        `;
    }
    const errEl = document.getElementById("bulkStaffTicketStatusError");
    if (errEl) errEl.textContent = "";
    const modal = document.getElementById("bulkStaffTicketStatusModal");
    if (modal) modal.style.display = "flex";
};

window.confirmBulkStaffTicketStatus = function() {
    const selected = getSelectedStaffTicketList();
    if (selected.length === 0) {
        alert("No staff tickets selected.");
        return;
    }

    const selectEl = document.getElementById("bulkStaffTicketStatusSelect");
    const newStatus = selectEl ? selectEl.value : "";
    const errEl = document.getElementById("bulkStaffTicketStatusError");

    if (!newStatus) {
        if (errEl) errEl.textContent = "Please select a ticket status.";
        return;
    }

    const all = getTicketStorage("staff");
    const selectedIds = new Set(selected.map(t => String(t.id)));
    let count = 0;

    all.forEach(t => {
        if (selectedIds.has(String(t.id))) {
            t.status = newStatus;
            if (newStatus.toLowerCase() === "resolved") {
                t.resolvedAt = new Date().toISOString();
            } else {
                delete t.resolvedAt;
            }
            t.updatedAt = new Date().toISOString();
            count++;
        }
    });

    saveTicketStorage("staff", all);

    if (typeof logActivity === "function") {
        logActivity({
            type: "ticket",
            title: `Updated status to "${newStatus}" for ${count} staff ticket(s)`,
            meta: selected.map(t => t.name).slice(0, 3).join(", ") + (selected.length > 3 ? "..." : ""),
            href: "tickets.html"
        });
    }

    const modal = document.getElementById("bulkStaffTicketStatusModal");
    if (modal) modal.style.display = "none";

    window.selectedStaffTicketIds.clear();
    renderStaffTickets();
    if (typeof getOpenTicketsCount === "function") getOpenTicketsCount();
};

window.openBulkStaffTicketPriorityModal = function() {
    const selected = getSelectedStaffTicketList();
    if (selected.length === 0) {
        alert("Please select at least one staff ticket to change priority.");
        return;
    }
    const summaryEl = document.getElementById("bulkStaffTicketPrioritySummary");
    if (summaryEl) {
        const preview = selected.map(t => escapeHtml(t.name || "Customer")).slice(0, 4).join(", ");
        const moreCount = selected.length > 4 ? ` +${selected.length - 4} more` : "";
        summaryEl.innerHTML = `
            <div style="font-size: 13px; line-height: 1.5;">
                <div>Selected staff tickets: <strong>${selected.length}</strong></div>
                <div style="color: var(--text-muted); font-size: 12px; margin-top: 4px;">${preview}${moreCount}</div>
            </div>
        `;
    }
    const errEl = document.getElementById("bulkStaffTicketPriorityError");
    if (errEl) errEl.textContent = "";
    const modal = document.getElementById("bulkStaffTicketPriorityModal");
    if (modal) modal.style.display = "flex";
};

window.confirmBulkStaffTicketPriority = function() {
    const selected = getSelectedStaffTicketList();
    if (selected.length === 0) {
        alert("No staff tickets selected.");
        return;
    }

    const selectEl = document.getElementById("bulkStaffTicketPrioritySelect");
    const newPriority = selectEl ? selectEl.value : "";
    const errEl = document.getElementById("bulkStaffTicketPriorityError");

    if (!newPriority) {
        if (errEl) errEl.textContent = "Please select a ticket priority.";
        return;
    }

    const all = getTicketStorage("staff");
    const selectedIds = new Set(selected.map(t => String(t.id)));
    let count = 0;

    all.forEach(t => {
        if (selectedIds.has(String(t.id))) {
            t.priority = newPriority;
            t.updatedAt = new Date().toISOString();
            count++;
        }
    });

    saveTicketStorage("staff", all);

    if (typeof logActivity === "function") {
        logActivity({
            type: "ticket",
            title: `Updated priority to "${newPriority}" for ${count} staff ticket(s)`,
            meta: selected.map(t => t.name).slice(0, 3).join(", ") + (selected.length > 3 ? "..." : ""),
            href: "tickets.html"
        });
    }

    const modal = document.getElementById("bulkStaffTicketPriorityModal");
    if (modal) modal.style.display = "none";

    window.selectedStaffTicketIds.clear();
    renderStaffTickets();
};

window.bulkArchiveStaffTickets = function() {
    const selected = getSelectedStaffTicketList();
    if (selected.length === 0) {
        alert("Please select at least one staff ticket to archive.");
        return;
    }

    const unresolvedCount = selected.filter(t => String(t.status || "").toLowerCase() !== "resolved").length;
    const eligible = selected.filter(t => String(t.status || "").toLowerCase() === "resolved");

    if (eligible.length === 0) {
        alert("Only resolved tickets can be archived. Active tickets cannot be archived until their status is Resolved.");
        return;
    }

    let confirmMsg = "";
    if (unresolvedCount > 0) {
        confirmMsg = `${unresolvedCount} selected ticket(s) are not resolved yet and cannot be archived.\n\nArchive the remaining ${eligible.length} resolved ticket(s)? They will leave the active queue but stay on file in the Archive page.`;
    } else {
        confirmMsg = `Archive ${eligible.length} resolved ticket(s)? They will leave the active queue but stay on file in the Archive page.`;
    }

    if (!confirm(confirmMsg)) return;

    const all = getTicketStorage("staff");
    const eligibleIds = new Set(eligible.map(t => String(t.id)));
    let count = 0;

    all.forEach(t => {
        if (eligibleIds.has(String(t.id))) {
            t.archived = true;
            t.archivedAt = new Date().toISOString();
            count++;
        }
    });

    saveTicketStorage("staff", all);

    if (typeof logActivity === "function") {
        logActivity({
            type: "ticket",
            title: `Archived ${count} staff walk-in ticket(s)`,
            meta: eligible.map(t => t.name).slice(0, 3).join(", ") + (eligible.length > 3 ? "..." : ""),
            href: "tickets.html"
        });
    }

    window.selectedStaffTicketIds.clear();
    renderStaffTickets();
    if (typeof renderArchivedTickets === "function") renderArchivedTickets();
    if (typeof getOpenTicketsCount === "function") getOpenTicketsCount();
};

// Customer Portal Inquiries Bulk Actions
function getFilteredCustomerInquiryList() {
    const filters = typeof tableFilters === "function" ? tableFilters() : { search: "", priority: "all", status: "all", source: "all", hideResolved: false };
    return getTicketStorage("customer")
        .filter(i => !i.archived)
        .filter(i => typeof matchesFilters === "function" ? matchesFilters(i, filters, "Portal", [i.email, i.phone, i.address].filter(Boolean).join(" ")) : true)
        .sort((a, b) => String(b.id) - String(a.id));
}
window.getFilteredCustomerInquiryList = getFilteredCustomerInquiryList;

function getSelectedCustomerInquiryList() {
    const all = getTicketStorage("customer");
    const selectedIds = window.selectedCustomerInquiryIds || new Set();
    return all.filter(i => selectedIds.has(String(i.id)));
}
window.getSelectedCustomerInquiryList = getSelectedCustomerInquiryList;

function updateCustomerInquiryBulkActionBar(visibleInquiries) {
    const bar = document.getElementById("customerInquiryBulkActionBar");
    const countEl = document.getElementById("customerInquiryBulkSelectedCount");
    const labelEl = document.getElementById("customerInquiryBulkSelectedLabel");
    const totalMatchingEl = document.getElementById("customerInquiryBulkTotalMatchingCount");
    const selectAllCheckbox = document.getElementById("selectAllCustomerInquiries");

    if (!bar) return;

    const visible = Array.isArray(visibleInquiries) ? visibleInquiries : getFilteredCustomerInquiryList();
    const selectedCount = window.selectedCustomerInquiryIds ? window.selectedCustomerInquiryIds.size : 0;
    const visibleCount = visible.length;

    if (totalMatchingEl) totalMatchingEl.textContent = String(visibleCount);

    if (selectedCount > 0) {
        bar.hidden = false;
        bar.style.display = "flex";
        bar.classList.add("visible");
        if (countEl) countEl.textContent = String(selectedCount);
        if (labelEl) labelEl.textContent = selectedCount === 1 ? "inquiry selected" : "inquiries selected";
    } else {
        bar.hidden = true;
        bar.style.display = "none";
        bar.classList.remove("visible");
    }

    if (selectAllCheckbox) {
        let matchingSelectedCount = 0;
        visible.forEach(i => {
            if (window.selectedCustomerInquiryIds && window.selectedCustomerInquiryIds.has(String(i.id))) {
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
window.updateCustomerInquiryBulkActionBar = updateCustomerInquiryBulkActionBar;

function initCustomerInquiryBulkActions() {
    const bar = document.getElementById("customerInquiryBulkActionBar");
    const tbody = document.getElementById("customerInquiriesBody");
    const selectAllCheckbox = document.getElementById("selectAllCustomerInquiries");

    if (!bar || bar.dataset.bulkBound === "1") return;
    bar.dataset.bulkBound = "1";

    if (!window.selectedCustomerInquiryIds || window.selectedCustomerInquiryIds.size === 0) {
        bar.hidden = true;
        bar.style.display = "none";
        bar.classList.remove("visible");
    }

    if (selectAllCheckbox && selectAllCheckbox.dataset.bound !== "1") {
        selectAllCheckbox.dataset.bound = "1";
        selectAllCheckbox.addEventListener("change", () => {
            const visible = getFilteredCustomerInquiryList();
            if (selectAllCheckbox.checked) {
                visible.forEach(i => window.selectedCustomerInquiryIds.add(String(i.id)));
            } else {
                visible.forEach(i => window.selectedCustomerInquiryIds.delete(String(i.id)));
            }
            if (tbody) {
                tbody.querySelectorAll(".customer-inquiry-select-checkbox").forEach(cb => {
                    const id = decodeURIComponent(cb.dataset.inquiryId || "");
                    const checked = window.selectedCustomerInquiryIds.has(id);
                    cb.checked = checked;
                    const row = cb.closest("tr");
                    if (row) row.classList.toggle("is-selected", checked);
                });
            }
            updateCustomerInquiryBulkActionBar(visible);
        });
    }

    if (tbody && tbody.dataset.bulkDelegated !== "1") {
        tbody.dataset.bulkDelegated = "1";

        tbody.addEventListener("change", e => {
            if (e.target.classList.contains("customer-inquiry-select-checkbox")) {
                const id = decodeURIComponent(e.target.dataset.inquiryId || "");
                if (e.target.checked) {
                    window.selectedCustomerInquiryIds.add(id);
                } else {
                    window.selectedCustomerInquiryIds.delete(id);
                }
                const row = e.target.closest("tr");
                if (row) row.classList.toggle("is-selected", e.target.checked);
                updateCustomerInquiryBulkActionBar();
            }
        });

        tbody.addEventListener("click", e => {
            if (e.target.closest("button, a, select, textarea, label")) return;
            if (e.target.tagName === "INPUT") return;

            const row = e.target.closest("tr");
            if (!row) return;

            const cb = row.querySelector(".customer-inquiry-select-checkbox");
            if (cb) {
                cb.checked = !cb.checked;
                const id = decodeURIComponent(cb.dataset.inquiryId || "");
                if (cb.checked) {
                    window.selectedCustomerInquiryIds.add(id);
                } else {
                    window.selectedCustomerInquiryIds.delete(id);
                }
                row.classList.toggle("is-selected", cb.checked);
                updateCustomerInquiryBulkActionBar();
            }
        });
    }

    const selectAllMatchingBtn = document.getElementById("customerInquiryBulkSelectAllMatchingBtn");
    if (selectAllMatchingBtn) {
        selectAllMatchingBtn.addEventListener("click", () => {
            const visible = getFilteredCustomerInquiryList();
            visible.forEach(i => window.selectedCustomerInquiryIds.add(String(i.id)));
            if (tbody) {
                tbody.querySelectorAll(".customer-inquiry-select-checkbox").forEach(cb => {
                    cb.checked = true;
                    const row = cb.closest("tr");
                    if (row) row.classList.add("is-selected");
                });
            }
            updateCustomerInquiryBulkActionBar(visible);
        });
    }

    const deselectBtn = document.getElementById("customerInquiryBulkDeselectBtn");
    if (deselectBtn) {
        deselectBtn.addEventListener("click", () => {
            window.selectedCustomerInquiryIds.clear();
            if (tbody) {
                tbody.querySelectorAll(".customer-inquiry-select-checkbox").forEach(cb => {
                    cb.checked = false;
                    const row = cb.closest("tr");
                    if (row) row.classList.remove("is-selected");
                });
            }
            updateCustomerInquiryBulkActionBar();
        });
    }

    const closeBarBtn = document.getElementById("customerInquiryBulkBarCloseBtn");
    if (closeBarBtn) {
        closeBarBtn.addEventListener("click", () => {
            window.selectedCustomerInquiryIds.clear();
            if (tbody) {
                tbody.querySelectorAll(".customer-inquiry-select-checkbox").forEach(cb => {
                    cb.checked = false;
                    const row = cb.closest("tr");
                    if (row) row.classList.remove("is-selected");
                });
            }
            updateCustomerInquiryBulkActionBar();
        });
    }

    const statusBtn = document.getElementById("bulkCustomerInquiryStatusBtn");
    if (statusBtn) statusBtn.addEventListener("click", () => window.openBulkCustomerInquiryStatusModal());

    const priorityBtn = document.getElementById("bulkCustomerInquiryPriorityBtn");
    if (priorityBtn) priorityBtn.addEventListener("click", () => window.openBulkCustomerInquiryPriorityModal());

    const archiveBtn = document.getElementById("bulkCustomerInquiryArchiveBtn");
    if (archiveBtn) archiveBtn.addEventListener("click", () => window.bulkArchiveCustomerInquiries());

    const statusModal = document.getElementById("bulkCustomerInquiryStatusModal");
    const closeStatusBtn = document.getElementById("closeBulkCustomerInquiryStatusModal");
    const cancelStatusBtn = document.getElementById("cancelBulkCustomerInquiryStatusModal");
    const hideStatus = () => { if (statusModal) statusModal.style.display = "none"; };
    if (closeStatusBtn) closeStatusBtn.addEventListener("click", hideStatus);
    if (cancelStatusBtn) cancelStatusBtn.addEventListener("click", hideStatus);
    if (statusModal) {
        statusModal.addEventListener("click", e => {
            if (e.target === statusModal) hideStatus();
        });
    }

    const priorityModal = document.getElementById("bulkCustomerInquiryPriorityModal");
    const closePriorityBtn = document.getElementById("closeBulkCustomerInquiryPriorityModal");
    const cancelPriorityBtn = document.getElementById("cancelBulkCustomerInquiryPriorityModal");
    const hidePriority = () => { if (priorityModal) priorityModal.style.display = "none"; };
    if (closePriorityBtn) closePriorityBtn.addEventListener("click", hidePriority);
    if (cancelPriorityBtn) cancelPriorityBtn.addEventListener("click", hidePriority);
    if (priorityModal) {
        priorityModal.addEventListener("click", e => {
            if (e.target === priorityModal) hidePriority();
        });
    }
}
window.initCustomerInquiryBulkActions = initCustomerInquiryBulkActions;

window.openBulkCustomerInquiryStatusModal = function() {
    const selected = getSelectedCustomerInquiryList();
    if (selected.length === 0) {
        alert("Please select at least one customer portal inquiry to change status.");
        return;
    }
    const summaryEl = document.getElementById("bulkCustomerInquiryStatusSummary");
    if (summaryEl) {
        const preview = selected.map(i => escapeHtml(i.name || "Customer")).slice(0, 4).join(", ");
        const moreCount = selected.length > 4 ? ` +${selected.length - 4} more` : "";
        summaryEl.innerHTML = `
            <div style="font-size: 13px; line-height: 1.5;">
                <div>Selected inquiries: <strong>${selected.length}</strong></div>
                <div style="color: var(--text-muted); font-size: 12px; margin-top: 4px;">${preview}${moreCount}</div>
            </div>
        `;
    }
    const errEl = document.getElementById("bulkCustomerInquiryStatusError");
    if (errEl) errEl.textContent = "";
    const modal = document.getElementById("bulkCustomerInquiryStatusModal");
    if (modal) modal.style.display = "flex";
};

window.confirmBulkCustomerInquiryStatus = function() {
    const selected = getSelectedCustomerInquiryList();
    if (selected.length === 0) {
        alert("No customer portal inquiries selected.");
        return;
    }

    const selectEl = document.getElementById("bulkCustomerInquiryStatusSelect");
    const newStatus = selectEl ? selectEl.value : "";
    const errEl = document.getElementById("bulkCustomerInquiryStatusError");

    if (!newStatus) {
        if (errEl) errEl.textContent = "Please select an inquiry status.";
        return;
    }

    const all = getTicketStorage("customer");
    const selectedIds = new Set(selected.map(i => String(i.id)));
    let count = 0;

    all.forEach(i => {
        if (selectedIds.has(String(i.id))) {
            i.status = newStatus;
            if (newStatus.toLowerCase() === "resolved") {
                i.resolvedAt = new Date().toISOString();
            } else {
                delete i.resolvedAt;
            }
            i.updatedAt = new Date().toISOString();
            count++;
        }
    });

    saveTicketStorage("customer", all);

    if (typeof logActivity === "function") {
        logActivity({
            type: "ticket",
            title: `Updated status to "${newStatus}" for ${count} customer inquiry/inquiries`,
            meta: selected.map(i => i.name).slice(0, 3).join(", ") + (selected.length > 3 ? "..." : ""),
            href: "tickets.html"
        });
    }

    const modal = document.getElementById("bulkCustomerInquiryStatusModal");
    if (modal) modal.style.display = "none";

    window.selectedCustomerInquiryIds.clear();
    renderCustomerInquiries();
    if (typeof getOpenTicketsCount === "function") getOpenTicketsCount();
};

window.openBulkCustomerInquiryPriorityModal = function() {
    const selected = getSelectedCustomerInquiryList();
    if (selected.length === 0) {
        alert("Please select at least one customer portal inquiry to change priority.");
        return;
    }
    const summaryEl = document.getElementById("bulkCustomerInquiryPrioritySummary");
    if (summaryEl) {
        const preview = selected.map(i => escapeHtml(i.name || "Customer")).slice(0, 4).join(", ");
        const moreCount = selected.length > 4 ? ` +${selected.length - 4} more` : "";
        summaryEl.innerHTML = `
            <div style="font-size: 13px; line-height: 1.5;">
                <div>Selected inquiries: <strong>${selected.length}</strong></div>
                <div style="color: var(--text-muted); font-size: 12px; margin-top: 4px;">${preview}${moreCount}</div>
            </div>
        `;
    }
    const errEl = document.getElementById("bulkCustomerInquiryPriorityError");
    if (errEl) errEl.textContent = "";
    const modal = document.getElementById("bulkCustomerInquiryPriorityModal");
    if (modal) modal.style.display = "flex";
};

window.confirmBulkCustomerInquiryPriority = function() {
    const selected = getSelectedCustomerInquiryList();
    if (selected.length === 0) {
        alert("No customer portal inquiries selected.");
        return;
    }

    const selectEl = document.getElementById("bulkCustomerInquiryPrioritySelect");
    const newPriority = selectEl ? selectEl.value : "";
    const errEl = document.getElementById("bulkCustomerInquiryPriorityError");

    if (!newPriority) {
        if (errEl) errEl.textContent = "Please select an inquiry priority.";
        return;
    }

    const all = getTicketStorage("customer");
    const selectedIds = new Set(selected.map(i => String(i.id)));
    let count = 0;

    all.forEach(i => {
        if (selectedIds.has(String(i.id))) {
            i.priority = newPriority;
            i.updatedAt = new Date().toISOString();
            count++;
        }
    });

    saveTicketStorage("customer", all);

    if (typeof logActivity === "function") {
        logActivity({
            type: "ticket",
            title: `Updated priority to "${newPriority}" for ${count} customer inquiry/inquiries`,
            meta: selected.map(i => i.name).slice(0, 3).join(", ") + (selected.length > 3 ? "..." : ""),
            href: "tickets.html"
        });
    }

    const modal = document.getElementById("bulkCustomerInquiryPriorityModal");
    if (modal) modal.style.display = "none";

    window.selectedCustomerInquiryIds.clear();
    renderCustomerInquiries();
};

window.bulkArchiveCustomerInquiries = function() {
    const selected = getSelectedCustomerInquiryList();
    if (selected.length === 0) {
        alert("Please select at least one customer portal inquiry to archive.");
        return;
    }

    const unresolvedCount = selected.filter(i => String(i.status || "").toLowerCase() !== "resolved").length;
    const eligible = selected.filter(i => String(i.status || "").toLowerCase() === "resolved");

    if (eligible.length === 0) {
        alert("Only resolved inquiries can be archived. Active inquiries cannot be archived until their status is Resolved.");
        return;
    }

    let confirmMsg = "";
    if (unresolvedCount > 0) {
        confirmMsg = `${unresolvedCount} selected inquiry/inquiries are not resolved yet and cannot be archived.\n\nArchive the remaining ${eligible.length} resolved inquiry/inquiries? They will leave the active queue but stay on file in the Archive page.`;
    } else {
        confirmMsg = `Archive ${eligible.length} resolved inquiry/inquiries? They will leave the active queue but stay on file in the Archive page.`;
    }

    if (!confirm(confirmMsg)) return;

    const all = getTicketStorage("customer");
    const eligibleIds = new Set(eligible.map(i => String(i.id)));
    let count = 0;

    all.forEach(i => {
        if (eligibleIds.has(String(i.id))) {
            i.archived = true;
            i.archivedAt = new Date().toISOString();
            count++;
        }
    });

    saveTicketStorage("customer", all);

    if (typeof logActivity === "function") {
        logActivity({
            type: "ticket",
            title: `Archived ${count} customer portal inquiry/inquiries`,
            meta: eligible.map(i => i.name).slice(0, 3).join(", ") + (eligible.length > 3 ? "..." : ""),
            href: "tickets.html"
        });
    }

    window.selectedCustomerInquiryIds.clear();
    renderCustomerInquiries();
    if (typeof renderArchivedTickets === "function") renderArchivedTickets();
    if (typeof getOpenTicketsCount === "function") getOpenTicketsCount();
};

// js-split:file=tickets.js part=3of10
// Split from script.js - whole top-level blocks moved verbatim, no behavior change.
function renderStaffTickets() {
    const tbody = document.getElementById("staffTicketsBody");
    if (!tbody) return;

    if (typeof initStaffTicketBulkActions === "function") {
        initStaffTicketBulkActions();
    }

    initTicketStatFilters();
    updateTicketStatCardActiveState();

    if (window.selectedStaffTicketIds) {
        const activeIds = new Set(getTicketStorage("staff").filter(t => !t.archived).map(t => String(t.id)));
        for (const id of Array.from(window.selectedStaffTicketIds)) {
            if (!activeIds.has(id)) window.selectedStaffTicketIds.delete(id);
        }
    }

    const tickets = getFilteredStaffTicketList();

    const countChip = document.getElementById("staffTicketCount");
    if (countChip) {
        const total = getTicketStorage("staff").filter(t => !t.archived).length;
        countChip.textContent = `${tickets.length} of ${total} ticket${total === 1 ? "" : "s"}`;
    }

    tbody.innerHTML = "";
    if (tickets.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8">No staff tickets match.</td></tr>';
        if (typeof updateStaffTicketBulkActionBar === "function") {
            updateStaffTicketBulkActionBar(tickets);
        }
        return;
    }

    tickets.forEach(t => {
        const id = encodeURIComponent(t.id);
        const isChecked = window.selectedStaffTicketIds && window.selectedStaffTicketIds.has(String(t.id));
        const resolved = String(t.status || "").toLowerCase() === "resolved";
        const tr = document.createElement("tr");
        if (isChecked) tr.classList.add("is-selected");
        tr.innerHTML = `
            <td class="td-checkbox">
                <input type="checkbox" class="staff-ticket-select-checkbox" data-ticket-id="${id}" ${isChecked ? "checked" : ""} title="Select ticket ${escapeHtml(t.name)}" aria-label="Select ticket ${escapeHtml(t.name)}">
            </td>
            <td>${formatDateLogged(t.date)}</td>
            <td>${escapeHtml(t.name)}</td>
            <td>${escapeHtml(t.contact || "—")}</td>
            <td>${escapeHtml(t.issue)}${commentsSummary(t)}</td>
            <td><span class="badge ${priorityClass(t.priority)}">${escapeHtml(t.priority)}</span></td>
            <td><span class="badge status-badge ${statusClass(t.status)}">${escapeHtml(t.status)}</span></td>
            <td>
                <button class="btn-view" onclick="openTicketDetails(${t.id}, 'staff', this)">View / Comment</button>
                ${resolved ? `<button class="btn-archive" onclick="requestArchiveTicket(${t.id}, 'staff')">Archive</button>` : ""}
            </td>
        `;
        tbody.appendChild(tr);
    });

    if (typeof updateStaffTicketBulkActionBar === "function") {
        updateStaffTicketBulkActionBar(tickets);
    }
}



// js-split:file=tickets.js part=4of10
// Split from script.js - whole top-level blocks moved verbatim, no behavior change.
function renderCustomerInquiries() {
    const tbody = document.getElementById("customerInquiriesBody");
    if (!tbody) return;

    if (typeof initCustomerInquiryBulkActions === "function") {
        initCustomerInquiryBulkActions();
    }

    if (typeof updateTicketStatCardActiveState === "function") {
        updateTicketStatCardActiveState();
    }

    if (window.selectedCustomerInquiryIds) {
        const activeIds = new Set(getTicketStorage("customer").filter(i => !i.archived).map(i => String(i.id)));
        for (const id of Array.from(window.selectedCustomerInquiryIds)) {
            if (!activeIds.has(id)) window.selectedCustomerInquiryIds.delete(id);
        }
    }

    const inquiries = getFilteredCustomerInquiryList();

    const countChip = document.getElementById("customerInquiryCount");
    if (countChip) {
        const total = getTicketStorage("customer").filter(i => !i.archived).length;
        countChip.textContent = `${inquiries.length} of ${total} inquir${total === 1 ? "y" : "ies"}`;
    }

    tbody.innerHTML = "";
    if (inquiries.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8">No customer portal inquiries match.</td></tr>';
        if (typeof updateCustomerInquiryBulkActionBar === "function") {
            updateCustomerInquiryBulkActionBar(inquiries);
        }
        return;
    }

    inquiries.forEach(inq => {
        const id = encodeURIComponent(inq.id);
        const isChecked = window.selectedCustomerInquiryIds && window.selectedCustomerInquiryIds.has(String(inq.id));
        const resolved = String(inq.status || "").toLowerCase() === "resolved";
        const contact = [inq.email, inq.phone, inq.address].filter(Boolean).join(" | ") || "—";
        const renewalBadge = inq.kind === RENEWAL_REQUEST_KIND
            ? '<span class="badge renewal">Renewal</span>'
            : "";
        const tr = document.createElement("tr");
        if (isChecked) tr.classList.add("is-selected");
        tr.innerHTML = `
            <td class="td-checkbox">
                <input type="checkbox" class="customer-inquiry-select-checkbox" data-inquiry-id="${id}" ${isChecked ? "checked" : ""} title="Select inquiry from ${escapeHtml(inq.name)}" aria-label="Select inquiry from ${escapeHtml(inq.name)}">
            </td>
            <td>${formatDateLogged(inq.date)}</td>
            <td>${escapeHtml(inq.name)}</td>
            <td>${escapeHtml(contact)}</td>
            <td>${escapeHtml(inq.message)}${commentsSummary(inq)}</td>
            <td><span class="badge ${priorityClass(inq.priority)}">${escapeHtml(inq.priority)}</span>${renewalBadge}</td>
            <td><span class="badge status-badge ${statusClass(inq.status)}">${escapeHtml(inq.status)}</span></td>
            <td>
                <button class="btn-view" onclick="openTicketDetails(${inq.id}, 'customer', this)">View / Reply</button>
                ${resolved ? `<button class="btn-archive" onclick="requestArchiveTicket(${inq.id}, 'customer')">Archive</button>` : ""}
            </td>
        `;
        tbody.appendChild(tr);
    });

    if (typeof updateCustomerInquiryBulkActionBar === "function") {
        updateCustomerInquiryBulkActionBar(inquiries);
    }
}

// Open the details / comment-reply dialog for a given ticket or inquiry


// js-split:file=tickets.js part=5of10
// Split from script.js - whole top-level blocks moved verbatim, no behavior change.
function openTicketDetails(id, source, buttonElement) {
    const modal = document.getElementById("ticketDetailsModal");
    if (!modal) return;

    const item = getTicketStorage(source).find(x => String(x.id) === String(id));
    if (!item) return;

    pendingTicket = { source, id };
    const isStaff = source === "staff";

    document.getElementById("detailsTitle").textContent = isStaff ? "Walk-in Ticket Details" : "Customer Inquiry Details";
    document.getElementById("detailsName").textContent = item.name;
    document.getElementById("detailsContact").textContent = item.contact || [item.email, item.phone, item.address].filter(Boolean).join(" | ") || "—";
    document.getElementById("detailsDate").textContent = formatDateLogged(item.date);
    document.getElementById("detailsPriority").value = item.priority || PRIORITY_NOT_DEFINED;
    document.getElementById("detailsStatus").value = item.status || "Open";
    document.getElementById("detailsIssue").textContent = item.issue || item.message;

    const thread = document.getElementById("detailsThread");
    const threadLabel = document.getElementById("detailsThreadLabel");
    thread.innerHTML = commentsHTML(item);
    if (isStaff) {
        thread.classList.add("comments-list");
        if (threadLabel) threadLabel.textContent = "Comments";
    } else {
        thread.classList.remove("comments-list");
        if (threadLabel) threadLabel.textContent = "Conversation History";
    }

    const label = document.getElementById("detailsActionLabel");
    const comment = document.getElementById("detailsComment");
    const staffNameEl = document.getElementById("detailsStaffName");
    if (isStaff) {
        label.textContent = "Add Comment";
        comment.placeholder = "Write a comment about this walk-in ticket...";
    } else {
        label.textContent = "Reply to Customer";
        comment.placeholder = "Type the reply to the customer...";
    }
    if (staffNameEl) staffNameEl.value = localStorage.getItem("crmStaffName") || "";

    const staffAvatarImg = document.getElementById("detailsStaffAvatarImg");
    if (staffAvatarImg) staffAvatarImg.src = getAdminAvatar();

    document.getElementById("detailsComment").value = "";
    document.getElementById("archiveFromDetails").style.display = String(item.status || "").toLowerCase() === "resolved" ? "inline-block" : "none";
    modal.style.display = "flex";
}



// js-split:file=tickets.js part=6of10
// Split from script.js - whole top-level blocks moved verbatim, no behavior change.
function saveTicketUpdate() {
    if (!pendingTicket) return;
    const { source, id } = pendingTicket;

    const list = getTicketStorage(source);
    const item = list.find(x => String(x.id) === String(id));
    if (!item) return;

    const newStatus = document.getElementById("detailsStatus").value;
    // Priority is a staff-only field: portal inquiries arrive untriaged and are
    // ranked here, from this dialog alone.
    const previousPriority = item.priority;
    const newPriority = document.getElementById("detailsPriority").value || PRIORITY_NOT_DEFINED;
    const staffName = (document.getElementById("detailsStaffName") || {}).value || "";
    const comment = document.getElementById("detailsComment").value.trim();

    if (comment) {
        if (!staffName.trim()) {
            alert("Please enter your name before commenting / replying.");
            return;
        }
        localStorage.setItem("crmStaffName", staffName.trim());
        if (!Array.isArray(item.comments)) item.comments = [];
        item.comments.push({
            author: staffName.trim(),
            role: "staff",
            text: comment,
            date: new Date().toLocaleString(),
            avatar: getAdminAvatar()
        });
    }

    const previousStatus = item.status;
    item.status = newStatus;
    item.priority = newPriority;
    item.reply = comment; // keep legacy field in sync

    saveTicketStorage(source, list);

    const staffLabel = staffName.trim() || "Support Staff";
    // A priority change is reported on its own: it is the staff triage decision,
    // not a status move.
    if (previousPriority !== newPriority) {
        logActivity({
            type: "ticket",
            title: `${staffLabel} set ${item.name}'s ticket to ${newPriority} priority`,
            meta: `Ticket ${activityTicketRef(item.id)} • Was ${previousPriority || PRIORITY_NOT_DEFINED}`,
            href: activityHref("tickets.html", item.name)
        });
    }
    logActivity(previousStatus !== newStatus && newStatus === "Resolved"
        ? {
            type: "resolved",
            title: `${staffLabel} resolved ${item.name}'s ticket`,
            meta: `Ticket ${activityTicketRef(item.id)} • ${item.priority} priority`,
            href: activityHref("tickets.html", item.name)
        }
        : {
            type: "ticket",
            title: `${item.name}'s ticket moved to ${newStatus}`,
            meta: `Ticket ${activityTicketRef(item.id)} • Updated by ${staffLabel}`,
            href: activityHref("tickets.html", item.name)
        });

    pendingTicket = null;
    document.getElementById("ticketDetailsModal").style.display = "none";

    renderStaffTickets();
    renderCustomerInquiries();
    getOpenTicketsCount();
}

// Open the archive confirmation dialog (admin only: customers never archive)


// js-split:file=tickets.js part=7of10
// Split from script.js - whole top-level blocks moved verbatim, no behavior change.
// Open the archive confirmation dialog (admin only: customers never archive)
function requestArchiveTicket(id, source) {
    if (sessionStorage.getItem("crmRole") !== "admin") {
        alert("Only staff can archive tickets.");
        return;
    }
    const modal = document.getElementById("archiveConfirmModal");
    if (!modal) return;

    pendingArchive = { source, id };
    document.getElementById("archiveConfirmMessage").textContent =
        "Archive this resolved ticket? It leaves the active queue but stays on file in the Archive page.";
    modal.style.display = "flex";
}

function confirmArchiveTicket() {
    if (!pendingArchive) return;
    const { source, id } = pendingArchive;

    const list = getTicketStorage(source);
    const item = list.find(x => String(x.id) === String(id));
    if (!item) return;
    item.archived = true;
    item.archivedAt = new Date().toISOString();
    saveTicketStorage(source, list);

    logActivity({
        type: "ticket",
        title: `${item.name}'s ticket was archived`,
        meta: `Ticket ${activityTicketRef(item.id)} • ${item.status || "Resolved"}`,
        href: activityHref("tickets.html", item.name)
    });

    pendingArchive = null;
    document.getElementById("archiveConfirmModal").style.display = "none";

    renderStaffTickets();
    renderCustomerInquiries();
    renderArchivedTickets();
    getOpenTicketsCount();
}

function restoreTicket(id, source) {
    if (sessionStorage.getItem("crmRole") !== "admin") {
        alert("Only staff can restore tickets.");
        return;
    }
    const list = getTicketStorage(source);
    const item = list.find(x => String(x.id) === String(id));
    if (!item) return;
    if (!confirm(`Restore ${item.name}'s ticket back to the active queue?`)) return;
    delete item.archived;
    delete item.archivedAt;
    saveTicketStorage(source, list);

    logActivity({
        type: "ticket",
        title: `${item.name}'s ticket was restored from the archive`,
        meta: `Ticket ${activityTicketRef(item.id)}`,
        href: activityHref("tickets.html", item.name)
    });

    renderStaffTickets();
    renderCustomerInquiries();
    renderArchivedTickets();
    getOpenTicketsCount();
}

function permanentlyDeleteTicket(id, source) {
    if (sessionStorage.getItem("crmRole") !== "admin") {
        alert("Only staff can permanently delete tickets.");
        return;
    }
    if (!confirm("Permanently delete this archived ticket? This cannot be undone.")) return;

    saveTicketStorage(source, getTicketStorage(source).filter(x => String(x.id) !== String(id)));

    renderStaffTickets();
    renderCustomerInquiries();
    renderArchivedTickets();
    getOpenTicketsCount();
}

function renderArchivedTickets() {
    const renderInto = (tbodyId, source, getText) => {
        const tbody = document.getElementById(tbodyId);
        if (!tbody) return;
        const rows = getTicketStorage(source)
            .filter(t => t.archived)
            .sort((a, b) => String(b.id) - String(a.id));
        tbody.innerHTML = "";
        if (rows.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7">No archived tickets yet.</td></tr>';
            return;
        }
        rows.forEach(t => {
            const contact = source === "staff"
                ? (t.contact || "—")
                : ([t.email, t.phone, t.address].filter(Boolean).join(" | ") || "—");
            const renewalBadge = t.kind === RENEWAL_REQUEST_KIND
                ? '<span class="badge renewal">Renewal</span>'
                : "";
            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td>${formatDateLogged(t.date)}</td>
                <td>${escapeHtml(t.name)}</td>
                <td>${escapeHtml(contact)}</td>
                <td>${escapeHtml(getText(t))}${commentsSummary(t)}</td>
                <td><span class="badge ${priorityClass(t.priority)}">${t.priority}</span>${renewalBadge}</td>
                <td><span class="badge open">Archived</span></td>
                <td>
                    <div class="row-actions">
                        <button class="btn-restore" onclick="restoreTicket(${t.id}, '${source}')">Restore</button>
                        <button class="btn-delete" onclick="permanentlyDeleteTicket(${t.id}, '${source}')">Delete Permanently</button>
                    </div>
                </td>
            `;
            tbody.appendChild(tr);
        });
    };
    renderInto("archivedStaffTicketsBody", "staff", t => t.issue || "");
    renderInto("archivedCustomerInquiriesBody", "customer", t => t.message || "");
}



// js-split:file=tickets.js part=8of10
// Split from script.js - whole top-level blocks moved verbatim, no behavior change.
// js-split:file=tickets.js part=9of10
// Split from script.js - whole top-level blocks moved verbatim, no behavior change.
function getOpenTicketsCount() {
    const all = [
        ...JSON.parse(localStorage.getItem("crmStaffTickets") || "[]"),
        ...JSON.parse(localStorage.getItem("crmInquiries") || "[]")
    ];
    const count = all.filter(t => {
        if (t.archived) return false;
        const s = String(t.status || "").toLowerCase();
        return s === "open" || s === "in progress";
    }).length;
    localStorage.setItem("crmOpenTicketsCount", count);
    return count;
}



// js-split:file=tickets.js part=10of10
// Split from script.js - whole top-level blocks moved verbatim, no behavior change.
function toggleTicketDetails(id) {
    const el = document.getElementById(`ticket-details-${id}`);
    if (el) el.style.display = el.style.display === "none" ? "block" : "none";
}

// Global exposure for Staff Logged Walk-in Tickets Bulk Actions
window.selectedStaffTicketIds = window.selectedStaffTicketIds;
window.updateStaffTicketBulkActionBar = updateStaffTicketBulkActionBar;
window.initStaffTicketBulkActions = initStaffTicketBulkActions;
window.openBulkStaffTicketStatusModal = openBulkStaffTicketStatusModal;
window.confirmBulkStaffTicketStatus = confirmBulkStaffTicketStatus;
window.openBulkStaffTicketPriorityModal = openBulkStaffTicketPriorityModal;
window.confirmBulkStaffTicketPriority = confirmBulkStaffTicketPriority;
window.bulkArchiveStaffTickets = bulkArchiveStaffTickets;
window.getFilteredStaffTicketList = getFilteredStaffTicketList;
window.getSelectedStaffTicketList = getSelectedStaffTicketList;

// Global exposure for Customer Portal Inquiries Bulk Actions
window.selectedCustomerInquiryIds = window.selectedCustomerInquiryIds;
window.updateCustomerInquiryBulkActionBar = updateCustomerInquiryBulkActionBar;
window.initCustomerInquiryBulkActions = initCustomerInquiryBulkActions;
window.openBulkCustomerInquiryStatusModal = openBulkCustomerInquiryStatusModal;
window.confirmBulkCustomerInquiryStatus = confirmBulkCustomerInquiryStatus;
window.openBulkCustomerInquiryPriorityModal = openBulkCustomerInquiryPriorityModal;
window.confirmBulkCustomerInquiryPriority = confirmBulkCustomerInquiryPriority;
window.bulkArchiveCustomerInquiries = bulkArchiveCustomerInquiries;
window.getFilteredCustomerInquiryList = getFilteredCustomerInquiryList;
window.getSelectedCustomerInquiryList = getSelectedCustomerInquiryList;

// ---- Sales Pipeline (Prospecting Clients) ----
