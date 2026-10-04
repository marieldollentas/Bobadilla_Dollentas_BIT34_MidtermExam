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
        const frozenEl = document.getElementById("statFrozen");
        const totalEl = document.getElementById("statTotal");
        if (expiringEl) expiringEl.textContent = localStorage.getItem(EXPIRE_KEY) || "0";
        if (ticketsEl) ticketsEl.textContent = localStorage.getItem(TICKETS_KEY) || "0";
        if (activeEl) activeEl.textContent = localStorage.getItem(ACTIVE_KEY) || "0";
        if (frozenEl) {
            const rows = getActiveDirectoryCustomers();
            const today = todayStart();
            const frozen = rows.filter(r => getMemberStatus(r, today) === "Frozen").length;
            frozenEl.textContent = frozen;
        }
        if (totalEl) {
            totalEl.textContent = getActiveDirectoryCustomers().length;
        }
    }

    function countActiveMembers() {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const count = getActiveDirectoryCustomers().filter(c => getMemberStatus(c, today) === "Active").length;
        localStorage.setItem(ACTIVE_KEY, count);
        return count;
    }

    function countExpiringMembers() {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const count = getActiveDirectoryCustomers().filter(c => customerStatus(c.exp, today) === "Expiring Soon").length;
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
    renderArchivedMembers();

    // Archive Member: retires a membership instead of deleting it. The record
    // and its login stay on file as a past member, so the gym keeps the history
    // behind it (sessions, ratings, tickets) and the member can be restored.
    window.archiveMember = id => {
        if (id === undefined || id === null || id === "") {
            alert("No member selected to archive.");
            return;
        }

        const member = getDirectoryCustomers().find(c => String(c.id) === String(id));
        if (!member) {
            alert("Member not found. It may have already been archived.");
            return;
        }
        if (!confirm(`Archive ${member.name}? The record is kept as a past member and can be restored later.`)) return;

        if (!archiveMemberById(id)) {
            alert("Member not found. It may have already been archived.");
            return;
        }

        logActivity({
            type: "membership",
            title: `${member.name} was archived as a past member`,
            meta: `${member.tier || "Membership"} • Joined ${member.joined || "—"} • Expires ${member.updatedExpirationDate || member.exp || "—"}`,
            href: activityHref("members.html", member.name)
        });

        renderCustomerDirectory();
        renderArchivedMembers();
        countExpiringMembers();
        countActiveMembers();
    };

    // Restore Member: brings an archived record back into the active directory.
    window.restoreMember = id => {
        const member = getDirectoryCustomers().find(c => String(c.id) === String(id));
        if (!member) {
            alert("Member not found.");
            return;
        }
        if (!confirm(`Restore ${member.name} to the active directory?`)) return;

        if (!restoreMemberById(id)) {
            alert("Member not found.");
            return;
        }

        logActivity({
            type: "membership",
            title: `${member.name} was restored from the archive`,
            meta: `${member.tier || "Membership"} • Archived ${member.archivedAt ? formatDateLogged(member.archivedAt) : "—"}`,
            href: activityHref("members.html", member.name)
        });

        renderCustomerDirectory();
        renderArchivedMembers();
        countExpiringMembers();
        countActiveMembers();
    };

    // Repaints every view that shows membership state, so a renewal taken on
    // one page never leaves a stale badge or button behind on another view of
    // the same tab.
    function refreshMembershipViews() {
        if (document.getElementById("customerTableBody")) renderCustomerDirectory();
        if (document.getElementById("archivedTableBody")) renderArchivedMembers();
        if (document.getElementById("recentActivityList")) renderRecentActivity();
        if (document.getElementById("coachTableBody") && typeof renderCoachTracker === "function") renderCoachTracker();
        if (document.getElementById("chartMembersStatus")) renderDashboardCharts();

        countExpiringMembers();
        countActiveMembers();
        if (document.getElementById("statExpiring")) syncDashboard();
    }

    // Renew Membership: extends the member's existing tier by one more term and
    // records the action in the activity feed. Every page that surfaces a
    // renewal button (Customer Directory, Coach Tracker, client dialogs) calls
    // this one function, so a renewal always behaves the same wherever it is
    // triggered from.
    window.renewMemberById = (encodedId) => {
        const id = decodeURIComponent(encodedId || "");
        const member = getDirectoryCustomers().find(c => String(c.id) === String(id));
        if (!member) {
            alert("Member not found. It may have already been removed.");
            return false;
        }

        const today = todayStart();
        const name = member.name || "This member";

        // Archived members are not up for renewal: restoring the record is the
        // deliberate first step for a past member who wants to come back.
        if (memberIsArchived(member)) {
            alert(`${name} is an Archived (past) member. Restore the record from the Customer Directory before renewing.`);
            return false;
        }

        if (!membershipNeedsRenewal(member, today)) {
            alert(`${name}'s membership is not due for renewal yet (${renewalCountdownLabel(member, today)}).`);
            return false;
        }

        const nextExp = renewalExpirationFor(member, today);
        if (!nextExp) {
            alert(`${name} does not have a valid membership tier, so the renewal term cannot be derived. Set a tier with Edit Membership first.`);
            return false;
        }

        const months = tierDurationMonths(member.tier);
        if (!confirm(`Renew ${name}'s ${member.tier}?\n\n${renewalCountdownLabel(member, today)} • New expiration: ${nextExp}\n\nConfirm the payment at the front desk before saving.`)) {
            return false;
        }

        const previousExp = member.exp || "";
        if (!updateDirectoryExpiration(member.id, nextExp)) {
            alert("Member not found. It may have already been removed.");
            return false;
        }

        logActivity({
            type: "membership",
            title: `${name}'s membership was renewed`,
            meta: `${member.tier} • +${months} months • ${previousExp ? `Was expiring ${previousExp}` : "Expired"} • Now expires ${nextExp}`,
            href: activityHref("members.html", name)
        });

        // The dialog that triggered the renewal holds a copy of the old record,
        // so it is closed before the views repaint.
        ["customerModal", "clientDetailsModal", "coachDetailsModal"].forEach(id2 => {
            const modal = document.getElementById(id2);
            if (modal) modal.style.display = "none";
        });

        refreshMembershipViews();
        return true;
    };

    // A tier always carries a fixed term, so the expiration date is never typed
    // in by hand: it is the member's join date plus the selected tier's term.
    // Keeping the date read-only and recomputing it from the tier is what makes
    // the two fields impossible to desynchronise, matching how register.html
    // derives the expiration for a new sign-up.
    function customerExpirationFor(tier, joined) {
        const months = tierDurationMonths(tier);
        if (!months) return "";
        const base = new Date(`${joined}T00:00:00`);
        if (isNaN(base.getTime())) return "";
        return computeExpirationDate(months, base);
    }

    function buildCustomerTierOptions() {
        const select = document.getElementById("customerTier");
        if (!select) return;
        select.innerHTML = PIPELINE_TIERS.map(tier =>
            `<option value="${escapeHtml(tier.value)}">${escapeHtml(tier.label)}</option>`
        ).join("");
    }

    // Repaint the locked expiration field so it always reflects the chosen tier
    function syncCustomerExpiration() {
        const tierEl = document.getElementById("customerTier");
        const expEl = document.getElementById("customerExp");
        const noteEl = document.getElementById("customerExpNote");
        if (!tierEl || !expEl) return;

        const months = tierDurationMonths(tierEl.value);
        const exp = customerExpirationFor(tierEl.value, document.getElementById("customerJoined").value);
        expEl.value = exp || "—";
        if (!noteEl) return;
        if (exp) {
            noteEl.textContent = `Auto-computed: ${months}-month term from the date joined.`;
        } else if (months) {
            noteEl.textContent = "This member has no valid date joined, so the expiration date cannot be derived.";
        } else {
            noteEl.textContent = "Select a membership tier to set the expiration date.";
        }
    }

    // Edit Membership: the member is looked up in the merged directory view, but
    // the change is written back to whichever store actually owns the record.
    window.openEditCustomer = (encodedId) => {
        const id = decodeURIComponent(encodedId);
        const modal = document.getElementById("customerModal");
        if (!modal) return;

        const customer = getDirectoryCustomers().find(c => String(c.id) === String(id));
        if (!customer) {
            alert("Member not found. It may have already been removed.");
            return;
        }

        buildCustomerTierOptions();
        document.getElementById("customerId").value = customer.id;
        document.getElementById("customerName").value = customer.name || "";
        document.getElementById("customerContact").value = customer.contact || "—";
        document.getElementById("customerKeyFob").value = customer.keyFob || "—";
        document.getElementById("customerJoined").value = customer.joined || "";

        const tierEl = document.getElementById("customerTier");
        tierEl.value = PIPELINE_TIERS.some(tier => tier.value === customer.tier)
            ? customer.tier
            : PIPELINE_TIERS[0].value;

        document.getElementById("customerFormError").textContent = "";
        document.getElementById("customerModalTitle").textContent = `Edit ${customer.name || "Member"}'s Membership`;
        document.getElementById("saveCustomerBtn").textContent = "Update Membership";
        syncCustomerExpiration();
        syncCustomerRenewalButton(customer);
        modal.style.display = "flex";
    };

    // The dialog carries the same renewal action as the table row, so staff can
    // renew straight from the member they are already editing. It stays hidden
    // for a membership that is not due yet.
    function syncCustomerRenewalButton(customer) {
        const btn = document.getElementById("renewCustomerBtn");
        if (!btn) return;

        if (!membershipNeedsRenewal(customer)) {
            btn.style.display = "none";
            return;
        }

        const nextExp = renewalExpirationFor(customer);
        btn.style.display = "";
        btn.textContent = nextExp ? `Renew Membership → ${nextExp}` : "Renew Membership";
    }

    // Save Membership: writes tier + derived expiration back to crmCustomers
    // (registered accounts, keyed by "reg-<username>") or to crmDirectory
    // (front desk records), so the member's own portal stays in step too.
    window.saveCustomer = () => {
        const id = document.getElementById("customerId").value;
        const tier = document.getElementById("customerTier").value;
        const joined = document.getElementById("customerJoined").value;
        const errorEl = document.getElementById("customerFormError");

        const fail = message => {
            errorEl.textContent = message;
            return false;
        };

        if (!id) return fail("No member selected to update.");
        if (!tierDurationMonths(tier)) return fail("Please select a valid membership tier.");

        const exp = customerExpirationFor(tier, joined);
        if (!exp) return fail("This member has no valid date joined, so the expiration date cannot be derived.");

        const isRegistered = String(id).indexOf("reg-") === 0;
        let record;
        let list;
        let storeKey;

        if (isRegistered) {
            const username = id.slice(4);
            storeKey = "crmCustomers";
            list = JSON.parse(localStorage.getItem(storeKey) || "[]");
            record = list.find(c => c.username === username);
        } else {
            storeKey = DIRECTORY_KEY;
            list = JSON.parse(localStorage.getItem(storeKey) || "[]");
            record = list.find(d => String(d.id) === String(id));
        }
        if (!record) return fail("Member not found. It may have already been removed.");

        const previousTier = record.tier || "";
        record.tier = tier;
        record.exp = exp;
        localStorage.setItem(storeKey, JSON.stringify(list));

        const name = record.name || "";
        const status = customerStatus(exp, new Date());
        if (previousTier !== tier) {
            logActivity({
                type: "membership",
                title: `${name || "A member"}'s membership was updated to ${tier}`,
                meta: `Was ${previousTier || "no tier"} • Expires ${exp} • ${status}`,
                href: activityHref("members.html", name)
            });
        }

        document.getElementById("customerModal").style.display = "none";
        renderCustomerDirectory();
        countExpiringMembers();
        countActiveMembers();
    };

    // Edit Membership dialog
    const customerModal = document.getElementById("customerModal");
    if (customerModal) {
        buildCustomerTierOptions();
        const closeCustomerBtn = document.getElementById("closeCustomerModal");
        const cancelCustomerBtn = document.getElementById("cancelCustomerModal");
        const customerForm = document.getElementById("customerForm");
        const customerTierEl = document.getElementById("customerTier");

        if (closeCustomerBtn) closeCustomerBtn.addEventListener("click", () => { customerModal.style.display = "none"; });
        if (cancelCustomerBtn) cancelCustomerBtn.addEventListener("click", () => { customerModal.style.display = "none"; });
        if (customerForm) customerForm.addEventListener("submit", event => { event.preventDefault(); window.saveCustomer(); });
        if (customerTierEl) customerTierEl.addEventListener("change", syncCustomerExpiration);

        const renewCustomerBtn = document.getElementById("renewCustomerBtn");
        if (renewCustomerBtn) {
            renewCustomerBtn.addEventListener("click", () => {
                const id = document.getElementById("customerId").value;
                if (!id) return;
                window.renewMemberById(encodeURIComponent(id));
            });
        }
        customerModal.addEventListener("click", event => {
            if (event.target === customerModal) customerModal.style.display = "none";
        });
    }

    const freezeModal = document.getElementById("freezeModal");
    if (freezeModal) {
        const closeFreezeBtn = document.getElementById("closeFreezeModal");
        const cancelFreezeBtn = document.getElementById("cancelFreezeModal");
        if (closeFreezeBtn) closeFreezeBtn.addEventListener("click", () => { freezeModal.style.display = "none"; });
        if (cancelFreezeBtn) cancelFreezeBtn.addEventListener("click", () => { freezeModal.style.display = "none"; });
        freezeModal.addEventListener("click", event => {
            if (event.target === freezeModal) freezeModal.style.display = "none";
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
            const previous = id ? leads.find(l => String(l.id) === String(id)) : null;
            if (id) {
                const idx = leads.findIndex(l => String(l.id) === String(id));
                if (idx > -1) leads[idx] = { ...leads[idx], ...data };
            } else {
                data.id = Date.now();
                leads.push(data);
            }

            savePipelineLeads(leads);
            logLeadActivity(previous, data, !previous);
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

            // Stale feedback from a previous entry would otherwise greet the user
            // the moment the form reopens.
            const hint = document.getElementById("campaignPostUrlHint");
            const error = document.getElementById("campaignPostUrlError");
            if (hint) { hint.textContent = ""; hint.hidden = true; }
            if (error) { error.textContent = ""; error.hidden = true; }

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

    // Live feedback on the post link: an unrecognised address is explained before
    // the campaign is saved, and a recognised one picks its own platform so staff
    // do not have to set Instagram and Facebook twice.
    const campaignPostUrlInput = document.getElementById("campaignPostUrl");
    const campaignPostUrlHint = document.getElementById("campaignPostUrlHint");
    const campaignPostUrlError = document.getElementById("campaignPostUrlError");

    if (campaignPostUrlInput) {
        campaignPostUrlInput.addEventListener("input", () => {
            const info = parseSocialPostUrl(campaignPostUrlInput.value);

            if (campaignPostUrlError) {
                campaignPostUrlError.textContent = info.reason;
                campaignPostUrlError.hidden = !info.reason;
            }
            if (campaignPostUrlHint) {
                campaignPostUrlHint.textContent = info.ok ? info.note : "";
                campaignPostUrlHint.hidden = !info.ok;
            }

            if (info.ok && CAMPAIGN_PLATFORMS.includes(info.platform) && campaignPlatformSelect) {
                campaignPlatformSelect.value = info.platform;
                campaignPlatformSelect.dispatchEvent(new Event("change", { bubbles: true }));
            }
        });

        campaignPostUrlInput.addEventListener("blur", () => {
            // A link copied without a scheme is normalised on the way out so what
            // gets stored is the address the parser actually accepted.
            const info = parseSocialPostUrl(campaignPostUrlInput.value);
            if (info.ok && !/^https?:\/\//i.test(campaignPostUrlInput.value.trim())) {
                campaignPostUrlInput.value = info.url;
            }
        });
    }

    if (campaignForm) {
        campaignForm.addEventListener("submit", (e) => {
            e.preventDefault();
            const title = document.getElementById("campaignTitle").value.trim();
            if (!title) {
                alert("Please enter the campaign title.");
                return;
            }

            // A post link that cannot be parsed is refused here rather than saved,
            // because the card's preview and embed both depend on a real permalink.
            // The field stays optional: campaigns without a link still save.
            const postUrl = document.getElementById("campaignPostUrl").value.trim();
            const postInfo = parseSocialPostUrl(postUrl);
            if (postUrl && !postInfo.ok) {
                if (campaignPostUrlError) {
                    campaignPostUrlError.textContent = postInfo.reason;
                    campaignPostUrlError.hidden = false;
                }
                if (campaignPostUrlHint) campaignPostUrlHint.hidden = true;
                if (campaignPostUrlInput) campaignPostUrlInput.focus();
                return;
            }

            const platform = document.getElementById("campaignPlatform").value;
            const customPlatform = document.getElementById("campaignPlatformOther").value.trim();

            const campaigns = getCampaigns();
            const data = {
                title,
                platform: platform === "Other" && customPlatform ? customPlatform : platform,
                status: document.getElementById("campaignStatus").value,
                // The canonical permalink is stored so the official embed script
                // is handed exactly the URL shape it documents.
                postUrl: postInfo.ok ? postInfo.url : "",
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
            if (!customer) {
                errorEl.textContent = "Customer not found or invalid credentials.";
                return;
            }

            // Archiving retires the membership, so the archived account is
            // refused here. Credentials are checked first so the message never
            // reveals that an account exists. Restoring the record clears the
            // flag and lets the member straight back in.
            if (memberIsArchived(customer)) {
                errorEl.textContent = "This account belongs to a past member and is archived. Please contact the front desk to restore your membership.";
                return;
            }

            sessionStorage.setItem("crmRole", "customer");
            sessionStorage.setItem("crmCurrentUser", username);
            location.href = "customer.html";
        });
    }

    if (registerForm) {
        const regTierEl = document.getElementById("regTier");
        const regFobEl = document.getElementById("regKeyFob");
        const regExpEl = document.getElementById("regExp");
        const regPhoneEl = document.getElementById("regPhone");

        // The phone field accepts digits only, capped at the 11 digits of a local
        // mobile number. Typing, pasting and autofill all go through the same
        // filter, so a letter or an extra digit never reaches the member record.
        if (regPhoneEl) {
            regPhoneEl.addEventListener("input", () => {
                const digits = regPhoneEl.value.replace(/\D/g, "").slice(0, 11);
                if (regPhoneEl.value !== digits) regPhoneEl.value = digits;
            });
        }

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
            const phone = regPhoneEl ? regPhoneEl.value.replace(/\D/g, "").slice(0, 11) : "";
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

            if (phone && !/^\d{11}$/.test(phone)) {
                errorEl.textContent = "Phone number must be exactly 11 digits.";
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
            logActivity({
                type: "member",
                title: `${name} registered as a new member`,
                meta: `${tier || "Membership"} • Key Fob ${keyFob}`,
                href: activityHref("members.html", name)
            });
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

        // The login form already refuses an archived account, but a session
        // opened before the member was archived has to be dropped too, or the
        // portal would keep serving a past member until the tab is closed.
        if (memberIsArchived(customer)) {
            logoutCustomer();
            return;
        }

        document.getElementById("welcomeName").textContent = customer.name.split(" ")[0];
        document.getElementById("pName").textContent = customer.name;
        document.getElementById("pEmail").textContent = customer.email || "—";
        document.getElementById("pPhone").textContent = customer.phone || "—";
        document.getElementById("pAddress").textContent = customer.address || "—";
        document.getElementById("pTier").textContent = customer.tier;
        document.getElementById("pJoined").textContent = customer.joined;
        // The inquiry form shows the contact details already on file instead of
        // taking them from the member, so an inquiry can never quote details the
        // rest of the portal disagrees with.
        if (document.getElementById("inqContact")) {
            document.getElementById("inqContact").textContent = [
                customer.email,
                customer.phone,
                customer.address
            ].filter(Boolean).join(" • ") || "No contact details on file — the front desk can still reach you at the counter.";
        }
        if (document.getElementById("pFob")) document.getElementById("pFob").textContent = customer.keyFob || customer.username || "—";

        const months = tierDurationMonths(customer.tier);
        const custExp = customer.updatedExpirationDate || customer.exp || (months && customer.joined ? computeExpirationDate(months, new Date(customer.joined + "T00:00:00")) : "");
        if (document.getElementById("pExp")) document.getElementById("pExp").textContent = custExp || "—";
        if (document.getElementById("pFrozenUntil")) {
            if (customer.status === "Frozen" && customer.freezeEndDate) {
                document.getElementById("pFrozenUntil").textContent = customer.freezeEndDate;
            } else {
                document.getElementById("pFrozenUntil").textContent = "—";
            }
        }
        if (document.getElementById("pOrigExp")) {
            document.getElementById("pOrigExp").textContent = customer.originalExpirationDate || "—";
        }

        const pStatusEl = document.getElementById("pStatus");
        if (pStatusEl) {
            const today = todayStart();
            const member = customer;
            const status = getMemberStatus({ ...customer, exp: custExp }, today);
            let cls = status === "Active" ? "active" : status === "Frozen" ? "warning" : (status === "Expired" ? "danger" : (status === "Archived" ? "open" : "warning"));
            if (status === "Frozen") {
                pStatusEl.innerHTML = "Frozen" + (customer.freezeEndDate ? "<br/>Frozen until " + customer.freezeEndDate : "");
                pStatusEl.className = "badge " + cls;
            } else {
                pStatusEl.textContent = status;
                pStatusEl.className = "badge " + cls;
            }
        }

        // Renewal panel + button, shown only while the term is expiring or expired
        renderPortalRenewal(customer, custExp);

        window.requestPortalRenewal = () => {
            if (!submitPortalRenewalRequest(customer, custExp)) {
                renderPortalRenewal(customer, custExp);
                return;
            }
            if (renderMyInquiries) renderMyInquiries();
            renderPortalRenewal(customer, custExp);
        };

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
                            ${inq.kind === RENEWAL_REQUEST_KIND ? '<span class="badge renewal">Renewal</span>' : ""}
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

        renderPortalCoachSection(customer);
        renderMyInquiries();

        // Ratings come from the member side only: the handler is scoped to this
        // page so the coach directory has no way to submit one, and it refuses a
        // second rating from the same member for the same coach.
        window.rateCoach = coachId => {
            const coach = coachById(coachId || window.portalCoachId);
            const select = document.getElementById("portalCoachRating");
            const input = document.getElementById("portalCoachFeedbackInput");
            const msg = document.getElementById("portalRatingMsg");
            if (!coach || !select || !input || !msg) return;

            const stars = Number(select.value) || 0;
            const comment = input.value.trim();
            if (stars < 1 || stars > 5) {
                msg.className = "error-msg";
                msg.textContent = "Please choose a rating between 1 and 5.";
                return;
            }
            if (!comment) {
                msg.className = "error-msg";
                msg.textContent = "Please tell us a little about your coach.";
                return;
            }

            const coaches = getCoaches();
            const target = coaches.find(item => String(item.id) === String(coach.id));
            if (!target) {
                msg.className = "error-msg";
                msg.textContent = "Your coach profile is no longer available. Please contact the front desk.";
                return;
            }

            const clientId = "reg-" + (customer.username || "");
            const ratings = Array.isArray(target.ratings) ? target.ratings : [];
            if (ratings.some(row => String(row.clientId) === clientId)) {
                msg.className = "error-msg";
                msg.textContent = `You have already rated ${target.name}. Each member can rate their coach once.`;
                return;
            }

            ratings.push({
                id: `rating-${Date.now().toString(36)}`,
                stars,
                comment,
                at: new Date().toISOString(),
                clientId,
                clientName: customer.name
            });
            target.ratings = ratings.slice(-COACH_FEEDBACK_LIMIT);
            target.ratingSum = (Number(target.ratingSum) || 0) + stars;
            target.ratingCount = (Number(target.ratingCount) || 0) + 1;
            saveCoaches(coaches);

            logActivity({
                type: "coach",
                title: `${target.name} received a ${stars}-star rating from ${customer.name}`,
                meta: `${shortenLabel(comment, 68)} • ${coachRatingAverage(target).toFixed(1)}/5 based on ${target.ratingCount} rating${Number(target.ratingCount) === 1 ? "" : "s"}`,
                href: "coach.html"
            });

            // Repaint first: the form is replaced by the submitted review, then
            // the confirmation is written underneath it.
            renderPortalCoachSection(customer);
            const done = document.getElementById("portalRatingMsg");
            if (done) {
                done.className = "success-msg";
                done.textContent = "Thank you! Your rating and feedback were submitted.";
            }
        };

        // A portal inquiry arrives untriaged: the member neither chooses a priority nor
// supplies contact details. Priority stays "Not Defined" until support staff
// rank it from the ticket details dialog, so the queue shows honestly what has
// not been looked at yet.
window.submitInquiry = () => {
            const message = document.getElementById("inqMessage").value.trim();
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
                email: customer.email || "",
                phone: customer.phone || "",
                address: customer.address || "",
                date: dateTimeStr,
                message,
                priority: PRIORITY_NOT_DEFINED,
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
            logActivity({
                type: "ticket",
                title: `${customer.name} submitted a new inquiry`,
                meta: `Awaiting staff triage • ${activityTopic(message) || "Portal inquiry"}`,
                href: activityHref("tickets.html", customer.name)
            });
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

            const newTicket = tickets[tickets.length - 1];
            logActivity({
                type: "ticket",
                title: `${newTicket.name} submitted a walk-in request`,
                meta: `${newTicket.priority} priority • Ticket ${activityTicketRef(newTicket.id)}`,
                href: activityHref("tickets.html", newTicket.name)
            });

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
        if (document.querySelector("#statExpiring") || document.querySelector("#statOpenTickets") || document.querySelector("#statActive") || document.querySelector("#statFrozen") || document.querySelector("#statTotal")) {
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

// A portal inquiry arrives untriaged: the member neither chooses a priority nor
// supplies contact details. Priority stays "Not Defined" until support staff
// rank it from the ticket details dialog, so the queue shows honestly what has
// not been looked at yet.
const PRIORITY_NOT_DEFINED = "Not Defined";

function priorityClass(priority) {
    if (priority === "High") return "danger";
    if (priority === "Low") return "active";
    if (priority === PRIORITY_NOT_DEFINED) return "open";
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
// Re-picking the staff the lead already has is a no-op: nothing is written and
// no activity row is added, so browsing the dropdown cannot pile up feed rows.
function updateLeadStaff(id, staff) {
    const leads = getPipelineLeads();
    const idx = leads.findIndex(l => String(l.id) === String(id));
    if (idx === -1) return;

    const nextStaff = normalizePipelineStaff(staff);
    if (normalizePipelineStaff(leads[idx].staff) === nextStaff) return;

    leads[idx] = { ...leads[idx], staff: nextStaff };
    savePipelineLeads(leads);
    logLeadStaffAssigned(leads[idx], nextStaff);
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

// ---- Social post embeds (Instagram / Facebook) ----
// Neither platform exposes post content to a browser page directly, so a pasted
// link is all we can read here. The URL is therefore parsed into the canonical
// permalink each platform's official embed script expects, and the embed itself
// is requested from that script only when a user asks for it.
//
// Recognised shapes return { ok: true, platform, url, embeddable, note }.
// Anything else returns { ok: false, reason } so the caller can explain the
// problem in the campaign form instead of silently dropping the input.

const INSTAGRAM_HOSTS = ["instagram.com", "www.instagram.com", "m.instagram.com"];
const FACEBOOK_HOSTS = ["facebook.com", "www.facebook.com", "m.facebook.com", "web.facebook.com", "mbasic.facebook.com"];

// Short hosts that stand in for a facebook.com permalink. Facebook does not
// accept them in the XFBML plugin, so the card links out instead of embedding.
const FACEBOOK_SHORT_HOSTS = ["fb.watch", "fb.com"];

function hostMatches(host, list) {
    return list.indexOf(host.toLowerCase()) !== -1;
}

// Instagram permalinks are /p|reel|reels|tv/<shortcode>. The username segment
// some shared URLs carry is dropped so the embed script always gets the shape it
// documents, and the trailing slash is added back as the canonical form.
function parseInstagramPermalink(pathname) {
    const match = pathname.match(/^\/(?:[\w.%-]+\/)?(p|reel|reels|tv)\/([\w-]+)\/?$/);
    if (!match) return null;
    return `https://www.instagram.com/${match[1]}/${match[2]}/`;
}

// Facebook exposes the same post under many URLs. Reduce them to the documented
// permalink forms: the page posts path, and the photo/video/permalink endpoints.
function parseFacebookPermalink(url) {
    const path = url.pathname.replace(/\/+$/, "");
    const query = url.searchParams;

    if (path === "/permalink.php" && query.get("story_fbid")) {
        const id = query.get("id") || "";
        return `https://www.facebook.com/permalink.php?story_fbid=${encodeURIComponent(query.get("story_fbid"))}${id ? `&id=${encodeURIComponent(id)}` : ""}`;
    }

    const postMatch = path.match(/\/posts\/(\d+)$/);
    if (postMatch) return `https://www.facebook.com${path}/`;

    const fbid = query.get("fbid");
    if (fbid) return `https://www.facebook.com/photo.php?fbid=${encodeURIComponent(fbid)}`;

    const video = query.get("v");
    if (video) return `https://www.facebook.com/video.php?v=${encodeURIComponent(video)}`;

    const videoMatch = path.match(/\/videos\/(\d+)$/);
    if (videoMatch) return `https://www.facebook.com${path}/`;

    return null;
}

function parseSocialPostUrl(raw) {
    const value = String(raw || "").trim();
    if (!value) return { ok: false, reason: "" };

    // Accept links pasted without a scheme, which browsers treat as relative
    let candidate = value;
    if (!/^https?:\/\//i.test(candidate)) candidate = `https://${candidate}`;

    let parsed;
    try {
        parsed = new URL(candidate);
    } catch (e) {
        return { ok: false, reason: "That does not look like a valid web address." };
    }

    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        return { ok: false, reason: "Only http and https addresses can be previewed." };
    }

    const host = parsed.hostname;

    if (hostMatches(host, INSTAGRAM_HOSTS)) {
        const url = parseInstagramPermalink(parsed.pathname);
        if (!url) {
            return { ok: false, reason: "Use an Instagram post link such as instagram.com/p/XXXXXX. Stories and profile pages cannot be embedded." };
        }
        return { ok: true, platform: "Instagram", url, embeddable: true, note: "Instagram post recognised. It will render as a live embed." };
    }

    if (hostMatches(host, FACEBOOK_HOSTS)) {
        const url = parseFacebookPermalink(parsed);
        if (!url) {
            return { ok: false, reason: "Use a link to a specific Facebook post, photo, video or reel. Facebook pages cannot be embedded." };
        }
        return { ok: true, platform: "Facebook", url, embeddable: true, note: "Facebook post recognised. It will render as a live embed." };
    }

    if (hostMatches(host, FACEBOOK_SHORT_HOSTS)) {
        return {
            ok: true,
            platform: "Facebook",
            url: parsed.href,
            embeddable: false,
            note: "Facebook share links open the post but cannot be embedded. Paste the full facebook.com post link to preview it here."
        };
    }

    if (hostMatches(host, ["twitter.com", "www.twitter.com", "x.com", "www.x.com"])) {
        return { ok: true, platform: "Twitter", url: parsed.href, embeddable: false, note: "Twitter posts link out only." };
    }

    if (hostMatches(host, ["tiktok.com", "www.tiktok.com", "vm.tiktok.com"])) {
        return { ok: true, platform: "TikTok", url: parsed.href, embeddable: false, note: "TikTok posts link out only." };
    }

    return { ok: false, reason: "Only Instagram and Facebook post links can be embedded here." };
}

// Reads the saved post link of a campaign and returns the same shape as
// parseSocialPostUrl so the card renderer never has to re-check for failures.
function campaignSocialInfo(campaign) {
    const raw = safeUrl(campaign.postUrl);
    if (!raw) return { ok: false, reason: "", platform: campaign.platform || "", url: "", embeddable: false };
    return parseSocialPostUrl(raw);
}

const CAMPAIGN_PLATFORM_TINTS = {
    Instagram: "instagram",
    Facebook: "facebook",
    Twitter: "twitter",
    TikTok: "tiktok"
};

// Platform chip drawn over the thumbnail. The chip text also keeps the card
// searchable by platform name through the existing topbar filter.
function campaignPlatformChip(platform) {
    if (!platform) return "";
    const tint = CAMPAIGN_PLATFORM_TINTS[platform] || "generic";
    return `<span class="social-platform social-platform-${tint}">${escapeHtml(platform)}</span>`;
}

// The embedded post is unusable inside a 190px dashboard column, so an expanded
// card takes the full width of the grid instead of stretching a single column.
function setCampaignEmbedded(card, expanded) {
    if (!card) return;
    card.classList.toggle("is-embedded", !!expanded);
    const panel = card.querySelector(".campaign-embed");
    if (panel) panel.hidden = !expanded;
    const toggle = card.querySelector(".social-embed-toggle");
    if (toggle) {
        toggle.textContent = expanded ? "Hide Post" : "Preview Post";
        toggle.setAttribute("aria-expanded", expanded ? "true" : "false");
    }
}

function buildCampaignCard(campaign) {
    const div = document.createElement("div");
    div.className = "campaign-card";
    div.setAttribute("data-id", campaign.id);

    const info = campaignSocialInfo(campaign);
    const imageUrl = safeUrl(campaign.imageUrl);
    const label = escapeHtml(info.ok && info.embeddable ? "Open Post" : "View Post");
    const link = info.url
        ? `<a href="${escapeHtml(info.url)}" target="_blank" rel="noopener" class="social-link">${label}</a>`
        : "";

    // A saved link that no longer parses is surfaced on the card rather than
    // dropped, so the staff member who added it can see why it stopped working.
    const note = !info.ok && campaign.postUrl
        ? `<p class="campaign-note">Link not previewed: ${escapeHtml(info.reason)}</p>`
        : (info.ok && info.note && !info.embeddable
            ? `<p class="campaign-note">${escapeHtml(info.note)}</p>`
            : "");

    const toggle = info.ok && info.embeddable
        ? `<button class="btn-view social-embed-toggle" aria-expanded="false" onclick="toggleCampaignEmbed(${Number(campaign.id)})">Preview Post</button>`
        : "";

    div.innerHTML = `
        <div class="campaign-media">
            <img src="${escapeHtml(imageUrl || CAMPAIGN_PLACEHOLDER_IMAGE)}" alt="${escapeHtml(campaign.title)}" class="campaign-img">
            ${campaignPlatformChip(info.ok ? info.platform : campaign.platform)}
        </div>
        <h4>${escapeHtml(campaign.title)}</h4>
        ${note}
        ${link}
        ${campaignStatusBadge(campaign.status)}
        <div class="kanban-card-actions">
            <button class="btn-view" onclick="openEditCampaign(${Number(campaign.id)})">Edit</button>
            ${toggle}
            <button class="btn-delete" onclick="requestDeleteCampaign(${Number(campaign.id)})">Delete</button>
        </div>
        <div class="campaign-embed" hidden></div>
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

// Official embed scripts are loaded at most once per page, but only after a user
// opens a preview. They are keyed so Instagram and Facebook each get their own
// entry and a card that is reopened does not fetch the vendor code again.
const CAMPAIGN_EMBED_SCRIPTS = {};

const INSTAGRAM_EMBED_SRC = "https://www.instagram.com/embed.js";
const FACEBOOK_EMBED_SRC = "https://connect.facebook.net/en_US/sdk.js#xfbml=1&version=v19.0";

// A preview should never leave a card spinning, so a vendor script that stalls is
// treated the same as one that fails outright.
const CAMPAIGN_EMBED_TIMEOUT = 8000;

function loadCampaignEmbedScript(key, src) {
    if (CAMPAIGN_EMBED_SCRIPTS[key]) return CAMPAIGN_EMBED_SCRIPTS[key];

    const pending = new Promise((resolve, reject) => {
        const script = document.createElement("script");
        script.src = src;
        script.async = true;
        script.onload = () => resolve();
        script.onerror = () => reject(new Error(`The ${key} embed script could not be reached.`));
        document.head.appendChild(script);
    });

    CAMPAIGN_EMBED_SCRIPTS[key] = pending;

    // Clearing the cache on failure lets a user retry after coming back online
    // instead of being stuck with a permanently broken preview.
    pending.catch(() => {
        if (CAMPAIGN_EMBED_SCRIPTS[key] === pending) delete CAMPAIGN_EMBED_SCRIPTS[key];
    });

    return pending;
}

function withCampaignEmbedTimeout(promise, label) {
    return Promise.race([
        promise,
        new Promise((_, reject) => setTimeout(() => reject(new Error(label)), CAMPAIGN_EMBED_TIMEOUT))
    ]);
}

// Shared shell for an open preview: a heading with a permanent link out, so a
// visitor is never trapped behind a vendor script that failed to render.
function buildCampaignEmbedPanel(platform, url) {
    const panel = document.createElement("div");
    panel.className = "campaign-embed-panel";

    const head = document.createElement("div");
    head.className = "campaign-embed-head";

    const title = document.createElement("span");
    title.className = "campaign-embed-title";
    title.textContent = `${platform} preview`;

    const link = document.createElement("a");
    link.className = "social-link";
    link.href = url;
    link.target = "_blank";
    link.rel = "noopener";
    link.textContent = "Open Post ↗";

    head.appendChild(title);
    head.appendChild(link);

    const frame = document.createElement("div");
    frame.className = "campaign-embed-frame";

    panel.appendChild(head);
    panel.appendChild(frame);
    return { panel, frame };
}

function campaignEmbedFailed(panel, message) {
    const frame = panel.querySelector(".campaign-embed-frame");
    if (!frame) return;

    frame.innerHTML = "";
    const note = document.createElement("p");
    note.className = "campaign-note";
    note.textContent = message;
    frame.appendChild(note);
    panel.dataset.state = "error";
}

// Instagram renders through a blockquote placeholder that embed.js upgrades into
// an iframe. The blockquote content is the documented no-script fallback.
function mountInstagramEmbed(panel, url) {
    const { panel: shell, frame } = buildCampaignEmbedPanel("Instagram", url);
    panel.appendChild(shell);

    const quote = document.createElement("blockquote");
    quote.className = "instagram-media campaign-embed-post";
    quote.setAttribute("data-instgrm-permalink", url);
    quote.setAttribute("data-instgrm-version", "14");
    quote.setAttribute("data-instgrm-captioned", "");

    const fallback = document.createElement("a");
    fallback.href = url;
    fallback.target = "_blank";
    fallback.rel = "noopener";
    fallback.textContent = "View this post on Instagram";
    quote.appendChild(fallback);

    frame.appendChild(quote);

    return loadCampaignEmbedScript("Instagram", INSTAGRAM_EMBED_SRC)
        .then(() => {
            if (window.instgrm && window.instgrm.Embeds) {
                window.instgrm.Embeds.process(quote);
                panel.dataset.state = "ready";
                return;
            }
            throw new Error("Instagram's embed script loaded without its embedder.");
        })
        .catch((error) => campaignEmbedFailed(panel, error.message));
}

// Facebook uses the XFBML plugin, which reads data-href off a plain container and
// swaps in an iframe of its own.
function mountFacebookEmbed(panel, url) {
    const { panel: shell, frame } = buildCampaignEmbedPanel("Facebook", url);
    panel.appendChild(shell);

    const post = document.createElement("div");
    post.className = "fb-post";
    post.setAttribute("data-href", url);
    post.setAttribute("data-width", "500");
    post.setAttribute("data-show-text", "true");
    frame.appendChild(post);

    return loadCampaignEmbedScript("Facebook", FACEBOOK_EMBED_SRC)
        .then(() => {
            if (window.FB && window.FB.XFBML) {
                window.FB.XFBML.parse(frame);
                panel.dataset.state = "ready";
                return;
            }
            throw new Error("Facebook's embed script loaded without its plugin.");
        })
        .catch((error) => campaignEmbedFailed(panel, error.message));
}

function requestCampaignEmbed(panel, info) {
    panel.dataset.state = "pending";

    const note = document.createElement("p");
    // Neutral tone while waiting: the warning note is reserved for real failures.
    note.className = "campaign-embed-loading";
    note.textContent = `Loading ${info.platform} post…`;
    panel.appendChild(note);

    const mount = info.platform === "Instagram" ? mountInstagramEmbed : mountFacebookEmbed;
    return withCampaignEmbedTimeout(mount(panel, info.url), "The post took too long to load. Use Open Post to view it on the platform.")
        .then(() => note.remove())
        .catch((error) => {
            note.remove();
            campaignEmbedFailed(panel, error.message);
        });
}

// Expands or collapses the embedded post on one campaign card. Embeds are never
// requested on page load so the dashboard keeps its existing weight and the
// cards stay a fast, scannable summary.
function toggleCampaignEmbed(id) {
    const card = document.querySelector(`.campaign-card[data-id="${id}"]`);
    if (!card) return;

    const panel = card.querySelector(".campaign-embed");
    if (!panel) return;

    const wasExpanded = !panel.hidden;
    if (wasExpanded) {
        setCampaignEmbedded(card, false);
        return;
    }

    setCampaignEmbedded(card, true);
    if (panel.dataset.state === "ready" || panel.dataset.state === "pending") return;

    const campaign = getCampaigns().find(c => String(c.id) === String(id));
    const info = campaign && campaignSocialInfo(campaign);
    if (!info || !info.ok || !info.embeddable) {
        setCampaignEmbedded(card, false);
        return;
    }

    panel.innerHTML = "";
    requestCampaignEmbed(panel, info);
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
    document.getElementById("campaignPostUrl").value = campaign.postUrl || "";
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
                    status: c.status || "Active",
                    freezeStartDate: c.freezeStartDate || null,
                    freezeEndDate: c.freezeEndDate || null,
                    freezeMonths: c.freezeMonths || null,
                    originalExpirationDate: c.originalExpirationDate || c.exp || null,
                    updatedExpirationDate: c.updatedExpirationDate || exp || null,
                    // Archived is part of the projection: a registered account is
                    // whitelisted field by field here, so leaving it out would
                    // silently un-archive the member everywhere it is read.
                    archived: Boolean(c.archived),
                    archivedAt: c.archivedAt || null
                };
        });
    return [...staff, ...registered];
}

// One rule for "needs attention": anything inside this many days of its
// expiration date is expiring, everything past it is expired.
const RENEWAL_WINDOW_DAYS = 30;

function customerStatus(expDate, today) {
    if (!expDate) return "Active";
    const d = new Date(expDate);
    if (isNaN(d.getTime())) return "Active";
    const diffDays = (d - today) / (24 * 60 * 60 * 1000);
    if (diffDays < 0) return "Expired";
    if (diffDays <= RENEWAL_WINDOW_DAYS) return "Expiring Soon";
    return "Active";
}

// Add freeze-aware status helper
function getMemberStatus(member, today = todayStart()) {
    if (!member) return "Active";
    const now = today || todayStart();
    // Archiving outranks every membership rule: a past member stays a past
    // member, and a freeze that lapses on an archived record does not revive it.
    if (member.archived) return "Archived";
    if (member.status === "Frozen" && member.freezeEndDate) {
        const end = new Date(member.freezeEndDate + "T00:00:00");
        if (!isNaN(end.getTime()) && now >= end) {
            unfreezeMemberById(member.id);
            return "Active";
        }
        return "Frozen";
    }
    return customerStatus(member.exp || member.expirationDate || member.updatedExpirationDate, now);
}

// Archiving is how the gym retires a membership: the record, and everything
// hanging off it (sessions, ratings, tickets, activity), stays on file and the
// member leaves the active directory. Nothing is deleted.
function memberIsArchived(member) {
    return Boolean(member && member.archived);
}

// Current members only. Historical views (session history, activity links) keep
// using getDirectoryCustomers() so an archived member can still be read.
function getActiveDirectoryCustomers() {
    return getDirectoryCustomers().filter(c => !memberIsArchived(c));
}

function getArchivedDirectoryCustomers() {
    return getDirectoryCustomers()
        .filter(memberIsArchived)
        .sort((a, b) => String(b.archivedAt || "").localeCompare(String(a.archivedAt || "")));
}

// Applies a change to whichever store owns the record: a registered account
// (crmCustomers, keyed "reg-<username>") or a front desk directory entry
// (crmDirectory). Returns false when no record matches.
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

function archiveMemberById(id) {
    return mutateMemberRecord(id, record => {
        record.archived = true;
        record.archivedAt = new Date().toISOString();
    });
}

function restoreMemberById(id) {
    return mutateMemberRecord(id, record => {
        delete record.archived;
        delete record.archivedAt;
    });
}

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

function todayStart() {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    return date;
}

// Whole days from today to an expiration date, or null when the record has no
// usable date. Negative once the term has lapsed.
function daysUntilExpiration(expDate, today) {
    if (!expDate) return null;
    const target = new Date(expDate);
    if (isNaN(target.getTime())) return null;
    return Math.round((target - (today || todayStart())) / 86400000);
}

// "Expires in 5 days" / "Expires today" / "Expired 12 days ago"
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
function membershipNeedsRenewal(member, today) {
    if (!member || !member.tier) return false;
    const status = customerStatus(member.exp, today || todayStart());
    return status === "Expiring Soon" || status === "Expired";
}

// A renewal adds one full term of the member's existing tier, measured from the
// later of today and the current expiration date: renewing early never discards
// the days already paid for, and an expired membership restarts from today.
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
function addMonthsSafe(dateStr, months) {
    const d = new Date(dateStr + "T00:00:00");
    if (isNaN(d.getTime())) return "";
    const originalDay = d.getDate();
    d.setMonth(d.getMonth() + months);
    if (d.getDate() < originalDay) {
        d.setDate(0);
    }
    return d.toISOString().split("T")[0];
}

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
const SVG_NS = "http://www.w3.org/2000/svg";
const CHART_COLORS = { brand: "#5b4bc4", tier: "#8b7bf0", active: "#55c878", warning: "#f5b942", danger: "#e85d75", info: "#4f8df7" };

// Charts sit in a fixed-height box and scale up to fill the card, so the canvas
// is wider than the plot it holds. This is the unit width of the fixed-size
// charts; anything sized to the full card width measures the container instead.
const CHART_WIDTH = 520;
const CHART_HEIGHT = 184;

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

// Shared setup for every renderer: clears the container, handles the
// "nothing to show yet" case once, and hands back sized data to draw.
function beginChart(containerId, items, options) {
    const container = document.getElementById(containerId);
    if (!container) return null;

    const opts = Object.assign({
        title: "Chart",
        color: CHART_COLORS.brand,
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
        return null;
    }
    return { container, data, total, opts };
}

function newChartSvg(width, height, title) {
    const svg = svgNode("svg", {
        viewBox: `0 0 ${width} ${height}`, role: "img",
        "aria-label": title, preserveAspectRatio: "xMidYMid meet"
    });
    const titleNode = svgNode("title");
    titleNode.textContent = title;
    svg.appendChild(titleNode);
    return svg;
}

function chartText(x, y, text, className, anchor) {
    const node = svgNode("text", { x, y, class: className || "chart-label" });
    if (anchor) node.setAttribute("text-anchor", anchor);
    node.textContent = text;
    return node;
}

// Native <title> on a shape is the hover tooltip and the accessible name.
function chartTip(text) {
    const tip = svgNode("title");
    tip.textContent = text;
    return tip;
}

function chartPercent(value, total) {
    if (!total) return "0%";
    return `${Math.round((value / total) * 100)}%`;
}

// Rounds an axis maximum up to a friendly 1/2/5 x 10^n so gridline labels land
// on round numbers instead of whatever the data happened to peak at.
function niceCeil(value) {
    if (!(value > 0)) return 1;
    const magnitude = Math.pow(10, Math.floor(Math.log10(value)));
    const scaled = value / magnitude;
    const step = scaled <= 1 ? 1 : scaled <= 2 ? 2 : scaled <= 5 ? 5 : 10;
    return step * magnitude;
}

function chartTick(value) {
    const rounded = Math.round(value * 10) / 10;
    return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

// Donut — for a part-to-whole split (member statuses). Each state reads as a
// slice of one ring, so "how much of the base is active" is immediate, and the
// hole carries the total instead of the legend repeating it three times.
function renderDonutChart(containerId, items, options) {
    const chart = beginChart(containerId, items, options);
    if (!chart) return;
    const { container, data, total, opts } = chart;

    const width = CHART_WIDTH;
    const height = CHART_HEIGHT;
    const cx = 112;
    const cy = height / 2;
    const ring = 72;                 // radius of the band centre line
    const thickness = 26;
    const circumference = 2 * Math.PI * ring;

    const svg = newChartSvg(width, height, opts.title);

    // Faint full ring first, so a state with zero members leaves a visible gap
    svg.appendChild(svgNode("circle", {
        cx, cy, r: ring, class: "chart-track-ring", "stroke-width": thickness
    }));

    let drawn = 0;
    data.forEach(item => {
        const value = Number(item.value) || 0;
        if (value <= 0) return;
        const sweep = (value / total) * circumference;
        const gap = Math.max(1, sweep - 3);
        const slice = svgNode("circle", {
            cx, cy, r: ring, fill: "none",
            stroke: item.color || opts.color,
            "stroke-width": thickness,
            "stroke-dasharray": `${gap} ${circumference - gap}`,
            "stroke-dashoffset": -drawn,
            transform: `rotate(-90 ${cx} ${cy})`
        });
        slice.appendChild(chartTip(`${item.label}: ${value.toLocaleString("en-US")} (${chartPercent(value, total)})`));
        svg.appendChild(slice);
        drawn += sweep;
    });

    svg.appendChild(chartText(cx, cy + 2, total.toLocaleString("en-US"), "chart-value chart-value-lg", "middle"));
    svg.appendChild(chartText(cx, cy + 19, opts.centerLabel || "Total", "chart-label", "middle"));

    // Legend doubles as a table: colour chip, category, share of the ring
    const legendX = 212;
    const rowH = data.length > 4 ? 28 : 34;
    const firstRow = cy - ((data.length - 1) * rowH) / 2;
    data.forEach((item, index) => {
        const value = Number(item.value) || 0;
        const y = firstRow + index * rowH;
        svg.appendChild(svgNode("rect", { x: legendX, y: y - 8, width: 10, height: 10, fill: item.color || opts.color }));
        svg.appendChild(chartText(legendX + 17, y + 1, shortenLabel(item.label, 26), "chart-label chart-label-strong"));
        svg.appendChild(chartText(width - 2, y + 1, chartPercent(value, total), "chart-share", "end"));
    });

    container.appendChild(svg);
}

// Ranked horizontal bars — for comparing categories whose names are long
// ("18-Month Membership"). The labels get their own column, so nothing has to
// be truncated into "18-Mont…" underneath a vertical bar.
function renderRankedBars(containerId, items, options) {
    const chart = beginChart(containerId, items, options);
    if (!chart) return;
    const { container, data, opts } = chart;

    const width = CHART_WIDTH;
    const height = CHART_HEIGHT;
    const padY = 10;
    const labelW = 150;
    const valueW = 36;                // right-hand column for the count
    const plotW = width - labelW - valueW;
    const rowH = (height - padY * 2) / data.length;
    const barH = Math.max(9, Math.min(20, rowH * 0.5));
    const max = Math.max(...data.map(item => Number(item.value) || 0));

    const svg = newChartSvg(width, height, opts.title);

    data.forEach((item, index) => {
        const value = Number(item.value) || 0;
        const centerY = padY + rowH * index + rowH / 2;

        // Full-width ghost bar keeps every row on the same scale
        svg.appendChild(svgNode("rect", {
            x: labelW, y: centerY - barH / 2, width: plotW, height: barH, class: "chart-track"
        }));

        // item.note is the optional second line under the label (the tier price)
        const lines = item.note
            ? [shortenLabel(item.label, 19), shortenLabel(item.note, 19)]
            : [shortenLabel(item.label, 19)];
        lines.forEach((line, lineIndex) => {
            svg.appendChild(chartText(labelW - 10, centerY + (lines.length === 1 ? 4 : lineIndex * 11),
                line, lineIndex === 0 ? "chart-label chart-label-strong" : "chart-label", "end"));
        });

        const barW = value === 0 ? 0 : Math.max(3, (value / max) * plotW);
        const bar = svgNode("rect", {
            x: labelW, y: centerY - barH / 2, width: barW, height: barH,
            fill: item.color || opts.color
        });
        bar.appendChild(chartTip(`${item.label}: ${value.toLocaleString("en-US")}`));
        svg.appendChild(bar);

        svg.appendChild(chartText(width - 2, centerY + 4, value.toLocaleString("en-US"), "chart-value", "end"));
    });

    container.appendChild(svg);
}

// Area + line — for a time series (tickets per month). A bar per month hides
// the trend, while the slope and the shaded area make month-to-month movement
// the thing you actually see.
function renderTrendChart(containerId, items, options) {
    const chart = beginChart(containerId, items, options);
    if (!chart) return;
    const { container, data, opts } = chart;

    const width = CHART_WIDTH;
    const height = CHART_HEIGHT;
    const padLeft = 28;
    const padRight = 12;
    const padTop = 22;
    const padBottom = 26;
    const plotW = width - padLeft - padRight;
    const plotH = height - padTop - padBottom;
    const baseline = padTop + plotH;

    const values = data.map(item => Number(item.value) || 0);
    const peak = niceCeil(Math.max(...values));
    const color = opts.color || CHART_COLORS.info;
    const pointX = index => data.length === 1
        ? padLeft + plotW / 2
        : padLeft + (plotW / (data.length - 1)) * index;
    const pointY = value => padTop + plotH - (value / peak) * plotH;

    const svg = newChartSvg(width, height, opts.title);

    // Fade the fill out downwards so the line itself stays the focus
    const fillId = `chart-fill-${containerId}`;
    const defs = svgNode("defs");
    const gradient = svgNode("linearGradient", { id: fillId, x1: 0, y1: 0, x2: 0, y2: 1 });
    gradient.appendChild(svgNode("stop", { offset: "0%", "stop-color": color, "stop-opacity": ".26" }));
    gradient.appendChild(svgNode("stop", { offset: "100%", "stop-color": color, "stop-opacity": "0" }));
    defs.appendChild(gradient);
    svg.appendChild(defs);

    [0, 0.5, 1].forEach(fraction => {
        const y = padTop + plotH * (1 - fraction);
        svg.appendChild(svgNode("line", {
            x1: padLeft, y1: y, x2: width - padRight, y2: y,
            class: fraction === 0 ? "chart-axis" : "chart-grid", "stroke-width": 1
        }));
        svg.appendChild(chartText(padLeft - 6, y + 3, chartTick(peak * fraction), "chart-label", "end"));
    });

    const points = values.map((value, index) => `${pointX(index)},${pointY(value)}`).join(" ");
    if (data.length > 1) {
        svg.appendChild(svgNode("polygon", {
            points: `${pointX(0)},${baseline} ${points} ${pointX(data.length - 1)},${baseline}`,
            fill: `url(#${fillId})`
        }));
        svg.appendChild(svgNode("polyline", { points, class: "chart-line", stroke: color }));
    }

    data.forEach((item, index) => {
        const value = values[index];
        const x = pointX(index);
        const y = pointY(value);

        const dot = svgNode("circle", { cx: x, cy: y, r: 3.4, fill: color, class: "chart-dot" });
        dot.appendChild(chartTip(`${item.label}: ${value.toLocaleString("en-US")}`));
        svg.appendChild(dot);

        svg.appendChild(chartText(x, baseline + 16, item.label, "chart-label", "middle"));
        if (String(value).length <= 3) {
            svg.appendChild(chartText(x, y - 9, String(value), "chart-value chart-value-sm", "middle"));
        }
    });

    container.appendChild(svg);
}

// Single mix bar — for "how the whole splits across a few priorities". One
// 100% bar says "one queue, these three severities" without three bars all
// restating the same total.
function renderMixBar(containerId, items, options) {
    const chart = beginChart(containerId, items, options);
    if (!chart) return;
    const { container, data, total, opts } = chart;

    const width = CHART_WIDTH;
    const height = CHART_HEIGHT;
    const barY = 44;
    const barH = 44;
    const clipId = `chart-clip-${containerId}`;

    const svg = newChartSvg(width, height, opts.title);

    // A rounded clip keeps only the outer ends of the bar rounded
    const defs = svgNode("defs");
    const clip = svgNode("clipPath", { id: clipId });
    clip.appendChild(svgNode("rect", { x: 0, y: barY, width, height: barH, rx: 6 }));
    defs.appendChild(clip);
    svg.appendChild(defs);

    svg.appendChild(chartText(0, 24, `${total.toLocaleString("en-US")} ${opts.unit || "in total"}`, "chart-caption"));

    const segments = svgNode("g", { "clip-path": `url(#${clipId})` });
    let cursor = 0;
    data.forEach(item => {
        const value = Number(item.value) || 0;
        if (value <= 0) return;
        const segmentW = (value / total) * width;
        const segment = svgNode("rect", { x: cursor, y: barY, width: segmentW, height: barH, fill: item.color || opts.color });
        segment.appendChild(chartTip(`${item.label}: ${value.toLocaleString("en-US")} (${chartPercent(value, total)})`));
        segments.appendChild(segment);
        if (segmentW > 34) {
            segments.appendChild(chartText(cursor + segmentW / 2, barY + barH / 2 + 4,
                chartPercent(value, total), "chart-inbar", "middle"));
        }
        cursor += segmentW;
    });
    svg.appendChild(segments);

    // Legend rows carry the exact counts the bar itself can only round to
    const rowH = 28;
    const firstRow = barY + barH + 20;
    data.forEach((item, index) => {
        const value = Number(item.value) || 0;
        const y = firstRow + index * rowH;
        svg.appendChild(svgNode("rect", { x: 0, y: y - 8, width: 10, height: 10, fill: item.color || opts.color }));
        svg.appendChild(chartText(18, y + 1, shortenLabel(item.label, 26), "chart-label chart-label-strong"));
        svg.appendChild(chartText(width - 78, y + 1, value.toLocaleString("en-US"), "chart-value", "end"));
        svg.appendChild(chartText(width - 2, y + 1, chartPercent(value, total), "chart-share", "end"));
    });

    container.appendChild(svg);
}

// Funnel — for ordered pipeline stages. Each stage is a band that tapers into
// the width of the next one, so the whole card reads as a funnel instead of a
// bar chart, and every row is annotated with its drop-off from the stage above,
// which is the number a pipeline is actually read for.
function renderFunnelChart(containerId, items, options) {
    const chart = beginChart(containerId, items, options);
    if (!chart) return;
    const { container, data, opts } = chart;

    // This card is full width, so the SVG is drawn 1:1 with its container
    // instead of being letterboxed inside a fixed 340-unit viewBox.
    const width = Math.max(360, Math.round(container.clientWidth || 0));
    const height = 184;
    const headH = 22;
    const rowH = (height - headH - 6) / data.length;
    const labelW = Math.min(210, Math.max(130, width * 0.2));
    const valueW = 96;
    const zoneX = labelW + 14;
    const zoneW = Math.max(80, width - valueW - zoneX);
    const centerX = zoneX + zoneW / 2;
    const max = Math.max(...data.map(item => Number(item.value) || 0));
    const bandFor = value => value <= 0 ? 0 : Math.max(6, (value / max) * zoneW);

    const svg = newChartSvg(width, height, opts.title);

    svg.appendChild(chartText(labelW, 12, "STAGE", "chart-caption", "end"));
    svg.appendChild(chartText(width - 52, 12, "LEADS", "chart-caption", "end"));
    svg.appendChild(chartText(width - 2, 12, "vs PREV", "chart-caption", "end"));

    data.forEach((item, index) => {
        const value = Number(item.value) || 0;
        const topY = headH + rowH * index + 2;
        const bottomY = headH + rowH * (index + 1) - 2;
        const centerY = (topY + bottomY) / 2;
        const isLast = index === data.length - 1;

        // The band tapers into the next stage; the final one closes straight.
        const topW = bandFor(value);
        const bottomW = isLast ? topW * 0.72 : bandFor(Number(data[index + 1].value) || 0);

        const band = svgNode("polygon", {
            points: `${centerX - topW / 2},${topY} ${centerX + topW / 2},${topY} `
                + `${centerX + bottomW / 2},${bottomY} ${centerX - bottomW / 2},${bottomY}`,
            fill: item.color || opts.color,
            class: "chart-band"
        });
        band.appendChild(chartTip(`${item.label}: ${value.toLocaleString("en-US")}`));
        svg.appendChild(band);

        wrapLabel(item.label, Math.floor((labelW - 8) / 5.4)).forEach((line, lineIndex) => {
            svg.appendChild(chartText(labelW, centerY + (lineIndex === 0 ? 1 : 11),
                line, lineIndex === 0 ? "chart-label chart-label-strong" : "chart-label", "end"));
        });

        const previous = index > 0 ? Number(data[index - 1].value) || 0 : 0;
        svg.appendChild(chartText(width - 52, centerY + 4, value.toLocaleString("en-US"), "chart-value", "end"));
        svg.appendChild(chartText(width - 2, centerY + 4,
            index === 0 || previous === 0 ? "—" : chartPercent(value, previous), "chart-share", "end"));
    });

    container.appendChild(svg);
}

// Members split by membership status and by tier, from the Customer Directory.
// Archived members are left out: the charts describe the current membership.
function memberChartData() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const rows = getActiveDirectoryCustomers();

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

    // The tier price rides along as the second line of the ranked-bar label,
    // so the plan and what it costs are read together.
    const byTier = PIPELINE_TIERS.map(tier => ({
        label: tier.value,
        note: `$${tier.price}/mo`,
        value: tierCounts[tier.value] || 0
    }));
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

    // Untriaged portal inquiries get their own slice so the queue never hides the
// work that has not been ranked yet.
const byPriority = [PRIORITY_NOT_DEFINED, "High", "Medium", "Low"].map(priority => {
        const cls = priorityClass(priority);
        const color = priority === PRIORITY_NOT_DEFINED ? CHART_COLORS.info
            : cls === "danger" ? CHART_COLORS.danger
                : cls === "active" ? CHART_COLORS.active : CHART_COLORS.warning;
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

// One renderer per metric, picked to match the shape of the data: a donut for
// the member-status split, ranked bars for tiers (long names), a trend line for
// ticket volume over time, a mix bar for priority share, a funnel for stages.
function renderDashboardCharts() {
    if (!document.getElementById("chartMembersStatus")) return;

    const members = memberChartData();
    renderDonutChart("chartMembersStatus", members.byStatus, {
        title: "Members by membership status",
        centerLabel: "Members",
        emptyText: "No members in the directory yet."
    });
    renderRankedBars("chartMembersTier", members.byTier, {
        title: "Members by membership tier",
        emptyText: "No members in the directory yet.",
        color: CHART_COLORS.tier
    });

    const tickets = ticketChartData(6);
    renderTrendChart("chartTicketVolume", tickets.byMonth, {
        title: "Tickets logged per month over the last 6 months",
        emptyText: "No tickets logged in the last 6 months.",
        color: CHART_COLORS.info
    });
    renderMixBar("chartTicketPriority", tickets.byPriority, {
        title: "Tickets by priority",
        unit: "tickets",
        emptyText: "No tickets recorded yet."
    });

    renderFunnelChart("chartPipelineStages", pipelineChartData(), {
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
        const rows = getActiveDirectoryCustomers();
        const today = todayStart();

        let active = 0;
        let expiring = 0;
        let expired = 0;
        let frozen = 0;
        rows.forEach(c => {
            const status = getMemberStatus(c, today);
            if (status === "Active") active++;
            if (status === "Frozen") frozen++;
            if (status === "Expiring Soon") expiring++;
            if (status === "Expired") expired++;
        });

        const open = ticketsByStatus("open");
        const progress = ticketsByStatus("in progress");

        if (document.getElementById("statTotal")) setText("statTotal", formatNumber(rows.length));
        setText("statActiveNote", `${formatNumber(active)} of ${formatNumber(rows.length)} member record${rows.length === 1 ? "" : "s"} active`);
        if (document.getElementById("statFrozen")) setText("statFrozen", formatNumber(frozen));
        // Expired memberships are renewable too, so the renewal workload is
        // spelled out instead of leaving lapsed terms off the card.
        setText("statExpiringNote", [
            expiring ? `${formatNumber(expiring)} renewal${expiring === 1 ? "" : "s"} due within 30 days` : "No renewals due in the next 30 days",
            expired ? `${formatNumber(expired)} expired` : ""
        ].filter(Boolean).join(" · "));
        setText("statOpenNote", `${formatNumber(open)} open · ${formatNumber(progress)} in progress`);
    }

    // Dashboard: one counter per status under the marketing campaign cards
    function renderCampaignTotals() {
        const campaigns = getCampaigns();

        // Driven by the same list that colours the card badges, so the counters
        // and the status pills cannot drift apart.
        CAMPAIGN_STATUSES.forEach((meta) => {
            const count = campaigns.filter(c => String(c.status || "") === meta.value).length;
            setText(`campaignStat${meta.value}`, formatNumber(count));
        });
    }

    // Customer Directory: the three directory statistic cards
    function renderDirectoryStats() {
        if (!document.getElementById("memberStatTotal")) return;

        const today = todayStart();
        const rows = getActiveDirectoryCustomers();
        const withStatus = (status) => rows.filter(c => getMemberStatus(c, today) === status).length;

        const expiring = withStatus("Expiring Soon");
        const expired = withStatus("Expired");
        const frozen = withStatus("Frozen");

        setText("memberStatTotal", formatNumber(rows.length));
        setText("memberStatActive", formatNumber(withStatus("Active")));
        if (document.getElementById("memberStatFrozen")) setText("memberStatFrozen", formatNumber(frozen));
        setText("memberStatExpiring", formatNumber(expiring));
        if (document.getElementById("memberStatArchived")) {
            setText("memberStatArchived", formatNumber(getArchivedDirectoryCustomers().length));
        }
        setText("memberStatExpiringNote", [
            expiring ? `Renewals to collect within 30 days` : "No renewals due in the next 30 days",
            expired ? `${formatNumber(expired)} expired` : ""
        ].filter(Boolean).join(" · "));
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
    const TOPBAR_SEARCH_TARGETS = ["searchCustomer", "ticketSearch", "pipelineSearch", "coachSearch"];

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

    // And for the directory statistics, so an added, edited or removed member
    // immediately refreshes the member count cards
    const directoryTableBody = document.getElementById("customerTableBody");
    if (directoryTableBody && typeof MutationObserver === "function") {
        new MutationObserver(() => renderDirectoryStats()).observe(directoryTableBody, { childList: true });
    }

    // Another tab writing to localStorage refreshes the derived totals too
    window.addEventListener("storage", () => {
        renderKpiNotes();
        renderCampaignTotals();
        renderDirectoryStats();
        renderTicketStats();
    });
});

// =============================================================
// Recent Activity (additive only)
// A lightweight activity feed kept under one localStorage key, so the
// dashboard can show what happened most recently without introducing a new
// module or reshaping any existing record.
//
// The feed is a merge of two sources:
//   1. entries appended by logActivity() from the existing action handlers
//      (member registration, ticket creation / update / resolution, lead
//      creation, stage change, staff assignment and follow-up scheduling);
//   2. "membership expiring" / "membership expired" renewal rows derived on
//      the fly from the Customer Directory, which is already the source of
//      truth for renewals.
// Nothing here removes or renames an existing key, function or element, and
// every new function is guarded so the feed can never block a CRM action.
// =============================================================
const ACTIVITY_KEY = "crmActivities";
const ACTIVITY_LOG_LIMIT = 80;        // newest entries kept in storage
const ACTIVITY_PREVIEW_COUNT = 6;     // rows shown before "View All"
const ACTIVITY_FULL_COUNT = 30;       // rows shown after "View All"
const ACTIVITY_EXPIRING_LIMIT = 4;    // nearest renewals surfaced in the feed

// Icons match the stroke style of the existing nav / stat icons, and the tone
// reuses the shared status palette so each activity type reads at a glance.
const ACTIVITY_TYPES = {
    member: {
        tone: "brand",
        icon: '<svg viewBox="0 0 24 24"><path d="M15.5 19v-1.5a3.5 3.5 0 0 0-3.5-3.5H6.5A3.5 3.5 0 0 0 3 17.5V19"/><circle cx="9.2" cy="7.5" r="3.2"/><path d="M21 19v-1.5a3.5 3.5 0 0 0-2.6-3.38"/><path d="M16 4.3a3.2 3.2 0 0 1 0 6.2"/></svg>'
    },
    ticket: {
        tone: "blue",
        icon: '<svg viewBox="0 0 24 24"><path d="M20.5 12.5c0 3.6-3.8 6.5-8.5 6.5a9.7 9.7 0 0 1-2.6-.35L4.5 20.5l1.2-3.4A6.3 6.3 0 0 1 3.5 12.5C3.5 8.9 7.3 6 12 6s8.5 2.9 8.5 6.5Z"/><path d="M9 12.5h.01M12 12.5h.01M15 12.5h.01"/></svg>'
    },
    membership: {
        tone: "green",
        icon: '<svg viewBox="0 0 24 24"><path d="M20 11a8 8 0 1 0-2.2 6"/><path d="M20 6v5h-5"/></svg>'
    },
    frozen: {
        tone: "blue",
        icon: '<svg viewBox="0 0 24 24"><path d="M12 3v18M4.2 7.5l15.6 9M19.8 7.5l-15.6 9"/><path d="M12 7.2 9.8 5M12 7.2 14.2 5M12 16.8 9.8 19M12 16.8l2.2 2.2"/></svg>'
    },
    renewal: {
        tone: "brand",
        icon: '<svg viewBox="0 0 24 24"><path d="M20 11a8 8 0 1 0-2.2 6"/><path d="M20 6v5h-5"/></svg>'
    },
    followup: {
        tone: "brand",
        icon: '<svg viewBox="0 0 24 24"><rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M8 3v4M16 3v4M3.5 10h17"/><path d="M12 13.5h.01"/></svg>'
    },
    won: {
        tone: "green",
        icon: '<svg viewBox="0 0 24 24"><path d="m12 3.6 2.2 4.9 5.3.7-3.9 3.6 1 5.2-4.6-2.6-4.6 2.6 1-5.2L4.5 9.2l5.3-.7L12 3.6Z"/></svg>'
    },
    expiring: {
        tone: "amber",
        icon: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/></svg>'
    },
    expired: {
        tone: "rose",
        icon: '<svg viewBox="0 0 24 24"><path d="M12 4.5 21 19.5H3z"/><path d="M12 10v3.5"/><path d="M12 16.6h.01"/></svg>'
    },
    resolved: {
        tone: "green",
        icon: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5"/><path d="M8 12.3l2.7 2.7L16.2 9.5"/></svg>'
    },
    assignment: {
        tone: "blue",
        icon: '<svg viewBox="0 0 24 24"><path d="M4 20h4l10-10-4-4L4 16v4Z"/><path d="M13.5 6.5l4 4"/></svg>'
    },
    lead: {
        tone: "blue",
        icon: '<svg viewBox="0 0 24 24"><path d="M3 17.5l5.5-5.5 3.5 3.5L21 6.5"/><path d="M15.5 6.5H21V12"/></svg>'
    },
    coach: {
        tone: "brand",
        icon: '<svg viewBox="0 0 24 24"><rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M8 3v4M16 3v4M3.5 10h17"/><path d="M12 13.5h.01"/></svg>'
    }
};

// Deep link into a module that already supports a search box, so an activity
// click lands on the matching record instead of on a brand new page.
function activityHref(page, term) {
    const text = String(term || "").trim();
    return text ? `${page}?q=${encodeURIComponent(text)}` : page;
}

// Short, human ticket reference derived from the stored ticket id
function activityTicketRef(id) {
    const raw = String(id === undefined || id === null ? "" : id);
    // Trim the trailing run of zeros a millisecond timestamp ends with so the
    // reference stays readable, e.g. 1788123456789 -> #6789
    const trimmed = raw.replace(/0+$/, "");
    return `#${(trimmed || raw).slice(-4)}`;
}

// Turns a free-text inquiry into a compact subject line: the first sentence,
// capped so the meta row stays on one line.
function activityTopic(text) {
    const firstSentence = String(text || "").trim().split(/[.!?\n]/)[0].trim();
    return shortenLabel(firstSentence, 36);
}

function activityStageTitle(stageId) {
    const stage = PIPELINE_STAGES.find(s => s.id === stageId);
    return stage ? stage.title : "Pipeline";
}

// "5 minutes ago" / "1 hour ago", falling back to the shared date format
function relativeTime(value) {
    const stamp = new Date(value);
    if (isNaN(stamp.getTime())) return "";

    const minutes = Math.round((Date.now() - stamp.getTime()) / 60000);
    if (minutes < 1) return "just now";
    if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;

    const hours = Math.round(minutes / 60);
    if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;

    const days = Math.round(hours / 24);
    if (days < 8) return `${days} day${days === 1 ? "" : "s"} ago`;
    return formatDateLogged(value);
}

function getActivities() {
    try {
        const list = JSON.parse(localStorage.getItem(ACTIVITY_KEY) || "[]");
        return Array.isArray(list) ? list.filter(entry => entry && entry.title) : [];
    } catch (e) {
        return [];
    }
}

// Appends one activity. Every field is a display string composed by the caller,
// which keeps the renderer trivial. A storage failure must never interrupt the
// CRM action that triggered it, so the whole body is defensive.
function logActivity(entry) {
    try {
        const list = getActivities();
        list.unshift({
            id: `act-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            at: new Date().toISOString(),
            type: "ticket",
            title: "",
            meta: "",
            timeLabel: "",
            href: "",
            ...(entry || {})
        });
        localStorage.setItem(ACTIVITY_KEY, JSON.stringify(list.slice(0, ACTIVITY_LOG_LIMIT)));
    } catch (e) { /* the activity feed must never block a CRM action */ }
}

// Like logActivity, but first drops the existing rows for the same record so the
// feed carries one current row instead of a duplicate per interaction. `href`
// identifies the record, because it is built from that record's own name.
function replaceActivityForLead(entry, href) {
    try {
        const kept = getActivities().filter(row => !(row.type === entry.type && row.href === href));
        localStorage.setItem(ACTIVITY_KEY, JSON.stringify(kept));
        logActivity(entry);
    } catch (e) { /* the activity feed must never block a CRM action */ }
}

// Lead lifecycle: a new lead, a stage move, the follow-up it carries and the
// staff who owns it. `previous` is the stored lead before the edit, or null
// when the lead is new.
function logLeadActivity(previous, lead, isNew) {
    const staff = normalizePipelineStaff(lead.staff);
    const stageTitle = activityStageTitle(lead.stage);
    const tier = serviceTierLabel(lead.tier);
    const href = activityHref("pipeline.html", lead.name);

    const won = lead.stage === "won";
    if (isNew || (previous && previous.stage !== lead.stage)) {
        logActivity({
            type: won ? "won" : "lead",
            title: won
                ? `${staff} converted ${lead.name} into a member`
                : isNew
                    ? `${lead.name} was added to the pipeline`
                    : `${lead.name} moved to ${stageTitle}`,
            meta: previous && previous.stage
                ? `${activityStageTitle(previous.stage)} → ${stageTitle}`
                : `${tier} • ${stageTitle}`,
            href
        });
    }

    if (lead.followUp && (!previous || previous.followUp !== lead.followUp)) {
        logActivity({
            type: "followup",
            title: `${staff} scheduled a follow-up with ${lead.name}`,
            meta: `${stageTitle} • ${formatDateLogged(lead.followUp)}`,
            href
        });
    }

    if (isNew || (previous && normalizePipelineStaff(previous.staff) !== staff)) {
        replaceActivityForLead({
            type: "assignment",
            title: `${staff} was assigned to ${isNew ? "a new lead" : "a lead"}`,
            meta: `${lead.name} • ${stageTitle}`,
            href
        }, href);
    }
}

// An assignment is a current fact about a lead, not a history of clicks, so the
// lead's earlier assignment row is replaced instead of stacked underneath. That
// is what stops reassigning one client from listing them repeatedly in the feed.
function logLeadStaffAssigned(lead, staff) {
    const href = activityHref("pipeline.html", lead.name);
    replaceActivityForLead({
        type: "assignment",
        title: `${staff} was assigned to a lead`,
        meta: `${lead.name} • ${activityStageTitle(lead.stage)}`,
        href
    }, href);
}

// Renewals are not a separate event, so the nearest expiring memberships are
// derived from the Customer Directory instead of being logged. Lapsed terms
// count as renewal work too, so a member whose membership has run out still
// shows up here. Row ids stay stable across renders, so a renewal never
// produces a duplicate row.
function membershipExpiryActivities() {
    const today = todayStart();

    // Archived members are never nudged for a renewal: they are not renewing.
    return getActiveDirectoryCustomers()
        .map(member => ({ member, days: daysUntilExpiration(member.exp, today) }))
        .filter(row => row.days !== null && row.days <= RENEWAL_WINDOW_DAYS)
        .sort((a, b) => a.days - b.days)
        .slice(0, ACTIVITY_EXPIRING_LIMIT)
        .map(({ member, days }) => ({
            id: `expiring-${member.id}-${member.exp}`,
            type: days < 0 ? "expired" : "expiring",
            title: days < 0
                ? `${member.name}'s membership expired ${Math.abs(days)} day${Math.abs(days) === 1 ? "" : "s"} ago`
                : `${member.name}'s membership expires in ${days} day${days === 1 ? "" : "s"}`,
            meta: `${member.tier || "Membership"} • ${days < 0 ? "Renewal due" : "Expiring Soon"}`,
            timeLabel: "Today",
            at: today.toISOString(),
            href: activityHref("members.html", member.name)
        }));
}

// Logged actions plus the derived renewal nudges, newest first
function recentActivityFeed() {
    const seen = new Set();

    return [...membershipExpiryActivities(), ...getActivities()]
        .filter(entry => {
            const key = entry.id || `${entry.type}-${entry.at}-${entry.title}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        })
        .sort((a, b) => new Date(b.at || 0) - new Date(a.at || 0));
}

let activityExpanded = false;

function activityRowHtml(activity) {
    const type = ACTIVITY_TYPES[activity.type] || ACTIVITY_TYPES.ticket;
    const time = activity.timeLabel || relativeTime(activity.at);
    const body = `
        <span class="activity-icon ${type.tone}" aria-hidden="true">${type.icon}</span>
        <span class="activity-body">
            <span class="activity-title">${escapeHtml(activity.title)}</span>
            ${activity.meta ? `<span class="activity-meta">${escapeHtml(activity.meta)}</span>` : ""}
            <span class="activity-time">${escapeHtml(time)}</span>
        </span>
    `;

    return activity.href
        ? `<a class="activity-item" href="${escapeHtml(activity.href)}">${body}</a>`
        : `<div class="activity-item">${body}</div>`;
}

function renderRecentActivity() {
    const list = document.getElementById("recentActivityList");
    if (!list) return;

    const feed = recentActivityFeed();
    const visible = feed.slice(0, activityExpanded ? ACTIVITY_FULL_COUNT : ACTIVITY_PREVIEW_COUNT);

    list.innerHTML = "";
    if (visible.length === 0) {
        list.innerHTML = '<p class="card-meta">No activity recorded yet.</p>';
    } else {
        visible.forEach(activity => {
            const row = document.createElement("div");
            row.innerHTML = activityRowHtml(activity);
            list.appendChild(row.firstElementChild);
        });
    }

    const viewAllBtn = document.getElementById("activityViewAll");
    if (viewAllBtn) {
        viewAllBtn.hidden = feed.length <= ACTIVITY_PREVIEW_COUNT;
        viewAllBtn.textContent = activityExpanded ? "Show Less ↑" : "View All →";
        viewAllBtn.setAttribute("aria-expanded", String(activityExpanded));
    }
}

// Activity links carry ?q= so the module page opens with its own search box
// pre-filled. The page's existing input listener does the filtering.
function applyActivityDeepLink() {
    const term = (new URLSearchParams(window.location.search).get("q") || "").trim();
    if (!term) return;

    const field = ["searchCustomer", "ticketSearch", "pipelineSearch", "coachSearch"]
        .map(id => document.getElementById(id))
        .find(el => el);
    if (!field) return;

    field.value = term;
    field.dispatchEvent(new Event("input", { bubbles: true }));
}

document.addEventListener("DOMContentLoaded", () => {
    applyActivityDeepLink();

    if (document.getElementById("recentActivityList")) {
        renderRecentActivity();

        const viewAllBtn = document.getElementById("activityViewAll");
        if (viewAllBtn) {
            viewAllBtn.addEventListener("click", () => {
                activityExpanded = !activityExpanded;
                renderRecentActivity();
            });
        }

        // Another tab logging an action refreshes this feed
        window.addEventListener("storage", renderRecentActivity);
    }
});

// =============================================================
// Coach Tracker (additive only)
// A coaching module layered on top of the existing CRM instead of
// beside it. It never introduces a second customer database: assigned
// clients and membership state come from getDirectoryCustomers() /
// getMemberStatus(), i.e. the same Customer Directory the rest of the
// portal uses, and every action is appended to the shared activity
// feed through logActivity().
//
// Three additive localStorage keys hold the coaching data:
//   crmCoaches           coach records (contact, specialization, status,
//                        working days + hours, client rating total)
//   crmCoachAssignments  coachId <-> customerId links with a date
//   crmCoachSessions     training sessions (date, time, type, status,
//                        notes)
//
// Every renderer, dialog and listener below is guarded by an element
// check, so pages without the Coach Tracker behave exactly as before.
// =============================================================
const COACH_KEY = "crmCoaches";
const COACH_ASSIGNMENT_KEY = "crmCoachAssignments";
const COACH_SESSION_KEY = "crmCoachSessions";

const COACH_SPECIALIZATIONS = [
    "Strength Training",
    "Weight Loss",
    "HIIT",
    "Cardio",
    "Muscle Building",
    "General Fitness"
];

const COACH_STATUSES = ["Active", "On Leave", "Inactive"];

const COACH_SESSION_STATUSES = ["Scheduled", "Completed", "Missed", "Cancelled"];

// JS getDay(): 0 = Sunday. Kept as numbers so a coach record stays small.
const COACH_WEEKDAYS = [
    { value: 0, short: "Sun", full: "Sunday" },
    { value: 1, short: "Mon", full: "Monday" },
    { value: 2, short: "Tue", full: "Tuesday" },
    { value: 3, short: "Wed", full: "Wednesday" },
    { value: 4, short: "Thu", full: "Thursday" },
    { value: 5, short: "Fri", full: "Friday" },
    { value: 6, short: "Sat", full: "Saturday" }
];

// Weekly grid + shift picker share one range so a booked slot always
// falls inside a day the coach actually works.
const COACH_SLOT_START = 6;
const COACH_SLOT_END = 20;

// One training session occupies a one-hour block, which is what the
// conflict check compares against.
const COACH_SESSION_MINUTES = 60;

function getCoaches() {
    return JSON.parse(localStorage.getItem(COACH_KEY) || "[]");
}

function saveCoaches(list) {
    localStorage.setItem(COACH_KEY, JSON.stringify(list));
}

function getCoachAssignments() {
    return JSON.parse(localStorage.getItem(COACH_ASSIGNMENT_KEY) || "[]");
}

function saveCoachAssignments(list) {
    localStorage.setItem(COACH_ASSIGNMENT_KEY, JSON.stringify(list));
}

function getCoachSessions() {
    return JSON.parse(localStorage.getItem(COACH_SESSION_KEY) || "[]");
}

function saveCoachSessions(list) {
    localStorage.setItem(COACH_SESSION_KEY, JSON.stringify(list));
}

// The coaching team is seeded once with the staff names the Sales
// Pipeline already uses, so both modules refer to the same people.
// Only the coach records are seeded: assignments and sessions stay
// empty and are filled from the real member directory, matching how
// the portal treats customers and tickets.
function seedCoaches() {
    if (localStorage.getItem(COACH_KEY) !== null) return;

    const presets = [
        {
            name: PIPELINE_STAFF[0],
            email: "joeff@anytimefitness.com",
            phone: "0917 555 0142",
            specialization: "Strength Training",
            status: "Active",
            days: [1, 2, 3, 4, 5],
            shiftStart: 6,
            shiftEnd: 14
        },
        {
            name: PIPELINE_STAFF[1],
            email: "mariel@anytimefitness.com",
            phone: "0917 555 0188",
            specialization: "Weight Loss",
            status: "Active",
            days: [1, 2, 3, 4, 5, 6],
            shiftStart: 14,
            shiftEnd: 21
        }
    ];

    saveCoaches(presets.map((preset, index) => ({
        id: `coach-${index + 1}-${Date.now().toString(36)}`,
        ratingSum: 0,
        ratingCount: 0,
        ratings: [],
        ...preset
    })));
}

// ---- Small shared helpers (local to the coach module) ----
function coachById(id) {
    return getCoaches().find(coach => String(coach.id) === String(id)) || null;
}

function coachAssignmentsFor(coachId) {
    return getCoachAssignments().filter(row => String(row.coachId) === String(coachId));
}

function coachClientCount(coachId) {
    return coachAssignmentsFor(coachId).length;
}

function coachSessionsFor(coachId) {
    return getCoachSessions().filter(session => String(session.coachId) === String(coachId));
}

function localISODate(date) {
    const d = date || new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
}

function todayISO() {
    return localISODate(new Date());
}

function formatHourLabel(hour) {
    const h = Number(hour);
    const display = h % 12 === 0 ? 12 : h % 12;
    return `${display}:00 ${h >= 12 ? "PM" : "AM"}`;
}

// "14:30" -> "2:30 PM"
function formatClock(value) {
    const raw = String(value || "").trim();
    const match = raw.match(/^(\d{1,2}):(\d{2})$/);
    if (!match) return raw || "—";
    const hour = Number(match[1]);
    const display = hour % 12 === 0 ? 12 : hour % 12;
    return `${display}:${match[2]} ${hour >= 12 ? "PM" : "AM"}`;
}

function clockToMinutes(value) {
    const match = String(value || "").match(/^(\d{1,2}):(\d{2})$/);
    if (!match) return NaN;
    return Number(match[1]) * 60 + Number(match[2]);
}

function sessionDayLabel(dateISO) {
    if (!dateISO) return "—";
    if (dateISO === todayISO()) return "Today";
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    if (dateISO === localISODate(tomorrow)) return "Tomorrow";
    return formatDateLogged(dateISO);
}

function sessionSortValue(session) {
    const minutes = clockToMinutes(session.time);
    return `${session.date || ""} ${isNaN(minutes) ? 0 : String(minutes).padStart(4, "0")}`;
}

function coachStatusBadge(status) {
    const cls = status === "Active" ? "active" : status === "On Leave" ? "warning" : "open";
    return `<span class="badge ${cls}">${escapeHtml(status || "—")}</span>`;
}

function sessionStatusBadge(status) {
    const cls = status === "Completed" ? "active"
        : status === "Missed" ? "danger"
            : status === "Cancelled" ? "warning"
                : "open";
    return `<span class="badge ${cls}">${escapeHtml(status || "—")}</span>`;
}

// Membership state comes from the Customer Directory so the coach
// module can never disagree with the Customer Directory page. A record
// without a tier is treated as inactive.
function memberMembershipStatus(member, today) {
    if (!member || !member.tier) return "Inactive";
    return getMemberStatus(member, today);
}

function membershipBadge(status) {
    const cls = status === "Active" ? "active"
        : status === "Expiring Soon" ? "warning"
            : status === "Expired" ? "danger"
                : status === "Frozen" ? "warning"
                    : status === "Archived" ? "open" : "open";
    return `<span class="badge ${cls}">${escapeHtml(status)}</span>`;
}

function coachWorkingDayLabels(coach) {
    const days = Array.isArray(coach && coach.days) ? coach.days : [];
    if (days.length === 0) return "Not set";
    const ordered = COACH_WEEKDAYS.filter(day => days.includes(day.value));
    if (ordered.length === 7) return "Every day";
    return ordered.map(day => day.full.slice(0, 3)).join(", ");
}

function coachShiftLabel(coach) {
    if (!coach) return "—";
    return `${formatHourLabel(coach.shiftStart)} – ${formatHourLabel(coach.shiftEnd)}`;
}

function coachAvailableOnDay(coach, date) {
    const days = Array.isArray(coach && coach.days) ? coach.days : [];
    return days.includes(date.getDay());
}

function coachSlotAvailable(coach, date, hour) {
    if (!coach || coach.status !== "Active") return false;
    if (!coachWorkingDayOn(coach, date)) return false;
    return hour >= Number(coach.shiftStart) && hour < Number(coach.shiftEnd);
}

function coachWorkingDayOn(coach, date) {
    return Array.isArray(coach && coach.days) && coach.days.includes(date.getDay());
}

// "Available now" = active today, inside the shift, and not already
// booked for the current hour.
function coachAvailableNow(coach, now) {
    const at = now || new Date();
    const hour = at.getHours();
    if (!coachSlotAvailable(coach, at, hour)) return false;
    const booked = coachSessionsFor(coach.id).some(session =>
        session.date === localISODate(at) &&
        clockToMinutes(session.time) >= hour * 60 &&
        clockToMinutes(session.time) < (hour + 1) * 60 &&
        session.status !== "Cancelled"
    );
    return !booked;
}

function sessionClientName(session) {
    if (!session) return "—";
    const member = getDirectoryCustomers().find(c => String(c.id) === String(session.clientId));
    return member ? member.name : (session.clientName || "—");
}

function coachNameById(coachId) {
    const coach = coachById(coachId);
    return coach ? coach.name : "Unassigned";
}

function coachRatingAverage(coach) {
    const count = Number(coach && coach.ratingCount) || 0;
    const sum = Number(coach && coach.ratingSum) || 0;
    if (count === 0) return null;
    return sum / count;
}

function ratingStarsHtml(average) {
    const rounded = Math.round(Number(average) || 0);
    return "★★★★★".slice(0, rounded) + "☆☆☆☆☆".slice(0, 5 - rounded);
}

// Newest written reviews kept per coach. ratingSum / ratingCount stay the tally
// so the average keeps working on records created before feedback existed.
const COACH_FEEDBACK_LIMIT = 20;

function coachFeedbackList(coach) {
    const rows = Array.isArray(coach && coach.ratings) ? coach.ratings : [];
    return rows.slice().sort((a, b) => String(b.at || "").localeCompare(String(a.at || "")));
}

function coachFeedbackHtml(coach, emptyText) {
    const rows = coachFeedbackList(coach);
    if (rows.length === 0) return `<div class="card-sub">${escapeHtml(emptyText)}</div>`;
    return `<div class="feedback-list">${rows.map(row => `
        <div class="feedback-item">
            <div class="feedback-head">
                <span class="stars">${ratingStarsHtml(row.stars)}</span>
                <span class="card-meta">${escapeHtml(row.clientName || "Member")} • ${escapeHtml(formatDateLogged(row.at))}</span>
            </div>
            <p class="feedback-text">${escapeHtml(row.comment || "")}</p>
        </div>
    `).join("")}</div>`;
}

// ---- KPI summaries ----
function coachTodaySessions() {
    const today = todayISO();
    return getCoachSessions().filter(session => session.date === today && session.status === "Scheduled");
}

// Shared by the Coach Tracker page and the dashboard card.
function renderCoachSummaryStats() {
    const coaches = getCoaches();
    const values = {
        coachStatTotal: coaches.length,
        coachStatActive: coaches.filter(coach => coach.status === "Active").length,
        coachStatAvailable: coaches.filter(coach => coachAvailableNow(coach)).length,
        coachStatSessions: coachTodaySessions().length
    };

    Object.entries(values).forEach(([id, value]) => {
        const el = document.getElementById(id);
        if (el) el.textContent = value;
    });
}

// ---- Member portal (customer.html) ----
// Read-only mirror of the Coach Tracker: the member sees the coach they
// are assigned to and their own sessions. Same storage keys as the
// Coach Tracker page, so staff updates appear on the next visit.

// A member cannot change their own tier or expiration date, so the portal
// renewal button files a renewal request with the front desk instead of
// extending the record. It is stored as a normal portal inquiry with this
// marker, which is what lets the support page spot it and what stops the
// member from queueing the same request twice.
const RENEWAL_REQUEST_KIND = "renewal";

function getRenewalRequests() {
    return JSON.parse(localStorage.getItem("crmInquiries") || "[]")
        .filter(inq => inq && inq.kind === RENEWAL_REQUEST_KIND);
}

// An open request blocks a second one; a resolved request leaves the member
// free to ask again once the term is close to ending again.
function openRenewalRequest(username) {
    return getRenewalRequests().some(inq =>
        String(inq.username) === String(username) &&
        String(inq.status || "").toLowerCase() !== "resolved"
    );
}

// Shows the renewal panel only while the membership is expiring or expired, and
// flips the button to a confirmation once the request is on file.
function renderPortalRenewal(customer, exp) {
    const panel = document.getElementById("portalRenewalPanel");
    if (!panel || !customer) return;

    const today = todayStart();
    const status = customerStatus(exp, today);
    const dueForRenewal = status === "Expiring Soon" || status === "Expired";

    if (!dueForRenewal) {
        panel.style.display = "none";
        return;
    }

    const months = tierDurationMonths(customer.tier);
    const nextExp = renewalExpirationFor({ tier: customer.tier, exp }, today);
    const requested = openRenewalRequest(customer.username);

    panel.style.display = "flex";
    panel.classList.toggle("is-expired", status === "Expired");

    const title = document.getElementById("portalRenewalTitle");
    if (title) {
        const days = daysUntilExpiration(exp, today);
        title.textContent = status === "Expired"
            ? "Your membership has expired"
            : days === 0
                ? "Your membership expires today"
                : `Your membership expires in ${days} day${days === 1 ? "" : "s"}`;
    }

    const note = document.getElementById("portalRenewalNote");
    if (note) {
        note.textContent = `${customer.tier || "Your membership"}${months ? ` (${months}-month term)` : ""} • ${renewalCountdownLabel({ exp }, today)}.`
            + (nextExp && !requested ? ` Renewing now runs the term to ${nextExp}.` : "");
    }

    const button = document.getElementById("portalRenewalBtn");
    if (button) {
        button.disabled = requested;
        button.textContent = requested ? "Renewal Requested" : "Renew Membership";
    }

    const message = document.getElementById("portalRenewalMsg");
    if (message) {
        message.textContent = requested
            ? "The front desk has your renewal request and will confirm payment and your new start date with you."
            : "Send a renewal request to the front desk. Payment is confirmed at the counter.";
    }
}

// The renewal request itself: a high priority portal inquiry the support page
// picks up like any other, so a renewal is never lost outside the CRM.
function submitPortalRenewalRequest(customer, exp) {
    const today = todayStart();
    const status = customerStatus(exp, today);
    if (status !== "Expiring Soon" && status !== "Expired") {
        alert("Your membership is not due for renewal yet.");
        return false;
    }

    if (openRenewalRequest(customer.username)) {
        alert("You already have a renewal request on file. Our front desk will get back to you shortly.");
        return false;
    }

    const tier = customer.tier || "your membership";
    const countdown = renewalCountdownLabel({ exp }, today);
    if (!confirm(`Send a renewal request for your ${tier}?\n\n${countdown}. Payment is confirmed at the front desk.`)) {
        return false;
    }

    const inquiries = JSON.parse(localStorage.getItem("crmInquiries") || "[]");
    const now = new Date().toISOString();
    inquiries.push({
        id: Date.now(),
        kind: RENEWAL_REQUEST_KIND,
        username: customer.username,
        name: customer.name,
        email: customer.email || "",
        phone: customer.phone || "",
        address: customer.address || "",
        date: now,
        message: `Membership renewal request: my ${tier} ${countdown.toLowerCase()}. Please confirm my new membership term and payment at the front desk.`,
        priority: "High",
        status: "Open",
        reply: "",
        comments: [{
            author: customer.name,
            role: "customer",
            text: `Membership renewal request: my ${tier} ${countdown.toLowerCase()}. Please confirm my new membership term and payment at the front desk.`,
            date: now
        }]
    });
    localStorage.setItem("crmInquiries", JSON.stringify(inquiries));

    logActivity({
        type: "renewal",
        title: `${customer.name} requested a membership renewal`,
        meta: `${tier} • ${countdown} • Renewal request`,
        href: activityHref("tickets.html", customer.name)
    });

    getOpenTicketsCount();
    return true;
}

function portalCoachForCustomer(customer) {
    if (!customer) return null;
    const clientId = "reg-" + (customer.username || "");
    const assignment = getCoachAssignments().find(row => String(row.clientId) === String(clientId));
    if (!assignment) return null;
    return { assignment, coach: coachById(assignment.coachId) };
}

function renderPortalCoachSection(customer) {
    const card = document.getElementById("customerCoachCard");
    const empty = document.getElementById("customerCoachEmpty");
    if (!card || !empty) return;

    const found = portalCoachForCustomer(customer);
    const coach = found && found.coach;

    // A member keeps their session history even when the coach record
    // was removed, so sessions render before the coach branch returns.
    renderPortalSessions(customer);

    if (!coach) {
        // Assigned to a coach record that no longer exists.
        empty.textContent = found
            ? "Your coach profile is no longer available. Please contact the front desk."
            : "You haven't been assigned a coach yet. The front desk will assign one soon.";
        empty.style.display = "block";
        card.style.display = "none";
        renderPortalCoachRating(null, customer);
        return;
    }

    empty.style.display = "none";
    card.style.display = "grid";

    const average = coachRatingAverage(coach);
    const values = {
        cCoachName: coach.name,
        cCoachSpec: coach.specialization || "Coach",
        cCoachPhone: coach.phone || "—",
        cCoachEmail: coach.email || "—",
        cCoachShift: coachShiftLabel(coach),
        cCoachDays: coachWorkingDayLabels(coach),
        cCoachStatus: coach.status || "—",
        cCoachRating: average === null
            ? "No ratings yet"
            : `${ratingStarsHtml(average)} ${average.toFixed(1)}/5 (${Number(coach.ratingCount)} rating${Number(coach.ratingCount) === 1 ? "" : "s"})`
    };

    Object.entries(values).forEach(([id, value]) => {
        const el = document.getElementById(id);
        if (el) el.textContent = value;
    });

    renderPortalCoachRating(coach, customer);
}

// Rating is the one part of the coach profile a member owns: the form lives in
// the portal and is replaced by the submitted review once a member has rated,
// so a single member can never stack ratings on their own coach.
function renderPortalCoachRating(coach, customer) {
    const box = document.getElementById("portalRatingBox");
    const done = document.getElementById("portalRatingDone");
    const list = document.getElementById("portalCoachFeedbackList");
    const feedbackInput = document.getElementById("portalCoachFeedbackInput");
    const feedbackBox = document.getElementById("portalFeedbackBox");
    if (!box || !done || !list) return;

    const msg = document.getElementById("portalRatingMsg");
    if (msg) msg.textContent = "";

    window.portalCoachId = coach ? coach.id : null;
    feedbackInput.value = "";

    if (!coach) {
        box.style.display = "none";
        done.style.display = "none";
        list.innerHTML = "";
        if (feedbackBox) feedbackBox.style.display = "none";
        return;
    }

    if (feedbackBox) feedbackBox.style.display = "block";

    const clientId = "reg-" + ((customer && customer.username) || "");
    const mine = coachFeedbackList(coach).find(row => String(row.clientId) === clientId);

    if (mine) {
        done.innerHTML = `You rated ${escapeHtml(coach.name)} ${ratingStarsHtml(mine.stars)}. <em>${escapeHtml(mine.comment || "")}</em> — submitted ${escapeHtml(formatDateLogged(mine.at))}.`;
        done.style.display = "block";
        box.style.display = "none";
    } else {
        done.style.display = "none";
        box.style.display = "block";
    }

    list.innerHTML = coachFeedbackHtml(coach, "No member feedback written yet.");
}

function renderPortalSessions(customer) {
    const tbody = document.getElementById("customerSessionsBody");
    const empty = document.getElementById("customerSessionsEmpty");
    if (!tbody || !empty) return;

    const clientId = "reg-" + (customer.username || "");
    const sessions = getCoachSessions()
        .filter(session => String(session.clientId) === String(clientId))
        .sort((a, b) => sessionSortValue(a).localeCompare(sessionSortValue(b)));

    // Upcoming first, then most recent past, so the next session is on top.
    const today = todayISO();
    const upcoming = sessions.filter(session => session.date >= today);
    const past = sessions.filter(session => session.date < today).reverse();
    const ordered = [...upcoming, ...past];

    tbody.innerHTML = "";
    if (ordered.length === 0) {
        empty.style.display = "block";
        return;
    }
    empty.style.display = "none";

    ordered.forEach(session => {
        const coach = coachById(session.coachId);
        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td>${escapeHtml(sessionDayLabel(session.date))}</td>
            <td>${escapeHtml(formatClock(session.time))}</td>
            <td>${escapeHtml(coach ? coach.name : "Previous coach")}</td>
            <td>${escapeHtml(session.type || "—")}</td>
            <td>${sessionStatusBadge(session.status)}</td>
            <td>${escapeHtml(session.notes || "—")}</td>
        `;
        tbody.appendChild(tr);
    });
}

// ---- Coach directory ----
function coachDirectoryFilters() {
    return {
        search: ((document.getElementById("coachSearch") || {}).value || "").trim().toLowerCase(),
        status: (document.getElementById("filterCoachStatus") || {}).value || "all",
        specialization: (document.getElementById("filterCoachSpecialization") || {}).value || "all"
    };
}

function fillSpecializationFilter() {
    const select = document.getElementById("filterCoachSpecialization");
    if (!select || select.dataset.filled === "1") return;
    select.innerHTML = ["all", ...COACH_SPECIALIZATIONS]
        .map(value => `<option value="${escapeHtml(value)}">${value === "all" ? "All Specializations" : escapeHtml(value)}</option>`)
        .join("");
    select.dataset.filled = "1";
}

function renderCoachDirectory() {
    const tbody = document.getElementById("coachTableBody");
    if (!tbody) return;

    const filters = coachDirectoryFilters();
    const coaches = getCoaches().filter(coach => {
        if (filters.status !== "all" && coach.status !== filters.status) return false;
        if (filters.specialization !== "all" && coach.specialization !== filters.specialization) return false;
        if (filters.search) {
            const haystack = [coach.name, coach.email, coach.phone, coach.specialization, coach.status]
                .filter(Boolean).join(" ").toLowerCase();
            if (!haystack.includes(filters.search)) return false;
        }
        return true;
    });

    const counter = document.getElementById("coachDirectoryCount");
    if (counter) {
        const total = getCoaches().length;
        counter.textContent = `${coaches.length} of ${total} coach${total === 1 ? "" : "es"}`;
    }

    tbody.innerHTML = "";
    if (coaches.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6">No coaches match your filters.</td></tr>';
        return;
    }

    coaches.forEach(coach => {
        const id = encodeURIComponent(coach.id);
        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td><strong>${escapeHtml(coach.name)}</strong><small>${escapeHtml(coachShiftLabel(coach))}</small></td>
            <td>
                ${escapeHtml(coach.phone || "—")}
                <small>${escapeHtml(coach.email || "—")}</small>
            </td>
            <td>${escapeHtml(coach.specialization || "—")}</td>
            <td>${coachStatusBadge(coach.status)}</td>
            <td>${coachClientCount(coach.id)}</td>
            <td>
                <button class="btn-view" onclick="openCoachDetails('${id}')">View Details</button>
                <button class="btn-view" onclick="openEditCoach('${id}')">Edit Coach</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function openCoachDetails(encodedId) {
    const coach = coachById(decodeURIComponent(encodedId));
    const modal = document.getElementById("coachDetailsModal");
    if (!coach || !modal) return;

    window.pendingCoachId = coach.id;
    const sessions = coachSessionsFor(coach.id).sort((a, b) => sessionSortValue(b).localeCompare(sessionSortValue(a)));
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const completed = sessions.filter(session => session.status === "Completed");
    const missed = sessions.filter(session => session.status === "Missed");
    const attended = completed.length + missed.length;
    const upcoming = sessions.filter(session => session.status === "Scheduled" && session.date >= todayISO());

    document.getElementById("coachDetailsName").textContent = coach.name;
    document.getElementById("coachDetailsSpecialty").textContent =
        `${coach.specialization || "Coach"} • Working ${coachWorkingDayLabels(coach)} • ${coachShiftLabel(coach)}`;
    document.getElementById("coachDetailsStatus").innerHTML = coachStatusBadge(coach.status);
    document.getElementById("coachDetailsEmail").textContent = coach.email || "—";
    document.getElementById("coachDetailsPhone").textContent = coach.phone || "—";
    document.getElementById("coachDetailsDays").textContent = coachWorkingDayLabels(coach);
    document.getElementById("coachDetailsHours").textContent = coachShiftLabel(coach);
    document.getElementById("coachDetailsClients").textContent = coachClientCount(coach.id);
    document.getElementById("coachDetailsUpcoming").textContent = upcoming.length;
    document.getElementById("coachDetailsCompleted").textContent = completed.length;
    document.getElementById("coachDetailsAttendance").textContent = attended
        ? `${Math.round((completed.length / attended) * 100)}%`
        : "—";

    const average = coachRatingAverage(coach);
    document.getElementById("coachDetailsStars").textContent = ratingStarsHtml(average);
    document.getElementById("coachDetailsRating").textContent = average === null
        ? "No client ratings yet"
        : `${average.toFixed(1)}/5 • Based on ${coach.ratingCount} rating${Number(coach.ratingCount) === 1 ? "" : "s"}`;

    const feedback = document.getElementById("coachDetailsFeedback");
    if (feedback) feedback.innerHTML = coachFeedbackHtml(coach, "No member feedback written yet.");

    // Assigned clients, straight from the Customer Directory
    const clientList = document.getElementById("coachDetailsClientList");
    clientList.innerHTML = "";
    const members = getDirectoryCustomers();
    const assignments = coachAssignmentsFor(coach.id);
    if (assignments.length === 0) {
        clientList.innerHTML = '<p class="card-meta">No clients assigned yet.</p>';
    } else {
        assignments.forEach(row => {
            const member = members.find(c => String(c.id) === String(row.clientId));
            const name = member ? member.name : (row.clientName || "Removed member");
            const status = member ? memberMembershipStatus(member, today) : "Inactive";
            const item = document.createElement("div");
            item.className = "mini-list-row";
            item.innerHTML = `
                <span class="mini-list-main">
                    <span class="mini-list-title">${escapeHtml(name)}</span>
                    <span class="card-meta">${escapeHtml(member ? member.tier : "—")} • assigned ${escapeHtml(formatDateLogged(row.assignedAt))}</span>
                </span>
                ${membershipBadge(status)}
            `;
            clientList.appendChild(item);
        });
    }

    renderMiniSessionList(document.getElementById("coachDetailsUpcomingList"), upcoming.slice(0, 6), "No upcoming sessions.");
    renderMiniSessionList(document.getElementById("coachDetailsHistory"),
        sessions.filter(session => session.status !== "Scheduled").slice(0, 6),
        "No completed sessions recorded yet.");

    modal.style.display = "flex";
}

function renderMiniSessionList(container, sessions, emptyText) {
    if (!container) return;
    container.innerHTML = "";
    if (!sessions || sessions.length === 0) {
        container.innerHTML = `<p class="card-meta">${escapeHtml(emptyText)}</p>`;
        return;
    }

    sessions.forEach(session => {
        const item = document.createElement("div");
        item.className = "mini-list-row";
        item.innerHTML = `
            <span class="mini-list-main">
                <span class="mini-list-title">${escapeHtml(sessionDayLabel(session.date))} • ${escapeHtml(formatClock(session.time))} • ${escapeHtml(session.type || "Training")}</span>
                <span class="card-meta">${escapeHtml(sessionClientName(session))}${session.notes ? ` — ${escapeHtml(shortenLabel(session.notes, 70))}` : ""}</span>
            </span>
            ${sessionStatusBadge(session.status)}
        `;
        container.appendChild(item);
    });
}

// ---- Availability & schedule ----
function fillCoachSelect(selectId, includeAll, selectedId) {
    const select = document.getElementById(selectId);
    if (!select) return;

    const options = [];
    if (includeAll) options.push('<option value="all">All Coaches</option>');
    getCoaches().forEach(coach => {
        const suffix = coach.status === "Active" ? "" : ` (${coach.status})`;
        options.push(`<option value="${escapeHtml(coach.id)}">${escapeHtml(coach.name + suffix)}</option>`);
    });
    select.innerHTML = options.join("");

    // The options are rebuilt on every render, so the current choice is
    // restored here instead of silently snapping back to the first option.
    if (selectedId === undefined || selectedId === null) return;
    if (String(selectedId) === "all") {
        if (includeAll) select.value = "all";
        return;
    }
    if (getCoaches().some(coach => String(coach.id) === String(selectedId))) select.value = selectedId;
}

function selectedScheduleCoach() {
    const select = document.getElementById("scheduleCoach");
    const coaches = getCoaches();
    const wanted = select ? select.value : "";
    return coaches.find(coach => String(coach.id) === String(wanted)) || coaches[0] || null;
}

function renderSchedule() {
    const head = document.getElementById("scheduleHead");
    const body = document.getElementById("scheduleBody");
    if (!head || !body) return;

    const coach = selectedScheduleCoach();
    head.innerHTML = "";
    body.innerHTML = "";

    if (!coach) {
        head.innerHTML = "<tr><th>Time</th></tr>";
        body.innerHTML = '<tr><td class="schedule-empty">No coaches on record yet.</td></tr>';
        const summary = document.getElementById("scheduleSummary");
        if (summary) summary.textContent = "";
        return;
    }

    // Monday first, matching a gym week
    const days = COACH_WEEKDAYS.filter(day => day.value >= 1).concat(COACH_WEEKDAYS.filter(day => day.value === 0));
    head.innerHTML = `<th>Time</th>${days.map(day =>
        `<th${day.value === new Date().getDay() ? ' class="is-today"' : ""}>${day.short}</th>`
    ).join("")}`;

    // Build the Mon-Sun dates of the current week so every slot can be
    // matched against the coach's working days and booked sessions.
    const today = new Date();
    const monday = new Date(today);
    monday.setDate(today.getDate() - ((today.getDay() + 6) % 7));
    const sessions = coachSessionsFor(coach.id);
    let bookedCount = 0;

    for (let hour = COACH_SLOT_START; hour <= COACH_SLOT_END; hour++) {
        const cells = [`<td class="schedule-slot">${formatHourLabel(hour)}</td>`];

        days.forEach(day => {
            const date = new Date(monday);
            date.setDate(monday.getDate() + (day.value === 0 ? 6 : day.value - 1));
            const dateISO = localISODate(date);
            const slotSessions = sessions.filter(session =>
                session.date === dateISO &&
                clockToMinutes(session.time) >= hour * 60 &&
                clockToMinutes(session.time) < (hour + 1) * 60 &&
                session.status !== "Cancelled"
            );

            if (slotSessions.length > 0) {
                bookedCount += slotSessions.length;
                const first = slotSessions[0];
                const extra = slotSessions.length > 1 ? ` +${slotSessions.length - 1}` : "";
                cells.push(`<td><div class="schedule-cell booked">${escapeHtml(sessionClientName(first))}${extra}<small>${escapeHtml(formatClock(first.time))} • ${escapeHtml(first.type || "Training")}</small></div></td>`);
            } else if (coachSlotAvailable(coach, date, hour)) {
                cells.push('<td><div class="schedule-cell available">Available</div></td>');
            } else {
                cells.push(`<td><div class="schedule-cell unavailable">${coach.status === "Active" ? "Unavailable" : escapeHtml(coach.status)}</div></td>`);
            }
        });

        body.appendChild(Object.assign(document.createElement("tr"), { innerHTML: cells.join("") }));
    }

    const summary = document.getElementById("scheduleSummary");
    if (summary) {
        summary.textContent = `${coach.name} • ${coachWorkingDayLabels(coach)} • ${coachShiftLabel(coach)} • ${bookedCount} session${bookedCount === 1 ? "" : "s"} this week`;
    }
}

function renderUpcomingAppointments() {
    const tbody = document.getElementById("upcomingBody");
    if (!tbody) return;

    const coachFilter = (document.getElementById("scheduleCoach") || {}).value || "";
    const upcoming = getCoachSessions()
        .filter(session => session.status === "Scheduled" && session.date >= todayISO())
        .filter(session => !coachFilter || coachFilter === "all" || String(session.coachId) === String(coachFilter))
        .sort((a, b) => sessionSortValue(a).localeCompare(sessionSortValue(b)))
        .slice(0, 12);

    const counter = document.getElementById("upcomingCount");
    if (counter) counter.textContent = `${upcoming.length} upcoming`;

    tbody.innerHTML = "";
    if (upcoming.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7">No upcoming appointments.</td></tr>';
        return;
    }

    upcoming.forEach(session => {
        const id = encodeURIComponent(session.id);
        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td>${escapeHtml(sessionDayLabel(session.date))}<small>${escapeHtml(session.date || "")}</small></td>
            <td>${escapeHtml(formatClock(session.time))}</td>
            <td>${escapeHtml(sessionClientName(session))}</td>
            <td>${escapeHtml(coachNameById(session.coachId))}</td>
            <td>${escapeHtml(session.type || "—")}</td>
            <td>${sessionStatusBadge(session.status)}</td>
            <td>
                <button class="btn-view" onclick="openSessionModal('${id}')">Edit / Notes</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// ---- Client assignment ----
function fillClientOptions(select, selectedId) {
    // Current members only: an archived member keeps their past sessions but
    // cannot be booked or assigned again without being restored first.
    const members = getActiveDirectoryCustomers().slice().sort((a, b) => String(a.name).localeCompare(String(b.name)));
    select.innerHTML = members
        .map(member => {
            // Frozen members stay listed so existing records keep rendering, but
            // the label spells out why a session cannot be booked for them.
            const frozen = getMemberStatus(member) === "Frozen";
            const label = frozen ? `${member.name} (Frozen${member.freezeEndDate ? " until " + member.freezeEndDate : ""})` : member.name;
            return `<option value="${escapeHtml(member.id)}">${escapeHtml(label)}</option>`;
        })
        .join("");

    if (selectedId !== undefined && selectedId !== null) {
        const exists = members.some(member => String(member.id) === String(selectedId));
        if (exists) select.value = selectedId;
    }
}

function renderAssignments() {
    const tbody = document.getElementById("assignmentTableBody");
    if (!tbody) return;

    const coach = selectedAssignmentCoach();
    const members = getDirectoryCustomers();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (!coach) {
        tbody.innerHTML = '<tr><td colspan="5">No coaches on record yet. Use "+ Add Coach" to create one.</td></tr>';
        return;
    }

    const rows = coachAssignmentsFor(coach.id);

    // The coach dropdown is a pure filter, so the table is always rebuilt from
    // scratch. Without this the new coach's rows land under the previous coach's
    // rows and the same client looks assigned to both coaches at once.
    tbody.innerHTML = "";
    if (rows.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5">No clients assigned to ${escapeHtml(coach.name)} yet.</td></tr>`;
        return;
    }

    rows.forEach(row => {
        const member = members.find(c => String(c.id) === String(row.clientId));
        const name = member ? member.name : (row.clientName || "Removed member");
        const status = member ? memberMembershipStatus(member, today) : "Inactive";
        // Clients whose membership is expiring or expired can be renewed from
        // here as well, using the same action as the Customer Directory. An
        // archived member is a past member, so no renewal is offered.
        const renewBtn = member && !memberIsArchived(member) && membershipNeedsRenewal(member, today)
            ? `<button class="btn-renew" onclick="renewMemberById('${encodeURIComponent(row.clientId)}')">Renew</button>`
            : "";
        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td>
                <strong>${escapeHtml(name)}</strong>
                <small>${escapeHtml(member ? member.keyFob || member.contact : "—")}</small>
            </td>
            <td>${membershipBadge(status)}<small>${escapeHtml(member ? member.tier || "—" : "No membership record")}</small></td>
            <td>${escapeHtml(coach.name)}</td>
            <td>${escapeHtml(formatDateLogged(row.assignedAt))}</td>
            <td>
                <div class="row-actions">
                    ${renewBtn}
                    <button class="btn-view" onclick="openClientDetails('${encodeURIComponent(row.clientId)}')">View</button>
                    <button class="btn-view" onclick="openAssignModal('${encodeURIComponent(coach.id)}', '${encodeURIComponent(row.id)}')">Reassign</button>
                    <button class="btn-delete" onclick="unassignClient('${encodeURIComponent(row.id)}')">Unassign</button>
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function selectedAssignmentCoach() {
    const select = document.getElementById("assignmentCoach");
    const coaches = getCoaches();
    const wanted = select ? select.value : "";
    return coaches.find(coach => String(coach.id) === String(wanted)) || coaches[0] || null;
}

function unassignClient(encodedId) {
    const id = decodeURIComponent(encodedId);
    const rows = getCoachAssignments();
    const row = rows.find(item => String(item.id) === String(id));
    if (!row) return;
    if (!confirm(`Remove ${row.clientName || "this client"} from ${coachNameById(row.coachId)}?`)) return;

    saveCoachAssignments(rows.filter(item => String(item.id) !== String(id)));
    logActivity({
        type: "coach",
        title: `${row.clientName || "A client"} was unassigned`,
        meta: `${coachNameById(row.coachId)} • Client assignment`,
        href: "coach.html"
    });

    renderCoachTracker();
}

// Assign a customer from the Customer Directory to a coach. Passing an
// existing assignment id switches the form into reassignment mode.
function openAssignModal(encodedCoachId, encodedAssignmentId) {
    const modal = document.getElementById("assignModal");
    if (!modal) return;

    const coaches = getCoaches();
    const assignmentId = encodedAssignmentId ? decodeURIComponent(encodedAssignmentId) : "";
    const existing = assignmentId
        ? getCoachAssignments().find(row => String(row.id) === String(assignmentId))
        : null;

    const coachId = encodedCoachId
        ? decodeURIComponent(encodedCoachId)
        : (existing ? existing.coachId : (selectedAssignmentCoach() || {}).id);

    document.getElementById("assignId").value = existing ? existing.id : "";
    document.getElementById("assignCoach").innerHTML = coaches.map(coach => {
        const disabled = coach.status !== "Active" && String(coach.id) !== String(coachId);
        return `<option value="${escapeHtml(coach.id)}"${disabled ? " disabled" : ""}>${escapeHtml(coach.name + (coach.status === "Active" ? "" : ` (${coach.status})`))}</option>`;
    }).join("");
    document.getElementById("assignCoach").value = coachId;

    fillClientOptions(document.getElementById("assignClient"), existing ? existing.clientId : null);

    document.getElementById("assignModalTitle").textContent = existing ? "Reassign Client" : "Assign Client to Coach";
    document.getElementById("assignError").textContent = "";

    const hint = document.getElementById("assignHint");
    const coach = coachById(coachId);
    if (hint) {
        hint.textContent = coach
            ? `Clients come from the Customer Directory. ${coach.name} is ${coach.status} and works ${coachWorkingDayLabels(coach)} (${coachShiftLabel(coach)}).`
            : "Clients come from the Customer Directory.";
    }

    modal.style.display = "flex";
}

function saveAssignment() {
    const assignmentId = document.getElementById("assignId").value;
    const coachId = document.getElementById("assignCoach").value;
    const clientId = document.getElementById("assignClient").value;
    const errorEl = document.getElementById("assignError");
    const fail = message => {
        errorEl.textContent = message;
        return false;
    };

    const coach = coachById(coachId);
    if (!coach) return fail("Please select a coach.");
    if (coach.status !== "Active") return fail(`${coach.name} is ${coach.status} and cannot take new clients.`);

    const member = getDirectoryCustomers().find(c => String(c.id) === String(clientId));
    if (!member) return fail("Please select a client from the Customer Directory.");

    const rows = getCoachAssignments();
    const existingRow = assignmentId ? rows.find(row => String(row.id) === String(assignmentId)) : null;

    // Duplicate guard: the same client must not land on the same coach twice
    const duplicate = rows.find(row =>
        String(row.clientId) === String(clientId) &&
        String(row.coachId) === String(coachId) &&
        (!existingRow || String(row.id) !== String(existingRow.id))
    );
    if (duplicate) return fail(`${member.name} is already assigned to ${coach.name}.`);

    // One active coach per client: a move has to be confirmed
    const other = rows.find(row =>
        String(row.clientId) === String(clientId) &&
        (!existingRow || String(row.id) !== String(existingRow.id))
    );
    if (other && !confirm(`${member.name} is currently assigned to ${coachNameById(other.coachId)}. Reassign to ${coach.name}?`)) {
        return false;
    }

    const target = existingRow || { id: `assign-${Date.now().toString(36)}` };
    target.coachId = coach.id;
    target.clientId = member.id;
    target.clientName = member.name;
    target.assignedAt = todayISO();

    if (!existingRow) rows.push(target);
    saveCoachAssignments(rows);

    logActivity({
        type: "coach",
        title: existingRow
            ? `${member.name} was reassigned to ${coach.name}`
            : `${member.name} was assigned to ${coach.name}`,
        meta: `${member.tier || "Membership"} • ${coach.specialization || "Coach"}`,
        href: activityHref("coach.html", member.name)
    });

    document.getElementById("assignModal").style.display = "none";
    renderCoachTracker();
}

// ---- Session tracking ----
function sessionFilters() {
    return {
        search: ((document.getElementById("sessionSearch") || {}).value || "").trim().toLowerCase(),
        coach: (document.getElementById("filterSessionCoach") || {}).value || "all",
        status: (document.getElementById("filterSessionStatus") || {}).value || "all"
    };
}

function renderSessions() {
    const tbody = document.getElementById("sessionTableBody");
    if (!tbody) return;

    const filters = sessionFilters();
    const sessions = getCoachSessions()
        .filter(session => filters.coach === "all" || String(session.coachId) === String(filters.coach))
        .filter(session => filters.status === "all" || session.status === filters.status)
        .filter(session => {
            if (!filters.search) return true;
            const haystack = [
                sessionClientName(session),
                coachNameById(session.coachId),
                session.type,
                session.status,
                session.notes
            ].filter(Boolean).join(" ").toLowerCase();
            return haystack.includes(filters.search);
        })
        .sort((a, b) => sessionSortValue(b).localeCompare(sessionSortValue(a)));

    tbody.innerHTML = "";
    if (sessions.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7">No training sessions match your filters.</td></tr>';
        return;
    }

    sessions.forEach(session => {
        const id = encodeURIComponent(session.id);
        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td>
                <strong>${escapeHtml(sessionClientName(session))}</strong>
                <small>${escapeHtml(sessionClientIdLabel(session))}</small>
            </td>
            <td>${escapeHtml(sessionDayLabel(session.date))}<small>${escapeHtml(session.date || "")}</small></td>
            <td>${escapeHtml(formatClock(session.time))}</td>
            <td>${escapeHtml(session.type || "—")}${session.notes ? `<small>${escapeHtml(shortenLabel(session.notes, 54))}</small>` : ""}</td>
            <td>${sessionStatusBadge(session.status)}</td>
            <td>${escapeHtml(coachNameById(session.coachId))}</td>
            <td>
                <button class="btn-view" onclick="openSessionModal('${id}')">Edit / Notes</button>
                <button class="btn-view" onclick="openClientDetails('${encodeURIComponent(session.clientId)}')">Client</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function sessionClientIdLabel(session) {
    const member = getDirectoryCustomers().find(c => String(c.id) === String(session.clientId));
    if (member && member.tier) return member.tier;
    return member ? member.keyFob || "Customer Directory" : "No matching member record";
}

// Session scheduling rules. Returns "" when the slot is clean, or a
// warning the form shows instead of saving.
function sessionConflictMessage(session, editingId) {
    const coach = coachById(session.coachId);
    if (!coach) return "Please select a coach for this session.";
    if (!session.clientId) return "Please select the client attending this session.";
    if (!session.date) return "Please choose a session date.";
    if (isNaN(clockToMinutes(session.time))) return "Please choose a session time.";

    // A frozen membership is on hold and an archived member is a past member,
    // so neither can book time with a coach until the record is unfrozen or
    // restored.
    const client = getDirectoryCustomers().find(c => String(c.id) === String(session.clientId));
    const clientName = client ? client.name : session.clientName;
    if (client && getMemberStatus(client) === "Archived") {
        return `Scheduling Conflict: ${clientName} is an Archived (past) member and cannot book sessions. Restore the membership first.`;
    }
    if (client && getMemberStatus(client) === "Frozen") {
        const until = client.freezeEndDate ? ` until ${client.freezeEndDate}` : "";
        return `Scheduling Conflict: ${clientName}'s membership is Frozen${until} and cannot book sessions. Unfreeze the membership first.`;
    }

    if (coach.status === "Inactive") {
        return `Scheduling Conflict: ${coach.name} is Inactive and cannot take sessions. Set the employment status to Active first.`;
    }

    const date = new Date(session.date + "T00:00:00");
    if (isNaN(date.getTime())) return "Please choose a valid session date.";

    if (!coachWorkingDayOn(coach, date)) {
        return `Scheduling Conflict: ${coach.name} does not work on ${date.toLocaleDateString("en-US", { weekday: "long" })}. Working days: ${coachWorkingDayLabels(coach)}.`;
    }

    const start = clockToMinutes(session.time);
    const hour = Math.floor(start / 60);
    if (hour < Number(coach.shiftStart) || hour >= Number(coach.shiftEnd)) {
        return `Scheduling Conflict: ${formatClock(session.time)} is outside ${coach.name}'s working hours (${coachShiftLabel(coach)}).`;
    }

    const blocking = session =>
        String(session.id) !== String(editingId) &&
        String(session.status) !== "Cancelled" &&
        String(session.status) !== "Missed";

    const coachClash = getCoachSessions().find(other =>
        blocking(other) &&
        String(other.coachId) === String(session.coachId) &&
        other.date === session.date &&
        overlapsClock(other.time, start)
    );
    if (coachClash) {
        return `Scheduling Conflict: ${coach.name} already has a session with ${sessionClientName(coachClash)} at ${formatClock(coachClash.time)}.`;
    }

    const clientClash = getCoachSessions().find(other =>
        blocking(other) &&
        String(other.clientId) === String(session.clientId) &&
        String(other.coachId) !== String(session.coachId) &&
        other.date === session.date &&
        overlapsClock(other.time, start)
    );
    if (clientClash) {
        return `Scheduling Conflict: this client already has a session with ${coachNameById(clientClash.coachId)} at ${formatClock(clientClash.time)}.`;
    }

    return "";
}

function overlapsClock(otherTime, startMinutes) {
    const otherStart = clockToMinutes(otherTime);
    if (isNaN(otherStart)) return false;
    return startMinutes < otherStart + COACH_SESSION_MINUTES && otherStart < startMinutes + COACH_SESSION_MINUTES;
}

function openSessionModal(encodedId) {
    const modal = document.getElementById("sessionModal");
    if (!modal) return;

    const id = encodedId ? decodeURIComponent(encodedId) : "";
    const session = id ? getCoachSessions().find(item => String(item.id) === String(id)) : null;

    document.getElementById("sessionId").value = session ? session.id : "";
    fillCoachSelect("sessionCoach", false, session ? session.coachId : (selectedScheduleCoach() || {}).id);
    fillClientOptions(document.getElementById("sessionClient"), session ? session.clientId : null);
    document.getElementById("sessionType").innerHTML = COACH_SPECIALIZATIONS
        .map(value => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`)
        .join("");
    document.getElementById("sessionType").value = session ? session.type : COACH_SPECIALIZATIONS[0];
    document.getElementById("sessionStatus").value = session ? session.status : "Scheduled";
    document.getElementById("sessionDate").value = session ? session.date : todayISO();
    document.getElementById("sessionTime").value = session ? session.time : "10:00";
    document.getElementById("sessionNotes").value = session ? (session.notes || "") : "";
    document.getElementById("sessionFormError").textContent = "";

    document.getElementById("sessionModalTitle").textContent = session ? "Edit Training Session" : "Create Training Session";
    document.getElementById("saveSessionBtn").textContent = session ? "Update Session" : "Save Session";
    modal.style.display = "flex";
}

function saveSession() {
    const id = document.getElementById("sessionId").value;
    const coachId = document.getElementById("sessionCoach").value;
    const clientId = document.getElementById("sessionClient").value;
    const client = getDirectoryCustomers().find(c => String(c.id) === String(clientId));
    const data = {
        coachId,
        clientId,
        clientName: client ? client.name : "Unknown client",
        date: document.getElementById("sessionDate").value,
        time: document.getElementById("sessionTime").value,
        type: document.getElementById("sessionType").value,
        status: document.getElementById("sessionStatus").value,
        notes: document.getElementById("sessionNotes").value.trim(),
        updatedAt: new Date().toISOString()
    };

    // Conflicts block the save: the CRM has no override mechanism.
    const conflict = sessionConflictMessage(data, id);
    if (conflict) {
        document.getElementById("sessionFormError").textContent = conflict;
        return;
    }

    const sessions = getCoachSessions();
    const previous = id ? sessions.find(session => String(session.id) === String(id)) : null;
    if (previous) {
        Object.assign(previous, data);
    } else {
        data.id = `session-${Date.now().toString(36)}`;
        sessions.push(data);
    }
    saveCoachSessions(sessions);

    logActivity({
        type: "coach",
        title: previous
            ? `${data.clientName}'s session was updated`
            : `${data.clientName} booked a ${data.type} session`,
        meta: `${coachNameById(data.coachId)} • ${sessionDayLabel(data.date)} ${formatClock(data.time)} • ${data.status}`,
        href: "coach.html"
    });

    document.getElementById("sessionModal").style.display = "none";
    renderCoachTracker();
}

// ---- Client details & session history ----
function openClientDetails(encodedClientId) {
    const modal = document.getElementById("clientDetailsModal");
    if (!modal) return;

    const clientId = decodeURIComponent(encodedClientId);
    const member = getDirectoryCustomers().find(c => String(c.id) === String(clientId));
    if (!member) {
        alert("This client is no longer in the Customer Directory.");
        return;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const assignment = getCoachAssignments().find(row => String(row.clientId) === String(member.id));

    // Remembered the same way as the coach dialog, so the renewal button can
    // act on the client this dialog is showing.
    window.pendingClientId = member.id;

    document.getElementById("clientDetailsName").textContent = member.name;
    document.getElementById("clientDetailsStatus").innerHTML = membershipBadge(memberMembershipStatus(member, today));
    document.getElementById("clientDetailsTier").textContent = member.tier || "—";
    document.getElementById("clientDetailsFob").textContent = member.keyFob || "—";
    document.getElementById("clientDetailsContact").textContent = member.contact || "—";
    document.getElementById("clientDetailsCoach").textContent = assignment ? coachNameById(assignment.coachId) : "Unassigned";
    document.getElementById("clientDetailsJoined").textContent = member.joined || "—";

    const link = document.getElementById("clientDirectoryLink");
    if (link) link.href = activityHref("members.html", member.name);

    const history = getCoachSessions()
        .filter(session => String(session.clientId) === String(member.id))
        .sort((a, b) => sessionSortValue(b).localeCompare(sessionSortValue(a)));

    renderMiniSessionList(document.getElementById("clientHistoryList"), history,
        "No training sessions recorded for this client yet.");

    // A client due for renewal also gets the renewal button here, so staff do
    // not have to go back to the Customer Directory to extend the term.
    const renewBtn = document.getElementById("renewClientBtn");
    if (renewBtn) {
        const due = membershipNeedsRenewal(member, today) && !memberIsArchived(member);
        renewBtn.style.display = due ? "" : "none";
        const nextExp = renewalExpirationFor(member, today);
        renewBtn.textContent = due && nextExp ? `Renew Membership → ${nextExp}` : "Renew Membership";
    }

    modal.style.display = "flex";
}

// ---- Performance overview ----
function performanceRange() {
    const now = new Date();
    const to = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    let from = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const period = (document.getElementById("performancePeriod") || {}).value || "month";
    if (period === "week") {
        from = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() + 6) % 7));
    } else if (period === "last30") {
        from.setDate(from.getDate() - 29);
    } else if (period === "last90") {
        from.setDate(from.getDate() - 89);
    } else if (period === "custom") {
        const fromEl = document.getElementById("performanceFrom");
        const toEl = document.getElementById("performanceTo");
        const startValue = fromEl ? fromEl.value : "";
        const endValue = toEl ? toEl.value : "";
        if (!startValue || !endValue) return null;
        const start = new Date(startValue + "T00:00:00");
        const end = new Date(endValue + "T00:00:00");
        if (isNaN(start.getTime()) || isNaN(end.getTime()) || start > end) return null;
        from = start;
        return { from, to: new Date(end.getFullYear(), end.getMonth(), end.getDate(), 23, 59, 59, 999) };
    }

    return { from, to };
}

function coachPerformance(coach) {
    const range = performanceRange();
    const sessions = coachSessionsFor(coach.id);

    const inPeriod = range ? sessions.filter(session => {
        const date = new Date((session.date || "") + "T00:00:00");
        return !isNaN(date.getTime()) && date >= range.from && date <= range.to;
    }) : [];

    const completed = inPeriod.filter(session => session.status === "Completed").length;
    const missed = inPeriod.filter(session => session.status === "Missed").length;
    const cancelled = inPeriod.filter(session => session.status === "Cancelled").length;
    const upcoming = sessions.filter(session => session.status === "Scheduled" && session.date >= todayISO()).length;
    const attended = completed + missed;

    return {
        clients: coachClientCount(coach.id),
        upcoming,
        completed,
        missed,
        cancelled,
        attendance: attended ? Math.round((completed / attended) * 100) : null,
        cancellation: inPeriod.length ? Math.round((cancelled / inPeriod.length) * 100) : null,
        total: inPeriod.length
    };
}

function renderPerformance() {
    const grid = document.getElementById("performanceGrid");
    if (!grid) return;

    const isCustom = ((document.getElementById("performancePeriod") || {}).value || "") === "custom";
    ["performanceFrom", "performanceTo"].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = isCustom ? "" : "none";
    });

    const coaches = getCoaches();
    grid.innerHTML = "";

    if (isCustom && !performanceRange()) {
        grid.innerHTML = '<p class="card-meta">Choose a valid start and end date to build the report.</p>';
        return;
    }

    if (coaches.length === 0) {
        grid.innerHTML = '<p class="card-meta">No coaches on record yet.</p>';
        return;
    }

    coaches.forEach(coach => {
        const stats = coachPerformance(coach);
        const average = coachRatingAverage(coach);
        const card = document.createElement("article");
        card.className = "card span-4";
        card.innerHTML = `
            <div class="card-head">
                <div>
                    <h3>${escapeHtml(coach.name)}</h3>
                    <p class="card-sub">${escapeHtml(coach.specialization || "Coach")} • ${escapeHtml(coachShiftLabel(coach))}</p>
                </div>
                ${coachStatusBadge(coach.status)}
            </div>
            <div class="perf-grid">
                <div class="perf-metric"><span>Assigned Clients</span><strong>${stats.clients}</strong></div>
                <div class="perf-metric"><span>Upcoming</span><strong>${stats.upcoming}</strong></div>
                <div class="perf-metric"><span>Completed</span><strong>${stats.completed}</strong></div>
                <div class="perf-metric"><span>Missed</span><strong>${stats.missed}</strong></div>
                <div class="perf-metric"><span>Cancelled</span><strong>${stats.cancelled}</strong></div>
            </div>
            <div class="perf-rates">
                <div><span>Attendance Rate</span><strong>${stats.attendance === null ? "—" : stats.attendance + "%"}</strong></div>
                <div><span>Cancellation Rate</span><strong>${stats.cancellation === null ? "—" : stats.cancellation + "%"}</strong></div>
            </div>
            <div class="rating-row">
                <span class="stars">${ratingStarsHtml(average)}</span>
                <span>${average === null ? "No client ratings yet" : `${average.toFixed(1)}/5 • Based on ${coach.ratingCount} rating${Number(coach.ratingCount) === 1 ? "" : "s"}`}</span>
            </div>
        `;
        grid.appendChild(card);
    });
}

// ---- Add / edit coach ----
function buildCoachFormFields() {
    const dayGrid = document.getElementById("coachDayGrid");
    if (dayGrid && !dayGrid.dataset.filled) {
        dayGrid.innerHTML = COACH_WEEKDAYS.map(day => `
            <label class="day-chip">
                <input type="checkbox" name="coachDay" value="${day.value}">
                ${day.short}
            </label>
        `).join("");
        dayGrid.dataset.filled = "1";
    }

    const hours = [];
    for (let hour = COACH_SLOT_START - 1; hour <= COACH_SLOT_END + 2; hour++) hours.push(hour);

    ["coachShiftStart", "coachShiftEnd"].forEach(id => {
        const select = document.getElementById(id);
        if (!select || select.dataset.filled) return;
        select.innerHTML = hours.map(hour =>
            `<option value="${hour}">${formatHourLabel(hour)}</option>`
        ).join("");
        select.dataset.filled = "1";
    });

    const specialization = document.getElementById("coachSpecialization");
    if (specialization && !specialization.dataset.filled) {
        specialization.innerHTML = COACH_SPECIALIZATIONS
            .map(value => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`)
            .join("");
        specialization.dataset.filled = "1";
    }
}

function openAddCoach() {
    const modal = document.getElementById("coachModal");
    const form = document.getElementById("coachForm");
    if (!modal || !form) return;

    form.reset();
    buildCoachFormFields();
    document.getElementById("coachId").value = "";
    document.getElementById("coachSpecialization").value = COACH_SPECIALIZATIONS[0];
    document.getElementById("coachStatus").value = "Active";
    document.getElementById("coachShiftStart").value = 6;
    document.getElementById("coachShiftEnd").value = 14;
    document.getElementById("coachDayGrid")
        .querySelectorAll('input[name="coachDay"]')
        .forEach(box => { box.checked = box.value !== "0"; });
    document.getElementById("coachFormError").textContent = "";
    document.getElementById("coachModalTitle").textContent = "Add Coach";
    document.getElementById("saveCoachBtn").textContent = "Save Coach";
    modal.style.display = "flex";
    document.getElementById("coachName").focus();
}

function openEditCoach(encodedId) {
    const coach = coachById(decodeURIComponent(encodedId));
    const modal = document.getElementById("coachModal");
    if (!coach || !modal) return;

    buildCoachFormFields();
    document.getElementById("coachId").value = coach.id;
    document.getElementById("coachName").value = coach.name || "";
    document.getElementById("coachEmail").value = coach.email || "";
    document.getElementById("coachPhone").value = coach.phone || "";
    document.getElementById("coachSpecialization").value = COACH_SPECIALIZATIONS.includes(coach.specialization)
        ? coach.specialization
        : COACH_SPECIALIZATIONS[0];
    document.getElementById("coachStatus").value = COACH_STATUSES.includes(coach.status) ? coach.status : "Active";
    document.getElementById("coachShiftStart").value = Number(coach.shiftStart) || 6;
    document.getElementById("coachShiftEnd").value = Number(coach.shiftEnd) || 14;

    const days = Array.isArray(coach.days) ? coach.days : [];
    document.getElementById("coachDayGrid")
        .querySelectorAll('input[name="coachDay"]')
        .forEach(box => { box.checked = days.includes(Number(box.value)); });

    document.getElementById("coachFormError").textContent = "";
    document.getElementById("coachModalTitle").textContent = "Edit Coach";
    document.getElementById("saveCoachBtn").textContent = "Update Coach";
    modal.style.display = "flex";
}

function saveCoach() {
    const id = document.getElementById("coachId").value;
    const name = document.getElementById("coachName").value.trim();
    const email = document.getElementById("coachEmail").value.trim();
    const phone = document.getElementById("coachPhone").value.trim();
    const specialization = document.getElementById("coachSpecialization").value;
    const status = document.getElementById("coachStatus").value;
    const shiftStart = Number(document.getElementById("coachShiftStart").value);
    const shiftEnd = Number(document.getElementById("coachShiftEnd").value);
    const days = Array.from(document.getElementById("coachDayGrid").querySelectorAll('input[name="coachDay"]:checked'))
        .map(box => Number(box.value));
    const errorEl = document.getElementById("coachFormError");

    const fail = message => {
        errorEl.textContent = message;
        return false;
    };

    if (!name) return fail("Please enter the coach's full name.");
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return fail("Please enter a valid email address.");
    if (!phone) return fail("Please enter a contact number.");
    if (!days.length) return fail("Please select at least one working day.");
    if (!(shiftStart < shiftEnd)) return fail("Working hours must end after they start.");

    const coaches = getCoaches();
    const duplicate = coaches.find(coach =>
        String(coach.name).toLowerCase() === name.toLowerCase() &&
        String(coach.id) !== String(id)
    );
    if (duplicate) return fail(`${name} already exists in the coach directory.`);

    const data = { name, email, phone, specialization, status, days, shiftStart, shiftEnd };
    const previous = id ? coaches.find(coach => String(coach.id) === String(id)) : null;

    if (previous) {
        Object.assign(previous, data);
    } else {
        coaches.push({ id: `coach-${Date.now().toString(36)}`, ratingSum: 0, ratingCount: 0, ratings: [], ...data });
    }
    saveCoaches(coaches);

    logActivity({
        type: "coach",
        title: previous ? `${name}'s coach record was updated` : `${name} was added to the coach directory`,
        meta: `${specialization} • ${status} • ${coachWorkingDayLabels({ days })} ${formatHourLabel(shiftStart)} – ${formatHourLabel(shiftEnd)}`,
        href: "coach.html"
    });

    document.getElementById("coachModal").style.display = "none";
    renderCoachTracker();
}

// One entry point repaints every Coach Tracker view, so a save anywhere
// (directory, schedule, assignment, session, performance) stays in sync.
function renderCoachTracker() {
    seedCoaches();
    fillSpecializationFilter();

    const coaches = getCoaches();
    const scheduleCoach = (document.getElementById("scheduleCoach") || {}).value;
    const assignmentCoach = (document.getElementById("assignmentCoach") || {}).value;
    const sessionCoach = (document.getElementById("filterSessionCoach") || {}).value;

    fillCoachSelect("scheduleCoach", false, scheduleCoach || (coaches[0] || {}).id);
    fillCoachSelect("assignmentCoach", false, assignmentCoach || (coaches[0] || {}).id);
    fillCoachSelect("filterSessionCoach", true, sessionCoach);

    renderCoachSummaryStats();
    renderCoachDirectory();
    renderSchedule();
    renderUpcomingAppointments();
    renderAssignments();
    renderSessions();
    renderPerformance();
}

document.addEventListener("DOMContentLoaded", () => {
    if (document.getElementById("coachStatTotal") && !document.getElementById("coachTableBody")) {
        // Dashboard card only: summarise the coaching team, nothing else.
        seedCoaches();
        renderCoachSummaryStats();
        window.addEventListener("storage", renderCoachSummaryStats);
        return;
    }

    if (!document.getElementById("coachTableBody")) return;

    renderCoachTracker();

    // Coach form dialog
    const coachModal = document.getElementById("coachModal");
    const openCoachBtn = document.getElementById("openCoachModal");
    const closeCoachBtn = document.getElementById("closeCoachModal");
    const cancelCoachBtn = document.getElementById("cancelCoachModal");
    const coachForm = document.getElementById("coachForm");

    buildCoachFormFields();
    if (openCoachBtn) openCoachBtn.addEventListener("click", openAddCoach);
    if (closeCoachBtn) closeCoachBtn.addEventListener("click", () => { coachModal.style.display = "none"; });
    if (cancelCoachBtn) cancelCoachBtn.addEventListener("click", () => { coachModal.style.display = "none"; });
    if (coachForm) coachForm.addEventListener("submit", event => { event.preventDefault(); saveCoach(); });

    // Coach details dialog
    const detailsModal = document.getElementById("coachDetailsModal");
    const closeDetails = document.getElementById("closeCoachDetails");
    const closeDetailsBtn = document.getElementById("closeCoachDetailsBtn");
    const editFromDetails = document.getElementById("editFromDetails");
    if (closeDetails) closeDetails.addEventListener("click", () => { detailsModal.style.display = "none"; });
    if (closeDetailsBtn) closeDetailsBtn.addEventListener("click", () => { detailsModal.style.display = "none"; });
    if (editFromDetails) {
        editFromDetails.addEventListener("click", () => {
            if (!window.pendingCoachId) return;
            detailsModal.style.display = "none";
            openEditCoach(encodeURIComponent(window.pendingCoachId));
        });
    }

    // Assignment dialog
    const assignModal = document.getElementById("assignModal");
    const openAssignBtn = document.getElementById("openAssignModal");
    const closeAssignBtn = document.getElementById("closeAssignModal");
    const cancelAssignBtn = document.getElementById("cancelAssignModal");
    const assignForm = document.getElementById("assignForm");
    if (openAssignBtn) {
        openAssignBtn.addEventListener("click", () => {
            const coach = selectedAssignmentCoach();
            openAssignModal(coach ? encodeURIComponent(coach.id) : null);
        });
    }
    if (closeAssignBtn) closeAssignBtn.addEventListener("click", () => { assignModal.style.display = "none"; });
    if (cancelAssignBtn) cancelAssignBtn.addEventListener("click", () => { assignModal.style.display = "none"; });
    if (assignForm) assignForm.addEventListener("submit", event => { event.preventDefault(); saveAssignment(); });

    // Session dialog
    const sessionModal = document.getElementById("sessionModal");
    const openSessionBtn = document.getElementById("openSessionModal");
    const closeSessionBtn = document.getElementById("closeSessionModal");
    const cancelSessionBtn = document.getElementById("cancelSessionModal");
    const sessionForm = document.getElementById("sessionForm");
    if (openSessionBtn) openSessionBtn.addEventListener("click", () => openSessionModal(null));
    if (closeSessionBtn) closeSessionBtn.addEventListener("click", () => { sessionModal.style.display = "none"; });
    if (cancelSessionBtn) cancelSessionBtn.addEventListener("click", () => { sessionModal.style.display = "none"; });
    if (sessionForm) sessionForm.addEventListener("submit", event => { event.preventDefault(); saveSession(); });

    // Client details dialog
    const clientModal = document.getElementById("clientDetailsModal");
    const closeClientBtn = document.getElementById("closeClientDetails");
    const closeClientBtn2 = document.getElementById("closeClientDetailsBtn");
    const renewClientBtn = document.getElementById("renewClientBtn");
    if (closeClientBtn) closeClientBtn.addEventListener("click", () => { clientModal.style.display = "none"; });
    if (closeClientBtn2) closeClientBtn2.addEventListener("click", () => { clientModal.style.display = "none"; });
    if (renewClientBtn) {
        renewClientBtn.addEventListener("click", () => {
            if (!window.pendingClientId) return;
            if (typeof window.renewMemberById === "function") {
                window.renewMemberById(encodeURIComponent(window.pendingClientId));
            }
        });
    }

    // Clicking the backdrop closes any open dialog, like the other modules
    [coachModal, detailsModal, assignModal, sessionModal, clientModal].forEach(modal => {
        if (!modal) return;
        modal.addEventListener("click", event => {
            if (event.target === modal) modal.style.display = "none";
        });
    });

    // Search & filters
    ["coachSearch", "filterCoachStatus", "filterCoachSpecialization"].forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        el.addEventListener("input", renderCoachDirectory);
        el.addEventListener("change", renderCoachDirectory);
    });

    ["sessionSearch", "filterSessionCoach", "filterSessionStatus"].forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        el.addEventListener("input", renderSessions);
        el.addEventListener("change", renderSessions);
    });

    // Schedule + assignment coach pickers
    const scheduleCoachSelect = document.getElementById("scheduleCoach");
    if (scheduleCoachSelect) {
        scheduleCoachSelect.addEventListener("change", () => {
            renderSchedule();
            renderUpcomingAppointments();
        });
    }
    const assignmentCoachSelect = document.getElementById("assignmentCoach");
    if (assignmentCoachSelect) assignmentCoachSelect.addEventListener("change", renderAssignments);

    // Reporting period
    const periodSelect = document.getElementById("performancePeriod");
    if (periodSelect) periodSelect.addEventListener("change", renderPerformance);
    ["performanceFrom", "performanceTo"].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener("change", renderPerformance);
    });

    // Another tab editing coaches refreshes this one
    window.addEventListener("storage", renderCoachTracker);
});