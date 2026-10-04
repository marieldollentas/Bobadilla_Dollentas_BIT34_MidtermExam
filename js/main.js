// js-split:file=main.js part=1of1
// Split from script.js - whole top-level blocks moved verbatim, no behavior change.
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

    // Permanent Delete: removes an archived record for good. Only reachable
    // from the Archive page, which itself is staff-only.
    window.permanentlyDeleteMember = id => {
        if (sessionStorage.getItem("crmRole") !== "admin") {
            alert("Only staff can permanently delete members.");
            return;
        }
        const member = getDirectoryCustomers().find(c => String(c.id) === String(id));
        if (!member) {
            alert("Member not found. It may have already been deleted.");
            return;
        }
        if (!confirm(`Permanently delete ${member.name || "this member"}'s archived record? This cannot be undone.`)) return;

        if (!permanentlyDeleteMemberById(id)) {
            alert("Member not found. It may have already been deleted.");
            return;
        }

        logActivity({
            type: "membership",
            title: `${member.name || "A member"}'s archived record was permanently deleted`,
            meta: `${member.tier || "Membership"} • Joined ${member.joined || "—"}`,
            href: activityHref("archive.html", member.name || "")
        });

        renderCustomerDirectory();
        renderArchivedMembers();
        countExpiringMembers();
        countActiveMembers();
    };
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

    const leadTierSelect = document.getElementById("leadTier");
    const leadValueInput = document.getElementById("leadValue");
    function syncLeadValue() {
        if (!leadTierSelect || !leadValueInput) return;
        const t = PIPELINE_TIERS.find(x => x.value === leadTierSelect.value);
        leadValueInput.value = t ? t.price : 0;
    }
    if (leadTierSelect) {
        leadTierSelect.addEventListener("change", syncLeadValue);
    }

    const leadPhoneInput = document.getElementById("leadPhone");
    if (leadPhoneInput) {
        leadPhoneInput.addEventListener("input", function() {
            this.value = this.value.replace(/\D/g, "");
            if (this.value.length > 11) this.value = this.value.slice(0, 11);
        });
    }

    const leadEmailInput = document.getElementById("leadEmail");
    if (leadEmailInput) {
        leadEmailInput.addEventListener("input", function() {
            this.setCustomValidity("");
        });
        leadEmailInput.addEventListener("change", function() {
            const val = this.value.trim();
            if (val && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) {
                this.setCustomValidity("Please enter a valid email address.");
            } else {
                this.setCustomValidity("");
            }
        });
    }

    if (document.getElementById("pipelineBoard")) renderPipelineBoard();

    if (openPipelineModalBtn) {
        openPipelineModalBtn.addEventListener("click", () => {
            pipelineForm.reset();
            document.getElementById("leadId").value = "";
            document.getElementById("leadStage").value = "new-lead";
            document.getElementById("lostReasonGroup").style.display = "none";
            document.getElementById("pipelineModalTitle").textContent = "Add Prospecting Client";
            document.getElementById("pipelineForm").querySelector('button[type="submit"]').textContent = "Save Client";
            if (typeof syncLeadValue === "function") syncLeadValue();
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

            const phoneVal = document.getElementById("leadPhone").value.trim();
            if (phoneVal && !/^\d{11}$/.test(phoneVal)) {
                alert("Phone number must be exactly 11 digits.");
                return;
            }

            const emailVal = (document.getElementById("leadEmail") || { value: "" }).value.trim();
            if (emailVal && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailVal)) {
                alert("Please enter a valid email address.");
                return;
            }

            const leads = getPipelineLeads();
            const data = {
                name,
                phone: phoneVal,
                email: emailVal,
                tier: document.getElementById("leadTier").value,
                staff: document.getElementById("leadStaff").value,
                heat: document.getElementById("leadHeat").value,
                stage: document.getElementById("leadStage").value,
                followUp: document.getElementById("leadFollowUp").value,
                monthlyValue: (function() {
                    const t = PIPELINE_TIERS.find(x => x.value === document.getElementById("leadTier").value);
                    return t ? t.price : (document.getElementById("leadValue").value || 0);
                })(),
                notes: (document.getElementById("leadNotes") || { value: "" }).value.trim(),
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
            if (!id) {
                logActivity({
                    type: "campaign",
                    title: `New social media marketing campaign added: ${title}`,
                    meta: `${data.platform} — ${data.status || "Scheduled"}`,
                    href: activityHref("index.html", title)
                });
            }
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
    const deleteFromDetailsBtn = document.getElementById("archiveFromDetails");

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
            requestArchiveTicket(pendingTicket.id, pendingTicket.source);
            detailsModal.style.display = "none";
        });
    }

    // Tickets page: Archive confirmation dialog
    const deleteModal = document.getElementById("archiveConfirmModal");
    const closeDeleteModal = document.getElementById("closeArchiveModal");
    const cancelDeleteBtn = document.getElementById("cancelArchiveBtn");
    const confirmDeleteBtn = document.getElementById("confirmArchiveBtn");

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
        confirmDeleteBtn.addEventListener("click", confirmArchiveTicket);
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

// Archive page (archive.html): staff-only overview of everything filed away.
// Each renderer guards on its own table body, so this listener is a no-op
// everywhere else.
document.addEventListener("DOMContentLoaded", () => {
    if (!document.getElementById("archivePage")) return;
    if (sessionStorage.getItem("crmRole") !== "admin") {
        location.href = "login.html";
        return;
    }

    renderArchivedMembers();
    renderArchivedTickets();
    renderArchivedLeads();
    renderArchivedSessions();
});
