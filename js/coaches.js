// js-split:file=coaches.js part=1of70
// Split from script.js - whole top-level blocks moved verbatim, no behavior change.
function normalizeCoach(coach) {
    if (!coach || typeof coach !== "object") return coach;

    const list = Array.isArray(coach.specializations)
        ? coach.specializations
        : (coach.specialization ? [coach.specialization] : []);

    return {
        ...coach,
        specializations: list.map(value => String(value).trim()).filter(Boolean),
        status: coach.status === "Inactive" ? "On Leave" : coach.status,
        phone: coach.phone ? String(coach.phone).replace(/\D/g, "").slice(0, COACH_PHONE_DIGITS) : coach.phone
    };
}

// The coaching team is seeded once with the staff names the Sales
// Pipeline already uses, so both modules refer to the same people.
// Only the coach records are seeded: assignments and sessions stay
// empty and are filled from the real member directory, matching how
// the portal treats customers and tickets.


// js-split:file=coaches.js part=2of70
// Split from script.js - whole top-level blocks moved verbatim, no behavior change.
function seedCoaches() {
    if (localStorage.getItem(COACH_KEY) !== null) return;

    const presets = [
        {
            name: PIPELINE_STAFF[0],
            email: "joeff@anytimefitness.com",
            phone: "09175550142",
            specializations: ["Strength Training", "Muscle Building"],
            status: "Active",
            days: [1, 2, 3, 4, 5],
            shiftStart: 6,
            shiftEnd: 14
        },
        {
            name: PIPELINE_STAFF[1],
            email: "mariel@anytimefitness.com",
            phone: "09175550188",
            specializations: ["Weight Loss", "HIIT", "Cardio"],
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


// js-split:file=coaches.js part=3of70
// Split from script.js - whole top-level blocks moved verbatim, no behavior change.
function coachById(id) {
    return getCoaches().find(coach => String(coach.id) === String(id)) || null;
}



// js-split:file=coaches.js part=4of70
// Split from script.js - whole top-level blocks moved verbatim, no behavior change.
function coachAssignmentsFor(coachId) {
    return getCoachAssignments().filter(row => String(row.coachId) === String(coachId));
}



// js-split:file=coaches.js part=5of70
// Split from script.js - whole top-level blocks moved verbatim, no behavior change.
function coachClientCount(coachId) {
    return coachAssignmentsFor(coachId).length;
}



// js-split:file=coaches.js part=6of70
// Split from script.js - whole top-level blocks moved verbatim, no behavior change.
function coachHasClient(coachId, clientId) {
    if (!clientId) return false;
    return coachAssignmentsFor(coachId).some(row => String(row.clientId) === String(clientId));
}



// js-split:file=coaches.js part=7of70
// Split from script.js - whole top-level blocks moved verbatim, no behavior change.
function coachSessionsFor(coachId) {
    return getCoachSessions().filter(session => String(session.coachId) === String(coachId));
}



// js-split:file=coaches.js part=8of70
// Split from script.js - whole top-level blocks moved verbatim, no behavior change.
function coachSpecializations(coach) {
    return Array.isArray(coach && coach.specializations) ? coach.specializations : [];
}



// js-split:file=coaches.js part=9of70
// Split from script.js - whole top-level blocks moved verbatim, no behavior change.
function coachSpecializationLabel(coach) {
    const list = coachSpecializations(coach);
    return list.length ? list.join(", ") : "Coach";
}



// js-split:file=coaches.js part=10of70
// Split from script.js - whole top-level blocks moved verbatim, no behavior change.
function coachHasSpecialization(coach, value) {
    return coachSpecializations(coach).some(entry => entry === value);
}

// Coaches can hold several specializations, so the directory lists them as
// chips instead of a single comma-joined string.


// js-split:file=coaches.js part=11of70
// Split from script.js - whole top-level blocks moved verbatim, no behavior change.
function coachSpecializationsHtml(coach, emptyText) {
    const list = coachSpecializations(coach);
    if (list.length === 0) return escapeHtml(emptyText || "—");
    return `<span class="spec-list">${list
        .map(value => `<span class="spec-chip">${escapeHtml(value)}</span>`)
        .join("")}</span>`;
}



// js-split:file=coaches.js part=12of70
// Split from script.js - whole top-level blocks moved verbatim, no behavior change.
function coachWorkingDayLabels(coach) {
    const days = Array.isArray(coach && coach.days) ? coach.days : [];
    if (days.length === 0) return "Not set";
    const ordered = COACH_WEEKDAYS.filter(day => days.includes(day.value));
    if (ordered.length === 7) return "Every day";
    return ordered.map(day => day.full.slice(0, 3)).join(", ");
}



// js-split:file=coaches.js part=13of70
// Split from script.js - whole top-level blocks moved verbatim, no behavior change.
function coachShiftLabel(coach) {
    if (!coach) return "—";
    return `${formatHourLabel(coach.shiftStart)} – ${formatHourLabel(coach.shiftEnd)}`;
}



// js-split:file=coaches.js part=14of70
// Split from script.js - whole top-level blocks moved verbatim, no behavior change.
function coachAvailableOnDay(coach, date) {
    const days = Array.isArray(coach && coach.days) ? coach.days : [];
    return days.includes(date.getDay());
}



// js-split:file=coaches.js part=15of70
// Split from script.js - whole top-level blocks moved verbatim, no behavior change.
function coachSlotAvailable(coach, date, hour) {
    if (!coach || coach.status !== "Active") return false;
    if (!coachWorkingDayOn(coach, date)) return false;
    return hour >= Number(coach.shiftStart) && hour < Number(coach.shiftEnd);
}



// js-split:file=coaches.js part=16of70
// Split from script.js - whole top-level blocks moved verbatim, no behavior change.
function coachWorkingDayOn(coach, date) {
    return Array.isArray(coach && coach.days) && coach.days.includes(date.getDay());
}

// "Available now" = active today, inside the shift, and not already
// booked for the current hour.


// js-split:file=coaches.js part=17of70
// Split from script.js - whole top-level blocks moved verbatim, no behavior change.
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



// js-split:file=coaches.js part=18of70
// Split from script.js - whole top-level blocks moved verbatim, no behavior change.
function sessionClientName(session) {
    if (!session) return "—";
    const member = getDirectoryCustomers().find(c => String(c.id) === String(session.clientId));
    return member ? member.name : (session.clientName || "—");
}



// js-split:file=coaches.js part=19of70
// Split from script.js - whole top-level blocks moved verbatim, no behavior change.
function coachNameById(coachId) {
    const coach = coachById(coachId);
    return coach ? coach.name : "Unassigned";
}



// js-split:file=coaches.js part=20of70
// Split from script.js - whole top-level blocks moved verbatim, no behavior change.
function coachRatingAverage(coach) {
    const count = Number(coach && coach.ratingCount) || 0;
    const sum = Number(coach && coach.ratingSum) || 0;
    if (count === 0) return null;
    return sum / count;
}



// js-split:file=coaches.js part=21of70
// Split from script.js - whole top-level blocks moved verbatim, no behavior change.
function coachFeedbackList(coach) {
    const rows = Array.isArray(coach && coach.ratings) ? coach.ratings : [];
    return rows.slice().sort((a, b) => String(b.at || "").localeCompare(String(a.at || "")));
}



// js-split:file=coaches.js part=22of70
// Split from script.js - whole top-level blocks moved verbatim, no behavior change.
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


// js-split:file=coaches.js part=23of70
// Split from script.js - whole top-level blocks moved verbatim, no behavior change.
function coachTodaySessions() {
    const today = todayISO();
    return getCoachSessions().filter(session => session.date === today && session.status === "Scheduled");
}

// Shared by the Coach Tracker page and the dashboard card.


// js-split:file=coaches.js part=24of70
// Split from script.js - whole top-level blocks moved verbatim, no behavior change.
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


// js-split:file=coaches.js part=25of70
// Split from script.js - whole top-level blocks moved verbatim, no behavior change.
function openRenewalRequest(username) {
    return getRenewalRequests().some(inq =>
        String(inq.username) === String(username) &&
        String(inq.status || "").toLowerCase() !== "resolved"
    );
}

// Shows the renewal panel only while the membership is expiring or expired, and
// flips the button to a confirmation once the request is on file.


// js-split:file=coaches.js part=26of70
// Split from script.js - whole top-level blocks moved verbatim, no behavior change.
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


// js-split:file=coaches.js part=27of70
// Split from script.js - whole top-level blocks moved verbatim, no behavior change.
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



// js-split:file=coaches.js part=28of70
// Split from script.js - whole top-level blocks moved verbatim, no behavior change.
function portalCoachForCustomer(customer) {
    if (!customer) return null;
    const clientId = "reg-" + (customer.username || "");
    const assignment = getCoachAssignments().find(row => String(row.clientId) === String(clientId));
    if (!assignment) return null;
    return { assignment, coach: coachById(assignment.coachId) };
}



// js-split:file=coaches.js part=29of70
// Split from script.js - whole top-level blocks moved verbatim, no behavior change.
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
        cCoachSpec: coachSpecializationLabel(coach),
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


// js-split:file=coaches.js part=30of70
// Split from script.js - whole top-level blocks moved verbatim, no behavior change.
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



// js-split:file=coaches.js part=31of70
// Split from script.js - whole top-level blocks moved verbatim, no behavior change.
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


// js-split:file=coaches.js part=32of70
// Split from script.js - whole top-level blocks moved verbatim, no behavior change.
function coachDirectoryFilters() {
    return {
        search: ((document.getElementById("coachSearch") || {}).value || "").trim().toLowerCase(),
        status: (document.getElementById("filterCoachStatus") || {}).value || "all",
        specialization: (document.getElementById("filterCoachSpecialization") || {}).value || "all"
    };
}



// js-split:file=coaches.js part=33of70
// Split from script.js - whole top-level blocks moved verbatim, no behavior change.
function fillSpecializationFilter() {
    const select = document.getElementById("filterCoachSpecialization");
    if (!select || select.dataset.filled === "1") return;
    select.innerHTML = ["all", ...COACH_SPECIALIZATIONS]
        .map(value => `<option value="${escapeHtml(value)}">${value === "all" ? "All Specializations" : escapeHtml(value)}</option>`)
        .join("");
    select.dataset.filled = "1";
}



// js-split:file=coaches.js part=34of70
// Split from script.js - whole top-level blocks moved verbatim, no behavior change.
function renderCoachDirectory() {
    const tbody = document.getElementById("coachTableBody");
    if (!tbody) return;

    const filters = coachDirectoryFilters();
    const coaches = getCoaches().filter(coach => {
        if (filters.status !== "all" && coach.status !== filters.status) return false;
        if (filters.specialization !== "all" && !coachHasSpecialization(coach, filters.specialization)) return false;
        if (filters.search) {
            const haystack = [coach.name, coach.email, coach.phone, ...coachSpecializations(coach), coach.status]
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
            <td>${coachSpecializationsHtml(coach)}</td>
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



// js-split:file=coaches.js part=35of70
// Split from script.js - whole top-level blocks moved verbatim, no behavior change.
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
    document.getElementById("coachDetailsSpecialty").innerHTML =
        `${coachSpecializationsHtml(coach)}<span class="card-meta"> Working ${escapeHtml(coachWorkingDayLabels(coach))} • ${escapeHtml(coachShiftLabel(coach))}</span>`;
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



// js-split:file=coaches.js part=36of70
// Split from script.js - whole top-level blocks moved verbatim, no behavior change.
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


// js-split:file=coaches.js part=37of70
// Split from script.js - whole top-level blocks moved verbatim, no behavior change.
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



// js-split:file=coaches.js part=38of70
// Split from script.js - whole top-level blocks moved verbatim, no behavior change.
function selectedScheduleCoach() {
    const select = document.getElementById("scheduleCoach");
    const coaches = getCoaches();
    const wanted = select ? select.value : "";
    return coaches.find(coach => String(coach.id) === String(wanted)) || coaches[0] || null;
}



// js-split:file=coaches.js part=39of70
// Split from script.js - whole top-level blocks moved verbatim, no behavior change.
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



// js-split:file=coaches.js part=40of70
// Split from script.js - whole top-level blocks moved verbatim, no behavior change.
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


// js-split:file=coaches.js part=41of70
// Split from script.js - whole top-level blocks moved verbatim, no behavior change.
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

// A coach only ever trains their own caseload, so the session form narrows the
// client picker to that coach's assigned clients. The assignment modal keeps
// offering the whole directory, since assigning is what creates a caseload.


// js-split:file=coaches.js part=42of70
// Split from script.js - whole top-level blocks moved verbatim, no behavior change.
function fillSessionClientOptions(coach, selectedId) {
    const select = document.getElementById("sessionClient");
    if (!select) return;

    const assignedIds = coachAssignmentsFor(coach ? coach.id : "").map(row => String(row.clientId));
    const members = getActiveDirectoryCustomers()
        .filter(member => assignedIds.includes(String(member.id)))
        .sort((a, b) => String(a.name).localeCompare(String(b.name)));

    const options = members.map(member => {
        // Frozen members stay listed so existing records keep rendering, but
        // the label spells out why a session cannot be booked for them.
        const frozen = getMemberStatus(member) === "Frozen";
        const label = frozen ? `${member.name} (Frozen${member.freezeEndDate ? " until " + member.freezeEndDate : ""})` : member.name;
        return `<option value="${escapeHtml(member.id)}">${escapeHtml(label)}</option>`;
    });

    // A session already on file keeps its client visible even if the assignment
    // was removed later, so editing shows the record as it actually stands.
    const wanted = String(selectedId || "");
    if (wanted && !members.some(member => String(member.id) === wanted)) {
        const member = getDirectoryCustomers().find(c => String(c.id) === wanted);
        const name = member ? member.name : "Unknown client";
        options.push(`<option value="${escapeHtml(wanted)}">${escapeHtml(`${name} (not assigned to ${coach ? coach.name : "this coach"})`)}</option>`);
    }

    select.innerHTML = options.length
        ? options.join("")
        : `<option value="">No clients assigned to ${escapeHtml(coach ? coach.name : "this coach")} yet</option>`;
    select.disabled = options.length === 0;
    if (wanted && options.length) select.value = wanted;

    const note = document.getElementById("sessionClientNote");
    if (note) {
        note.textContent = coach
            ? `Only clients assigned to ${coach.name} can be booked. Use Client Assignment to add one.`
            : "";
    }
}



// js-split:file=coaches.js part=43of70
// Split from script.js - whole top-level blocks moved verbatim, no behavior change.
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



// js-split:file=coaches.js part=44of70
// Split from script.js - whole top-level blocks moved verbatim, no behavior change.
function selectedAssignmentCoach() {
    const select = document.getElementById("assignmentCoach");
    const coaches = getCoaches();
    const wanted = select ? select.value : "";
    return coaches.find(coach => String(coach.id) === String(wanted)) || coaches[0] || null;
}



// js-split:file=coaches.js part=45of70
// Split from script.js - whole top-level blocks moved verbatim, no behavior change.
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


// js-split:file=coaches.js part=46of70
// Split from script.js - whole top-level blocks moved verbatim, no behavior change.
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



// js-split:file=coaches.js part=47of70
// Split from script.js - whole top-level blocks moved verbatim, no behavior change.
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
        meta: `${member.tier || "Membership"} • ${coachSpecializationLabel(coach)}`,
        href: activityHref("coach.html", member.name)
    });

    document.getElementById("assignModal").style.display = "none";
    renderCoachTracker();
}

// ---- Session tracking ----


// js-split:file=coaches.js part=48of70
// Split from script.js - whole top-level blocks moved verbatim, no behavior change.
function sessionFilters() {
    return {
        search: ((document.getElementById("sessionSearch") || {}).value || "").trim().toLowerCase(),
        coach: (document.getElementById("filterSessionCoach") || {}).value || "all",
        status: (document.getElementById("filterSessionStatus") || {}).value || "all"
    };
}



// js-split:file=coaches.js part=49of70
// Split from script.js - whole top-level blocks moved verbatim, no behavior change.
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



// js-split:file=coaches.js part=50of70
// Split from script.js - whole top-level blocks moved verbatim, no behavior change.
function sessionClientIdLabel(session) {
    const member = getDirectoryCustomers().find(c => String(c.id) === String(session.clientId));
    if (member && member.tier) return member.tier;
    return member ? member.keyFob || "Customer Directory" : "No matching member record";
}

// Session scheduling rules. Returns "" when the slot is clean, or a
// warning the form shows instead of saving.


// js-split:file=coaches.js part=51of70
// Split from script.js - whole top-level blocks moved verbatim, no behavior change.
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
    const clientName = client ? client.name : (session.clientName || "This client");
    if (client && getMemberStatus(client) === "Archived") {
        return `Scheduling Conflict: ${clientName} is an Archived (past) member and cannot book sessions. Restore the membership first.`;
    }
    if (client && getMemberStatus(client) === "Frozen") {
        const until = client.freezeEndDate ? ` until ${client.freezeEndDate}` : "";
        return `Scheduling Conflict: ${clientName}'s membership is Frozen${until} and cannot book sessions. Unfreeze the membership first.`;
    }

    // A coach only trains their own caseload, so a client has to be assigned
    // to this coach before a session can be booked for them.
    if (!coachHasClient(coach.id, session.clientId)) {
        return `Scheduling Conflict: ${clientName} is not assigned to ${coach.name}. Assign the client to this coach first.`;
    }

    // A coach who is away does not take sessions, whoever the client is.
    if (coach.status !== "Active") {
        return `Scheduling Conflict: ${coach.name} is ${coach.status || "not Active"} and cannot take sessions. Set the employment status to Active first.`;
    }

    // Coaches only take sessions in the training types they specialize in,
    // so a client cannot be booked onto a discipline the coach does not hold.
    const owned = coachSpecializations(coach);
    if (owned.length === 0) {
        return `Scheduling Conflict: ${coach.name} has no specialization on record and cannot take sessions. Add one to the coach record first.`;
    }
    if (!owned.includes(session.type)) {
        return `Scheduling Conflict: ${coach.name} is not specialized in ${session.type || "that training type"}. Specializations: ${owned.join(", ")}.`;
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



// js-split:file=coaches.js part=52of70
// Split from script.js - whole top-level blocks moved verbatim, no behavior change.
function overlapsClock(otherTime, startMinutes) {
    const otherStart = clockToMinutes(otherTime);
    if (isNaN(otherStart)) return false;
    return startMinutes < otherStart + COACH_SESSION_MINUTES && otherStart < startMinutes + COACH_SESSION_MINUTES;
}

// A coach can only be booked for the training types they actually hold, so
// the picker offers that coach's specializations and nothing else. A stored
// type outside the list is still offered (flagged) so editing an older
// session shows what is on file instead of silently swapping it.


// js-split:file=coaches.js part=53of70
// Split from script.js - whole top-level blocks moved verbatim, no behavior change.
function fillSessionTypeOptions(coach, currentType) {
    const select = document.getElementById("sessionType");
    if (!select) return;

    const owned = coachSpecializations(coach);
    const options = owned.map(value => ({ value, label: value }));

    const stray = String(currentType || "").trim();
    if (stray && !options.some(option => option.value === stray)) {
        options.push({ value: stray, label: `${stray} (outside ${coach ? coach.name : "coach"}'s specializations)` });
    }

    select.innerHTML = options.length
        ? options.map(option => `<option value="${escapeHtml(option.value)}">${escapeHtml(option.label)}</option>`).join("")
        : '<option value="">No specializations on this coach record</option>';
    select.disabled = options.length === 0;

    if (stray && options.some(option => option.value === stray)) select.value = stray;

    const note = document.getElementById("sessionTypeNote");
    if (note) {
        note.textContent = owned.length
            ? `Limited to ${coach.name}'s specializations: ${owned.join(", ")}.`
            : `${coach ? coach.name : "This coach"} has no specialization on record yet.`;
    }
}



// js-split:file=coaches.js part=54of70
// Split from script.js - whole top-level blocks moved verbatim, no behavior change.
function openSessionModal(encodedId) {
    const modal = document.getElementById("sessionModal");
    if (!modal) return;

    const id = encodedId ? decodeURIComponent(encodedId) : "";
    const session = id ? getCoachSessions().find(item => String(item.id) === String(id)) : null;

    document.getElementById("sessionId").value = session ? session.id : "";
    fillCoachSelect("sessionCoach", false, session ? session.coachId : (selectedScheduleCoach() || {}).id);
    const coach = coachById(document.getElementById("sessionCoach").value);
    fillSessionClientOptions(coach, session ? session.clientId : null);
    // With no stored type the picker falls back to the coach's first one.
    fillSessionTypeOptions(coach, session ? session.type : null);
    document.getElementById("sessionStatus").value = session ? session.status : "Scheduled";
    document.getElementById("sessionDate").value = session ? session.date : todayISO();
    document.getElementById("sessionTime").value = session ? session.time : "10:00";
    document.getElementById("sessionNotes").value = session ? (session.notes || "") : "";
    document.getElementById("sessionFormError").textContent = "";

    document.getElementById("sessionModalTitle").textContent = session ? "Edit Training Session" : "Create Training Session";
    document.getElementById("saveSessionBtn").textContent = session ? "Update Session" : "Save Session";
    modal.style.display = "flex";
}



// js-split:file=coaches.js part=55of70
// Split from script.js - whole top-level blocks moved verbatim, no behavior change.
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


// js-split:file=coaches.js part=56of70
// Split from script.js - whole top-level blocks moved verbatim, no behavior change.
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
// A calendar period (week, month) runs to the end of the span it names rather
// than to today. Truncating at today dropped any session dated later in the
// chosen period out of the report, so marking one Completed removed it from
// the overview entirely instead of counting it. The trailing windows (last 30
// / 90 days) still end today, because that is what the label promises.


// js-split:file=coaches.js part=57of70
// Split from script.js - whole top-level blocks moved verbatim, no behavior change.
function performanceRange() {
    const now = new Date();
    const endOfDay = date => new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
    const period = (document.getElementById("performancePeriod") || {}).value || "month";

    if (period === "custom") {
        const fromEl = document.getElementById("performanceFrom");
        const toEl = document.getElementById("performanceTo");
        const startValue = fromEl ? fromEl.value : "";
        const endValue = toEl ? toEl.value : "";
        if (!startValue || !endValue) return null;
        const start = new Date(startValue + "T00:00:00");
        const end = new Date(endValue + "T00:00:00");
        if (isNaN(start.getTime()) || isNaN(end.getTime()) || start > end) return null;
        return { from: start, to: endOfDay(end) };
    }

    if (period === "week") {
        const from = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() + 6) % 7));
        const sunday = new Date(from.getFullYear(), from.getMonth(), from.getDate() + 6);
        return { from, to: endOfDay(sunday) };
    }

    if (period === "last30" || period === "last90") {
        const from = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (period === "last30" ? 29 : 89));
        return { from, to: endOfDay(now) };
    }

    const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return { from: firstOfMonth, to: endOfDay(lastOfMonth) };
}



// js-split:file=coaches.js part=58of70
// Split from script.js - whole top-level blocks moved verbatim, no behavior change.
function coachPerformance(coach) {
    const range = performanceRange();
    const sessions = coachSessionsFor(coach.id);

    const inPeriod = range ? sessions.filter(session => {
        const date = new Date((session.date || "") + "T00:00:00");
        return !isNaN(date.getTime()) && date >= range.from && date <= range.to;
    }) : [];

    // Every status is read off the same period, so the four tiles always add
    // up to `total` and both rates share that one denominator. Reading any
    // status from a different window is what previously let an edit pull a
    // session out of one figure without it appearing in any other.
    const scheduled = inPeriod.filter(session => session.status === "Scheduled").length;
    const completed = inPeriod.filter(session => session.status === "Completed").length;
    const missed = inPeriod.filter(session => session.status === "Missed").length;
    const cancelled = inPeriod.filter(session => session.status === "Cancelled").length;
    const attended = completed + missed;

    return {
        clients: coachClientCount(coach.id),
        scheduled,
        completed,
        missed,
        cancelled,
        attendance: attended ? Math.round((completed / attended) * 100) : null,
        cancellation: inPeriod.length ? Math.round((cancelled / inPeriod.length) * 100) : null,
        total: inPeriod.length
    };
}



// js-split:file=coaches.js part=59of70
// Split from script.js - whole top-level blocks moved verbatim, no behavior change.
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
                    <p class="card-sub">${escapeHtml(coachSpecializationLabel(coach))} • ${escapeHtml(coachShiftLabel(coach))}</p>
                </div>
                ${coachStatusBadge(coach.status)}
            </div>
            <div class="perf-grid">
                <div class="perf-metric"><span>Assigned Clients</span><strong>${stats.clients}</strong></div>
                <div class="perf-metric"><span>Sessions in Period</span><strong>${stats.total}</strong></div>
                <div class="perf-metric"><span>Scheduled</span><strong>${stats.scheduled}</strong></div>
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


// js-split:file=coaches.js part=60of70
// Split from script.js - whole top-level blocks moved verbatim, no behavior change.
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

    const specializationGrid = document.getElementById("coachSpecializationGrid");
    if (specializationGrid && !specializationGrid.dataset.filled) {
        specializationGrid.innerHTML = COACH_SPECIALIZATIONS
            .map(value => `
                <label class="day-chip">
                    <input type="checkbox" name="coachSpecialization" value="${escapeHtml(value)}">
                    ${escapeHtml(value)}
                </label>
            `).join("");
        specializationGrid.dataset.filled = "1";
    }
}

// Specialization picker behaves like the working-day picker: every chip can
// be toggled, and saving reads back whichever ones are checked.


// js-split:file=coaches.js part=61of70
// Split from script.js - whole top-level blocks moved verbatim, no behavior change.
function coachSpecializationSelection() {
    const grid = document.getElementById("coachSpecializationGrid");
    if (!grid) return [];
    return Array.from(grid.querySelectorAll('input[name="coachSpecialization"]:checked'))
        .map(box => box.value)
        .filter(value => COACH_SPECIALIZATIONS.includes(value));
}



// js-split:file=coaches.js part=62of70
// Split from script.js - whole top-level blocks moved verbatim, no behavior change.
function setCoachSpecializationSelection(values) {
    const grid = document.getElementById("coachSpecializationGrid");
    if (!grid) return;
    grid.querySelectorAll('input[name="coachSpecialization"]')
        .forEach(box => { box.checked = values.includes(box.value); });
}

// Keeps the coach form's contact fields to what they can actually store:
// the phone number is 11 bare digits, and the email has to look like an
// address. Both checks run while typing, so a bad value is caught before
// the form is submitted.


// js-split:file=coaches.js part=63of70
// Split from script.js - whole top-level blocks moved verbatim, no behavior change.
function bindCoachContactFields() {
    const phone = document.getElementById("coachPhone");
    const email = document.getElementById("coachEmail");
    const errorEl = document.getElementById("coachFormError");

    // Letters, spaces and dashes are dropped as they are typed or pasted, and
    // the length cap in the markup stops an extra digit at the source.
    if (phone) {
        phone.addEventListener("input", () => {
            const digits = phone.value.replace(/\D/g, "").slice(0, COACH_PHONE_DIGITS);
            if (digits !== phone.value) phone.value = digits;
            clearFieldError(errorEl, "phone");
        });
    }

    // An address can hold almost every character, so nothing is blocked while
    // typing; whitespace can never be part of one and is dropped, and anything
    // that is not an address is reported instead of silently accepted.
    if (email && errorEl) {
        const checkEmail = () => {
            const value = email.value.trim();
            if (value && !COACH_EMAIL_PATTERN.test(value)) {
                errorEl.textContent = "Please enter a valid email address.";
                errorEl.dataset.field = "email";
            } else {
                clearFieldError(errorEl, "email");
            }
        };

        email.addEventListener("input", () => {
            if (/\s/.test(email.value)) email.value = email.value.replace(/\s/g, "");
            checkEmail();
        });
        email.addEventListener("blur", checkEmail);
    }
}

// Only clears the shared error line when it is still showing this field's
// message, so a submit error about something else is left alone.


// js-split:file=coaches.js part=64of70
// Split from script.js - whole top-level blocks moved verbatim, no behavior change.
function clearFieldError(errorEl, field) {
    if (!errorEl || errorEl.dataset.field !== field) return;
    errorEl.textContent = "";
    delete errorEl.dataset.field;
}



// js-split:file=coaches.js part=65of70
// Split from script.js - whole top-level blocks moved verbatim, no behavior change.
function resetCoachFormError() {
    const errorEl = document.getElementById("coachFormError");
    if (!errorEl) return;
    errorEl.textContent = "";
    delete errorEl.dataset.field;
}



// js-split:file=coaches.js part=66of70
// Split from script.js - whole top-level blocks moved verbatim, no behavior change.
function openAddCoach() {
    const modal = document.getElementById("coachModal");
    const form = document.getElementById("coachForm");
    if (!modal || !form) return;

    form.reset();
    buildCoachFormFields();
    document.getElementById("coachId").value = "";
    setCoachSpecializationSelection([COACH_SPECIALIZATIONS[0]]);
    document.getElementById("coachStatus").value = "Active";
    document.getElementById("coachShiftStart").value = 6;
    document.getElementById("coachShiftEnd").value = 14;
    document.getElementById("coachDayGrid")
        .querySelectorAll('input[name="coachDay"]')
        .forEach(box => { box.checked = box.value !== "0"; });
    resetCoachFormError();
    document.getElementById("coachModalTitle").textContent = "Add Coach";
    document.getElementById("saveCoachBtn").textContent = "Save Coach";
    modal.style.display = "flex";
    document.getElementById("coachName").focus();
}



// js-split:file=coaches.js part=67of70
// Split from script.js - whole top-level blocks moved verbatim, no behavior change.
function openEditCoach(encodedId) {
    const coach = coachById(decodeURIComponent(encodedId));
    const modal = document.getElementById("coachModal");
    if (!coach || !modal) return;

    buildCoachFormFields();
    document.getElementById("coachId").value = coach.id;
    document.getElementById("coachName").value = coach.name || "";
    document.getElementById("coachEmail").value = coach.email || "";
    document.getElementById("coachPhone").value = coach.phone || "";
    // Only catalogue entries have a chip, so a stale value on an old record
    // is dropped in favour of the default rather than shown unchecked.
    const known = coachSpecializations(coach).filter(value => COACH_SPECIALIZATIONS.includes(value));
    setCoachSpecializationSelection(known.length ? known : [COACH_SPECIALIZATIONS[0]]);
    document.getElementById("coachStatus").value = COACH_STATUSES.includes(coach.status) ? coach.status : "Active";
    document.getElementById("coachShiftStart").value = Number(coach.shiftStart) || 6;
    document.getElementById("coachShiftEnd").value = Number(coach.shiftEnd) || 14;

    const days = Array.isArray(coach.days) ? coach.days : [];
    document.getElementById("coachDayGrid")
        .querySelectorAll('input[name="coachDay"]')
        .forEach(box => { box.checked = days.includes(Number(box.value)); });

    resetCoachFormError();
    document.getElementById("coachModalTitle").textContent = "Edit Coach";
    document.getElementById("saveCoachBtn").textContent = "Update Coach";
    modal.style.display = "flex";
}



// js-split:file=coaches.js part=68of70
// Split from script.js - whole top-level blocks moved verbatim, no behavior change.
function saveCoach() {
    const id = document.getElementById("coachId").value;
    const name = document.getElementById("coachName").value.trim();
    const email = document.getElementById("coachEmail").value.trim();
    const phone = document.getElementById("coachPhone").value.trim();
    const specializations = coachSpecializationSelection();
    const status = document.getElementById("coachStatus").value;
    const shiftStart = Number(document.getElementById("coachShiftStart").value);
    const shiftEnd = Number(document.getElementById("coachShiftEnd").value);
    const days = Array.from(document.getElementById("coachDayGrid").querySelectorAll('input[name="coachDay"]:checked'))
        .map(box => Number(box.value));
    const errorEl = document.getElementById("coachFormError");

    // The field name records which input the message belongs to, so the live
    // checks can clear their own message without wiping a submit error.
    const fail = (message, field) => {
        errorEl.textContent = message;
        if (field) errorEl.dataset.field = field;
        else delete errorEl.dataset.field;
        return false;
    };

    if (!name) return fail("Please enter the coach's full name.");
    if (!email || !COACH_EMAIL_PATTERN.test(email)) return fail("Please enter a valid email address.", "email");
    if (!phone) return fail("Please enter a contact number.", "phone");
    if (phone.length !== COACH_PHONE_DIGITS) return fail(`Phone number must be exactly ${COACH_PHONE_DIGITS} digits.`, "phone");
    if (!specializations.length) return fail("Please select at least one specialization.");
    if (!days.length) return fail("Please select at least one working day.");
    if (!(shiftStart < shiftEnd)) return fail("Working hours must end after they start.");

    const coaches = getCoaches();
    const duplicate = coaches.find(coach =>
        String(coach.name).toLowerCase() === name.toLowerCase() &&
        String(coach.id) !== String(id)
    );
    if (duplicate) return fail(`${name} already exists in the coach directory.`);

    const data = { name, email, phone, specializations, status, days, shiftStart, shiftEnd };
    const previous = id ? coaches.find(coach => String(coach.id) === String(id)) : null;

    if (previous) {
        Object.assign(previous, data);
        // Drop the single-value field so the list is the only source of truth.
        delete previous.specialization;
    } else {
        coaches.push({ id: `coach-${Date.now().toString(36)}`, ratingSum: 0, ratingCount: 0, ratings: [], ...data });
    }
    saveCoaches(coaches);

    logActivity({
        type: "coach",
        title: previous ? `${name}'s coach record was updated` : `${name} was added to the coach directory`,
        meta: `${specializations.join(", ")} • ${status} • ${coachWorkingDayLabels({ days })} ${formatHourLabel(shiftStart)} – ${formatHourLabel(shiftEnd)}`,
        href: "coach.html"
    });

    document.getElementById("coachModal").style.display = "none";
    renderCoachTracker();
}

// One entry point repaints every Coach Tracker view, so a save anywhere
// (directory, schedule, assignment, session, performance) stays in sync.


// js-split:file=coaches.js part=69of70
// Split from script.js - whole top-level blocks moved verbatim, no behavior change.
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



// js-split:file=coaches.js part=70of70
// Split from script.js - whole top-level blocks moved verbatim, no behavior change.
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

    bindCoachContactFields();

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

    // Switching coach narrows the form to that coach's caseload and to the
    // training types they specialize in, so both pickers are rebuilt.
    const sessionCoachSelect = document.getElementById("sessionCoach");
    if (sessionCoachSelect) {
        sessionCoachSelect.addEventListener("change", () => {
            const coach = coachById(sessionCoachSelect.value);
            fillSessionClientOptions(coach, null);
            fillSessionTypeOptions(coach, null);
        });
    }

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
