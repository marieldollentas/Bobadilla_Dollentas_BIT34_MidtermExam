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
    const topbar = document.getElementById("topbarSearch");

    if (searchEl) searchEl.value = "";
    if (topbar) topbar.value = "";
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

function renderCustomerDirectory() {
    const tbody = document.getElementById("customerTableBody");
    if (!tbody) return;

    initCustomerDirectoryFilters();

    const today = todayStart();
    const allRows = getActiveDirectoryCustomers();
    const filters = getCustomerDirectoryFilters();

    // Filter rows by search, status, and tier
    const filteredRows = allRows.filter(c => {
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
        tbody.innerHTML = '<tr><td colspan="15" style="text-align: center; padding: 32px 16px; color: var(--text-secondary);">No customers found.</td></tr>';
        return;
    }

    if (filteredRows.length === 0) {
        tbody.innerHTML = '<tr><td colspan="15" style="text-align: center; padding: 32px 16px; color: var(--text-secondary);">No members match your filter criteria. <button type="button" onclick="resetCustomerDirectoryFilters()" style="color: var(--primary); text-decoration: underline; background: none; border: none; font-weight: 600; cursor: pointer;">Reset filters</button> to view all members.</td></tr>';
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
        const tr = document.createElement("tr");
        tr.innerHTML = `
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
}

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

