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
function renderCustomerDirectory() {
    const tbody = document.getElementById("customerTableBody");
    if (!tbody) return;

    const today = todayStart();

    // Archived members are past members: they live in the archive table below
    // this one, never in the active directory.
    const rows = getActiveDirectoryCustomers();
    tbody.innerHTML = "";
    if (rows.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8">No customers found.</td></tr>';
        return;
    }

    rows.forEach(c => {
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
        let statusHtml = `<span class="badge ${cls}">${memberStatus}</span>`;
        if (memberStatus === "Frozen" && c.freezeEndDate) {
            statusHtml = `<span class="badge ${cls}">● Frozen<br/>Until ${c.freezeEndDate}</span>`;
        }
        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td>${escapeHtml(c.name)}</td>
            <td>${escapeHtml(c.contact || "—")}</td>
            <td>${escapeHtml(c.keyFob || "—")}</td>
            <td>${escapeHtml(c.tier)}</td>
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

