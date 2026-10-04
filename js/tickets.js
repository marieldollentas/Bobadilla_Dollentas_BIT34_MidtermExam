// js-split:file=tickets.js part=1of10
// Split from script.js - whole top-level blocks moved verbatim, no behavior change.
let pendingTicket = null;


// js-split:file=tickets.js part=2of10
// Split from script.js - whole top-level blocks moved verbatim, no behavior change.
let pendingArchive = null;



// js-split:file=tickets.js part=3of10
// Split from script.js - whole top-level blocks moved verbatim, no behavior change.
function renderStaffTickets() {
    const tbody = document.getElementById("staffTicketsBody");
    if (!tbody) return;

    const filters = tableFilters();
    const tickets = getTicketStorage("staff")
        .filter(t => !t.archived)
        .filter(t => matchesFilters(t, filters, "Staff", t.contact))
        .sort((a, b) => String(b.id) - String(a.id));
    tbody.innerHTML = "";
    if (tickets.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7">No staff tickets match.</td></tr>';
        return;
    }

    tickets.forEach(t => {
        const resolved = String(t.status || "").toLowerCase() === "resolved";
        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td>${formatDateLogged(t.date)}</td>
            <td>${t.name}</td>
            <td>${t.contact || "—"}</td>
            <td>${t.issue}${commentsSummary(t)}</td>
            <td><span class="badge ${priorityClass(t.priority)}">${t.priority}</span></td>
            <td><span class="badge status-badge ${statusClass(t.status)}">${t.status}</span></td>
            <td>
                <button class="btn-view" onclick="openTicketDetails(${t.id}, 'staff', this)">View / Comment</button>
                ${resolved ? `<button class="btn-archive" onclick="requestArchiveTicket(${t.id}, 'staff')">Archive</button>` : ""}
            </td>
        `;
        tbody.appendChild(tr);
    });
}



// js-split:file=tickets.js part=4of10
// Split from script.js - whole top-level blocks moved verbatim, no behavior change.
function renderCustomerInquiries() {
    const tbody = document.getElementById("customerInquiriesBody");
    if (!tbody) return;

    const filters = tableFilters();
    const inquiries = getTicketStorage("customer")
        .filter(i => !i.archived)
        .filter(i => matchesFilters(i, filters, "Portal", [i.email, i.phone, i.address].filter(Boolean).join(" ")))
        .sort((a, b) => String(b.id) - String(a.id));
    tbody.innerHTML = "";
    if (inquiries.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7">No customer portal inquiries match.</td></tr>';
        return;
    }

    inquiries.forEach(inq => {
        const resolved = String(inq.status || "").toLowerCase() === "resolved";
        const contact = [inq.email, inq.phone, inq.address].filter(Boolean).join(" | ") || "—";
        // A portal renewal request is an inquiry like any other, but it carries
        // a badge so the front desk can spot the renewal work immediately.
        const renewalBadge = inq.kind === RENEWAL_REQUEST_KIND
            ? '<span class="badge renewal">Renewal</span>'
            : "";
        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td>${formatDateLogged(inq.date)}</td>
            <td>${inq.name}</td>
            <td>${contact}</td>
            <td>${inq.message}${commentsSummary(inq)}</td>
            <td><span class="badge ${priorityClass(inq.priority)}">${inq.priority}</span>${renewalBadge}</td>
            <td><span class="badge status-badge ${statusClass(inq.status)}">${inq.status}</span></td>
            <td>
                <button class="btn-view" onclick="openTicketDetails(${inq.id}, 'customer', this)">View / Reply</button>
                ${resolved ? `<button class="btn-archive" onclick="requestArchiveTicket(${inq.id}, 'customer')">Archive</button>` : ""}
            </td>
        `;
        tbody.appendChild(tr);
    });
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
            date: new Date().toLocaleString()
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

// ---- Sales Pipeline (Prospecting Clients) ----
