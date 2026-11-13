// Member portal navigation: shows one portal group at a time and keeps the
// sidebar navigation, the URL hash and the page title in step.
(function () {
    "use strict";

    document.addEventListener("DOMContentLoaded", function () {
        const nav = document.querySelector(".sidebar .nav-menu");
        if (!nav) return;

        const links = Array.prototype.slice.call(nav.querySelectorAll("[data-portal-target]"));
        const pages = Array.prototype.slice.call(document.querySelectorAll("[data-portal-page]"));
        if (!links.length || !pages.length) return;

        const navToggle = document.getElementById("navToggle");
        const baseTitle = document.title;
        const labels = {};

        links.forEach(function (link) {
            const label = link.querySelector(".nav-text");
            labels[link.getAttribute("data-portal-target")] = label ? label.textContent.trim() : "";
        });

        function currentPageName() {
            return String(window.location.hash || "").replace(/^#/, "");
        }

        function findPage(name) {
            return pages.find(function (page) {
                return page.getAttribute("data-portal-page") === name;
            }) || null;
        }

        function showPage(name) {
            const page = findPage(name);
            if (!page) return false;

            pages.forEach(function (item) {
                item.hidden = item !== page;
            });

            links.forEach(function (link) {
                const isActive = link.getAttribute("data-portal-target") === name;
                link.classList.toggle("active", isActive);
                if (isActive) link.setAttribute("aria-current", "page");
                else link.removeAttribute("aria-current");
            });

            if (navToggle) navToggle.checked = false;

            const label = labels[name];
            document.title = label ? label + " | " + baseTitle : baseTitle;
            return true;
        }

        function activate(name, scrollToTop) {
            if (!showPage(name)) return false;
            if (scrollToTop) window.scrollTo(0, 0);
            return true;
        }

        nav.addEventListener("click", function (event) {
            const link = event.target.closest("[data-portal-target]");
            if (!link || !nav.contains(link)) return;

            const name = link.getAttribute("data-portal-target");
            if (!findPage(name)) return;

            event.preventDefault();
            if (currentPageName() === name) {
                activate(name, true);
            } else {
                window.location.hash = name;
            }
        });

        window.addEventListener("hashchange", function () {
            if (!activate(currentPageName(), true)) {
                activate("overview", true);
            }
        });

        if (!activate(currentPageName(), false)) {
            activate("overview", false);
        }
    });
})();
