// js-split:file=auth.js part=1of1
// Split from script.js - whole top-level blocks moved verbatim, no behavior change.
function logoutCustomer() {
    sessionStorage.removeItem("crmCurrentUser");
    sessionStorage.removeItem("crmRole");
    location.href = "login.html";
}

// =============================================================
// Customer Forgot Password Feature
// Allows registered gym members to verify their identity and reset
// their portal password from the Login page.
// =============================================================

function findCustomerForPasswordReset(identifier, birthday, phone) {
    const cleanId = String(identifier || "").trim().toLowerCase();
    const cleanBday = String(birthday || "").trim();
    const cleanPhone = typeof phPhoneNationalDigits === "function"
        ? phPhoneNationalDigits(phone || "")
        : String(phone || "").replace(/\D/g, "").slice(-10);

    if (!cleanId) {
        return { ok: false, reason: "Please enter your Key Fob Number or registered email address." };
    }

    if (!cleanBday && !cleanPhone) {
        return { ok: false, reason: "Please enter your date of birth for identity verification." };
    }

    const customers = JSON.parse(localStorage.getItem("crmCustomers") || "[]");
    const customer = customers.find(c => {
        const cFob = String(c.keyFob || c.username || "").trim().toLowerCase();
        const cEmail = String(c.email || "").trim().toLowerCase();
        const cBday = String(c.birthday || "").trim();
        const cPhone = typeof phPhoneNationalDigits === "function"
            ? phPhoneNationalDigits(c.phone || "")
            : String(c.phone || "").replace(/\D/g, "").slice(-10);

        const idMatches = (cleanId && (cFob === cleanId || cEmail === cleanId));
        if (!idMatches) return false;

        // Primary verification: Birthday matches registration record
        if (cleanBday && cBday === cleanBday) return true;

        // Secondary verification: Phone matches registration record
        if (cleanPhone && cPhone && cleanPhone === cPhone) return true;

        // Alternative verification: If user entered key fob as identifier, verify if secondary field is their email
        if (cleanId === cFob && cleanBday.toLowerCase() === cEmail) return true;

        return false;
    });

    if (!customer) {
        return {
            ok: false,
            reason: "No active customer account was found matching those details. Please check your Key Fob / Email and Date of Birth."
        };
    }

    if (typeof memberIsArchived === "function" && memberIsArchived(customer)) {
        return {
            ok: false,
            reason: "This account belongs to a past member and is archived. Please contact the front desk to restore your membership."
        };
    }

    return { ok: true, customer };
}

function updateCustomerPassword(keyFobOrUsername, newPassword) {
    if (!newPassword || newPassword.length < 4) {
        return { ok: false, reason: "Password must be at least 4 characters long." };
    }

    const customers = JSON.parse(localStorage.getItem("crmCustomers") || "[]");
    const targetKey = String(keyFobOrUsername || "").trim().toLowerCase();
    const idx = customers.findIndex(c =>
        String(c.keyFob || "").trim().toLowerCase() === targetKey ||
        String(c.username || "").trim().toLowerCase() === targetKey
    );

    if (idx === -1) {
        return { ok: false, reason: "Customer record could not be found to update." };
    }

    customers[idx].password = newPassword;
    localStorage.setItem("crmCustomers", JSON.stringify(customers));

    // Keep crmDirectory synchronized if a corresponding entry exists
    try {
        const dirKey = typeof DIRECTORY_KEY !== "undefined" ? DIRECTORY_KEY : "crmDirectory";
        const directory = JSON.parse(localStorage.getItem(dirKey) || "[]");
        let dirUpdated = false;
        directory.forEach(d => {
            const dFob = String(d.keyFob || d.fob || "").trim().toLowerCase();
            const dEmail = String(d.email || "").trim().toLowerCase();
            if (dFob === targetKey || (customers[idx].email && dEmail === String(customers[idx].email).toLowerCase())) {
                if (d.password) {
                    d.password = newPassword;
                    dirUpdated = true;
                }
            }
        });
        if (dirUpdated) {
            localStorage.setItem(dirKey, JSON.stringify(directory));
        }
    } catch (e) { /* ignore */ }

    // Log the password change in shared activity feed
    if (typeof logActivity === "function") {
        logActivity({
            type: "member",
            title: `${customers[idx].name || "Customer"} reset their account password`,
            meta: `Key Fob ${customers[idx].keyFob || customers[idx].username}`
        });
    }

    return { ok: true, customer: customers[idx] };
}

function initForgotPasswordModal() {
    const modal = document.getElementById("forgotPasswordModal");
    if (!modal) return;

    const forgotPasswordLink = document.getElementById("forgotPasswordLink");
    const forgotPasswordCustomerHintLink = document.getElementById("forgotPasswordCustomerHintLink");
    const closeForgotModalBtn = document.getElementById("closeForgotModalBtn");
    const btnCancelForgot = document.getElementById("btnCancelForgot");
    const btnBackToVerify = document.getElementById("btnBackToVerify");
    const btnForgotGoLogin = document.getElementById("btnForgotGoLogin");

    const forgotStepVerify = document.getElementById("forgotStepVerify");
    const forgotStepReset = document.getElementById("forgotStepReset");
    const forgotStepSuccess = document.getElementById("forgotStepSuccess");

    const forgotIdentifier = document.getElementById("forgotIdentifier");
    const forgotBirthday = document.getElementById("forgotBirthday");
    const forgotPhone = document.getElementById("forgotPhone");
    const forgotVerifyError = document.getElementById("forgotVerifyError");

    const forgotNewPassword = document.getElementById("forgotNewPassword");
    const forgotConfirmPassword = document.getElementById("forgotConfirmPassword");
    const forgotResetError = document.getElementById("forgotResetError");

    const forgotVerifiedMemberName = document.getElementById("forgotVerifiedMemberName");
    const forgotVerifiedKeyFob = document.getElementById("forgotVerifiedKeyFob");
    const forgotSuccessFob = document.getElementById("forgotSuccessFob");

    let verifiedCustomer = null;

    const showStep = (step) => {
        if (forgotStepVerify) forgotStepVerify.style.display = step === 1 ? "block" : "none";
        if (forgotStepReset) forgotStepReset.style.display = step === 2 ? "block" : "none";
        if (forgotStepSuccess) forgotStepSuccess.style.display = step === 3 ? "block" : "none";
    };

    const openModal = () => {
        // Ensure customer tab is active on the login card
        const tabCustomer = document.getElementById("tabCustomer");
        if (tabCustomer && !tabCustomer.classList.contains("active")) {
            tabCustomer.click();
        }

        // Reset fields and errors
        if (forgotVerifyError) forgotVerifyError.textContent = "";
        if (forgotResetError) forgotResetError.textContent = "";
        if (forgotNewPassword) forgotNewPassword.value = "";
        if (forgotConfirmPassword) forgotConfirmPassword.value = "";

        // Pre-fill identifier if user already typed their key fob/username in loginForm
        const currentLoginUser = document.getElementById("loginUsername");
        if (currentLoginUser && currentLoginUser.value.trim() && forgotIdentifier) {
            forgotIdentifier.value = currentLoginUser.value.trim();
        }

        showStep(1);
        modal.style.display = "flex";

        if (forgotIdentifier && forgotIdentifier.value) {
            if (forgotBirthday) forgotBirthday.focus();
        } else if (forgotIdentifier) {
            forgotIdentifier.focus();
        }
    };

    const closeModal = () => {
        modal.style.display = "none";
        showStep(1);
        verifiedCustomer = null;
    };

    // Open handlers
    if (forgotPasswordLink) {
        forgotPasswordLink.addEventListener("click", (e) => {
            e.preventDefault();
            openModal();
        });
    }

    if (forgotPasswordCustomerHintLink) {
        forgotPasswordCustomerHintLink.addEventListener("click", (e) => {
            e.preventDefault();
            openModal();
        });
    }

    // Close handlers
    if (closeForgotModalBtn) closeForgotModalBtn.addEventListener("click", closeModal);
    if (btnCancelForgot) btnCancelForgot.addEventListener("click", closeModal);

    window.addEventListener("click", (e) => {
        if (e.target === modal) closeModal();
    });

    window.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && modal.style.display === "flex") closeModal();
    });

    // Step navigation
    if (btnBackToVerify) {
        btnBackToVerify.addEventListener("click", () => {
            showStep(1);
            if (forgotVerifyError) forgotVerifyError.textContent = "";
        });
    }

    // Step 1: Verification submit
    if (forgotStepVerify) {
        forgotStepVerify.addEventListener("submit", (e) => {
            e.preventDefault();
            if (forgotVerifyError) forgotVerifyError.textContent = "";

            const idVal = forgotIdentifier ? forgotIdentifier.value.trim() : "";
            const bdayVal = forgotBirthday ? forgotBirthday.value : "";
            const phoneVal = forgotPhone ? forgotPhone.value : "";

            const result = findCustomerForPasswordReset(idVal, bdayVal, phoneVal);
            if (!result.ok) {
                if (forgotVerifyError) forgotVerifyError.textContent = result.reason;
                return;
            }

            verifiedCustomer = result.customer;
            const memberName = verifiedCustomer.name ||
                [verifiedCustomer.firstName, verifiedCustomer.lastName].filter(Boolean).join(" ") ||
                "Valued Member";
            const memberFob = verifiedCustomer.keyFob || verifiedCustomer.username || "—";

            if (forgotVerifiedMemberName) {
                forgotVerifiedMemberName.textContent = `Member: ${memberName}`;
            }
            if (forgotVerifiedKeyFob) {
                forgotVerifiedKeyFob.textContent = `Key Fob Number: ${memberFob}`;
            }

            showStep(2);
            if (forgotNewPassword) forgotNewPassword.value = "";
            if (forgotConfirmPassword) forgotConfirmPassword.value = "";
            if (forgotResetError) forgotResetError.textContent = "";
            if (forgotNewPassword) forgotNewPassword.focus();
        });
    }

    // Step 2: Password reset submit
    if (forgotStepReset) {
        forgotStepReset.addEventListener("submit", (e) => {
            e.preventDefault();
            if (forgotResetError) forgotResetError.textContent = "";

            if (!verifiedCustomer) {
                showStep(1);
                return;
            }

            const newPass = forgotNewPassword ? forgotNewPassword.value : "";
            const confirmPass = forgotConfirmPassword ? forgotConfirmPassword.value : "";

            if (!newPass || newPass.length < 4) {
                if (forgotResetError) forgotResetError.textContent = "Password must be at least 4 characters long.";
                if (forgotNewPassword) forgotNewPassword.focus();
                return;
            }

            if (newPass !== confirmPass) {
                if (forgotResetError) forgotResetError.textContent = "Passwords do not match.";
                if (forgotConfirmPassword) forgotConfirmPassword.focus();
                return;
            }

            const memberFob = verifiedCustomer.keyFob || verifiedCustomer.username;
            const updateRes = updateCustomerPassword(memberFob, newPass);
            if (!updateRes.ok) {
                if (forgotResetError) forgotResetError.textContent = updateRes.reason;
                return;
            }

            if (forgotSuccessFob) {
                forgotSuccessFob.textContent = memberFob;
            }
            showStep(3);
        });
    }

    // Step 3: Complete & return to login
    if (btnForgotGoLogin) {
        btnForgotGoLogin.addEventListener("click", () => {
            const memberFob = verifiedCustomer ? (verifiedCustomer.keyFob || verifiedCustomer.username) : "";
            closeModal();

            const tabCustomer = document.getElementById("tabCustomer");
            if (tabCustomer) tabCustomer.click();

            const loginUser = document.getElementById("loginUsername");
            const loginPass = document.getElementById("loginPassword");
            const loginErr = document.getElementById("loginError");

            if (loginUser && memberFob) loginUser.value = memberFob;
            if (loginPass) {
                loginPass.value = "";
                loginPass.focus();
            }
            if (loginErr) {
                loginErr.textContent = "Password successfully reset! Please sign in with your new password.";
                loginErr.style.color = "var(--success, #16a34a)";
            }
        });
    }

    // Bind phone input formatting if available
    if (forgotPhone && typeof bindPhPhoneInput === "function") {
        bindPhPhoneInput(forgotPhone);
    }
}

document.addEventListener("DOMContentLoaded", () => {
    initForgotPasswordModal();
});

if (typeof window !== "undefined") {
    window.logoutCustomer = logoutCustomer;
    window.findCustomerForPasswordReset = findCustomerForPasswordReset;
    window.updateCustomerPassword = updateCustomerPassword;
    window.initForgotPasswordModal = initForgotPasswordModal;
}

