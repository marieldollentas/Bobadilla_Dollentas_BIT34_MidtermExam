// js-split:file=auth.js part=1of1
// Split from script.js - whole top-level blocks moved verbatim, no behavior change.
function logoutCustomer() {
    sessionStorage.removeItem("crmCurrentUser");
    sessionStorage.removeItem("crmRole");
    location.href = "login.html";
}

