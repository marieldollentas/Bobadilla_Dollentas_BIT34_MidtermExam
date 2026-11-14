// js-split:file=members.js part=1of14
// Split from script.js - whole top-level blocks moved verbatim, no behavior change.
function mutateMemberRecord(id, mutate) {
    const isRegistered = String(id).indexOf("reg-") === 0;
    const storeKey = isRegistered ? "crmCustomers" : DIRECTORY_KEY;
    const list = JSON.parse(localStorage.getItem(storeKey) || "[]");
    const record = isRegistered
        ? list.find(c => c.username === id.slice(4))
        : list.find(d => String(d.id) === String(id));
    if (!record) return false;
    mutate(record);
    localStorage.setItem(storeKey, JSON.stringify(list));
    return true;
}



// js-split:file=members.js part=2of14
// Split from script.js - whole top-level blocks moved verbatim, no behavior change.
function archiveMemberById(id) {
    return mutateMemberRecord(id, record => {
        record.archived = true;
        record.archivedAt = new Date().toISOString();
    });
}



// js-split:file=members.js part=3of14
// Split from script.js - whole top-level blocks moved verbatim, no behavior change.
function restoreMemberById(id) {
    return mutateMemberRecord(id, record => {
        delete record.archived;
        delete record.archivedAt;
    });
}

function permanentlyDeleteMemberById(id) {
    const isRegistered = String(id).indexOf("reg-") === 0;
    const storeKey = isRegistered ? "crmCustomers" : DIRECTORY_KEY;
    const list = JSON.parse(localStorage.getItem(storeKey) || "[]");
    const before = list.length;
    const kept = isRegistered
        ? list.filter(c => c.username !== id.slice(4))
        : list.filter(d => String(d.id) !== String(id));
    if (kept.length === before) return false;
    localStorage.setItem(storeKey, JSON.stringify(kept));
    return true;
}



// js-split:file=members.js part=4of14
// Split from script.js - whole top-level blocks moved verbatim, no behavior change.
function unfreezeMemberById(id) {
    const isRegistered = String(id).indexOf("reg-") === 0;
    const storeKey = isRegistered ? "crmCustomers" : DIRECTORY_KEY;
    const list = JSON.parse(localStorage.getItem(storeKey) || "[]");
    const record = isRegistered
        ? list.find(c => c.username === id.slice(4))
        : list.find(d => String(d.id) === String(id));
    if (!record) return false;
    record.status = "Active";
    delete record.freezeStartDate;
    delete record.freezeEndDate;
    delete record.freezeMonths;
    localStorage.setItem(storeKey, JSON.stringify(list));
    return true;
}



// js-split:file=members.js part=5of14
// Split from script.js - whole top-level blocks moved verbatim, no behavior change.
function renewalCountdownLabel(member, today) {
    const days = daysUntilExpiration(member && member.exp, today);
    if (days === null) return "No expiration date on record";
    if (days < 0) return `Expired ${Math.abs(days)} day${Math.abs(days) === 1 ? "" : "s"} ago`;
    if (days === 0) return "Expires today";
    return `Expires in ${days} day${days === 1 ? "" : "s"}`;
}

// A membership is renewable exactly while customerStatus() reports it as
// "Expiring Soon" or "Expired", so a renewal button can never appear beside a
// membership the rest of the portal still shows as active.


// js-split:file=members.js part=6of14
// Split from script.js - whole top-level blocks moved verbatim, no behavior change.
function membershipNeedsRenewal(member, today) {
    if (!member || !member.tier) return false;
    const status = customerStatus(member.exp, today || todayStart());
    return status === "Expiring Soon" || status === "Expired";
}

// A renewal adds one full term of the member's existing tier, measured from the
// later of today and the current expiration date: renewing early never discards
// the days already paid for, and an expired membership restarts from today.


// js-split:file=members.js part=7of14
// Split from script.js - whole top-level blocks moved verbatim, no behavior change.
function renewalExpirationFor(member, today) {
    const months = tierDurationMonths(member && member.tier);
    if (!months) return "";
    const from = today || todayStart();
    const current = member && member.exp ? new Date(member.exp) : null;
    const base = current && !isNaN(current.getTime()) && current > from ? current : from;
    return computeExpirationDate(months, base);
}

// Renewals only move the expiration date, so the change is written back to
// whichever store already owns the record: a registered account (crmCustomers,
// keyed "reg-<username>") or a front desk directory entry (crmDirectory).


// js-split:file=members.js part=8of14
// Split from script.js - whole top-level blocks moved verbatim, no behavior change.
function updateDirectoryExpiration(id, exp) {
    const isRegistered = String(id).indexOf("reg-") === 0;
    const storeKey = isRegistered ? "crmCustomers" : DIRECTORY_KEY;
    const list = JSON.parse(localStorage.getItem(storeKey) || "[]");
    const record = isRegistered
        ? list.find(c => c.username === id.slice(4))
        : list.find(d => String(d.id) === String(id));
    if (!record) return false;

    record.exp = exp;
    record.updatedExpirationDate = exp;
    localStorage.setItem(storeKey, JSON.stringify(list));
    return true;
}



// js-split:file=members.js part=9of14
// Split from script.js - whole top-level blocks moved verbatim, no behavior change.
window.openFreezeModal = function(id) {
    const member = getDirectoryCustomers().find(c => String(c.id) === String(id));
    if (!member) {
        alert("Member not found. It may have already been removed.");
        return;
    }
    const mStatus = getMemberStatus(member);
    if (mStatus === "Frozen" && member.freezeEndDate) {
        alert(`Membership is already frozen until ${member.freezeEndDate}.`);
        return;
    }
    if (mStatus === "Expired") {
        alert("Cannot freeze an expired member.");
        return;
    }
    if (mStatus === "Archived") {
        alert("Cannot freeze an archived member. Restore the record first.");
        return;
    }
    const modal = document.getElementById("freezeModal");
    if (!modal) return;
    document.getElementById("freezeMemberId").value = member.id;
    document.getElementById("freezeMemberName").value = member.name || "";
    document.getElementById("freezeMemberTier").value = member.tier || "";
    document.getElementById("freezeMemberExp").value = member.updatedExpirationDate || member.exp || "";
    document.getElementById("freezeMonths").value = "";
    document.getElementById("freezeFormError").textContent = "";
    modal.style.display = "flex";
};



// js-split:file=members.js part=10of14
// Split from script.js - whole top-level blocks moved verbatim, no behavior change.
window.confirmFreeze = function() {
    const id = document.getElementById("freezeMemberId").value;
    const months = parseInt(document.getElementById("freezeMonths").value);
    const errorEl = document.getElementById("freezeFormError");
    if (!months || months < 1 || months > 6) {
        errorEl.textContent = "Please select freeze duration (1-6 months).";
        return;
    }
    const isRegistered = String(id).indexOf("reg-") === 0;
    const storeKey = isRegistered ? "crmCustomers" : DIRECTORY_KEY;
    const list = JSON.parse(localStorage.getItem(storeKey) || "[]");
    const record = isRegistered
        ? list.find(c => c.username === id.slice(4))
        : list.find(d => String(d.id) === String(id));
    if (!record) {
        errorEl.textContent = "Member not found.";
        return;
    }
    const today = new Date();
    const startStr = today.toISOString().split("T")[0];
    const endStr = addMonthsSafe(startStr, months);
    const currentExp = record.updatedExpirationDate || record.exp || "";
    const newExp = addMonthsSafe(currentExp || startStr, months);
    record.status = "Frozen";
    record.freezeStartDate = startStr;
    record.freezeEndDate = endStr;
    record.freezeMonths = months;
    record.originalExpirationDate = record.originalExpirationDate || currentExp || null;
    record.updatedExpirationDate = newExp;
    if (!isRegistered) {
        record.exp = newExp;
    } else {
        record.exp = newExp;
    }
    localStorage.setItem(storeKey, JSON.stringify(list));
    document.getElementById("freezeModal").style.display = "none";

    const memberName = record.name || "A member";
    logActivity({
        type: "frozen",
        title: `${memberName}'s membership was frozen for ${months} month${months === 1 ? "" : "s"}`,
        meta: `${record.tier || "Membership"} • Frozen until ${endStr} • New expiration ${newExp}`,
        href: activityHref("members.html", memberName)
    });

    renderCustomerDirectory();
    countExpiringMembers();
    countActiveMembers();
};



// js-split:file=members.js part=11of14
// Split from script.js - whole top-level blocks moved verbatim, no behavior change.
window.unfreezeMember = function(id) {
    if (!confirm("Are you sure you want to end this membership freeze early?")) return;
    // Read the name before the flags are dropped, and log here rather than in
    // unfreezeMemberById: that helper also runs on its own when a freeze lapses
    // during a repaint, which must stay out of the activity feed.
    const member = getDirectoryCustomers().find(c => String(c.id) === String(id));
    const frozenUntil = member ? member.freezeEndDate : "";
    if (!unfreezeMemberById(id)) return;
    if (member) {
        const name = member.name || "A member";
        logActivity({
            type: "membership",
            title: `${name}'s membership freeze was ended early`,
            meta: `Was frozen until ${frozenUntil || "further notice"} • Expires ${member.updatedExpirationDate || member.exp || "—"}`,
            href: activityHref("members.html", name)
        });
    }
    renderCustomerDirectory();
    countExpiringMembers();
    countActiveMembers();
};



// js-split:file=members.js part=12of14
// Split from script.js - whole top-level blocks moved verbatim, no behavior change.

function getCustomerDirectoryFilters() {
    const searchEl = document.getElementById("searchCustomer");
    const statusEl = document.getElementById("filterMemberStatus");
    const tierEl = document.getElementById("filterMemberTier");
    const sortEl = document.getElementById("sortMemberBy");

    return {
        search: (searchEl ? searchEl.value : "").trim().toLowerCase(),
        status: statusEl ? statusEl.value : "all",
        tier: tierEl ? tierEl.value : "all",
        sortBy: sortEl ? sortEl.value : "joined-desc"
    };
}
window.getCustomerDirectoryFilters = getCustomerDirectoryFilters;

window.resetCustomerDirectoryFilters = function() {
    const searchEl = document.getElementById("searchCustomer");
    const statusEl = document.getElementById("filterMemberStatus");
    const tierEl = document.getElementById("filterMemberTier");
    const sortEl = document.getElementById("sortMemberBy");

    if (searchEl) searchEl.value = "";
    if (statusEl) statusEl.value = "all";
    if (tierEl) tierEl.value = "all";
    if (sortEl) sortEl.value = "joined-desc";

    renderCustomerDirectory();
};

function initCustomerDirectoryFilters() {
    const tableBody = document.getElementById("customerTableBody");
    if (!tableBody) return;

    const filterIds = ["searchCustomer", "filterMemberStatus", "filterMemberTier", "sortMemberBy"];
    filterIds.forEach(id => {
        const el = document.getElementById(id);
        if (!el || el.dataset.filterBound === "1") return;
        el.dataset.filterBound = "1";
        const evt = el.tagName === "INPUT" ? "input" : "change";
        el.addEventListener(evt, () => renderCustomerDirectory());
    });

    const resetBtn = document.getElementById("resetMemberFilters");
    if (resetBtn && resetBtn.dataset.filterBound !== "1") {
        resetBtn.dataset.filterBound = "1";
        resetBtn.addEventListener("click", () => window.resetCustomerDirectoryFilters());
    }

    // Interactive stat cards filter
    document.querySelectorAll(".stat-card[data-status-filter]").forEach(card => {
        if (card.dataset.statBound === "1") return;
        card.dataset.statBound = "1";
        card.addEventListener("click", () => {
            const targetStatus = card.dataset.statusFilter || "all";
            const statusEl = document.getElementById("filterMemberStatus");
            if (statusEl) {
                statusEl.value = targetStatus;
                renderCustomerDirectory();
            }
        });
        card.addEventListener("keydown", e => {
            if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                card.click();
            }
        });
    });
}
window.initCustomerDirectoryFilters = initCustomerDirectoryFilters;

// Shared selection state for Customer Directory bulk operations
window.selectedMemberIds = window.selectedMemberIds || new Set();

function getFilteredDirectoryCustomers(allRows, filters, today) {
    return allRows.filter(c => {
        const memberStatus = getMemberStatus(c, today);

        // Status filter
        if (filters.status !== "all" && memberStatus !== filters.status) {
            return false;
        }

        // Tier filter
        if (filters.tier !== "all" && (c.tier || "") !== filters.tier) {
            return false;
        }

        // Search query filter
        if (filters.search) {
            const query = filters.search;
            const genderDisplay = c.gender === "Other" && c.genderIdentity
                ? `other (${c.genderIdentity})`
                : (c.gender || "");
            const haystack = [
                c.name,
                c.firstName,
                c.middleName,
                c.lastName,
                c.suffix,
                genderDisplay,
                c.birthday,
                c.email,
                c.phone,
                c.contact,
                c.address,
                c.keyFob,
                c.tier,
                c.joined,
                c.updatedExpirationDate || c.exp,
                memberStatus
            ].filter(Boolean).join(" ").toLowerCase();

            if (!haystack.includes(query)) {
                return false;
            }
        }

        return true;
    });
}
window.getFilteredDirectoryCustomers = getFilteredDirectoryCustomers;

function updateBulkActionBar(filteredRows) {
    const bar = document.getElementById("customerBulkActionBar");
    const countEl = document.getElementById("bulkSelectedCount");
    const labelEl = document.getElementById("bulkSelectedLabel");
    const totalMatchingEl = document.getElementById("bulkTotalMatchingCount");
    const selectAllCheckbox = document.getElementById("selectAllMembers");

    const selectedCount = window.selectedMemberIds ? window.selectedMemberIds.size : 0;
    const visibleCount = Array.isArray(filteredRows) ? filteredRows.length : 0;

    if (totalMatchingEl) {
        totalMatchingEl.textContent = visibleCount;
    }

    if (!bar) return;

    if (selectedCount === 0) {
        bar.hidden = true;
        bar.style.display = "none";
    } else {
        bar.hidden = false;
        bar.style.display = "flex";
        if (countEl) countEl.textContent = selectedCount;
        if (labelEl) labelEl.textContent = selectedCount === 1 ? "member selected" : "members selected";
    }

    // Sync header checkbox
    if (selectAllCheckbox && Array.isArray(filteredRows)) {
        const visibleSelectedCount = filteredRows.filter(r => window.selectedMemberIds.has(String(r.id))).length;
        if (visibleCount > 0 && visibleSelectedCount === visibleCount) {
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
window.updateBulkActionBar = updateBulkActionBar;

function initCustomerDirectoryBulkActions() {
    const tableWrap = document.querySelector(".table-wrap");
    const tbody = document.getElementById("customerTableBody");
    const selectAllCheckbox = document.getElementById("selectAllMembers");
    const bar = document.getElementById("customerBulkActionBar");

    if (!bar || bar.dataset.bulkBound === "1") return;
    bar.dataset.bulkBound = "1";

    // Header checkbox toggles selection for all currently visible rows
    if (selectAllCheckbox && selectAllCheckbox.dataset.bound !== "1") {
        selectAllCheckbox.dataset.bound = "1";
        selectAllCheckbox.addEventListener("change", () => {
            const today = todayStart();
            const allRows = getActiveDirectoryCustomers();
            const filters = getCustomerDirectoryFilters();
            const filteredRows = getFilteredDirectoryCustomers(allRows, filters, today);

            if (selectAllCheckbox.checked) {
                filteredRows.forEach(r => window.selectedMemberIds.add(String(r.id)));
            } else {
                filteredRows.forEach(r => window.selectedMemberIds.delete(String(r.id)));
            }
            renderCustomerDirectory();
        });
    }

    // Row selection delegation on customerTableBody
    if (tbody && tbody.dataset.bulkDelegated !== "1") {
        tbody.dataset.bulkDelegated = "1";

        tbody.addEventListener("change", e => {
            if (e.target.classList.contains("member-select-checkbox")) {
                const id = decodeURIComponent(e.target.dataset.memberId || "");
                if (e.target.checked) {
                    window.selectedMemberIds.add(id);
                } else {
                    window.selectedMemberIds.delete(id);
                }
                const tr = e.target.closest("tr");
                if (tr) tr.classList.toggle("is-selected", e.target.checked);

                const today = todayStart();
                const allRows = getActiveDirectoryCustomers();
                const filters = getCustomerDirectoryFilters();
                const filteredRows = getFilteredDirectoryCustomers(allRows, filters, today);
                updateBulkActionBar(filteredRows);
            }
        });

        // Click on the checkbox cell also toggles the checkbox
        tbody.addEventListener("click", e => {
            const td = e.target.closest("td.td-checkbox");
            if (td && e.target.tagName !== "INPUT") {
                const checkbox = td.querySelector(".member-select-checkbox");
                if (checkbox) {
                    checkbox.checked = !checkbox.checked;
                    checkbox.dispatchEvent(new Event("change", { bubbles: true }));
                }
            }
        });
    }

    // Select all matching button
    const selectAllMatchingBtn = document.getElementById("bulkSelectAllMatchingBtn");
    if (selectAllMatchingBtn) {
        selectAllMatchingBtn.addEventListener("click", () => {
            const today = todayStart();
            const allRows = getActiveDirectoryCustomers();
            const filters = getCustomerDirectoryFilters();
            const filteredRows = getFilteredDirectoryCustomers(allRows, filters, today);
            filteredRows.forEach(r => window.selectedMemberIds.add(String(r.id)));
            renderCustomerDirectory();
        });
    }

    // Clear selection button
    const deselectBtn = document.getElementById("bulkDeselectBtn");
    if (deselectBtn) {
        deselectBtn.addEventListener("click", () => {
            window.selectedMemberIds.clear();
            renderCustomerDirectory();
        });
    }

    // Close button
    const closeBarBtn = document.getElementById("bulkBarCloseBtn");
    if (closeBarBtn) {
        closeBarBtn.addEventListener("click", () => {
            window.selectedMemberIds.clear();
            renderCustomerDirectory();
        });
    }

    // Action buttons
    const renewBtn = document.getElementById("bulkRenewBtn");
    if (renewBtn) renewBtn.addEventListener("click", () => window.bulkRenewMembers());

    const freezeBtn = document.getElementById("bulkFreezeBtn");
    if (freezeBtn) freezeBtn.addEventListener("click", () => window.openBulkFreezeModal());

    const unfreezeBtn = document.getElementById("bulkUnfreezeBtn");
    if (unfreezeBtn) unfreezeBtn.addEventListener("click", () => window.bulkUnfreezeMembers());

    const tierBtn = document.getElementById("bulkChangeTierBtn");
    if (tierBtn) tierBtn.addEventListener("click", () => window.openBulkChangeTierModal());

    const archiveBtn = document.getElementById("bulkArchiveBtn");
    if (archiveBtn) archiveBtn.addEventListener("click", () => window.bulkArchiveMembers());

    // Export dropdown
    const exportBtn = document.getElementById("bulkExportBtn");
    const exportMenu = document.getElementById("bulkExportMenu");
    if (exportBtn && exportMenu) {
        exportBtn.addEventListener("click", e => {
            e.stopPropagation();
            const isHidden = exportMenu.hidden;
            exportMenu.hidden = !isHidden;
            exportBtn.setAttribute("aria-expanded", String(isHidden));
        });

        document.addEventListener("click", e => {
            if (!exportMenu.contains(e.target) && !exportBtn.contains(e.target)) {
                exportMenu.hidden = true;
                exportBtn.setAttribute("aria-expanded", "false");
            }
        });
    }

    const exportCsvBtn = document.getElementById("bulkExportCsvBtn");
    if (exportCsvBtn) {
        exportCsvBtn.addEventListener("click", () => {
            if (exportMenu) exportMenu.hidden = true;
            window.bulkExportMembersCsv();
        });
    }

    const exportPdfBtn = document.getElementById("bulkExportPdfBtn");
    if (exportPdfBtn) {
        exportPdfBtn.addEventListener("click", () => {
            if (exportMenu) exportMenu.hidden = true;
            window.bulkExportMembersPdf(exportBtn || exportPdfBtn);
        });
    }

    // Bulk Freeze Modal close listeners
    const bulkFreezeModal = document.getElementById("bulkFreezeModal");
    if (bulkFreezeModal) {
        const closeBtn = document.getElementById("closeBulkFreezeModal");
        const cancelBtn = document.getElementById("cancelBulkFreezeModal");
        if (closeBtn) closeBtn.addEventListener("click", () => { bulkFreezeModal.style.display = "none"; });
        if (cancelBtn) cancelBtn.addEventListener("click", () => { bulkFreezeModal.style.display = "none"; });
        bulkFreezeModal.addEventListener("click", e => {
            if (e.target === bulkFreezeModal) bulkFreezeModal.style.display = "none";
        });
    }

    // Bulk Change Tier Modal close listeners
    const bulkTierModal = document.getElementById("bulkChangeTierModal");
    if (bulkTierModal) {
        const closeBtn = document.getElementById("closeBulkTierModal");
        const cancelBtn = document.getElementById("cancelBulkTierModal");
        if (closeBtn) closeBtn.addEventListener("click", () => { bulkTierModal.style.display = "none"; });
        if (cancelBtn) cancelBtn.addEventListener("click", () => { bulkTierModal.style.display = "none"; });
        bulkTierModal.addEventListener("click", e => {
            if (e.target === bulkTierModal) bulkTierModal.style.display = "none";
        });
    }
}
window.initCustomerDirectoryBulkActions = initCustomerDirectoryBulkActions;

function renderCustomerDirectory() {
    const tbody = document.getElementById("customerTableBody");
    if (!tbody) return;

    initCustomerDirectoryFilters();
    initCustomerDirectoryBulkActions();

    const today = todayStart();
    const allRows = getActiveDirectoryCustomers();
    const filters = getCustomerDirectoryFilters();

    // Prune selections that no longer exist
    if (window.selectedMemberIds && window.selectedMemberIds.size > 0) {
        const activeIds = new Set(allRows.map(r => String(r.id)));
        Array.from(window.selectedMemberIds).forEach(id => {
            if (!activeIds.has(String(id))) window.selectedMemberIds.delete(id);
        });
    }

    // Filter rows by search, status, and tier
    const filteredRows = getFilteredDirectoryCustomers(allRows, filters, today);

    // Sort filtered rows
    filteredRows.sort((a, b) => {
        switch (filters.sortBy) {
            case "joined-asc": {
                const dateA = a.joined && a.joined !== "—" ? new Date(a.joined + "T00:00:00").getTime() : 0;
                const dateB = b.joined && b.joined !== "—" ? new Date(b.joined + "T00:00:00").getTime() : 0;
                return dateA - dateB;
            }
            case "joined-desc": {
                const dateA = a.joined && a.joined !== "—" ? new Date(a.joined + "T00:00:00").getTime() : 0;
                const dateB = b.joined && b.joined !== "—" ? new Date(b.joined + "T00:00:00").getTime() : 0;
                return dateB - dateA;
            }
            case "last-name-asc": {
                const lastA = (a.lastName || (typeof namePartsFromRecord === "function" ? namePartsFromRecord(a).lastName : "") || "").trim();
                const lastB = (b.lastName || (typeof namePartsFromRecord === "function" ? namePartsFromRecord(b).lastName : "") || "").trim();
                const cmp = lastA.localeCompare(lastB, undefined, { sensitivity: "base" });
                if (cmp !== 0) return cmp;
                const firstA = (a.firstName || (typeof namePartsFromRecord === "function" ? namePartsFromRecord(a).firstName : "") || "").trim();
                const firstB = (b.firstName || (typeof namePartsFromRecord === "function" ? namePartsFromRecord(b).firstName : "") || "").trim();
                return firstA.localeCompare(firstB, undefined, { sensitivity: "base" });
            }
            case "last-name-desc": {
                const lastA = (a.lastName || (typeof namePartsFromRecord === "function" ? namePartsFromRecord(a).lastName : "") || "").trim();
                const lastB = (b.lastName || (typeof namePartsFromRecord === "function" ? namePartsFromRecord(b).lastName : "") || "").trim();
                const cmp = lastB.localeCompare(lastA, undefined, { sensitivity: "base" });
                if (cmp !== 0) return cmp;
                const firstA = (a.firstName || (typeof namePartsFromRecord === "function" ? namePartsFromRecord(a).firstName : "") || "").trim();
                const firstB = (b.firstName || (typeof namePartsFromRecord === "function" ? namePartsFromRecord(b).firstName : "") || "").trim();
                return firstB.localeCompare(firstA, undefined, { sensitivity: "base" });
            }
            case "first-name-asc": {
                const firstA = (a.firstName || (typeof namePartsFromRecord === "function" ? namePartsFromRecord(a).firstName : "") || "").trim();
                const firstB = (b.firstName || (typeof namePartsFromRecord === "function" ? namePartsFromRecord(b).firstName : "") || "").trim();
                const cmp = firstA.localeCompare(firstB, undefined, { sensitivity: "base" });
                if (cmp !== 0) return cmp;
                const lastA = (a.lastName || (typeof namePartsFromRecord === "function" ? namePartsFromRecord(a).lastName : "") || "").trim();
                const lastB = (b.lastName || (typeof namePartsFromRecord === "function" ? namePartsFromRecord(b).lastName : "") || "").trim();
                return lastA.localeCompare(lastB, undefined, { sensitivity: "base" });
            }
            case "first-name-desc": {
                const firstA = (a.firstName || (typeof namePartsFromRecord === "function" ? namePartsFromRecord(a).firstName : "") || "").trim();
                const firstB = (b.firstName || (typeof namePartsFromRecord === "function" ? namePartsFromRecord(b).firstName : "") || "").trim();
                const cmp = firstB.localeCompare(firstA, undefined, { sensitivity: "base" });
                if (cmp !== 0) return cmp;
                const lastA = (a.lastName || (typeof namePartsFromRecord === "function" ? namePartsFromRecord(a).lastName : "") || "").trim();
                const lastB = (b.lastName || (typeof namePartsFromRecord === "function" ? namePartsFromRecord(b).lastName : "") || "").trim();
                return lastB.localeCompare(lastA, undefined, { sensitivity: "base" });
            }
            case "name-asc": {
                const nameA = (a.name || `${a.firstName || ""} ${a.lastName || ""}`).trim();
                const nameB = (b.name || `${b.firstName || ""} ${b.lastName || ""}`).trim();
                return nameA.localeCompare(nameB, undefined, { sensitivity: "base" });
            }
            case "name-desc": {
                const nameA = (a.name || `${a.firstName || ""} ${a.lastName || ""}`).trim();
                const nameB = (b.name || `${b.firstName || ""} ${b.lastName || ""}`).trim();
                return nameB.localeCompare(nameA, undefined, { sensitivity: "base" });
            }
            case "exp-asc": {
                const expA = a.updatedExpirationDate || a.exp || "";
                const expB = b.updatedExpirationDate || b.exp || "";
                const timeA = expA ? new Date(expA + "T00:00:00").getTime() : Infinity;
                const timeB = expB ? new Date(expB + "T00:00:00").getTime() : Infinity;
                return timeA - timeB;
            }
            case "exp-desc": {
                const expA = a.updatedExpirationDate || a.exp || "";
                const expB = b.updatedExpirationDate || b.exp || "";
                const timeA = expA ? new Date(expA + "T00:00:00").getTime() : 0;
                const timeB = expB ? new Date(expB + "T00:00:00").getTime() : 0;
                return timeB - timeA;
            }
            default:
                return 0;
        }
    });

    // Update Result Counter
    const countEl = document.getElementById("customerResultCount");
    if (countEl) {
        if (allRows.length === 0) {
            countEl.textContent = "0 members";
        } else if (filteredRows.length === allRows.length) {
            countEl.textContent = `Showing all ${allRows.length} member${allRows.length === 1 ? "" : "s"}`;
        } else {
            countEl.textContent = `Showing ${filteredRows.length} of ${allRows.length} member${allRows.length === 1 ? "" : "s"}`;
        }
    }

    // Highlight active stat card
    document.querySelectorAll(".stat-card[data-status-filter]").forEach(card => {
        card.classList.toggle("is-active", card.dataset.statusFilter === filters.status);
    });

    tbody.innerHTML = "";
    if (allRows.length === 0) {
        tbody.innerHTML = '<tr><td colspan="16" style="text-align: center; padding: 32px 16px; color: var(--text-secondary);">No customers found.</td></tr>';
        updateBulkActionBar(filteredRows);
        return;
    }

    if (filteredRows.length === 0) {
        tbody.innerHTML = '<tr><td colspan="16" style="text-align: center; padding: 32px 16px; color: var(--text-secondary);">No members match your filter criteria. <button type="button" onclick="resetCustomerDirectoryFilters()" style="color: var(--primary); text-decoration: underline; background: none; border: none; font-weight: 600; cursor: pointer;">Reset filters</button> to view all members.</td></tr>';
        updateBulkActionBar(filteredRows);
        return;
    }

    filteredRows.forEach(c => {
        const memberStatus = getMemberStatus(c, today);
        const cls = memberStatus === "Active" ? "active" : memberStatus === "Frozen" ? "warning" : (memberStatus === "Expired" ? "danger" : (memberStatus === "Expiring Soon" ? "warning" : "active"));
        const renewBtn = memberStatus !== "Frozen" && membershipNeedsRenewal(c, today)
            ? `<button class="btn-renew" onclick="renewMemberById('${encodeURIComponent(c.id)}')">Renew</button>`
            : "";
        let freezeBtn = `<button class="btn-freeze" onclick="openFreezeModal('${c.id}')">Freeze</button>`;
        if (memberStatus === "Frozen") {
            freezeBtn = `<button class="btn-unfreeze" onclick="unfreezeMember('${c.id}')">Unfreeze</button>`;
        }
        const expDisplay = c.updatedExpirationDate || c.exp || "—";
        const genderDisplay = c.gender === "Other" && c.genderIdentity
            ? `Other (${c.genderIdentity})`
            : (c.gender || "—");
        let statusHtml = `<span class="badge ${cls}">${memberStatus}</span>`;
        if (memberStatus === "Frozen" && c.freezeEndDate) {
            statusHtml = `<span class="badge ${cls}">● Frozen<br/>Until ${c.freezeEndDate}</span>`;
        }
        const isChecked = window.selectedMemberIds && window.selectedMemberIds.has(String(c.id));
        const tr = document.createElement("tr");
        if (isChecked) tr.classList.add("is-selected");
        tr.innerHTML = `
            <td class="td-checkbox">
                <input type="checkbox" class="member-select-checkbox" data-member-id="${encodeURIComponent(c.id)}" ${isChecked ? "checked" : ""} aria-label="Select ${escapeHtml(c.name || 'member')}">
            </td>
            <td>${escapeHtml(c.firstName || "—")}</td>
            <td>${escapeHtml(c.middleName || "—")}</td>
            <td>${escapeHtml(c.lastName || "—")}</td>
            <td>${escapeHtml(c.suffix || "—")}</td>
            <td>${escapeHtml(genderDisplay)}</td>
            <td>${escapeHtml(c.birthday || "—")}</td>
            <td>${escapeHtml(c.email || "—")}</td>
            <td>${escapeHtml(c.phone || "—")}</td>
            <td class="cell-address">${escapeHtml(c.address || "—")}</td>
            <td>${escapeHtml(c.keyFob || "—")}</td>
            <td>${escapeHtml(c.tier || "—")}</td>
            <td>${escapeHtml(c.joined || "—")}</td>
            <td>${escapeHtml(expDisplay)}</td>
            <td>${statusHtml}</td>
            <td>
                <div class="row-actions">
                    ${renewBtn}
                    <button class="btn-view" onclick="openEditCustomer('${encodeURIComponent(c.id)}')">Edit</button>
                    ${freezeBtn}
                    <button class="btn-archive" onclick="archiveMember('${encodeURIComponent(c.id)}')">Archive</button>
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });

    updateBulkActionBar(filteredRows);
}

// Helper to trigger UI refreshes across the CRM
function notifyDirectoryViewsChanged() {
    if (typeof refreshMembershipViews === "function") {
        refreshMembershipViews();
    } else {
        renderCustomerDirectory();
        if (typeof renderArchivedMembers === "function") renderArchivedMembers();
        if (typeof countExpiringMembers === "function") countExpiringMembers();
        if (typeof countActiveMembers === "function") countActiveMembers();
    }
}

// Bulk Action: Renew eligible members
window.bulkRenewMembers = function() {
    const selectedIds = Array.from(window.selectedMemberIds || []);
    if (selectedIds.length === 0) {
        alert("Please select at least one member to renew.");
        return;
    }

    const today = todayStart();
    const allMembers = getDirectoryCustomers();
    const selectedMembers = selectedIds
        .map(id => allMembers.find(c => String(c.id) === String(id)))
        .filter(Boolean);

    // Eligible: not archived, not frozen, due for renewal, has tier
    const eligible = selectedMembers.filter(m =>
        !memberIsArchived(m) &&
        getMemberStatus(m, today) !== "Frozen" &&
        membershipNeedsRenewal(m, today) &&
        Boolean(m.tier)
    );

    const frozen = selectedMembers.filter(m => getMemberStatus(m, today) === "Frozen");
    const notDue = selectedMembers.filter(m =>
        !memberIsArchived(m) &&
        getMemberStatus(m, today) !== "Frozen" &&
        !membershipNeedsRenewal(m, today)
    );

    if (eligible.length === 0) {
        let msg = "None of the selected members are currently due for renewal (Expiring Soon or Expired).\n\n";
        if (notDue.length > 0) {
            msg += `• ${notDue.length} member(s) are active and not within 30 days of expiration.\n`;
        }
        if (frozen.length > 0) {
            msg += `• ${frozen.length} member(s) are frozen and cannot be renewed until unfrozen.\n`;
        }
        alert(msg);
        return;
    }

    const previewList = eligible.slice(0, 5).map(m => {
        const nextExp = renewalExpirationFor(m, today);
        return `• ${m.name || "Member"} (${m.tier}) → New expiration: ${nextExp}`;
    }).join("\n") + (eligible.length > 5 ? `\n...and ${eligible.length - 5} more` : "");

    let confirmMsg = `Renew ${eligible.length} member(s)?\n\n${previewList}\n\n`;
    if (notDue.length > 0 || frozen.length > 0) {
        confirmMsg += `Note: ${notDue.length + frozen.length} selected member(s) not due or frozen will be skipped.\n\n`;
    }
    confirmMsg += "Please confirm the renewal payments at the front desk before proceeding.";

    if (!confirm(confirmMsg)) return;

    let renewedCount = 0;
    eligible.forEach(m => {
        const nextExp = renewalExpirationFor(m, today);
        if (!nextExp) return;
        const previousExp = m.exp || "";
        const months = tierDurationMonths(m.tier);

        if (updateDirectoryExpiration(m.id, nextExp)) {
            renewedCount++;
            if (typeof logActivity === "function") {
                logActivity({
                    type: "membership",
                    title: `${m.name || "A member"}'s membership was renewed`,
                    meta: `${m.tier} • +${months} months • ${previousExp ? `Was expiring ${previousExp}` : "Expired"} • Now expires ${nextExp}`,
                    href: typeof activityHref === "function" ? activityHref("members.html", m.name) : "members.html"
                });
            }
        }
    });

    window.selectedMemberIds.clear();
    notifyDirectoryViewsChanged();
    alert(`Successfully renewed ${renewedCount} member(s)!`);
};

// Bulk Action: Open Freeze Modal
window.openBulkFreezeModal = function() {
    const selectedIds = Array.from(window.selectedMemberIds || []);
    if (selectedIds.length === 0) {
        alert("Please select at least one member to freeze.");
        return;
    }

    const today = todayStart();
    const allMembers = getDirectoryCustomers();
    const selectedMembers = selectedIds
        .map(id => allMembers.find(c => String(c.id) === String(id)))
        .filter(Boolean);

    // Eligible: not already frozen, not expired, not archived
    const eligible = selectedMembers.filter(m => {
        const status = getMemberStatus(m, today);
        return status !== "Frozen" && status !== "Expired" && !memberIsArchived(m);
    });

    const alreadyFrozen = selectedMembers.filter(m => getMemberStatus(m, today) === "Frozen");
    const expired = selectedMembers.filter(m => getMemberStatus(m, today) === "Expired");

    if (eligible.length === 0) {
        alert("None of the selected members are eligible for freeze. Expired, already frozen, or archived members cannot be frozen.");
        return;
    }

    const modal = document.getElementById("bulkFreezeModal");
    if (!modal) return;

    const summaryEl = document.getElementById("bulkFreezeSummary");
    if (summaryEl) {
        let summaryHtml = `<div class="bulk-summary-card">
            <p><strong>${eligible.length}</strong> member(s) will be frozen.</p>`;
        if (alreadyFrozen.length > 0 || expired.length > 0) {
            summaryHtml += `<p class="card-meta" style="margin-top: 4px; color: var(--warning-ink);">
                Note: ${alreadyFrozen.length} already frozen and ${expired.length} expired member(s) will be skipped.
            </p>`;
        }
        summaryHtml += `<ul class="bulk-members-preview-list" style="margin-top: 8px; max-height: 120px; overflow-y: auto;">
            ${eligible.slice(0, 10).map(m => `<li>${escapeHtml(m.name || "Member")} <small>(${escapeHtml(m.tier || "No tier")})</small></li>`).join("")}
            ${eligible.length > 10 ? `<li><em>...and ${eligible.length - 10} more</em></li>` : ""}
        </ul></div>`;
        summaryEl.innerHTML = summaryHtml;
    }

    document.getElementById("bulkFreezeMonths").value = "";
    document.getElementById("bulkFreezeError").textContent = "";
    modal.style.display = "flex";
};

// Bulk Action: Confirm Freeze
window.confirmBulkFreeze = function() {
    const months = parseInt(document.getElementById("bulkFreezeMonths").value);
    const errorEl = document.getElementById("bulkFreezeError");
    if (!months || months < 1 || months > 6) {
        errorEl.textContent = "Please select freeze duration (1-6 months).";
        return;
    }

    const selectedIds = Array.from(window.selectedMemberIds || []);
    const today = todayStart();
    const allMembers = getDirectoryCustomers();
    const selectedMembers = selectedIds
        .map(id => allMembers.find(c => String(c.id) === String(id)))
        .filter(Boolean);

    const eligible = selectedMembers.filter(m => {
        const status = getMemberStatus(m, today);
        return status !== "Frozen" && status !== "Expired" && !memberIsArchived(m);
    });

    const todayDate = new Date();
    const startStr = todayDate.toISOString().split("T")[0];
    const endStr = addMonthsSafe(startStr, months);

    let frozenCount = 0;
    eligible.forEach(record => {
        const success = mutateMemberRecord(record.id, rec => {
            const currentExp = rec.updatedExpirationDate || rec.exp || "";
            const newExp = addMonthsSafe(currentExp || startStr, months);
            rec.status = "Frozen";
            rec.freezeStartDate = startStr;
            rec.freezeEndDate = endStr;
            rec.freezeMonths = months;
            rec.originalExpirationDate = rec.originalExpirationDate || currentExp || null;
            rec.updatedExpirationDate = newExp;
            rec.exp = newExp;
        });

        if (success) {
            frozenCount++;
            const memberName = record.name || "A member";
            if (typeof logActivity === "function") {
                logActivity({
                    type: "frozen",
                    title: `${memberName}'s membership was frozen for ${months} month${months === 1 ? "" : "s"}`,
                    meta: `${record.tier || "Membership"} • Frozen until ${endStr}`,
                    href: typeof activityHref === "function" ? activityHref("members.html", memberName) : "members.html"
                });
            }
        }
    });

    document.getElementById("bulkFreezeModal").style.display = "none";
    window.selectedMemberIds.clear();
    notifyDirectoryViewsChanged();
    alert(`Successfully froze ${frozenCount} member(s) for ${months} month(s).`);
};

// Bulk Action: Unfreeze members
window.bulkUnfreezeMembers = function() {
    const selectedIds = Array.from(window.selectedMemberIds || []);
    if (selectedIds.length === 0) {
        alert("Please select at least one member to unfreeze.");
        return;
    }

    const today = todayStart();
    const allMembers = getDirectoryCustomers();
    const selectedMembers = selectedIds
        .map(id => allMembers.find(c => String(c.id) === String(id)))
        .filter(Boolean);

    const frozenMembers = selectedMembers.filter(m => getMemberStatus(m, today) === "Frozen");

    if (frozenMembers.length === 0) {
        alert("None of the selected members are currently frozen.");
        return;
    }

    const previewList = frozenMembers.slice(0, 5).map(m =>
        `• ${m.name || "Member"} (Frozen until: ${m.freezeEndDate || "—"})`
    ).join("\n") + (frozenMembers.length > 5 ? `\n...and ${frozenMembers.length - 5} more` : "");

    if (!confirm(`End membership freeze early for ${frozenMembers.length} member(s)?\n\n${previewList}`)) {
        return;
    }

    let unfrozenCount = 0;
    frozenMembers.forEach(m => {
        const frozenUntil = m.freezeEndDate || "";
        if (unfreezeMemberById(m.id)) {
            unfrozenCount++;
            const name = m.name || "A member";
            if (typeof logActivity === "function") {
                logActivity({
                    type: "membership",
                    title: `${name}'s membership freeze was ended early`,
                    meta: `Was frozen until ${frozenUntil || "further notice"} • Expires ${m.updatedExpirationDate || m.exp || "—"}`,
                    href: typeof activityHref === "function" ? activityHref("members.html", name) : "members.html"
                });
            }
        }
    });

    window.selectedMemberIds.clear();
    notifyDirectoryViewsChanged();
    alert(`Successfully unfrozen ${unfrozenCount} member(s)!`);
};

// Bulk Action: Open Change Tier Modal
window.openBulkChangeTierModal = function() {
    const selectedIds = Array.from(window.selectedMemberIds || []);
    if (selectedIds.length === 0) {
        alert("Please select at least one member to change their tier.");
        return;
    }

    const allMembers = getDirectoryCustomers();
    const selectedMembers = selectedIds
        .map(id => allMembers.find(c => String(c.id) === String(id)))
        .filter(m => m && !memberIsArchived(m));

    if (selectedMembers.length === 0) {
        alert("No valid active members selected.");
        return;
    }

    const modal = document.getElementById("bulkChangeTierModal");
    if (!modal) return;

    // Populate tier select options from PIPELINE_TIERS
    const select = document.getElementById("bulkTierSelect");
    if (select && typeof PIPELINE_TIERS !== "undefined") {
        select.innerHTML = PIPELINE_TIERS.map(tier =>
            `<option value="${escapeHtml(tier.value)}">${escapeHtml(tier.label)}</option>`
        ).join("");
    }

    const summaryEl = document.getElementById("bulkTierSummary");
    if (summaryEl) {
        summaryEl.innerHTML = `<div class="bulk-summary-card">
            <p><strong>${selectedMembers.length}</strong> member(s) will have their membership tier updated.</p>
            <ul class="bulk-members-preview-list" style="margin-top: 8px; max-height: 120px; overflow-y: auto;">
                ${selectedMembers.slice(0, 10).map(m => `<li>${escapeHtml(m.name || "Member")} <small>(Current: ${escapeHtml(m.tier || "None")})</small></li>`).join("")}
                ${selectedMembers.length > 10 ? `<li><em>...and ${selectedMembers.length - 10} more</em></li>` : ""}
            </ul>
        </div>`;
    }

    document.getElementById("bulkTierError").textContent = "";
    modal.style.display = "flex";
};

// Bulk Action: Confirm Change Tier
window.confirmBulkChangeTier = function() {
    const newTier = document.getElementById("bulkTierSelect").value;
    const policy = document.getElementById("bulkTierExpPolicy").value;
    const errorEl = document.getElementById("bulkTierError");

    if (!newTier) {
        errorEl.textContent = "Please select a membership tier.";
        return;
    }

    const months = tierDurationMonths(newTier);
    if (!months) {
        errorEl.textContent = "Invalid membership tier selected.";
        return;
    }

    const selectedIds = Array.from(window.selectedMemberIds || []);
    const allMembers = getDirectoryCustomers();
    const selectedMembers = selectedIds
        .map(id => allMembers.find(c => String(c.id) === String(id)))
        .filter(m => m && !memberIsArchived(m));

    let updatedCount = 0;
    const today = todayStart();

    selectedMembers.forEach(m => {
        let nextExp = "";
        if (policy === "recalculate-join") {
            const base = m.joined && m.joined !== "—" ? new Date(`${m.joined}T00:00:00`) : today;
            nextExp = computeExpirationDate(months, isNaN(base.getTime()) ? today : base);
        } else if (policy === "extend-current") {
            const currentExp = m.updatedExpirationDate || m.exp;
            const base = currentExp && currentExp !== "—" ? new Date(`${currentExp}T00:00:00`) : today;
            nextExp = computeExpirationDate(months, isNaN(base.getTime()) ? today : base);
        } else {
            // reset-today
            nextExp = computeExpirationDate(months, today);
        }

        const success = mutateMemberRecord(m.id, rec => {
            rec.tier = newTier;
            if (nextExp) {
                rec.exp = nextExp;
                rec.updatedExpirationDate = nextExp;
            }
        });

        if (success) {
            updatedCount++;
            const memberName = m.name || "A member";
            if (typeof logActivity === "function") {
                logActivity({
                    type: "membership",
                    title: `${memberName}'s tier was changed to ${newTier}`,
                    meta: `New term: ${months} months • Expires ${nextExp || "—"}`,
                    href: typeof activityHref === "function" ? activityHref("members.html", memberName) : "members.html"
                });
            }
        }
    });

    document.getElementById("bulkChangeTierModal").style.display = "none";
    window.selectedMemberIds.clear();
    notifyDirectoryViewsChanged();
    alert(`Successfully updated membership tier to "${newTier}" for ${updatedCount} member(s)!`);
};

// Bulk Action: Archive selected members
window.bulkArchiveMembers = function() {
    const selectedIds = Array.from(window.selectedMemberIds || []);
    if (selectedIds.length === 0) {
        alert("Please select at least one member to archive.");
        return;
    }

    const allMembers = getDirectoryCustomers();
    const selectedMembers = selectedIds
        .map(id => allMembers.find(c => String(c.id) === String(id)))
        .filter(m => m && !memberIsArchived(m));

    if (selectedMembers.length === 0) {
        alert("No valid active members selected.");
        return;
    }

    const previewNames = selectedMembers.slice(0, 5).map(m => `• ${m.name || "Member"}`).join("\n") +
        (selectedMembers.length > 5 ? `\n...and ${selectedMembers.length - 5} more` : "");

    if (!confirm(`Archive ${selectedMembers.length} selected member(s)?\n\n${previewNames}\n\nTheir records will be moved to the Past Members Archive and can be restored at any time.`)) {
        return;
    }

    let archivedCount = 0;
    selectedMembers.forEach(m => {
        if (archiveMemberById(m.id)) {
            archivedCount++;
            if (typeof logActivity === "function") {
                logActivity({
                    type: "membership",
                    title: `${m.name || "A member"} was archived as a past member`,
                    meta: `${m.tier || "Membership"} • Joined ${m.joined || "—"} • Expires ${m.updatedExpirationDate || m.exp || "—"}`,
                    href: typeof activityHref === "function" ? activityHref("members.html", m.name) : "members.html"
                });
            }
        }
    });

    window.selectedMemberIds.clear();
    notifyDirectoryViewsChanged();
    alert(`Successfully archived ${archivedCount} member(s).`);
};

// Bulk Action: Export to CSV
window.bulkExportMembersCsv = function() {
    const selectedIds = Array.from(window.selectedMemberIds || []);
    if (selectedIds.length === 0) {
        alert("Please select at least one member to export.");
        return;
    }

    const today = todayStart();
    const allMembers = getDirectoryCustomers();
    const selectedMembers = selectedIds
        .map(id => allMembers.find(c => String(c.id) === String(id)))
        .filter(Boolean);

    if (selectedMembers.length === 0) {
        alert("No member data found for export.");
        return;
    }

    const headers = [
        "First Name",
        "Middle Name",
        "Last Name",
        "Suffix",
        "Gender",
        "Birthday",
        "Email",
        "Phone",
        "Address",
        "Key Fob Number",
        "Membership Tier",
        "Date Joined",
        "Expiration Date",
        "Status"
    ];

    const escapeCsv = val => {
        const str = String(val === null || val === undefined ? "" : val);
        if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
            return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
    };

    const rows = selectedMembers.map(m => {
        const status = getMemberStatus(m, today);
        const exp = m.updatedExpirationDate || m.exp || "—";
        const gender = m.gender === "Other" && m.genderIdentity
            ? `Other (${m.genderIdentity})`
            : (m.gender || "—");
        return [
            escapeCsv(m.firstName || "—"),
            escapeCsv(m.middleName || "—"),
            escapeCsv(m.lastName || "—"),
            escapeCsv(m.suffix || "—"),
            escapeCsv(gender),
            escapeCsv(m.birthday || "—"),
            escapeCsv(m.email || "—"),
            escapeCsv(m.phone || "—"),
            escapeCsv(m.address || "—"),
            escapeCsv(m.keyFob || "—"),
            escapeCsv(m.tier || "—"),
            escapeCsv(m.joined || "—"),
            escapeCsv(exp),
            escapeCsv(status)
        ].join(",");
    });

    const csvContent = "\uFEFF" + [headers.join(","), ...rows].join("\r\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const todayStr = new Date().toISOString().split("T")[0];
    a.href = url;
    a.download = `anytime-fitness-members-selected-${todayStr}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
};

// Bulk Action: Export to PDF
window.bulkExportMembersPdf = function(btn) {
    const selectedIds = Array.from(window.selectedMemberIds || []);
    if (selectedIds.length === 0) {
        alert("Please select at least one member to export.");
        return;
    }

    const allMembers = getDirectoryCustomers();
    const selectedMembers = selectedIds
        .map(id => allMembers.find(c => String(c.id) === String(id)))
        .filter(m => m && !memberIsArchived(m));

    if (typeof exportMembershipReportPdf === "function") {
        exportMembershipReportPdf(btn, selectedMembers, "Selected Members Directory Report");
    } else {
        alert("PDF export is not available.");
    }
};

// Past members kept on file. Read-only apart from Restore, because the point of
// the archive is the record: tiers, dates and history stay exactly as they were.


// js-split:file=members.js part=13of14
// Split from script.js - whole top-level blocks moved verbatim, no behavior change.
function renderArchivedMembers() {
    const tbody = document.getElementById("archivedTableBody");
    if (!tbody) return;

    const rows = getArchivedDirectoryCustomers();
    tbody.innerHTML = "";
    if (rows.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7">No archived members yet. Archiving a member keeps their record here.</td></tr>';
        return;
    }

    rows.forEach(c => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td>${escapeHtml(c.name)}</td>
            <td>${escapeHtml(c.contact || "—")}</td>
            <td>${escapeHtml(c.keyFob || "—")}</td>
            <td>${escapeHtml(c.tier || "—")}</td>
            <td>${escapeHtml(c.joined || "—")}</td>
            <td>${escapeHtml(c.updatedExpirationDate || c.exp || "—")}</td>
            <td>
                <div class="row-actions">
                    <span class="badge open">Archived</span>
                    <button class="btn-restore" onclick="restoreMember('${encodeURIComponent(c.id)}')">Restore</button>
                    <button class="btn-delete" onclick="permanentlyDeleteMember('${encodeURIComponent(c.id)}')">Delete Permanently</button>
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// ---- Dashboard Charts ----
// Charts are drawn as inline SVG so the portal keeps zero dependencies and
// still works when opened straight from the filesystem. Each metric is drawn by
// the renderer that fits the shape of its data rather than by one bar function:
// a donut for a part-to-whole split, ranked horizontal bars for comparing
// categories, an area line for a time series, one mix bar for a proportion,
// and a funnel for ordered pipeline stages.


// js-split:file=members.js part=14of14
// Split from script.js - whole top-level blocks moved verbatim, no behavior change.
function memberMembershipStatus(member, today) {
    if (!member || !member.tier) return "Inactive";
    return getMemberStatus(member, today);
}

