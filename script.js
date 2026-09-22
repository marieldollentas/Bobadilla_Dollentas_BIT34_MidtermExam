document.addEventListener("DOMContentLoaded", () => {
    // Dashboard stat helpers (shared via localStorage across pages)
    const EXPIRE_KEY = "crmExpiringCount";
    const TICKETS_KEY = "crmOpenTicketsCount";
    const DAY_MS = 24 * 60 * 60 * 1000;

    function syncDashboard() {
        const expiringEl = document.getElementById("statExpiring");
        const ticketsEl = document.getElementById("statOpenTickets");
        if (expiringEl) expiringEl.textContent = localStorage.getItem(EXPIRE_KEY) || "0";
        if (ticketsEl) ticketsEl.textContent = localStorage.getItem(TICKETS_KEY) || "0";
    }

    function countExpiringMembers() {
        const rows = document.querySelectorAll("#customerTableBody tr");
        let count = 0;
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        rows.forEach(row => {
            const cells = row.querySelectorAll("td");
            const statusEl = row.querySelector(".badge");
            const expCell = cells[4];
            const status = statusEl ? statusEl.textContent.trim().toLowerCase() : "";

            if (status === "expiring soon") {
                count++;
                return;
            }

            if (expCell) {
                const expDate = new Date(expCell.textContent.trim());
                if (!isNaN(expDate)) {
                    const diff = (expDate - today) / DAY_MS;
                    if (diff >= 0 && diff <= 30) count++;
                }
            }
        });

        localStorage.setItem(EXPIRE_KEY, count);
        return count;
    }

    function countOpenTickets() {
        const tables = [document.querySelectorAll("#staffTicketsBody tr"), document.querySelectorAll("#customerInquiriesBody tr")];
        let count = 0;

        tables.forEach(rows => {
            rows.forEach(row => {
                const statusEl = row.querySelector(".badge");
                const status = statusEl ? statusEl.textContent.trim().toLowerCase() : "";
                if (status === "open" || status === "in progress") count++;
            });
        });

        localStorage.setItem(TICKETS_KEY, count);
        return count;
    }

    // Seed default staff tickets on first run
    if (!localStorage.getItem("crmStaffTickets")) {
        const today = new Date().toISOString().split("T")[0];
        localStorage.setItem("crmStaffTickets", JSON.stringify([
            {
                id: 1,
                date: today,
                name: "John Doe",
                contact: "john@example.com / 555-0192",
                issue: "Requested a 1-month membership freeze starting next week due to business travel.",
                priority: "Medium",
                status: "Open",
                reply: ""
            },
            {
                id: 2,
                date: today,
                name: "Jane Smith",
                contact: "jane@example.com / 555-8491",
                issue: "Lost key fob during evening workout; needs replacement and locker access reset.",
                priority: "High",
                status: "In Progress",
                reply: ""
            }
        ]));
    }

    // Modal Elements for Customer Directory
    const modal = document.getElementById("customerModal");
    const openModalBtn = document.getElementById("openCustomerModal");
    const closeBtn = document.querySelector(".close-btn");
    const customerForm = document.getElementById("customerForm");
    const customerTableBody = document.getElementById("customerTableBody");

    if (openModalBtn && modal) {
        openModalBtn.addEventListener("click", () => {
            modal.style.display = "flex";
        });

        closeBtn.addEventListener("click", () => {
            modal.style.display = "none";
        });

        window.addEventListener("click", (e) => {
            if (e.target === modal) {
                modal.style.display = "none";
            }
        });
    }

    // Customer Form Submission & Dynamic Insertion
    if (customerForm) {
        customerForm.addEventListener("submit", (e) => {
            e.preventDefault();

            const name = document.getElementById("newCustName").value.trim();
            const contact = document.getElementById("newCustEmail").value.trim();
            const tier = document.getElementById("newCustTier").value;
            const expDate = document.getElementById("newCustExp").value;
            const today = new Date().toISOString().split('T')[0];

            if (!name || !contact || !expDate) {
                alert("Please fill out all required fields.");
                return;
            }

            const newRow = document.createElement("tr");
            const expDateObj = new Date(expDate);
            const diffDays = ((expDateObj - new Date(today)) / (24 * 60 * 60 * 1000));
            const statusBadge = diffDays <= 30
                ? '<span class="badge warning">Expiring Soon</span>'
                : '<span class="badge active">Active</span>';

            newRow.innerHTML = `
                <td>${name}</td>
                <td>${contact}</td>
                <td>${tier}</td>
                <td>${today}</td>
                <td>${expDate}</td>
                <td>${statusBadge}</td>
            `;
            customerTableBody.appendChild(newRow);
            countExpiringMembers();

            customerForm.reset();
            modal.style.display = "none";
        });
    }

    // Real-Time Table Search Filter
    const searchInput = document.getElementById("searchCustomer");
    if (searchInput) {
        searchInput.addEventListener("input", (e) => {
            const term = e.target.value.toLowerCase();
            const rows = customerTableBody.getElementsByTagName("tr");

            Array.from(rows).forEach(row => {
                const text = row.textContent.toLowerCase();
                row.style.display = text.includes(term) ? "" : "none";
            });
        });
    }

    // Pipeline Kanban Filter Logic
    const filterStaff = document.getElementById("filterStaff");
    const filterTier = document.getElementById("filterTier");
    
    if (filterStaff && filterTier) {
        const applyFilters = () => {
            const staffVal = filterStaff.value;
            const tierVal = filterTier.value;
            const cards = document.querySelectorAll(".kanban-card");

            cards.forEach(card => {
                const cardStaff = card.getAttribute("data-staff");
                const cardTier = card.getAttribute("data-tier");

                const matchesStaff = (staffVal === "all" || cardStaff === staffVal);
                const matchesTier = (tierVal === "all" || cardTier === tierVal);

                card.style.display = (matchesStaff && matchesTier) ? "block" : "none";
            });
        };

        filterStaff.addEventListener("change", applyFilters);
        filterTier.addEventListener("change", applyFilters);
    }

    // Login / Register page logic
    const loginForm = document.getElementById("loginForm");
    const registerForm = document.getElementById("registerForm");
    const tabAdmin = document.getElementById("tabAdmin");
    const tabCustomer = document.getElementById("tabCustomer");

    if (tabAdmin && tabCustomer) {
        const switchTab = (role) => {
            const isAdmin = role === "admin";
            tabAdmin.classList.toggle("active", isAdmin);
            tabCustomer.classList.toggle("active", !isAdmin);
            document.getElementById("adminHint").style.display = isAdmin ? "block" : "none";
            document.getElementById("customerHint").style.display = isAdmin ? "none" : "block";
        };
        tabAdmin.addEventListener("click", () => switchTab("admin"));
        tabCustomer.addEventListener("click", () => switchTab("customer"));
    }

    if (loginForm) {
        loginForm.addEventListener("submit", (e) => {
            e.preventDefault();
            const username = document.getElementById("loginUsername").value.trim();
            const password = document.getElementById("loginPassword").value;
            const isAdmin = tabAdmin && tabAdmin.classList.contains("active");
            const errorEl = document.getElementById("loginError");

            if (isAdmin) {
                if (username === "admin" && password === "admin123") {
                    sessionStorage.setItem("crmRole", "admin");
                    location.href = "index.html";
                } else {
                    errorEl.textContent = "Invalid admin credentials.";
                }
                return;
            }

            const customers = JSON.parse(localStorage.getItem("crmCustomers") || "[]");
            const customer = customers.find(c => c.username === username && c.password === password);
            if (customer) {
                sessionStorage.setItem("crmRole", "customer");
                sessionStorage.setItem("crmCurrentUser", username);
                location.href = "customer.html";
            } else {
                errorEl.textContent = "Customer not found or invalid credentials.";
            }
        });
    }

    if (registerForm) {
        registerForm.addEventListener("submit", (e) => {
            e.preventDefault();
            const name = document.getElementById("regName").value.trim();
            const email = document.getElementById("regEmail").value.trim();
            const phone = document.getElementById("regPhone").value.trim();
            const address = document.getElementById("regAddress").value.trim();
            const tier = document.getElementById("regTier").value;
            const username = document.getElementById("regUsername").value.trim();
            const password = document.getElementById("regPassword").value;
            const confirm = document.getElementById("regConfirm").value;
            const errorEl = document.getElementById("regError");

            if (password !== confirm) {
                errorEl.textContent = "Passwords do not match.";
                return;
            }

            const customers = JSON.parse(localStorage.getItem("crmCustomers") || "[]");
            if (customers.some(c => c.username === username)) {
                errorEl.textContent = "Username already taken.";
                return;
            }

            customers.push({
                username,
                password,
                name,
                email,
                phone,
                address,
                tier,
                joined: new Date().toISOString().split("T")[0]
            });

            localStorage.setItem("crmCustomers", JSON.stringify(customers));
            errorEl.style.color = "#27ae60";
            errorEl.textContent = "Registration successful! Redirecting to login...";
            setTimeout(() => location.href = "login.html", 1500);
        });
    }

    // Customer portal page logic
    const portalPage = document.getElementById("welcomeName");
    if (portalPage) {
        const currentUser = sessionStorage.getItem("crmCurrentUser");
        if (!currentUser) {
            location.href = "login.html";
            return;
        }

        const customers = JSON.parse(localStorage.getItem("crmCustomers") || "[]");
        const customer = customers.find(c => c.username === currentUser);
        if (!customer) {
            location.href = "login.html";
            return;
        }

        document.getElementById("welcomeName").textContent = customer.name.split(" ")[0];
        document.getElementById("pName").textContent = customer.name;
        document.getElementById("pEmail").textContent = customer.email || "—";
        document.getElementById("pPhone").textContent = customer.phone || "—";
        document.getElementById("pAddress").textContent = customer.address || "—";
        document.getElementById("pTier").textContent = customer.tier;
        document.getElementById("pJoined").textContent = customer.joined;

        // Prefill inquiry box with customer details
        const inquireEmail = document.getElementById("inqEmail");
        const inquirePhone = document.getElementById("inqPhone");
        const inquireAddress = document.getElementById("inqAddress");
        if (inquireEmail) inquireEmail.value = customer.email || "";
        if (inquirePhone) inquirePhone.value = customer.phone || "";
        if (inquireAddress) inquireAddress.value = customer.address || "";

        const renderMyInquiries = () => {
            const inquiries = JSON.parse(localStorage.getItem("crmInquiries") || "[]")
                .filter(i => i.username === currentUser)
                .sort((a, b) => b.id - a.id);
            const tbody = document.getElementById("myInquiriesBody");
            tbody.innerHTML = "";

            if (inquiries.length === 0) {
                tbody.innerHTML = '<tr><td colspan="4">No inquiries yet.</td></tr>';
                return;
            }

            inquiries.forEach(inq => {
                const priorityClass = inq.priority === "High" ? "danger" : inq.priority === "Low" ? "active" : "warning";
                const statusClass = inq.status === "Resolved" ? "active" : "open";
                const tr = document.createElement("tr");
                tr.innerHTML = `
                    <td>${inq.date}</td>
                    <td>${inq.message}${inq.reply ? `<span class="ticket-reply">Staff reply: ${inq.reply}</span>` : ""}</td>
                    <td><span class="badge ${priorityClass}">${inq.priority}</span></td>
                    <td><span class="badge ${statusClass}">${inq.status}</span></td>
                `;
                tbody.appendChild(tr);
            });
        };

        renderMyInquiries();

        window.submitInquiry = () => {
            const message = document.getElementById("inqMessage").value.trim();
            const priority = document.getElementById("inqPriority").value;
            const email = document.getElementById("inqEmail").value.trim();
            const phone = document.getElementById("inqPhone").value.trim();
            const address = document.getElementById("inqAddress").value.trim();
            const statusEl = document.getElementById("inqStatus");

            if (!message) {
                statusEl.textContent = "Please enter your inquiry.";
                return;
            }

            const inquiries = JSON.parse(localStorage.getItem("crmInquiries") || "[]");
            inquiries.push({
                id: Date.now(),
                username: currentUser,
                name: customer.name,
                email,
                phone,
                address,
                date: new Date().toISOString().split("T")[0],
                message,
                priority,
                status: "Open",
                reply: ""
            });
            localStorage.setItem("crmInquiries", JSON.stringify(inquiries));

            document.getElementById("inqMessage").value = "";
            statusEl.textContent = "Inquiry submitted! Our support team will follow up.";
            renderMyInquiries();
        };
    }

    // Tickets page: Add Walk-in Ticket modal
    const ticketModal = document.getElementById("ticketModal");
    const openTicketModal = document.getElementById("openTicketModal");
    const closeTicketModal = document.getElementById("closeTicketModal");
    const ticketForm = document.getElementById("ticketForm");

    if (openTicketModal && ticketModal) {
        openTicketModal.addEventListener("click", () => {
            ticketModal.style.display = "flex";
        });

        closeTicketModal.addEventListener("click", () => {
            ticketModal.style.display = "none";
        });

        window.addEventListener("click", (e) => {
            if (e.target === ticketModal) {
                ticketModal.style.display = "none";
            }
        });
    }

    if (ticketForm) {
        ticketForm.addEventListener("submit", (e) => {
            e.preventDefault();
            const name = document.getElementById("ticketName").value.trim();
            const contact = document.getElementById("ticketContact").value.trim();
            const priority = document.getElementById("ticketPriority").value;
            const issue = document.getElementById("ticketIssue").value.trim();

            if (!name || !issue) {
                alert("Please provide at least a name and an issue description.");
                return;
            }

            const tickets = JSON.parse(localStorage.getItem("crmStaffTickets") || "[]");
            tickets.push({
                id: Date.now(),
                date: new Date().toISOString().split("T")[0],
                name,
                contact,
                issue,
                priority,
                status: "Open",
                reply: ""
            });
            localStorage.setItem("crmStaffTickets", JSON.stringify(tickets));

            ticketForm.reset();
            ticketModal.style.display = "none";
            renderStaffTickets();
            countOpenTickets();
        });
    }

    // Tickets page: Resolve / Reply dialog
    const resolveModal = document.getElementById("resolveModal");
    const closeResolveModal = document.getElementById("closeResolveModal");
    const confirmResolveBtn = document.getElementById("confirmResolve");

    if (closeResolveModal) {
        closeResolveModal.addEventListener("click", () => {
            resolveModal.style.display = "none";
        });
        window.addEventListener("click", (e) => {
            if (e.target === resolveModal) {
                resolveModal.style.display = "none";
            }
        });
    }

    if (confirmResolveBtn) {
        confirmResolveBtn.addEventListener("click", confirmResolve);
    }

    // Render tickets & inquiries tables
    if (document.getElementById("staffTicketsBody")) renderStaffTickets();
    if (document.getElementById("customerInquiriesBody")) renderCustomerInquiries();
    if (document.getElementById("supportColumn")) renderSupportTickets();

    // Initialize live stats per page
    if (document.querySelector("#staffTicketsBody") || document.querySelector("#customerInquiriesBody")) countOpenTickets();
    if (document.querySelector("#customerTableBody")) countExpiringMembers();
    if (document.querySelector("#statExpiring") || document.querySelector("#statOpenTickets")) {
        syncDashboard();
        window.addEventListener("storage", syncDashboard);
    }
});

let pendingResolve = null;

function renderStaffTickets() {
    const tbody = document.getElementById("staffTicketsBody");
    if (!tbody) return;

    const tickets = JSON.parse(localStorage.getItem("crmStaffTickets") || "[]");
    tbody.innerHTML = "";
    if (tickets.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7">No staff tickets logged yet.</td></tr>';
        return;
    }

    tickets.forEach(t => {
        const priorityClass = t.priority === "High" ? "danger" : t.priority === "Low" ? "active" : "warning";
        const statusClass = t.status === "Resolved" ? "active" : "open";
        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td>${t.date}</td>
            <td>${t.name}</td>
            <td>${t.contact || "—"}</td>
            <td>${t.issue}${t.reply ? `<span class="ticket-reply">Reply sent: ${t.reply}</span>` : ""}</td>
            <td><span class="badge ${priorityClass}">${t.priority}</span></td>
            <td><span class="badge ${statusClass}" id="staff-status-${t.id}">${t.status}</span></td>
            <td>${t.status === "Resolved" ? '<span class="badge active">Done</span>' : `<button class="btn-resolve" onclick="resolveTicket(${t.id}, 'staff', this)">Resolve</button>`}</td>
        `;
        tbody.appendChild(tr);
    });
}

function renderCustomerInquiries() {
    const tbody = document.getElementById("customerInquiriesBody");
    if (!tbody) return;

    const inquiries = JSON.parse(localStorage.getItem("crmInquiries") || "[]");
    tbody.innerHTML = "";
    if (inquiries.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7">No customer portal inquiries yet.</td></tr>';
        return;
    }

    inquiries.forEach(inq => {
        const priorityClass = inq.priority === "High" ? "danger" : inq.priority === "Low" ? "active" : "warning";
        const statusClass = inq.status === "Resolved" ? "active" : "open";
        const contact = [inq.email, inq.phone, inq.address].filter(Boolean).join(" | ") || "—";
        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td>${inq.date}</td>
            <td>${inq.name}</td>
            <td>${contact}</td>
            <td>${inq.message}${inq.reply ? `<span class="ticket-reply">Reply sent: ${inq.reply}</span>` : ""}</td>
            <td><span class="badge ${priorityClass}">${inq.priority}</span></td>
            <td><span class="badge ${statusClass}" id="customer-status-${inq.id}">${inq.status}</span></td>
            <td>${inq.status === "Resolved" ? '<span class="badge active">Done</span>' : `<button class="btn-resolve" onclick="resolveTicket(${inq.id}, 'customer', this)">Resolve</button>`}</td>
        `;
        tbody.appendChild(tr);
    });
}

function renderSupportTickets() {
    const column = document.getElementById("supportColumn");
    if (!column) return;

    const staffTickets = JSON.parse(localStorage.getItem("crmStaffTickets") || "[]")
        .filter(t => t.status !== "Resolved");
    const inquiries = JSON.parse(localStorage.getItem("crmInquiries") || "[]")
        .filter(i => i.status !== "Resolved")
        .map(i => ({
            id: i.id,
            name: i.name,
            issue: i.message,
            priority: i.priority,
            source: "Portal"
        }));

    const all = [
        ...staffTickets.map(t => ({ id: t.id, name: t.name, issue: t.issue, priority: t.priority, source: "Staff" })),
        ...inquiries
    ];

    const title = document.getElementById("supportCount");
    if (title) title.textContent = `Support Tickets (${all.length})`;

    column.querySelectorAll(".kanban-card").forEach(c => c.remove());

    if (all.length === 0) {
        const p = document.createElement("p");
        p.className = "card-meta";
        p.textContent = "No open support tickets.";
        column.appendChild(p);
        return;
    }

    all.forEach(t => {
        const priorityClass = t.priority === "High" ? "danger" : t.priority === "Low" ? "active" : "warning";
        const div = document.createElement("div");
        div.className = "kanban-card";
        div.setAttribute("data-staff", "Support");
        div.setAttribute("data-tier", "Support");
        div.innerHTML = `
            <strong>${t.name}</strong> <span class="badge ${priorityClass}">${t.priority}</span>
            <p class="card-meta">Source: ${t.source}</p>
            <p class="card-meta">${t.issue}</p>
        `;
        column.appendChild(div);
    });
}

// Open the resolve/reply dialog for a given ticket/inquiry
function resolveTicket(id, source, buttonElement) {
    const modal = document.getElementById("resolveModal");
    if (!modal) return;

    let item = null;
    if (source === "staff") {
        item = JSON.parse(localStorage.getItem("crmStaffTickets") || "[]").find(x => String(x.id) === String(id));
    } else {
        item = JSON.parse(localStorage.getItem("crmInquiries") || "[]").find(x => String(x.id) === String(id));
    }
    if (!item) return;

    pendingResolve = { source, id };
    document.getElementById("resolveFrom").textContent = `${item.name} (${item.source === "Portal" ? "Customer Portal" : "Staff Logged"})`;
    document.getElementById("resolveIssue").textContent = item.issue || item.message;
    document.getElementById("resolveReply").value = "";
    modal.style.display = "flex";
}

function confirmResolve() {
    if (!pendingResolve) return;
    const { source, id } = pendingResolve;
    const reply = document.getElementById("resolveReply").value.trim();
    const key = source === "staff" ? "crmStaffTickets" : "crmInquiries";
    const list = JSON.parse(localStorage.getItem(key) || "[]");
    const item = list.find(x => String(x.id) === String(id));

    if (item) {
        item.status = "Resolved";
        item.reply = reply;
        localStorage.setItem(key, JSON.stringify(list));
    }

    pendingResolve = null;
    document.getElementById("resolveModal").style.display = "none";

    if (source === "staff") renderStaffTickets(); else renderCustomerInquiries();
    renderSupportTickets();
    getOpenTicketsCount();
}

function getOpenTicketsCount() {
    const tables = [document.querySelectorAll("#staffTicketsBody tr"), document.querySelectorAll("#customerInquiriesBody tr")];
    let count = 0;
    tables.forEach(rows => {
        rows.forEach(row => {
            const statusEl = row.querySelector(".badge");
            const status = statusEl ? statusEl.textContent.trim().toLowerCase() : "";
            if (status === "open" || status === "in progress") count++;
        });
    });
    localStorage.setItem("crmOpenTicketsCount", count);
    return count;
}

function logoutCustomer() {
    sessionStorage.removeItem("crmCurrentUser");
    sessionStorage.removeItem("crmRole");
    location.href = "login.html";
}