// js-split:file=tickets.js part=1of10
// Split from script.js - whole top-level blocks moved verbatim, no behavior change.
let pendingTicket = null;


// js-split:file=tickets.js part=2of10
// Split from script.js - whole top-level blocks moved verbatim, no behavior change.
let pendingDelete = null;



// js-split:file=tickets.js part=3of10
// Split from script.js - whole top-level blocks moved verbatim, no behavior change.
function renderStaffTickets() {
    const tbody = document.getElementById("staffTicketsBody");
    if (!tbody) return;

    const filters = tableFilters();
    const tickets = getTicketStorage("staff")
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
                ${resolved ? `<button class="btn-delete" onclick="requestDeleteTicket(${t.id}, 'staff')">Delete</button>` : ""}
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
                ${resolved ? `<button class="btn-delete" onclick="requestDeleteTicket(${inq.id}, 'customer')">Delete</button>` : ""}
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
    document.getElementById("deleteFromDetails").style.display = String(item.status || "").toLowerCase() === "resolved" ? "inline-block" : "none";
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

// Open the delete confirmation dialog


// js-split:file=tickets.js part=7of10
// Split from script.js - whole top-level blocks moved verbatim, no behavior change.
function requestDeleteTicket(id, source) {
    const modal = document.getElementById("deleteConfirmModal");
    if (!modal) return;

    pendingDelete = { source, id };
    document.getElementById("deleteConfirmMessage").textContent =
        "Are you sure you want to permanently delete this ticket? This action cannot be undone.";
    modal.style.display = "flex";
}



// js-split:file=tickets.js part=8of10
// Split from script.js - whole top-level blocks moved verbatim, no behavior change.
function confirmDeleteTicket() {
    if (!pendingDelete) return;
    const { source, id } = pendingDelete;

    const list = getTicketStorage(source).filter(x => String(x.id) !== String(id));
    saveTicketStorage(source, list);

    pendingDelete = null;
    document.getElementById("deleteConfirmModal").style.display = "none";

    renderStaffTickets();
    renderCustomerInquiries();
    if (typeof renderMyInquiries === "function") renderMyInquiries();
    getOpenTicketsCount();
}



// js-split:file=tickets.js part=9of10
// Split from script.js - whole top-level blocks moved verbatim, no behavior change.
function getOpenTicketsCount() {
    const all = [
        ...JSON.parse(localStorage.getItem("crmStaffTickets") || "[]"),
        ...JSON.parse(localStorage.getItem("crmInquiries") || "[]")
    ];
    const count = all.filter(t => {
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
