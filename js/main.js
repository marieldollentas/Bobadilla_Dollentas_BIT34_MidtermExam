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

        if (window.selectedArchivedMemberIds) {
            window.selectedArchivedMemberIds.delete(String(id));
        }

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

        if (window.selectedArchivedMemberIds) {
            window.selectedArchivedMemberIds.delete(String(id));
        }

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

    function buildCustomerTierOptions(currentTier) {
        const select = document.getElementById("customerTier");
        if (!select) return;
        const availableTiers = currentTier
            ? PIPELINE_TIERS.filter(tier => tier.value !== currentTier)
            : PIPELINE_TIERS;
        select.innerHTML = availableTiers.map(tier =>
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
        const today = typeof todayStart === "function" ? todayStart() : new Date();
        const exp = months ? computeExpirationDate(months, today) : "";
        expEl.value = exp || "—";
        if (!noteEl) return;
        if (exp) {
            noteEl.textContent = `Auto-computed: New ${months}-month term starting from today.`;
        } else if (months) {
            noteEl.textContent = "Could not derive expiration date.";
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

        const currentTier = customer.tier || "";
        buildCustomerTierOptions(currentTier);
        document.getElementById("customerId").value = customer.id;
        const nameParts = namePartsFromRecord(customer);
        document.getElementById("customerFirstName").value = nameParts.firstName || "—";
        document.getElementById("customerMiddleName").value = nameParts.middleName || "—";
        document.getElementById("customerLastName").value = nameParts.lastName || "—";
        const suffixEl = document.getElementById("customerSuffix");
        if (suffixEl) suffixEl.value = customer.suffix || "—";
        document.getElementById("customerGender").value = customer.gender === "Other" && customer.genderIdentity
            ? `Other (${customer.genderIdentity})`
            : (customer.gender || "—");
        const bdayEl = document.getElementById("customerBirthday");
        if (bdayEl) bdayEl.value = customer.birthday || "—";
        const emailEl = document.getElementById("customerEmail");
        if (emailEl) emailEl.value = customer.email || "—";
        const phoneEl = document.getElementById("customerPhone");
        if (phoneEl) phoneEl.value = customer.phone || "—";
        const addrEl = document.getElementById("customerAddress");
        if (addrEl) addrEl.value = customer.address || "—";
        const contactEl = document.getElementById("customerContact");
        if (contactEl) contactEl.value = customer.contact || "—";
        document.getElementById("customerKeyFob").value = customer.keyFob || "—";
        document.getElementById("customerJoined").value = customer.joined || "";

        const currentTierEl = document.getElementById("customerCurrentTier");
        if (currentTierEl) currentTierEl.value = currentTier || "None";

        const tierEl = document.getElementById("customerTier");
        if (tierEl && tierEl.options.length > 0) {
            tierEl.selectedIndex = 0;
        }

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
        if (previousTier && previousTier === tier) {
            return fail("Member is already enrolled in this tier. Please choose between the other two tiers.");
        }

        const months = tierDurationMonths(tier);
        const today = typeof todayStart === "function" ? todayStart() : new Date();
        const exp = computeExpirationDate(months, today);
        if (!exp) return fail("The new expiration date could not be derived.");

        record.tier = tier;
        record.exp = exp;
        record.updatedExpirationDate = exp;
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

    // Customer Directory Filters & Real-Time Search
    if (document.getElementById("customerTableBody") && typeof initCustomerDirectoryFilters === "function") {
        initCustomerDirectoryFilters();
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

    // Lead names are filtered at the source: numbers and special characters
    // (except ñ/Ñ) never reach the field, and the length is capped to match
    // the member registration form.
    ["leadFirstName", "leadMiddleName", "leadLastName"].forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        el.addEventListener("input", () => sanitizePersonNameInput(el));
        el.addEventListener("blur", () => sanitizePersonNameInput(el));
    });

    // The lead form shows the +63 prefix, so the field holds the 10-digit
    // national number and is stored back as an 11-digit local number.
    bindPhPhoneInput(document.getElementById("leadPhone"));

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
            if (typeof renderStaffOptions === "function") {
                renderStaffOptions(document.getElementById("leadStaff"), false);
            }
            document.getElementById("leadId").value = "";
            document.getElementById("leadStage").value = "new-lead";
            document.getElementById("lostReasonGroup").style.display = "none";
            if (typeof applyLeadFollowUpBounds === "function") applyLeadFollowUpBounds();
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
            const nameParts = readNameInputs("lead");
            const name = nameParts.name;
            if (!nameParts.firstName || !nameParts.lastName) {
                alert("Please enter the client's first and last name.");
                return;
            }

            if (![nameParts.firstName, nameParts.middleName, nameParts.lastName].every(isValidPersonName)) {
                alert("Names may only contain letters and spaces. Numbers and special characters are not allowed, except ñ or Ñ.");
                return;
            }

            const phoneVal = phLocalNumber(document.getElementById("leadPhone").value);
            if (phoneVal && !/^0\d{10}$/.test(phoneVal)) {
                alert("Enter the 10-digit mobile number after +63.");
                return;
            }

            const emailVal = (document.getElementById("leadEmail") || { value: "" }).value.trim();
            if (emailVal && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailVal)) {
                alert("Please enter a valid email address.");
                return;
            }

            const followUpInput = document.getElementById("leadFollowUp");
            const followUpVal = followUpInput.value;
            const editingId = document.getElementById("leadId").value;
            const existingLead = editingId ? getPipelineLeads().find(l => String(l.id) === String(editingId)) : null;
            const existingFollowUp = existingLead ? existingLead.followUp || "" : "";
            if (followUpVal && followUpVal !== existingFollowUp) {
                const bounds = leadFollowUpBounds();
                if (followUpVal < bounds.min || followUpVal > bounds.max) {
                    alert("Follow-up dates must be today or later, and no more than 10 years from today.");
                    return;
                }
            }

            const leads = getPipelineLeads();
            const duplicate = findContactDuplicate(leads, phoneVal, emailVal, editingId);
            if (duplicate) {
                alert(contactDuplicateBlockedMessage("lead", duplicate));
                return;
            }

            const chosenStaff = (document.getElementById("leadStaff") || {}).value || "";
            const staffList = (typeof getPipelineStaffList === "function") ? getPipelineStaffList() : [];
            const targetStaff = staffList.find(s => s.name === chosenStaff || (typeof normalizePipelineStaff === "function" && normalizePipelineStaff(s.name) === normalizePipelineStaff(chosenStaff)));

            if (targetStaff && targetStaff.status !== "Active") {
                alert(`Cannot assign lead to "${targetStaff.name}" because their status is currently "${targetStaff.status}". Staff who are inactive or on leave cannot be assigned with a lead. Please select an Active staff member.`);
                return;
            }

            const data = {
                name,
                firstName: nameParts.firstName,
                middleName: nameParts.middleName,
                lastName: nameParts.lastName,
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
            if (typeof renderStaffDirectory === "function") renderStaffDirectory();
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
            const otherInput = document.getElementById("campaignPlatformOther");
            if (otherInput) otherInput.required = false;
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
            const otherInput = document.getElementById("campaignPlatformOther");
            const isOther = campaignPlatformSelect.value === "Other";
            if (group) group.style.display = isOther ? "block" : "none";
            if (otherInput) otherInput.required = isOther;
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
            const rawVal = campaignPostUrlInput.value.trim();
            if (!rawVal) {
                if (campaignPostUrlError) {
                    campaignPostUrlError.textContent = "";
                    campaignPostUrlError.hidden = true;
                }
                if (campaignPostUrlHint) {
                    campaignPostUrlHint.textContent = "";
                    campaignPostUrlHint.hidden = true;
                }
                return;
            }

            const info = parseSocialPostUrl(rawVal);

            if (campaignPostUrlError) {
                campaignPostUrlError.textContent = info.ok ? "" : info.reason;
                campaignPostUrlError.hidden = info.ok;
            }
            if (campaignPostUrlHint) {
                campaignPostUrlHint.textContent = info.ok ? (info.note || "") : "";
                campaignPostUrlHint.hidden = !info.ok || !info.note;
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
            const titleInput = document.getElementById("campaignTitle");
            const title = (titleInput ? titleInput.value : "").trim();
            if (!title) {
                alert("Please enter the campaign title.");
                if (titleInput) titleInput.focus();
                return;
            }

            const postUrl = (campaignPostUrlInput ? campaignPostUrlInput.value : "").trim();
            if (!postUrl) {
                if (campaignPostUrlError) {
                    campaignPostUrlError.textContent = "Please enter the post link.";
                    campaignPostUrlError.hidden = false;
                }
                if (campaignPostUrlHint) campaignPostUrlHint.hidden = true;
                if (campaignPostUrlInput) campaignPostUrlInput.focus();
                return;
            }

            const postInfo = parseSocialPostUrl(postUrl);
            if (!postInfo.ok) {
                if (campaignPostUrlError) {
                    campaignPostUrlError.textContent = postInfo.reason || "Please enter a valid post link.";
                    campaignPostUrlError.hidden = false;
                }
                if (campaignPostUrlHint) campaignPostUrlHint.hidden = true;
                if (campaignPostUrlInput) campaignPostUrlInput.focus();
                return;
            }

            const platform = campaignPlatformSelect ? campaignPlatformSelect.value : "";
            if (!platform) {
                alert("Please select a platform.");
                if (campaignPlatformSelect) campaignPlatformSelect.focus();
                return;
            }

            const customPlatformInput = document.getElementById("campaignPlatformOther");
            const customPlatform = (customPlatformInput ? customPlatformInput.value : "").trim();
            if (platform === "Other" && !customPlatform) {
                alert("Please enter the custom platform name.");
                if (customPlatformInput) customPlatformInput.focus();
                return;
            }

            const statusInput = document.getElementById("campaignStatus");
            const status = statusInput ? statusInput.value : "";
            if (!status) {
                alert("Please select a status.");
                if (statusInput) statusInput.focus();
                return;
            }

            const imageInput = document.getElementById("campaignImageUrl");
            const rawImageUrl = (imageInput ? imageInput.value : "").trim();
            // Thumbnail is optional: fallback to default image if left blank
            const imageUrl = rawImageUrl || CAMPAIGN_PLACEHOLDER_IMAGE;

            const campaigns = getCampaigns();
            const data = {
                title,
                platform: platform === "Other" && customPlatform ? customPlatform : platform,
                status,
                // The canonical permalink is stored so the official embed script
                // is handed exactly the URL shape it documents.
                postUrl: postInfo.url || postUrl,
                imageUrl
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
            const customerHint = document.getElementById("customerHint");
            if (customerHint) customerHint.style.display = isAdmin ? "none" : "block";
            const forgotLink = document.getElementById("forgotPasswordLink");
            if (forgotLink) forgotLink.style.display = isAdmin ? "none" : "inline";
        };
        tabAdmin.addEventListener("click", () => switchTab("admin"));
        tabCustomer.addEventListener("click", () => switchTab("customer"));
        switchTab(tabAdmin.classList.contains("active") ? "admin" : "customer");
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
                // If credentials don't match, check if password fails customer complexity requirements
                // to provide specific, helpful feedback
                const validation = typeof validatePasswordComplexity === "function"
                    ? validatePasswordComplexity(password)
                    : { ok: true };
                if (!validation.ok) {
                    errorEl.textContent = validation.reason;
                    return;
                }
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
        const regGenderEl = document.getElementById("regGender");
        const regGenderIdentityEl = document.getElementById("regGenderIdentity");
        const genderIdentityGroup = document.getElementById("genderIdentityGroup");
        const regBirthdayEl = document.getElementById("regBirthday");

        // The calendar is bounded to the last 100 years and can never reach the
        // future, and the minimum age of 18 is enforced again on submit.
        const birthdayBounds = () => {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const earliest = new Date(today);
            earliest.setFullYear(earliest.getFullYear() - 100);
            return { min: localISODate(earliest), max: localISODate(today) };
        };
        const calculateAge = (value) => {
            const birth = new Date(String(value) + "T00:00:00");
            if (isNaN(birth.getTime())) return null;
            const today = new Date();
            let age = today.getFullYear() - birth.getFullYear();
            const monthDiff = today.getMonth() - birth.getMonth();
            if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) age -= 1;
            return age;
        };
        if (regBirthdayEl) {
            const bounds = birthdayBounds();
            regBirthdayEl.min = bounds.min;
            regBirthdayEl.max = bounds.max;
        }

        // The optional gender identity only applies when "Other" is chosen, so
        // it is revealed on demand and cleared again when another option is
        // selected. Its input keeps the same 50-character limit as a name and
        // allows letters, spaces and hyphens only.
        const sanitizeGenderIdentity = () => {
            if (!regGenderIdentityEl) return;
            const clean = String(regGenderIdentityEl.value || "").replace(/[^A-Za-zñÑ\s-]/g, "").slice(0, PERSON_NAME_MAX_LENGTH);
            if (regGenderIdentityEl.value !== clean) regGenderIdentityEl.value = clean;
        };
        const toggleGenderIdentity = () => {
            if (!regGenderEl || !genderIdentityGroup) return;
            const isOther = regGenderEl.value === "Other";
            genderIdentityGroup.style.display = isOther ? "" : "none";
            if (!isOther && regGenderIdentityEl) regGenderIdentityEl.value = "";
        };
        if (regGenderEl) regGenderEl.addEventListener("change", toggleGenderIdentity);
        if (regGenderIdentityEl) {
            regGenderIdentityEl.addEventListener("input", sanitizeGenderIdentity);
            regGenderIdentityEl.addEventListener("blur", sanitizeGenderIdentity);
        }
        toggleGenderIdentity();

        // Name fields accept letters and spaces only, capped at 50 characters.
        // Filtering on input keeps pasted or autofilled values clean too, so a
        // number or special character never reaches the member record.
        const nameEls = ["regFirstName", "regMiddleName", "regLastName"]
            .map(id => document.getElementById(id))
            .filter(Boolean);
        const sanitizeName = (el) => sanitizePersonNameInput(el, PERSON_NAME_MAX_LENGTH);
        nameEls.forEach(el => {
            el.addEventListener("input", () => sanitizeName(el));
            el.addEventListener("blur", () => sanitizeName(el));
        });

        // The field shows the +63 prefix, so it holds the 10-digit national
        // number; typing, pasting and autofill all go through the same filter.
        bindPhPhoneInput(regPhoneEl);

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

        // Terms and Conditions disclaimer & modal
        const regTermsEl = document.getElementById("regTerms");
        const termsModal = document.getElementById("termsModal");
        const openTermsLink = document.getElementById("openTermsLink");
        const closeTermsBtn = document.getElementById("closeTermsBtn");
        const acceptTermsModalBtn = document.getElementById("acceptTermsModalBtn");

        if (termsModal) {
            const showTermsModal = (e) => {
                if (e) e.preventDefault();
                termsModal.style.display = "flex";
            };
            const hideTermsModal = () => {
                termsModal.style.display = "none";
            };
            if (openTermsLink) openTermsLink.addEventListener("click", showTermsModal);
            if (closeTermsBtn) closeTermsBtn.addEventListener("click", hideTermsModal);
            if (acceptTermsModalBtn) {
                acceptTermsModalBtn.addEventListener("click", () => {
                    if (regTermsEl) regTermsEl.checked = true;
                    hideTermsModal();
                    const errorEl = document.getElementById("regError");
                    if (errorEl && errorEl.textContent.includes("Terms and Conditions")) {
                        errorEl.textContent = "";
                    }
                });
            }
            window.addEventListener("click", (e) => {
                if (e.target === termsModal) hideTermsModal();
            });
        }

        if (regTermsEl) {
            regTermsEl.addEventListener("change", () => {
                const errorEl = document.getElementById("regError");
                if (errorEl && errorEl.textContent.includes("Terms and Conditions")) {
                    errorEl.textContent = "";
                }
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
        if (typeof bindPasswordCriteria === "function") {
            bindPasswordCriteria("regPassword", "regPasswordCriteria");
        }

        registerForm.addEventListener("submit", (e) => {
            e.preventDefault();
            nameEls.forEach(sanitizeName);
            const nameParts = readNameInputs("reg");
            const suffixEl = document.getElementById("regSuffix");
            const suffix = suffixEl ? suffixEl.value : "";
            const name = nameParts.name + (suffix ? ` ${suffix}` : "");
            sanitizeGenderIdentity();
            const gender = regGenderEl ? regGenderEl.value : "";
            const genderIdentity = gender === "Other" && regGenderIdentityEl
                ? regGenderIdentityEl.value.trim()
                : "";
            const email = document.getElementById("regEmail").value.trim();
            const phone = phLocalNumber(regPhoneEl ? regPhoneEl.value : "");
            const address = document.getElementById("regAddress").value.trim();
            const tier = regTierEl ? regTierEl.value : "";
            const keyFob = regFobEl ? regFobEl.value.trim() : "";
            const birthday = regBirthdayEl ? regBirthdayEl.value : "";
            const password = document.getElementById("regPassword").value;
            const confirm = document.getElementById("regConfirm").value;
            const errorEl = document.getElementById("regError");

            if (!nameParts.firstName || !nameParts.lastName) {
                errorEl.textContent = "Please enter your first and last name.";
                return;
            }

            if (!isValidPersonName(nameParts.firstName) || !isValidPersonName(nameParts.lastName)) {
                errorEl.textContent = "Names may only contain letters and spaces. Numbers and special characters are not allowed, except ñ or Ñ.";
                return;
            }

            if (nameParts.middleName && !isValidPersonName(nameParts.middleName)) {
                errorEl.textContent = "Middle name may only contain letters and spaces. Numbers and special characters are not allowed, except ñ or Ñ.";
                return;
            }

            if (!birthday) {
                errorEl.textContent = "Please enter your birthday.";
                return;
            }

            const bounds = birthdayBounds();
            if (birthday > bounds.max) {
                errorEl.textContent = "Your birthday cannot be in the future.";
                return;
            }

            if (birthday < bounds.min) {
                errorEl.textContent = "Your birthday cannot be more than 100 years ago.";
                return;
            }

            if (calculateAge(birthday) < 18) {
                errorEl.textContent = "You must be at least 18 years old to register.";
                return;
            }

            if (!gender) {
                errorEl.textContent = "Please select your gender.";
                return;
            }

            if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
                errorEl.textContent = "Please enter a valid email address.";
                return;
            }

            const passwordValidation = typeof validatePasswordComplexity === "function"
                ? validatePasswordComplexity(password)
                : { ok: true };
            if (!passwordValidation.ok) {
                errorEl.textContent = passwordValidation.reason;
                const pInput = document.getElementById("regPassword");
                if (pInput) pInput.focus();
                return;
            }

            if (password !== confirm) {
                errorEl.textContent = "Passwords do not match.";
                const cInput = document.getElementById("regConfirm");
                if (cInput) cInput.focus();
                return;
            }

            if (phone && !/^0\d{10}$/.test(phone)) {
                errorEl.textContent = "Enter the 10-digit mobile number after +63.";
                return;
            }

            if (!keyFob) {
                errorEl.textContent = "A Key Fob Number could not be generated. Please reload and try again.";
                return;
            }

            if (!regTermsEl || !regTermsEl.checked) {
                errorEl.textContent = "Please agree to the Terms and Conditions before registering.";
                if (regTermsEl) regTermsEl.focus();
                return;
            }

            const customers = JSON.parse(localStorage.getItem("crmCustomers") || "[]");
            if (customers.some(c => c.username === keyFob)) {
                errorEl.textContent = "Key Fob Number already assigned. Please reload and try again.";
                return;
            }

            const directory = JSON.parse(localStorage.getItem(DIRECTORY_KEY) || "[]");
            const contactDuplicate = findContactDuplicate([...customers, ...directory], phone, email, null);
            if (contactDuplicate) {
                alert(contactDuplicateBlockedMessage("member", contactDuplicate));
                return;
            }

            customers.push({
                username: keyFob,
                keyFob,
                password,
                name,
                firstName: nameParts.firstName,
                middleName: nameParts.middleName,
                lastName: nameParts.lastName,
                suffix,
                gender,
                genderIdentity,
                birthday,
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

        const AVATAR_MAX_BYTES = 5 * 1024 * 1024;
        const AVATAR_MAX_PX = 512;
        const avatarInput = document.getElementById("avatarInput");
        const avatarUploadBtn = document.getElementById("avatarUploadBtn");
        const avatarRemoveBtn = document.getElementById("avatarRemoveBtn");
        const avatarMsg = document.getElementById("avatarMsg");

        const avatarIsImage = value => /^data:image\/(?:png|jpe?g|webp|gif);base64,/i.test(String(value || ""));

        const avatarInitials = () => {
            const source = String(customer.name || customer.username || "AF").trim();
            const parts = source.split(/\s+/).filter(Boolean);
            if (parts.length > 1) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
            return (source.slice(0, 2) || "AF").toUpperCase();
        };

        const paintAvatar = src => {
            const safeSrc = avatarIsImage(src) ? src : "";
            ["userAvatar", "portalAvatar"].forEach(id => {
                const el = document.getElementById(id);
                if (!el) return;
                el.classList.toggle("has-photo", Boolean(safeSrc));
                el.innerHTML = "";
                if (safeSrc) {
                    const img = document.createElement("img");
                    img.src = safeSrc;
                    img.alt = `${customer.name || "Member"} profile picture`;
                    el.appendChild(img);
                } else {
                    el.textContent = avatarInitials();
                }
            });
            if (avatarRemoveBtn) avatarRemoveBtn.hidden = !safeSrc;
        };

        const saveCustomerAvatar = value => {
            const list = JSON.parse(localStorage.getItem("crmCustomers") || "[]");
            const record = list.find(c => c.username === currentUser);
            if (!record) return false;
            if (value) record.avatar = value;
            else delete record.avatar;
            try {
                localStorage.setItem("crmCustomers", JSON.stringify(list));
            } catch (e) {
                return false;
            }
            if (value) customer.avatar = value;
            else delete customer.avatar;
            if (typeof updateCustomerInquiriesAvatar === "function") {
                updateCustomerInquiriesAvatar(currentUser, customer.name, value);
            }
            return true;
        };

        const resizeAvatarFile = file => new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onerror = () => reject(new Error("read"));
            reader.onload = () => {
                const img = new Image();
                img.onerror = () => reject(new Error("decode"));
                img.onload = () => {
                    const scale = Math.min(1, AVATAR_MAX_PX / Math.max(img.width, img.height));
                    const width = Math.max(1, Math.round(img.width * scale));
                    const height = Math.max(1, Math.round(img.height * scale));
                    const canvas = document.createElement("canvas");
                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext("2d");
                    if (!ctx) {
                        reject(new Error("canvas"));
                        return;
                    }
                    ctx.fillStyle = "#ffffff";
                    ctx.fillRect(0, 0, width, height);
                    ctx.drawImage(img, 0, 0, width, height);
                    try {
                        resolve(canvas.toDataURL("image/jpeg", 0.85));
                    } catch (e) {
                        reject(e);
                    }
                };
                img.src = reader.result;
            };
            reader.readAsDataURL(file);
        });

        const showAvatarMsg = (text, isError) => {
            if (!avatarMsg) return;
            avatarMsg.className = isError ? "error-msg" : "success-msg";
            avatarMsg.textContent = text;
        };

        paintAvatar(customer.avatar);

        if (avatarUploadBtn && avatarInput) {
            avatarUploadBtn.addEventListener("click", () => avatarInput.click());
            avatarInput.addEventListener("change", async () => {
                const file = avatarInput.files && avatarInput.files[0];
                avatarInput.value = "";
                if (!file) return;
                if (!/^image\/(?:jpeg|png|webp)$/i.test(file.type)) {
                    showAvatarMsg("Please choose a JPG, PNG or WebP image.", true);
                    return;
                }
                if (file.size > AVATAR_MAX_BYTES) {
                    showAvatarMsg("That image is larger than 5 MB. Please choose a smaller file.", true);
                    return;
                }
                showAvatarMsg("Uploading your photo…", false);
                try {
                    const dataUrl = await resizeAvatarFile(file);
                    if (!saveCustomerAvatar(dataUrl)) {
                        showAvatarMsg("We couldn't save your photo. Please try a smaller image.", true);
                        return;
                    }
                    paintAvatar(dataUrl);
                    showAvatarMsg("Profile picture updated.", false);
                    if (typeof renderMyInquiries === "function") renderMyInquiries();
                } catch (e) {
                    showAvatarMsg("That image could not be read. Please try another file.", true);
                }
            });
        }

        if (avatarRemoveBtn) {
            avatarRemoveBtn.addEventListener("click", () => {
                if (!customer.avatar) return;
                if (!confirm("Remove your profile picture?")) return;
                if (!saveCustomerAvatar("")) {
                    showAvatarMsg("We couldn't remove your photo. Please try again.", true);
                    return;
                }
                paintAvatar("");
                showAvatarMsg("Profile picture removed.", false);
                if (typeof renderMyInquiries === "function") renderMyInquiries();
            });
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
                            <div class="portal-reply-header" style="display:flex; align-items:center; gap:8px; margin-bottom:8px;">
                                <span class="avatar has-photo" style="width:28px; height:28px; border:1px solid #0284c7;">
                                    <img src="${escapeHtml(getCustomerAvatar(inq, null))}" alt="Your avatar" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">
                                </span>
                                <label for="reply-${inq.id}" style="margin-bottom:0;">Reply as <strong>${escapeHtml(customer.name || "Member")}</strong></label>
                            </div>
                            <textarea id="reply-${inq.id}" class="inquiry-input" rows="3" placeholder="Type your reply to support..."></textarea>
                            <button class="btn-primary" onclick="replyToInquiry(${inq.id})">Send Reply</button>
                        </div>
                    </div>
                `;
                container.appendChild(card);
            });
        };

        renderPortalCoachSection(customer);

        // Archived sessions are revealed read-only; archiving stays a staff action.
        const showArchivedSessionsEl = document.getElementById("portalShowArchivedSessions");
        if (showArchivedSessionsEl) {
            showArchivedSessionsEl.addEventListener("change", () => renderPortalSessions(customer));
        }

        renderMyInquiries();

        // Ratings come from the member side only: the handler is scoped to this
        // page so the coach directory has no way to submit one, and it enforces
        // a single rating per member (updating their existing review if already rated).
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
            const existingIndex = ratings.findIndex(row => String(row.clientId) === clientId);

            if (existingIndex >= 0) {
                // Member has already rated this coach: update existing rating in place
                // rather than creating a duplicate entry or inflating ratingCount.
                const oldRating = ratings[existingIndex];
                const oldStars = Number(oldRating.stars) || 0;
                oldRating.stars = stars;
                oldRating.comment = comment;
                oldRating.updatedAt = new Date().toISOString();
                target.ratings = ratings;
                target.ratingSum = Math.max(0, (Number(target.ratingSum) || 0) - oldStars + stars);
                // ratingCount remains unchanged on update
                saveCoaches(coaches);

                logActivity({
                    type: "coach",
                    title: `${target.name}'s rating was updated by ${customer.name} (${stars} stars)`,
                    meta: `${shortenLabel(comment, 68)} • ${coachRatingAverage(target).toFixed(1)}/5 based on ${target.ratingCount} rating${Number(target.ratingCount) === 1 ? "" : "s"}`,
                    href: "coach.html"
                });

                renderPortalCoachSection(customer);
                const done = document.getElementById("portalRatingMsg");
                if (done) {
                    done.className = "success-msg";
                    done.textContent = "Thank you! Your rating and feedback were updated.";
                }
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
                avatar: customer.avatar || "",
                comments: [{
                    author: customer.name,
                    role: "customer",
                    text: message,
                    date: dateTimeStr,
                    avatar: customer.avatar || ""
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
                date: new Date().toLocaleString(),
                avatar: customer.avatar || ""
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
            const nameParts = readNameInputs("ticket");
            const name = nameParts.name;
            const contact = document.getElementById("ticketContact").value.trim();
            const priority = document.getElementById("ticketPriority").value;
            const status = document.getElementById("ticketStatus").value;
            const issue = document.getElementById("ticketIssue").value.trim();

            if (!nameParts.firstName || !nameParts.lastName || !issue) {
                alert("Please provide at least a first name, last name and an issue description.");
                return;
            }

            const tickets = JSON.parse(localStorage.getItem("crmStaffTickets") || "[]");
            const now = new Date().toISOString();
            tickets.push({
                id: Date.now(),
                date: now,
                name,
                firstName: nameParts.firstName,
                middleName: nameParts.middleName,
                lastName: nameParts.lastName,
                contact,
                issue,
                priority,
                status,
                reply: "",
                avatar: typeof getCustomerAvatar === "function" ? getCustomerAvatar(null, { author: name }) : "",
                comments: [{
                    author: name,
                    role: "customer",
                    text: issue,
                    date: now,
                    avatar: typeof getCustomerAvatar === "function" ? getCustomerAvatar(null, { author: name }) : ""
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
    const archiveFromDetailsBtn = document.getElementById("archiveFromDetails");

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

    if (archiveFromDetailsBtn) {
        archiveFromDetailsBtn.addEventListener("click", () => {
            if (!pendingTicket) return;
            requestArchiveTicket(pendingTicket.id, pendingTicket.source);
            detailsModal.style.display = "none";
        });
    }

    // Tickets page: Archive confirmation dialog
    const archiveModal = document.getElementById("archiveConfirmModal");
    const closeArchiveModal = document.getElementById("closeArchiveModal");
    const cancelArchiveBtn = document.getElementById("cancelArchiveBtn");
    const confirmArchiveBtn = document.getElementById("confirmArchiveBtn");

    if (closeArchiveModal && archiveModal) {
        closeArchiveModal.addEventListener("click", () => {
            archiveModal.style.display = "none";
        });
        window.addEventListener("click", (e) => {
            if (e.target === archiveModal) {
                archiveModal.style.display = "none";
            }
        });
    }

    if (cancelArchiveBtn) {
        cancelArchiveBtn.addEventListener("click", () => {
            archiveModal.style.display = "none";
        });
    }

    if (confirmArchiveBtn) {
        confirmArchiveBtn.addEventListener("click", confirmArchiveTicket);
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
                if (id === "filterStatus" && el.value === "Resolved") {
                    const hideResolvedEl = document.getElementById("hideResolved");
                    if (hideResolvedEl && hideResolvedEl.checked) {
                        hideResolvedEl.checked = false;
                    }
                }
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
    if (typeof initTicketStatFilters === "function") initTicketStatFilters();

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
    renderArchivedCoaches();
    renderArchivedTickets();
    renderArchivedLeads();
    renderArchivedSessions();

    // Each archive container has its own search field. Rows are filtered by
    // their rendered text and the filter is re-applied whenever a renderer
    // repaints the table (restore, delete or a storage update).
    const archiveFilters = [
        ["archiveMemberSearch", "archivedTableBody"],
        ["archiveCoachSearch", "archivedCoachesBody"],
        ["archiveStaffTicketSearch", "archivedStaffTicketsBody"],
        ["archiveCustomerInquirySearch", "archivedCustomerInquiriesBody"],
        ["archiveLeadSearch", "archivedLeadsBody"],
        ["archiveSessionSearch", "archivedSessionsBody"]
    ];

    const applyArchiveFilter = (input, tbody) => {
        const query = input.value.trim().toLowerCase();
        Array.from(tbody.rows).forEach(row => {
            if (row.querySelector("td[colspan]")) return;
            row.style.display = !query || row.textContent.toLowerCase().includes(query) ? "" : "none";
        });
    };

    archiveFilters.forEach(([inputId, tbodyId]) => {
        const input = document.getElementById(inputId);
        const tbody = document.getElementById(tbodyId);
        if (!input || !tbody) return;

        input.addEventListener("input", () => applyArchiveFilter(input, tbody));
        if (typeof MutationObserver === "function") {
            new MutationObserver(() => applyArchiveFilter(input, tbody))
                .observe(tbody, { childList: true });
        }
    });
});
