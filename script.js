// One-time cleanup: older versions seeded demo customers/tickets into localStorage.
// Remove those exact seeded records (matched by name + contact) without touching real data.
(function purgeSeededDemoData() {
    try {
        if (localStorage.getItem("crmPurgedDemoSeed1")) return;

        const demo = [
            ["Alice Johnson", "555-1234"],
            ["Mark Taylor", "555-5678"],
            ["Sarah Connor", "555-9012"],
            ["David Lee", "555-3456"],
            ["Chris Evans", "555-7890"],
            ["Tom Hardy", "555-1111"],
            ["John Doe", "john@example.com"],
            ["Jane Smith", "jane@example.com"]
        ];

        const isDemo = (item) => demo.some(([name, marker]) => {
            if (String(item.name || "") !== name) return false;
            const contact = [item.contact, item.email, item.phone].filter(Boolean).join(" | ");
            return contact.includes(marker);
        });

        ["crmDirectory", "crmPipelineLeads", "crmStaffTickets", "crmInquiries"].forEach(key => {
            try {
                const list = JSON.parse(localStorage.getItem(key) || "[]");
                if (!Array.isArray(list)) return;
                const kept = list.filter(item => !isDemo(item));
                if (kept.length !== list.length) {
                    localStorage.setItem(key, JSON.stringify(kept));
                }
            } catch (e) { /* skip malformed storage */ }
        });

        localStorage.setItem("crmPurgedDemoSeed1", "1");
    } catch (e) { /* non-critical */ }
})();

document.addEventListener("DOMContentLoaded", () => {
    // Dashboard stat helpers (shared via localStorage across pages)
    const EXPIRE_KEY = "crmExpiringCount";
    const TICKETS_KEY = "crmOpenTicketsCount";
    const ACTIVE_KEY = "crmActiveMembersCount";

    function syncDashboard() {
        const expiringEl = document.getElementById("statExpiring");
        const ticketsEl = document.getElementById("statOpenTickets");
        const activeEl = document.getElementById("statActive");
        if (expiringEl) expiringEl.textContent = localStorage.getItem(EXPIRE_KEY) || "0";
        if (ticketsEl) ticketsEl.textContent = localStorage.getItem(TICKETS_KEY) || "0";
        if (activeEl) activeEl.textContent = localStorage.getItem(ACTIVE_KEY) || "0";
    }

    function countActiveMembers() {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const count = getDirectoryCustomers().filter(c => customerStatus(c.exp, today) === "Active").length;
        localStorage.setItem(ACTIVE_KEY, count);
        return count;
    }

    function countExpiringMembers() {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const count = getDirectoryCustomers().filter(c => customerStatus(c.exp, today) === "Expiring Soon").length;
        localStorage.setItem(EXPIRE_KEY, count);
        return count;
    }

    function countOpenTickets() {
        const all = [
            ...JSON.parse(localStorage.getItem("crmStaffTickets") || "[]"),
            ...JSON.parse(localStorage.getItem("crmInquiries") || "[]")
        ];
        const count = all.filter(t => {
            const s = String(t.status || "").toLowerCase();
            return s === "open" || s === "in progress";
        }).length;

        localStorage.setItem(TICKETS_KEY, count);
        return count;
    }

    // Migrate any pre-existing tickets/inquiries so they support comment threads
    ["crmStaffTickets", "crmInquiries"].forEach(key => {
        let list = JSON.parse(localStorage.getItem(key) || "[]");
        list = list.map(entry => {
            if (!Array.isArray(entry.comments)) {
                entry.comments = entry.reply ? [{ author: "Support Staff", role: "staff", text: entry.reply, date: entry.date }] : [];
            }
            return entry;
        });
        localStorage.setItem(key, JSON.stringify(list));
    });

    const customerTableBody = document.getElementById("customerTableBody");

    // Customer Directory: render stored members + registered accounts
    renderCustomerDirectory();

    // Remove Member: validates the record exists and asks for confirmation
    // before deleting a directory entry or a registered login account.
    window.removeDirectoryCustomer = (id) => {
        if (id === undefined || id === null || id === "") {
            alert("No member selected to remove.");
            return;
        }

        const isRegistered = typeof id === "string" && id.indexOf("reg-") === 0;
        const recordLabel = isRegistered ? "member and their login account" : "member record";

        if (!confirm(`Remove this ${recordLabel}? This action cannot be undone.`)) return;

        if (isRegistered) {
            const username = id.slice(4);
            const customers = JSON.parse(localStorage.getItem("crmCustomers") || "[]");
            if (!customers.some(c => c.username === username)) {
                alert("Member not found. It may have already been removed.");
                return;
            }
            localStorage.setItem("crmCustomers", JSON.stringify(customers.filter(c => c.username !== username)));
        } else {
            const directory = JSON.parse(localStorage.getItem(DIRECTORY_KEY) || "[]");
            if (!directory.some(d => String(d.id) === String(id))) {
                alert("Member not found. It may have already been removed.");
                return;
            }
            localStorage.setItem(DIRECTORY_KEY, JSON.stringify(directory.filter(d => String(d.id) !== String(id))));
        }

        renderCustomerDirectory();
        countExpiringMembers();
        countActiveMembers();
    };

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

    // Pipeline Kanban: Modal, Seed, Render, Search & Filters
    const pipelineModal = document.getElementById("pipelineModal");
    const openPipelineModalBtn = document.getElementById("openPipelineModal");
    const closePipelineModalBtn = document.getElementById("closePipelineModal");
    const cancelPipelineModalBtn = document.getElementById("cancelPipelineModal");
    const pipelineForm = document.getElementById("pipelineForm");
    const pipelineSearch = document.getElementById("pipelineSearch");
    const pipelineStaffFilter = document.getElementById("filterStaff");
    const pipelineTierFilter = document.getElementById("filterTier");

    if (document.getElementById("pipelineBoard")) renderPipelineBoard();

    if (openPipelineModalBtn) {
        openPipelineModalBtn.addEventListener("click", () => {
            pipelineForm.reset();
            document.getElementById("leadId").value = "";
            document.getElementById("leadStage").value = "new-lead";
            document.getElementById("lostReasonGroup").style.display = "none";
            document.getElementById("pipelineModalTitle").textContent = "Add Prospecting Client";
            document.getElementById("pipelineForm").querySelector('button[type="submit"]').textContent = "Save Client";
            pipelineModal.style.display = "flex";
        });
    }
    if (closePipelineModalBtn) closePipelineModalBtn.addEventListener("click", () => pipelineModal.style.display = "none");
    if (cancelPipelineModalBtn) cancelPipelineModalBtn.addEventListener("click", () => pipelineModal.style.display = "none");
    if (pipelineModal) {
        window.addEventListener("click", (e) => {
            if (e.target === pipelineModal) pipelineModal.style.display = "none";
        });
    }

    const leadStageSelect = document.getElementById("leadStage");
    if (leadStageSelect) {
        const toggleLostReason = () => {
            const group = document.getElementById("lostReasonGroup");
            if (group) group.style.display = leadStageSelect.value === "lost" ? "block" : "none";
        };
        leadStageSelect.addEventListener("change", toggleLostReason);
        toggleLostReason();
    }

    if (pipelineForm) {
        pipelineForm.addEventListener("submit", (e) => {
            e.preventDefault();
            const name = document.getElementById("leadName").value.trim();
            if (!name) {
                alert("Please enter the client's name.");
                return;
            }

            const leads = getPipelineLeads();
            const data = {
                name,
                phone: document.getElementById("leadPhone").value.trim(),
                tier: document.getElementById("leadTier").value,
                staff: document.getElementById("leadStaff").value,
                heat: document.getElementById("leadHeat").value,
                stage: document.getElementById("leadStage").value,
                followUp: document.getElementById("leadFollowUp").value,
                monthlyValue: document.getElementById("leadValue").value || 0,
                reason: document.getElementById("leadLostReason").value.trim()
            };

            const id = document.getElementById("leadId").value;
            if (id) {
                const idx = leads.findIndex(l => String(l.id) === String(id));
                if (idx > -1) leads[idx] = { ...leads[idx], ...data };
            } else {
                data.id = Date.now();
                leads.push(data);
            }

            savePipelineLeads(leads);
            pipelineModal.style.display = "none";
            renderPipelineBoard();
        });
    }

    if (pipelineSearch) pipelineSearch.addEventListener("input", renderPipelineBoard);
    if (pipelineStaffFilter) pipelineStaffFilter.addEventListener("change", renderPipelineBoard);
    if (pipelineTierFilter) pipelineTierFilter.addEventListener("change", renderPipelineBoard);

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
                    sessionStorage.setItem("crmCurrentUser", username);
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
        const regTierEl = document.getElementById("regTier");
        const regFobEl = document.getElementById("regKeyFob");
        const regExpEl = document.getElementById("regExp");

        // Key Fob confirmation dialog
        const fobModal = document.getElementById("fobModal");
        const fobDisplay = document.getElementById("regFobAssigned");
        const fobCopyBtn = document.getElementById("fobCopyBtn");
        const fobGoLoginBtn = document.getElementById("fobGoLoginBtn");
        const fobCloseBtn = document.getElementById("fobCloseBtn");

        if (fobModal) {
            const hideFobModal = () => { fobModal.style.display = "none"; };
            if (fobCloseBtn) fobCloseBtn.addEventListener("click", hideFobModal);
            if (fobGoLoginBtn) fobGoLoginBtn.addEventListener("click", () => location.href = "login.html");
            if (fobCopyBtn) {
                fobCopyBtn.addEventListener("click", () => {
                    if (!fobDisplay || !fobDisplay.textContent) return;
                    const doCopy = () => navigator.clipboard.writeText(fobDisplay.textContent);
                    const copied = () => {
                        fobCopyBtn.textContent = "Copied!";
                        setTimeout(() => (fobCopyBtn.textContent = "Copy"), 2000);
                    };
                    if (navigator.clipboard && navigator.clipboard.writeText) {
                        doCopy().then(copied).catch(() => alert("Could not copy. Please note your Key Fob Number manually."));
                    } else {
                        alert("Clipboard not available. Please note your Key Fob Number manually.");
                    }
                });
            }
            window.addEventListener("click", (e) => {
                if (e.target === fobModal) hideFobModal();
            });
        }

        // Expiration Date is automatically derived from the selected tier
        const setRegExpiration = () => {
            const months = tierDurationMonths(regTierEl ? regTierEl.value : "");
            if (regExpEl) regExpEl.value = computeExpirationDate(months, new Date());
        };

        if (regFobEl) regFobEl.value = generateKeyFob();
        setRegExpiration();
        if (regTierEl) regTierEl.addEventListener("change", setRegExpiration);

        registerForm.addEventListener("submit", (e) => {
            e.preventDefault();
            const name = document.getElementById("regName").value.trim();
            const email = document.getElementById("regEmail").value.trim();
            const phone = document.getElementById("regPhone").value.trim();
            const address = document.getElementById("regAddress").value.trim();
            const tier = regTierEl ? regTierEl.value : "";
            const keyFob = regFobEl ? regFobEl.value.trim() : "";
            const password = document.getElementById("regPassword").value;
            const confirm = document.getElementById("regConfirm").value;
            const errorEl = document.getElementById("regError");

            if (password !== confirm) {
                errorEl.textContent = "Passwords do not match.";
                return;
            }

            if (!keyFob) {
                errorEl.textContent = "A Key Fob Number could not be generated. Please reload and try again.";
                return;
            }

            const customers = JSON.parse(localStorage.getItem("crmCustomers") || "[]");
            if (customers.some(c => c.username === keyFob)) {
                errorEl.textContent = "Key Fob Number already assigned. Please reload and try again.";
                return;
            }

            customers.push({
                username: keyFob,
                keyFob,
                password,
                name,
                email,
                phone,
                address,
                tier,
                joined: new Date().toISOString().split("T")[0],
                exp: computeExpirationDate(tierDurationMonths(tier), new Date())
            });

            localStorage.setItem("crmCustomers", JSON.stringify(customers));
            errorEl.textContent = "";

            if (fobModal && fobDisplay) {
                fobDisplay.textContent = keyFob;
                fobModal.style.display = "flex";
            } else {
                errorEl.style.color = "#27ae60";
                errorEl.textContent = `Registration successful! Your Key Fob Number (username): ${keyFob}`;
                setTimeout(() => location.href = "login.html", 4000);
            }
        });
    }

    // Customer portal page logic
    let renderMyInquiries = null;
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
        if (document.getElementById("pFob")) document.getElementById("pFob").textContent = customer.keyFob || customer.username || "—";

        const months = tierDurationMonths(customer.tier);
        const custExp = customer.exp || (months && customer.joined ? computeExpirationDate(months, new Date(customer.joined + "T00:00:00")) : "");
        if (document.getElementById("pExp")) document.getElementById("pExp").textContent = custExp || "—";

        const pStatusEl = document.getElementById("pStatus");
        if (pStatusEl) {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const status = customerStatus(custExp, today);
            const cls = status === "Active" ? "active" : status === "Expiring Soon" ? "warning" : "danger";
            pStatusEl.textContent = status;
            pStatusEl.className = "badge " + cls;
        }

        // Prefill inquiry box with customer details
        const inquireEmail = document.getElementById("inqEmail");
        const inquirePhone = document.getElementById("inqPhone");
        const inquireAddress = document.getElementById("inqAddress");
        if (inquireEmail) inquireEmail.value = customer.email || "";
        if (inquirePhone) inquirePhone.value = customer.phone || "";
        if (inquireAddress) inquireAddress.value = customer.address || "";

        renderMyInquiries = () => {
            const container = document.getElementById("myInquiriesList");
            if (!container) return;

            const search = ((document.getElementById("portalTicketSearch") || {}).value || "").trim().toLowerCase();
            const statusFilter = (document.getElementById("portalStatusFilter") || {}).value || "all";
            const hideResolved = !!((document.getElementById("portalHideResolved") || {}).checked);

            let inquiries = JSON.parse(localStorage.getItem("crmInquiries") || "[]")
                .filter(i => i.username === currentUser)
                .filter(i => {
                    if (hideResolved && String(i.status || "").toLowerCase() === "resolved") return false;
                    if (statusFilter !== "all" && String(i.status || "").toLowerCase() !== statusFilter.toLowerCase()) return false;
                    if (search) {
                        const hay = [i.message, i.priority, i.status, i.email, i.phone].filter(Boolean).join(" ").toLowerCase();
                        if (!hay.includes(search)) return false;
                    }
                    return true;
                })
                .sort((a, b) => b.id - a.id);

            container.innerHTML = "";
            if (inquiries.length === 0) {
                container.innerHTML = '<p class="card-meta">No matching tickets.</p>';
                return;
            }

            inquiries.forEach(inq => {
                const resolved = String(inq.status || "").toLowerCase() === "resolved";
                const card = document.createElement("div");
                card.className = "ticket-card";
                card.innerHTML = `
                    <div class="ticket-card-header">
                        <div>
                            <span class="badge ${priorityClass(inq.priority)}">${inq.priority}</span>
                            <span class="badge ${statusClass(inq.status)}">${inq.status}</span>
                        </div>
                        <span class="ticket-date">${formatDateLogged(inq.date)}</span>
                    </div>
                    <p class="ticket-message">${inq.message}</p>
                    <button class="btn-view" onclick="toggleTicketDetails(${inq.id})">View / Hide Details</button>
                    ${resolved ? `<button class="btn-delete" onclick="requestDeleteTicket(${inq.id}, 'customer')">Delete</button>` : ""}
                    <div class="ticket-details" id="ticket-details-${inq.id}" style="display:none;">
                        <div class="ticket-thread">${commentsHTML(inq)}</div>
                        <div class="portal-reply-box">
                            <label for="reply-${inq.id}">Add Your Reply</label>
                            <textarea id="reply-${inq.id}" class="inquiry-input" rows="3" placeholder="Type your reply to support..."></textarea>
                            <button class="btn-primary" onclick="replyToInquiry(${inq.id})">Send Reply</button>
                        </div>
                    </div>
                `;
                container.appendChild(card);
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
            const now = new Date();
            const dateTimeStr = now.toISOString();
            const newInquiry = {
                id: Date.now(),
                username: currentUser,
                name: customer.name,
                email,
                phone,
                address,
                date: dateTimeStr,
                message,
                priority,
                status: "Open",
                reply: "",
                comments: [{
                    author: customer.name,
                    role: "customer",
                    text: message,
                    date: dateTimeStr
                }]
            };
            inquiries.push(newInquiry);
            localStorage.setItem("crmInquiries", JSON.stringify(inquiries));
            getOpenTicketsCount();

            document.getElementById("inqMessage").value = "";
            statusEl.textContent = "Inquiry submitted! Our support team will follow up.";
            renderMyInquiries();
        };

        window.replyToInquiry = (id) => {
            const textarea = document.getElementById(`reply-${id}`);
            if (!textarea) return;
            const reply = textarea.value.trim();
            if (!reply) {
                alert("Please type your reply first.");
                return;
            }
            const inquiries = JSON.parse(localStorage.getItem("crmInquiries") || "[]");
            const inq = inquiries.find(i => String(i.id) === String(id));
            if (!inq) return;
            if (!Array.isArray(inq.comments)) inq.comments = [];
            inq.comments.push({
                author: customer.name,
                role: "customer",
                text: reply,
                date: new Date().toLocaleString()
            });
            localStorage.setItem("crmInquiries", JSON.stringify(inquiries));
            getOpenTicketsCount();
            renderMyInquiries();
            const el = document.getElementById(`ticket-details-${id}`);
            if (el) el.style.display = "block";
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
            const status = document.getElementById("ticketStatus").value;
            const issue = document.getElementById("ticketIssue").value.trim();

            if (!name || !issue) {
                alert("Please provide at least a name and an issue description.");
                return;
            }

            const tickets = JSON.parse(localStorage.getItem("crmStaffTickets") || "[]");
            const now = new Date().toISOString();
            tickets.push({
                id: Date.now(),
                date: now,
                name,
                contact,
                issue,
                priority,
                status,
                reply: "",
                comments: [{
                    author: name,
                    role: "customer",
                    text: issue,
                    date: now
                }]
            });
            localStorage.setItem("crmStaffTickets", JSON.stringify(tickets));

            ticketForm.reset();
            ticketModal.style.display = "none";
            renderStaffTickets();
            countOpenTickets();
        });
    }

    // Tickets page: Ticket Details / Comment-Reply modal
    const detailsModal = document.getElementById("ticketDetailsModal");
    const closeDetailsModal = document.getElementById("closeDetailsModal");
    const confirmDetailsUpdateBtn = document.getElementById("confirmDetailsUpdate");
    const deleteFromDetailsBtn = document.getElementById("deleteFromDetails");

    if (closeDetailsModal && detailsModal) {
        closeDetailsModal.addEventListener("click", () => {
            detailsModal.style.display = "none";
        });
        window.addEventListener("click", (e) => {
            if (e.target === detailsModal) {
                detailsModal.style.display = "none";
            }
        });
    }

    if (confirmDetailsUpdateBtn) {
        confirmDetailsUpdateBtn.addEventListener("click", saveTicketUpdate);
    }

    if (deleteFromDetailsBtn) {
        deleteFromDetailsBtn.addEventListener("click", () => {
            if (!pendingTicket) return;
            requestDeleteTicket(pendingTicket.id, pendingTicket.source);
            detailsModal.style.display = "none";
        });
    }

    // Tickets page: Delete confirmation dialog
    const deleteModal = document.getElementById("deleteConfirmModal");
    const closeDeleteModal = document.getElementById("closeDeleteModal");
    const cancelDeleteBtn = document.getElementById("cancelDeleteBtn");
    const confirmDeleteBtn = document.getElementById("confirmDeleteBtn");

    if (closeDeleteModal && deleteModal) {
        closeDeleteModal.addEventListener("click", () => {
            deleteModal.style.display = "none";
        });
        window.addEventListener("click", (e) => {
            if (e.target === deleteModal) {
                deleteModal.style.display = "none";
            }
        });
    }

    if (cancelDeleteBtn) {
        cancelDeleteBtn.addEventListener("click", () => {
            deleteModal.style.display = "none";
        });
    }

    if (confirmDeleteBtn) {
        confirmDeleteBtn.addEventListener("click", confirmDeleteTicket);
    }

    // Tickets page: Search & Filter listeners
    const ticketFilterIds = ["ticketSearch", "filterPriority", "filterStatus", "filterSource", "hideResolved"];
    ticketFilterIds.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener("input", () => {
                renderStaffTickets();
                renderCustomerInquiries();
            });
            el.addEventListener("change", () => {
                renderStaffTickets();
                renderCustomerInquiries();
            });
        }
    });

    // User Portal: search & filter listeners
    const portalFilterIds = ["portalTicketSearch", "portalStatusFilter", "portalHideResolved"];
    portalFilterIds.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener("input", () => {
                if (typeof renderMyInquiries === "function") renderMyInquiries();
            });
            el.addEventListener("change", () => {
                if (typeof renderMyInquiries === "function") renderMyInquiries();
            });
        }
    });

    // Dashboard header: show the logged-in user (no hardcoded identity)
    const userProfileEl = document.getElementById("userProfile");
    if (userProfileEl) {
        const role = sessionStorage.getItem("crmRole");
        const user = sessionStorage.getItem("crmCurrentUser");
        userProfileEl.textContent = role === "admin"
            ? `Staff: ${user || "Admin"}`
            : (role === "customer" ? `Member: ${user || ""}` : "Guest");
    }

    // Render tickets & inquiries tables
    if (document.getElementById("staffTicketsBody")) renderStaffTickets();
    if (document.getElementById("customerInquiriesBody")) renderCustomerInquiries();

    // Initialize live stats per page
    if (document.querySelector("#staffTicketsBody") || document.querySelector("#customerInquiriesBody")) countOpenTickets();
    if (document.querySelector("#customerTableBody")) {
        countExpiringMembers();
        countActiveMembers();
    }
    if (document.querySelector("#statExpiring") || document.querySelector("#statOpenTickets") || document.querySelector("#statActive")) {
        // Recompute from the shared data so the dashboard always matches the modules
        countOpenTickets();
        countExpiringMembers();
        countActiveMembers();
        syncDashboard();
        window.addEventListener("storage", syncDashboard);
    }
});

let pendingTicket = null;
let pendingDelete = null;

function statusClass(status) {
    const s = String(status || "").toLowerCase();
    if (s === "resolved") return "active";
    if (s === "in progress") return "warning";
    return "open";
}

function priorityClass(priority) {
    if (priority === "High") return "danger";
    if (priority === "Low") return "active";
    return "warning";
}

// Organize a stored date into a readable date + time label.
// Handles full ISO datetimes and legacy date-only (yyyy-mm-dd) values.
function formatDateLogged(value) {
    if (!value) return "—";
    const raw = String(value).trim();
    const hasTime = raw.includes("T") || /\d{1,2}:\d{2}/.test(raw);
    const d = new Date(hasTime ? raw : raw + "T00:00:00");
    if (isNaN(d.getTime())) return raw;
    return d.toLocaleString("en-US", hasTime
        ? { year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }
        : { year: "numeric", month: "short", day: "numeric" });
}

function tableFilters() {
    const search = (document.getElementById("ticketSearch") || {}).value || "";
    const priority = (document.getElementById("filterPriority") || {}).value || "all";
    const status = (document.getElementById("filterStatus") || {}).value || "all";
    const source = (document.getElementById("filterSource") || {}).value || "all";
    const hideResolved = !!(document.getElementById("hideResolved") || {}).checked;
    return { search: search.trim().toLowerCase(), priority, status, source, hideResolved };
}

function matchesFilters(item, filters, source, extraText) {
    if (filters.source !== "all" && filters.source !== source) return false;
    if (filters.status !== "all" && String(item.status || "").toLowerCase() !== filters.status.toLowerCase()) return false;
    if (filters.priority !== "all" && item.priority !== filters.priority) return false;
    if (filters.hideResolved && String(item.status || "").toLowerCase() === "resolved") return false;
    if (filters.search) {
        const hay = [item.name, item.contact, item.issue, item.message, item.priority, item.status, extraText]
            .filter(Boolean).join(" ").toLowerCase();
        if (!hay.includes(filters.search)) return false;
    }
    return true;
}

function commentsHTML(item) {
    const comments = Array.isArray(item.comments) ? item.comments : [];
    if (comments.length === 0) {
        return '<p class="card-meta">No comments yet.</p>';
    }
    return comments.map(c => `
        <div class="thread-comment ${c.role === "staff" ? "staff" : "customer"}">
            <span class="thread-author">${c.author || (c.role === "staff" ? "Support Staff" : "Customer")}</span>
            <span class="thread-date">${c.date ? formatDateLogged(c.date) : ""}</span>
            <p>${c.text}</p>
        </div>
    `).join("");
}

function commentsSummary(item) {
    const comments = Array.isArray(item.comments) ? item.comments : [];
    if (comments.length === 0) return "";
    const last = comments[comments.length - 1];
    return `<span class="ticket-reply">Last ${last.role === "staff" ? "comment from staff" : "comment"}: ${last.text}</span>`;
}

function getTicketStorage(source) {
    return JSON.parse(localStorage.getItem(source === "staff" ? "crmStaffTickets" : "crmInquiries") || "[]");
}

function saveTicketStorage(source, list) {
    localStorage.setItem(source === "staff" ? "crmStaffTickets" : "crmInquiries", JSON.stringify(list));
}

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
        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td>${formatDateLogged(inq.date)}</td>
            <td>${inq.name}</td>
            <td>${contact}</td>
            <td>${inq.message}${commentsSummary(inq)}</td>
            <td><span class="badge ${priorityClass(inq.priority)}">${inq.priority}</span></td>
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
    document.getElementById("detailsPriority").textContent = item.priority;
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

function saveTicketUpdate() {
    if (!pendingTicket) return;
    const { source, id } = pendingTicket;

    const list = getTicketStorage(source);
    const item = list.find(x => String(x.id) === String(id));
    if (!item) return;

    const newStatus = document.getElementById("detailsStatus").value;
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

    item.status = newStatus;
    item.reply = comment; // keep legacy field in sync

    saveTicketStorage(source, list);

    pendingTicket = null;
    document.getElementById("ticketDetailsModal").style.display = "none";

    renderStaffTickets();
    renderCustomerInquiries();
    getOpenTicketsCount();
}

// Open the delete confirmation dialog
function requestDeleteTicket(id, source) {
    const modal = document.getElementById("deleteConfirmModal");
    if (!modal) return;

    pendingDelete = { source, id };
    document.getElementById("deleteConfirmMessage").textContent =
        "Are you sure you want to permanently delete this ticket? This action cannot be undone.";
    modal.style.display = "flex";
}

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

function logoutCustomer() {
    sessionStorage.removeItem("crmCurrentUser");
    sessionStorage.removeItem("crmRole");
    location.href = "login.html";
}

function toggleTicketDetails(id) {
    const el = document.getElementById(`ticket-details-${id}`);
    if (el) el.style.display = el.style.display === "none" ? "block" : "none";
}

// ---- Sales Pipeline (Prospecting Clients) ----
const PIPELINE_KEY = "crmPipelineLeads";

const PIPELINE_STAGES = [
    { id: "new-lead", title: "New Lead", goal: "Goal: Respond within 5 minutes." },
    { id: "contacted", title: "Contacted", goal: "Goal: Book a gym tour." },
    { id: "visit", title: "Visit Scheduled", goal: "Goal: Send an automated text reminder." },
    { id: "trial", title: "Trial / Tour Completed", goal: "Goal: Present a tailored membership offer on the spot." },
    { id: "won", title: "Membership (Won)", goal: "Goal: Trigger onboarding and welcome sequence." },
    { id: "lost", title: "Closed / Lost", goal: "Goal: Move to a long-term re-engagement email list." }
];

// Anytime Fitness membership tiers (term-based) — matches "Membership Tiers Info"
// in the Customer Directory (members.html). Each tier has a fixed membership term.
const PIPELINE_TIERS = [
    { value: "6-Month Membership", label: "6-Month Membership ($45/mo)", price: 45, months: 6 },
    { value: "12-Month Membership", label: "12-Month Membership ($40/mo)", price: 40, months: 12 },
    { value: "18-Month Membership", label: "18-Month Membership ($35/mo)", price: 35, months: 18 }
];

function tierDurationMonths(tier) {
    const t = PIPELINE_TIERS.find(t => t.value === tier);
    return t ? t.months : 0;
}

// Expiration date = base date + membership term, as yyyy-mm-dd
function computeExpirationDate(months, base) {
    const d = new Date(base);
    d.setMonth(d.getMonth() + months);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
}

// Random, unique 8-digit Key Fob Number used as the customer's username
function generateKeyFob() {
    const customers = JSON.parse(localStorage.getItem("crmCustomers") || "[]");
    let fob;
    do {
        fob = String(Math.floor(10000000 + Math.random() * 90000000));
    } while (customers.some(c => c.username === fob || c.keyFob === fob));
    return fob;
}

function normalizePipelineTier(tier) {
    if (PIPELINE_TIERS.some(t => t.value === tier)) return tier;
    // Legacy/unknown tiers fall back to the base 6-month membership
    return "6-Month Membership";
}

function pipelineTierPrice(tier) {
    const t = PIPELINE_TIERS.find(t => t.value === normalizePipelineTier(tier));
    return t ? t.price : 0;
}

function serviceTierLabel(tier) {
    const t = PIPELINE_TIERS.find(t => t.value === normalizePipelineTier(tier));
    return t ? t.label : tier;
}

function getPipelineLeads() {
    return JSON.parse(localStorage.getItem(PIPELINE_KEY) || "[]").map(l => {
        const tier = normalizePipelineTier(l.tier);
        const hasValue = l.monthlyValue !== undefined && l.monthlyValue !== null && l.monthlyValue !== "";
        return { ...l, tier, monthlyValue: hasValue ? Number(l.monthlyValue) : pipelineTierPrice(tier) };
    });
}

function savePipelineLeads(list) {
    localStorage.setItem(PIPELINE_KEY, JSON.stringify(list));
}

function pipelineFilters() {
    return {
        search: ((document.getElementById("pipelineSearch") || {}).value || "").trim().toLowerCase(),
        staff: (document.getElementById("filterStaff") || {}).value || "all",
        tier: (document.getElementById("filterTier") || {}).value || "all"
    };
}

function leadHeatBadge(heat) {
    const cls = heat === "Hot" ? "danger" : heat === "Warm" ? "warning" : "open";
    const label = heat === "Cold" ? "Cold" : `${heat} Lead`;
    return `<span class="badge ${cls}">[${label}]</span>`;
}

function buildLeadCard(lead) {
    const div = document.createElement("div");
    div.className = "kanban-card";
    div.setAttribute("data-id", lead.id);
    div.setAttribute("data-staff", lead.staff);
    div.setAttribute("data-tier", lead.tier);

    const followUp = lead.followUp ? `Next Follow-up: ${lead.followUp}` : "Next Follow-up: —";

    let meta2 = `Assigned: ${lead.staff} | ${followUp}`;
    if (lead.stage === "won") meta2 = `Assigned: ${lead.staff} | Membership active`;
    if (lead.stage === "lost" && lead.reason) meta2 = `Reason: ${lead.reason}`;

    const value = Number(lead.monthlyValue) || 0;
    const tierPrice = pipelineTierPrice(lead.tier);
    const tierText = tierPrice ? `${lead.tier} ($${tierPrice}/mo)` : lead.tier;
    const valueSuffix = lead.stage === "won" && value > 0 ? ` | $${value}/mo` : "";

    div.innerHTML = `
        <strong>${lead.name}</strong> ${leadHeatBadge(lead.heat)}
        <p class="card-meta">📞 ${lead.phone || "—"} | Target: ${tierText}${valueSuffix}</p>
        <p class="card-meta">${meta2}</p>
        <div class="kanban-card-actions">
            <button class="btn-view" onclick="openEditPipelineLead(${lead.id})">Edit</button>
            <button class="btn-delete" onclick="requestDeletePipelineLead(${lead.id})">Delete</button>
        </div>
    `;
    return div;
}

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
            const searchText = [lead.name, lead.phone, lead.tier, tierLabel, lead.staff, lead.reason].filter(Boolean).join(" ").toLowerCase();
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

function openEditPipelineLead(id) {
    const lead = getPipelineLeads().find(l => String(l.id) === String(id));
    const modal = document.getElementById("pipelineModal");
    if (!lead || !modal) return;

    document.getElementById("leadId").value = lead.id;
    document.getElementById("leadName").value = lead.name;
    document.getElementById("leadPhone").value = lead.phone || "";
    document.getElementById("leadTier").value = lead.tier;
    document.getElementById("leadStaff").value = lead.staff;
    document.getElementById("leadHeat").value = lead.heat || "Warm";
    document.getElementById("leadStage").value = lead.stage;
    document.getElementById("leadFollowUp").value = lead.followUp || "";
    document.getElementById("leadValue").value = lead.monthlyValue ? Number(lead.monthlyValue) : "";
    document.getElementById("leadLostReason").value = lead.reason || "";

    const group = document.getElementById("lostReasonGroup");
    if (group) group.style.display = lead.stage === "lost" ? "block" : "none";

    document.getElementById("pipelineModalTitle").textContent = "Edit Prospecting Client";
    document.getElementById("pipelineForm").querySelector('button[type="submit"]').textContent = "Update Client";
    modal.style.display = "flex";
}

function requestDeletePipelineLead(id) {
    if (!confirm("Delete this lead from the pipeline? This cannot be undone.")) return;
    const leads = getPipelineLeads().filter(l => String(l.id) !== String(id));
    savePipelineLeads(leads);
    renderPipelineBoard();
}

// ---- Customer Directory ----
// Single source of truth: staff-managed directory entries + registered accounts (crmCustomers)
const DIRECTORY_KEY = "crmDirectory";

function getDirectoryCustomers() {
    const staff = JSON.parse(localStorage.getItem(DIRECTORY_KEY) || "[]");
    const registered = JSON.parse(localStorage.getItem("crmCustomers") || "[]")
        .map(c => {
            const months = tierDurationMonths(c.tier);
            const exp = c.exp || (months && c.joined ? computeExpirationDate(months, new Date(c.joined + "T00:00:00")) : "");
            return {
                id: "reg-" + c.username,
                name: c.name,
                contact: [c.email, c.phone].filter(Boolean).join(" / ") || "—",
                keyFob: c.keyFob || c.username,
                tier: c.tier,
                joined: c.joined || "—",
                exp,
                status: "Active"
            };
        });
    return [...staff, ...registered];
}

function customerStatus(expDate, today) {
    if (!expDate) return "Active";
    const d = new Date(expDate);
    if (isNaN(d.getTime())) return "Active";
    const diffDays = (d - today) / (24 * 60 * 60 * 1000);
    if (diffDays < 0) return "Expired";
    if (diffDays <= 30) return "Expiring Soon";
    return "Active";
}

function renderCustomerDirectory() {
    const tbody = document.getElementById("customerTableBody");
    if (!tbody) return;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const rows = getDirectoryCustomers();
    tbody.innerHTML = "";
    if (rows.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8">No customers found.</td></tr>';
        return;
    }

    rows.forEach(c => {
        const status = customerStatus(c.exp, today);
        const cls = status === "Active" ? "active" : status === "Expiring Soon" ? "warning" : "danger";
        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td>${c.name}</td>
            <td>${c.contact || "—"}</td>
            <td>${c.keyFob || "—"}</td>
            <td>${c.tier}</td>
            <td>${c.joined || "—"}</td>
            <td>${c.exp || "—"}</td>
            <td><span class="badge ${cls}">${status}</span></td>
            <td><button class="btn-delete" onclick="removeDirectoryCustomer('${c.id}')">Remove</button></td>
        `;
        tbody.appendChild(tr);
    });
}