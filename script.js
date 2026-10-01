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

    // Staff dropdowns are built from PIPELINE_STAFF so both stay in sync
    renderStaffOptions(pipelineStaffFilter, true);
    renderStaffOptions(document.getElementById("leadStaff"), false);

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

    // Marketing Campaigns (Dashboard): Modal & Add/Edit handler
    const campaignModal = document.getElementById("campaignModal");
    const openCampaignModalBtn = document.getElementById("openCampaignModal");
    const closeCampaignModalBtn = document.getElementById("closeCampaignModal");
    const cancelCampaignModalBtn = document.getElementById("cancelCampaignModal");
    const campaignForm = document.getElementById("campaignForm");
    const campaignPlatformSelect = document.getElementById("campaignPlatform");

    if (document.getElementById("campaignCards")) renderCampaigns();

    if (openCampaignModalBtn) {
        openCampaignModalBtn.addEventListener("click", () => {
            campaignForm.reset();
            document.getElementById("campaignId").value = "";
            document.getElementById("campaignStatus").value = "Scheduled";
            document.getElementById("otherPlatformGroup").style.display = "none";
            document.getElementById("campaignModalTitle").textContent = "Add Marketing Campaign";
            campaignForm.querySelector('button[type="submit"]').textContent = "Save Campaign";
            campaignModal.style.display = "flex";
            document.getElementById("campaignTitle").focus();
        });
    }
    if (closeCampaignModalBtn) closeCampaignModalBtn.addEventListener("click", () => campaignModal.style.display = "none");
    if (cancelCampaignModalBtn) cancelCampaignModalBtn.addEventListener("click", () => campaignModal.style.display = "none");
    if (campaignModal) {
        window.addEventListener("click", (e) => {
            if (e.target === campaignModal) campaignModal.style.display = "none";
        });
    }

    if (campaignPlatformSelect) {
        const toggleCustomPlatform = () => {
            const group = document.getElementById("otherPlatformGroup");
            if (group) group.style.display = campaignPlatformSelect.value === "Other" ? "block" : "none";
        };
        campaignPlatformSelect.addEventListener("change", toggleCustomPlatform);
        toggleCustomPlatform();
    }

    if (campaignForm) {
        campaignForm.addEventListener("submit", (e) => {
            e.preventDefault();
            const title = document.getElementById("campaignTitle").value.trim();
            if (!title) {
                alert("Please enter the campaign title.");
                return;
            }

            const platform = document.getElementById("campaignPlatform").value;
            const customPlatform = document.getElementById("campaignPlatformOther").value.trim();

            const campaigns = getCampaigns();
            const data = {
                title,
                platform: platform === "Other" && customPlatform ? customPlatform : platform,
                status: document.getElementById("campaignStatus").value,
                reach: Number(document.getElementById("campaignReach").value) || 0,
                clicks: Number(document.getElementById("campaignClicks").value) || 0,
                postUrl: document.getElementById("campaignPostUrl").value.trim(),
                linkLabel: document.getElementById("campaignLinkLabel").value.trim(),
                imageUrl: document.getElementById("campaignImageUrl").value.trim()
            };

            const id = document.getElementById("campaignId").value;
            if (id) {
                const idx = campaigns.findIndex(c => String(c.id) === String(id));
                if (idx > -1) campaigns[idx] = { ...campaigns[idx], ...data };
            } else {
                data.id = Date.now();
                campaigns.push(data);
            }

            saveCampaigns(campaigns);
            campaignModal.style.display = "none";
            renderCampaigns();
        });
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

    if (document.getElementById("chartMembersStatus")) {
        renderDashboardCharts();
        // Another tab writing to localStorage (e.g. removing a member) refreshes the charts
        window.addEventListener("storage", renderDashboardCharts);
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

// Campaign fields are staff-editable free text and are rendered into HTML, so
// escape them before interpolation to keep stored values inert.
function escapeHtml(value) {
    const chars = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
    return String(value || "").replace(/[&<>"']/g, ch => chars[ch]);
}

// Campaign image/post links come from free-text inputs. Only http(s) is kept so a
// "javascript:" value can never become a live href/src when a card is rendered.
function safeUrl(value) {
    const raw = String(value || "").trim();
    if (!raw) return "";
    try {
        const parsed = new URL(raw);
        return parsed.protocol === "http:" || parsed.protocol === "https:" ? raw : "";
    } catch (e) {
        return "";
    }
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

// Single source of truth for pipeline staff. Both the filter bar and the
// Add/Edit Prospecting Client form are populated from this list so the
// available staff can never drift apart between the two.
const PIPELINE_STAFF = ["Coach Joeff", "Agent Mariel"];

// Legacy names kept so leads saved before the staff rename still resolve to a
// valid option instead of appearing as an unassigned staff member.
const PIPELINE_STAFF_ALIASES = {
    "Coach Mike": "Coach Joeff",
    "Agent Sarah": "Agent Mariel"
};

function normalizePipelineStaff(staff) {
    if (!staff) return PIPELINE_STAFF[0];
    return PIPELINE_STAFF_ALIASES[staff] || staff;
}

// Fills a staff <select> with the shared list. "all" adds the All Staff option.
function renderStaffOptions(select, includeAll) {
    if (!select) return;
    const options = [];
    if (includeAll) options.push({ value: "all", label: "All Staff" });
    PIPELINE_STAFF.forEach(name => options.push({ value: name, label: name }));
    select.innerHTML = options.map(o =>
        `<option value="${escapeHtml(o.value)}">${escapeHtml(o.label)}</option>`
    ).join("");
}

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
        return {
            ...l,
            tier,
            staff: normalizePipelineStaff(l.staff),
            monthlyValue: hasValue ? Number(l.monthlyValue) : pipelineTierPrice(tier)
        };
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

// Inline staff selector shown on a lead card. Saving goes through the same
// pipeline storage the Add/Edit form uses, so the card, the filter bar and the
// Edit form all show the same assigned staff.
function staffSelectHtml(lead) {
    const options = PIPELINE_STAFF.map(name =>
        `<option value="${escapeHtml(name)}"${name === lead.staff ? " selected" : ""}>${escapeHtml(name)}</option>`
    ).join("");
    return `
        <label class="staff-inline">
            <span class="staff-inline-label">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h4l10-10-4-4L4 16v4Z"/><path d="M13.5 6.5l4 4"/></svg>
                Assigned Staff
            </span>
            <select class="staff-inline-select" onchange="updateLeadStaff(${lead.id}, this.value)" aria-label="Assigned staff for ${escapeHtml(lead.name)}">${options}</select>
        </label>
    `;
}

// Reassigns a lead's staff without touching any other field, then re-renders so
// the card text, the staff filter and the Edit form stay consistent.
function updateLeadStaff(id, staff) {
    const leads = getPipelineLeads();
    const idx = leads.findIndex(l => String(l.id) === String(id));
    if (idx === -1) return;
    leads[idx] = { ...leads[idx], staff: normalizePipelineStaff(staff) };
    savePipelineLeads(leads);
    renderPipelineBoard();
}

function buildLeadCard(lead) {
    const div = document.createElement("div");
    div.className = "kanban-card";
    div.setAttribute("data-id", lead.id);
    div.setAttribute("data-staff", lead.staff);
    div.setAttribute("data-tier", lead.tier);

    const followUp = lead.followUp ? `Next Follow-up: ${lead.followUp}` : "Next Follow-up: —";

    let meta2 = `Assigned: ${escapeHtml(lead.staff)} | ${followUp}`;
    if (lead.stage === "won") meta2 = `Assigned: ${escapeHtml(lead.staff)} | Membership active`;
    if (lead.stage === "lost" && lead.reason) meta2 = `Reason: ${escapeHtml(lead.reason)}`;

    const value = Number(lead.monthlyValue) || 0;
    const tierPrice = pipelineTierPrice(lead.tier);
    const tierText = tierPrice ? `${lead.tier} ($${tierPrice}/mo)` : lead.tier;
    const valueSuffix = lead.stage === "won" && value > 0 ? ` | $${value}/mo` : "";

    div.innerHTML = `
        <strong>${escapeHtml(lead.name)}</strong> ${leadHeatBadge(lead.heat)}
        <p class="card-meta">📞 ${escapeHtml(lead.phone || "—")} | Target: ${escapeHtml(tierText)}${valueSuffix}</p>
        <p class="card-meta">${meta2}</p>
        ${staffSelectHtml(lead)}
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

// ---- Marketing Campaigns (Social Media) ----
const CAMPAIGN_KEY = "crmCampaigns";

const CAMPAIGN_PLATFORMS = ["Instagram", "Facebook", "Twitter", "TikTok", "Other"];

// Badge colour per campaign status, reusing the shared .badge palette
const CAMPAIGN_STATUSES = [
    { value: "Scheduled", badge: "warning" },
    { value: "Running", badge: "active" },
    { value: "Completed", badge: "open" }
];

// Fallback artwork so a campaign saved without an image URL still renders a card
const CAMPAIGN_PLACEHOLDER_IMAGE = "https://images.unsplash.com/photo-1517838277536-f5f99be501cd?w=400&q=80";

function getCampaigns() {
    return JSON.parse(localStorage.getItem(CAMPAIGN_KEY) || "[]");
}

function saveCampaigns(list) {
    localStorage.setItem(CAMPAIGN_KEY, JSON.stringify(list));
}

function campaignStatusBadge(status) {
    const meta = CAMPAIGN_STATUSES.find(s => s.value === status) || CAMPAIGN_STATUSES[0];
    return `<span class="badge ${meta.badge}">${escapeHtml(meta.value)}</span>`;
}

// Platforms outside the known dropdown list are edited through the "Other" option
function campaignPlatformOption(platform) {
    return CAMPAIGN_PLATFORMS.includes(platform) ? platform : "Other";
}

function buildCampaignCard(campaign) {
    const div = document.createElement("div");
    div.className = "campaign-card";
    div.setAttribute("data-id", campaign.id);

    const reach = (Number(campaign.reach) || 0).toLocaleString("en-US");
    const clicks = (Number(campaign.clicks) || 0).toLocaleString("en-US");
    const postUrl = safeUrl(campaign.postUrl);
    const imageUrl = safeUrl(campaign.imageUrl);
    const label = escapeHtml(campaign.linkLabel || "View Post");
    const link = postUrl
        ? `<a href="${escapeHtml(postUrl)}" target="_blank" rel="noopener" class="social-link">${label}</a>`
        : "";

    div.innerHTML = `
        <img src="${escapeHtml(imageUrl || CAMPAIGN_PLACEHOLDER_IMAGE)}" alt="${escapeHtml(campaign.title)}" class="campaign-img">
        <h4>${escapeHtml(campaign.title)} (${escapeHtml(campaign.platform)})</h4>
        <p>Reach: ${reach} | Clicks: ${clicks}</p>
        ${link}
        ${campaignStatusBadge(campaign.status)}
        <div class="kanban-card-actions">
            <button class="btn-view" onclick="openEditCampaign(${Number(campaign.id)})">Edit</button>
            <button class="btn-delete" onclick="requestDeleteCampaign(${Number(campaign.id)})">Delete</button>
        </div>
    `;
    return div;
}

function renderCampaigns() {
    const container = document.getElementById("campaignCards");
    if (!container) return;

    container.innerHTML = "";
    const campaigns = getCampaigns();
    if (campaigns.length === 0) {
        const p = document.createElement("p");
        p.className = "card-meta";
        p.textContent = "No campaigns yet. Use \"+ Add Campaign\" to create one.";
        container.appendChild(p);
        return;
    }
    campaigns.forEach(c => container.appendChild(buildCampaignCard(c)));
}

function openEditCampaign(id) {
    const campaign = getCampaigns().find(c => String(c.id) === String(id));
    const modal = document.getElementById("campaignModal");
    if (!campaign || !modal) return;

    const platform = campaignPlatformOption(campaign.platform);

    document.getElementById("campaignId").value = campaign.id;
    document.getElementById("campaignTitle").value = campaign.title || "";
    document.getElementById("campaignPlatform").value = platform;
    document.getElementById("campaignPlatformOther").value = platform === "Other" ? (campaign.platform || "") : "";
    document.getElementById("campaignStatus").value = campaign.status || "Scheduled";
    document.getElementById("campaignReach").value = Number(campaign.reach) || 0;
    document.getElementById("campaignClicks").value = Number(campaign.clicks) || 0;
    document.getElementById("campaignPostUrl").value = campaign.postUrl || "";
    document.getElementById("campaignLinkLabel").value = campaign.linkLabel || "";
    document.getElementById("campaignImageUrl").value = campaign.imageUrl || "";

    const group = document.getElementById("otherPlatformGroup");
    if (group) group.style.display = platform === "Other" ? "block" : "none";

    document.getElementById("campaignModalTitle").textContent = "Edit Marketing Campaign";
    document.getElementById("campaignForm").querySelector('button[type="submit"]').textContent = "Update Campaign";
    modal.style.display = "flex";
}

function requestDeleteCampaign(id) {
    if (!confirm("Delete this marketing campaign? This cannot be undone.")) return;
    saveCampaigns(getCampaigns().filter(c => String(c.id) !== String(id)));
    renderCampaigns();
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

// ---- Dashboard Charts ----
// Charts are drawn as inline SVG so the portal keeps zero dependencies and
// still works when opened straight from the filesystem.
const SVG_NS = "http://www.w3.org/2000/svg";
const CHART_COLORS = { brand: "#5c068c", active: "#27ae60", warning: "#f39c12", danger: "#e74c3c" };

function svgNode(name, attrs) {
    const node = document.createElementNS(SVG_NS, name);
    Object.entries(attrs || {}).forEach(([key, value]) => node.setAttribute(key, String(value)));
    return node;
}

function shortenLabel(value, max) {
    const text = String(value || "");
    return text.length > max ? text.slice(0, Math.max(1, max - 1)) + "…" : text;
}

// Category names are long ("18-Month Membership", "Trial / Tour Completed"), so
// break them onto two lines under the bar rather than truncating them to noise.
function wrapLabel(value, maxChars) {
    const words = String(value || "").split(/\s+/).filter(Boolean);
    if (words.length === 0) return [""];

    const lines = [];
    let current = "";
    words.forEach(word => {
        if (current && (current + " " + word).length > maxChars) {
            lines.push(current);
            current = word;
        } else {
            current = current ? current + " " + word : word;
        }
    });
    if (current) lines.push(current);

    if (lines.length > 2) {
        lines[1] = shortenLabel(lines.slice(1).join(" "), maxChars);
        lines.length = 2;
    }
    return lines.map(line => shortenLabel(line, maxChars));
}

// Vertical bar chart. Each item is { label, value, color? }.
function renderBarChart(containerId, items, options) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const opts = Object.assign({
        title: "Bar chart",
        barColor: CHART_COLORS.brand,
        emptyText: "No data to chart yet."
    }, options || {});

    container.innerHTML = "";
    const data = (items || []).filter(Boolean);
    const total = data.reduce((sum, item) => sum + (Number(item.value) || 0), 0);
    if (data.length === 0 || total === 0) {
        const p = document.createElement("p");
        p.className = "card-meta";
        p.textContent = opts.emptyText;
        container.appendChild(p);
        return;
    }

    // viewBox is sized close to the rendered card so the SVG text stays legible
    const width = 340;
    const height = 220;
    const padTop = 22;
    const padBottom = 38;
    const plotHeight = height - padTop - padBottom;
    const slot = width / data.length;
    const barWidth = Math.max(6, Math.min(46, slot * 0.55));
    const maxChars = Math.max(6, Math.floor(slot / 4.7));
    const max = Math.max(...data.map(item => Number(item.value) || 0));

    const svg = svgNode("svg", {
        viewBox: `0 0 ${width} ${height}`,
        role: "img",
        "aria-label": opts.title,
        preserveAspectRatio: "xMidYMid meet"
    });

    const titleNode = svgNode("title");
    titleNode.textContent = opts.title;
    svg.appendChild(titleNode);

    svg.appendChild(svgNode("line", {
        x1: 0, y1: padTop + plotHeight, x2: width, y2: padTop + plotHeight,
        stroke: "#e0e0e0", "stroke-width": 1
    }));

    data.forEach((item, index) => {
        const value = Number(item.value) || 0;
        const barHeight = value === 0 ? 0 : Math.max(3, (value / max) * plotHeight);
        const x = slot * index + (slot - barWidth) / 2;
        const y = padTop + plotHeight - barHeight;

        const bar = svgNode("rect", {
            x, y, width: barWidth, height: barHeight, rx: 3,
            fill: item.color || opts.barColor
        });
        const barTitle = svgNode("title");
        barTitle.textContent = `${item.label}: ${value.toLocaleString("en-US")}`;
        bar.appendChild(barTitle);
        svg.appendChild(bar);

        const valueText = svgNode("text", {
            x: x + barWidth / 2, y: Math.max(12, y - 6),
            "text-anchor": "middle", class: "chart-value"
        });
        valueText.textContent = value.toLocaleString("en-US");
        svg.appendChild(valueText);

        wrapLabel(item.label, maxChars).forEach((line, lineIndex) => {
            const labelText = svgNode("text", {
                x: x + barWidth / 2, y: padTop + plotHeight + 15 + lineIndex * 11,
                "text-anchor": "middle", class: "chart-label"
            });
            labelText.textContent = line;
            svg.appendChild(labelText);
        });
    });

    container.appendChild(svg);
}

// Members split by membership status and by tier, from the Customer Directory.
function memberChartData() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const rows = getDirectoryCustomers();

    const statusCounts = { "Active": 0, "Expiring Soon": 0, "Expired": 0 };
    const tierCounts = {};
    rows.forEach(c => {
        const status = customerStatus(c.exp, today);
        if (statusCounts[status] === undefined) statusCounts[status] = 0;
        statusCounts[status]++;

        const tier = c.tier || "Unassigned";
        tierCounts[tier] = (tierCounts[tier] || 0) + 1;
    });

    const byStatus = ["Active", "Expiring Soon", "Expired"].map((label, index) => ({
        label,
        value: statusCounts[label] || 0,
        color: [CHART_COLORS.active, CHART_COLORS.warning, CHART_COLORS.danger][index]
    }));

    const byTier = PIPELINE_TIERS.map(tier => ({ label: tier.value, value: tierCounts[tier.value] || 0 }));
    const knownTiers = PIPELINE_TIERS.map(tier => tier.value);
    const otherTotal = Object.keys(tierCounts)
        .filter(tier => !knownTiers.includes(tier))
        .reduce((sum, tier) => sum + tierCounts[tier], 0);
    if (otherTotal > 0) byTier.push({ label: "Other", value: otherTotal });

    return { byStatus, byTier };
}

// Month buckets ending with the current month, used by the ticket histogram.
function recentMonthBuckets(count) {
    const buckets = [];
    const now = new Date();
    for (let back = count - 1; back >= 0; back--) {
        const d = new Date(now.getFullYear(), now.getMonth() - back, 1);
        buckets.push({
            key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
            label: d.toLocaleString("en-US", { month: "short" })
        });
    }
    return buckets;
}

// Both staff tickets and customer portal inquiries, matching the open-ticket stat.
function allTickets() {
    return [
        ...JSON.parse(localStorage.getItem("crmStaffTickets") || "[]"),
        ...JSON.parse(localStorage.getItem("crmInquiries") || "[]")
    ];
}

function ticketChartData(monthsBack) {
    const tickets = allTickets();
    const buckets = recentMonthBuckets(monthsBack || 6);
    buckets.forEach(bucket => { bucket.value = 0; });

    tickets.forEach(ticket => {
        const key = String(ticket.date || "").slice(0, 7);
        const bucket = buckets.find(b => b.key === key);
        if (bucket) bucket.value++;
    });

    const byPriority = ["High", "Medium", "Low"].map(priority => {
        const cls = priorityClass(priority);
        const color = cls === "danger" ? CHART_COLORS.danger : cls === "active" ? CHART_COLORS.active : CHART_COLORS.warning;
        return {
            label: priority,
            value: tickets.filter(t => String(t.priority || "").toLowerCase() === priority.toLowerCase()).length,
            color
        };
    });

    return { byMonth: buckets, byPriority };
}

function pipelineChartData() {
    const leads = getPipelineLeads();
    return PIPELINE_STAGES.map(stage => ({
        label: stage.title,
        value: leads.filter(l => l.stage === stage.id).length,
        color: stage.id === "won" ? CHART_COLORS.active
            : stage.id === "lost" ? CHART_COLORS.danger
                : CHART_COLORS.brand
    }));
}

function renderDashboardCharts() {
    if (!document.getElementById("chartMembersStatus")) return;

    const members = memberChartData();
    renderBarChart("chartMembersStatus", members.byStatus, {
        title: "Members by membership status",
        emptyText: "No members in the directory yet."
    });
    renderBarChart("chartMembersTier", members.byTier, {
        title: "Members by membership tier",
        emptyText: "No members in the directory yet.",
        barColor: "#8e44ad"
    });

    const tickets = ticketChartData(6);
    renderBarChart("chartTicketVolume", tickets.byMonth, {
        title: "Tickets logged per month over the last 6 months",
        emptyText: "No tickets logged in the last 6 months.",
        barColor: "#3498db"
    });
    renderBarChart("chartTicketPriority", tickets.byPriority, {
        title: "Tickets by priority",
        emptyText: "No tickets recorded yet."
    });

    renderBarChart("chartPipelineStages", pipelineChartData(), {
        title: "Pipeline leads by stage",
        emptyText: "No pipeline leads yet."
    });
}

// =============================================================
// Dashboard presentation extras (additive only)
// The redesigned cards below are filled from the same localStorage data the
// modules above already use, so every number is real rather than placeholder.
// No existing ID, storage key, listener, function or validation rule is
// changed, and every element is optional, so all pages still boot as before.
// =============================================================
document.addEventListener("DOMContentLoaded", () => {
    const setText = (id, value) => {
        const el = document.getElementById(id);
        if (el) el.textContent = value;
    };

    const formatNumber = (value) => (Number(value) || 0).toLocaleString("en-US");

    const ticketsByStatus = (status) => allTickets()
        .filter(t => String(t.status || "").toLowerCase() === status).length;

    // Header chrome: avatar initials, role label and today's date
    function renderTopbarChrome() {
        const role = sessionStorage.getItem("crmRole");
        const user = sessionStorage.getItem("crmCurrentUser") || "";
        setText("userAvatar", (user.slice(0, 2) || "AF").toUpperCase());
        setText("userRole", role === "admin"
            ? "Front Desk Staff"
            : role === "customer" ? "Gym Member" : "Signed out");
        setText("topbarDate", new Date().toLocaleDateString("en-US", {
            weekday: "short", month: "short", day: "numeric", year: "numeric"
        }));
    }

    // Dashboard: the supporting line under each KPI card
    function renderKpiNotes() {
        const rows = getDirectoryCustomers();
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        let active = 0;
        let expiring = 0;
        rows.forEach(c => {
            const status = customerStatus(c.exp, today);
            if (status === "Active") active++;
            if (status === "Expiring Soon") expiring++;
        });

        const open = ticketsByStatus("open");
        const progress = ticketsByStatus("in progress");

        setText("statActiveNote", `${formatNumber(active)} of ${formatNumber(rows.length)} member record${rows.length === 1 ? "" : "s"} active`);
        setText("statExpiringNote", expiring
            ? `Renewal${expiring === 1 ? "" : "s"} due within 30 days`
            : "No renewals due in the next 30 days");
        setText("statOpenNote", `${formatNumber(open)} open · ${formatNumber(progress)} in progress`);
    }

    // Dashboard: real totals under the marketing campaign cards
    function renderCampaignTotals() {
        const campaigns = getCampaigns();
        setText("campaignStatReach", formatNumber(campaigns.reduce((sum, c) => sum + (Number(c.reach) || 0), 0)));
        setText("campaignStatClicks", formatNumber(campaigns.reduce((sum, c) => sum + (Number(c.clicks) || 0), 0)));
        setText("campaignStatRunning", formatNumber(campaigns.filter(c => String(c.status || "") === "Running").length));
    }

    // Customer Directory: the three directory statistic cards
    function renderDirectoryStats() {
        if (!document.getElementById("memberStatTotal")) return;

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const rows = getDirectoryCustomers();
        const withStatus = (status) => rows.filter(c => customerStatus(c.exp, today) === status).length;

        setText("memberStatTotal", formatNumber(rows.length));
        setText("memberStatActive", formatNumber(withStatus("Active")));
        setText("memberStatExpiring", formatNumber(withStatus("Expiring Soon")));
    }

    // Support module: the three ticket statistic cards
    function renderTicketStats() {
        if (!document.getElementById("ticketStatOpen")) return;

        setText("ticketStatOpen", formatNumber(ticketsByStatus("open")));
        setText("ticketStatProgress", formatNumber(ticketsByStatus("in progress")));
        setText("ticketStatResolved", formatNumber(ticketsByStatus("resolved")));
    }

    // The header search mirrors the page's own search field so there is a single
    // filter instead of two. On the dashboard it filters the campaign cards.
    const TOPBAR_SEARCH_TARGETS = ["searchCustomer", "ticketSearch", "pipelineSearch"];

    function filterCampaignCards(term) {
        const wrap = document.getElementById("campaignCards");
        if (!wrap) return;

        const query = term.trim().toLowerCase();
        Array.from(wrap.children).forEach(child => {
            if (!child.classList.contains("campaign-card")) {
                child.style.display = query ? "none" : "";
                return;
            }
            child.style.display = !query || child.textContent.toLowerCase().includes(query) ? "" : "none";
        });
    }

    function wireTopbarSearch() {
        const bar = document.getElementById("topbarSearch");
        if (!bar) return;

        const target = TOPBAR_SEARCH_TARGETS
            .map(id => document.getElementById(id))
            .find(el => el) || null;

        if (target) {
            bar.addEventListener("input", () => {
                if (target.value === bar.value) return;
                target.value = bar.value;
                target.dispatchEvent(new Event("input", { bubbles: true }));
            });
            target.addEventListener("input", () => {
                if (bar.value !== target.value) bar.value = target.value;
            });
            return;
        }

        bar.addEventListener("input", () => filterCampaignCards(bar.value));
    }

    renderTopbarChrome();
    renderKpiNotes();
    renderCampaignTotals();
    renderDirectoryStats();
    renderTicketStats();
    wireTopbarSearch();

    // Keep the campaign totals in step with add / edit / delete in this tab
    const campaignCards = document.getElementById("campaignCards");
    if (campaignCards && typeof MutationObserver === "function") {
        new MutationObserver(() => renderCampaignTotals()).observe(campaignCards, { childList: true });
    }

    // Likewise for the support statistics, which re-render whenever either
    // ticket table is repainted by the module above
    ["staffTicketsBody", "customerInquiriesBody"].forEach(id => {
        const tbody = document.getElementById(id);
        if (tbody && typeof MutationObserver === "function") {
            new MutationObserver(() => renderTicketStats()).observe(tbody, { childList: true });
        }
    });

    // Another tab writing to localStorage refreshes the derived totals too
    window.addEventListener("storage", () => {
        renderKpiNotes();
        renderCampaignTotals();
        renderDirectoryStats();
        renderTicketStats();
    });
});