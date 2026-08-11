// ----- Dark Mode Toggle -----
const toggleBtn = document.getElementById("themeToggle");

function getPageLoadMs() {
  const [nav] = performance.getEntriesByType("navigation");
  if (nav && nav.loadEventEnd > 0) {
    return Math.round(nav.loadEventEnd);
  }

  const timing = performance.timing;
  if (timing && timing.loadEventEnd > 0 && timing.navigationStart > 0) {
    return timing.loadEventEnd - timing.navigationStart;
  }

  return Math.round(performance.now());
}

function renderLoadTime() {
  const el = document.getElementById("loadTime");
  if (!el) return;

  const ms = getPageLoadMs();
  el.replaceChildren(
    document.createTextNode("Page loaded in "),
    Object.assign(document.createElement("span"), {
      className: "load-time-ms",
      textContent: ms.toLocaleString("en-US")
    }),
    document.createTextNode(" milliseconds")
  );
}

if (document.readyState === "complete") {
  renderLoadTime();
} else {
  window.addEventListener("load", renderLoadTime, { once: true });
}

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  });
}

toggleBtn.addEventListener("click", () => {
  const isDark = document.body.getAttribute("data-theme") === "dark";
  document.body.setAttribute("data-theme", isDark ? "light" : "dark");
  toggleBtn.textContent = isDark ? "Dark Mode" : "Light Mode";
});

// ----- Load Contributions from JSON -----
// ----- Load Contributions from GitHub API -----
// ----- Load Contributions from GitHub API -----
const BASE_API_URL = "https://api.github.com/search/issues?q=is:pr+is:merged+author:varunkasyap";
const MOBILE_QUERY = window.matchMedia("(max-width: 600px)");
const ITEMS_PER_PAGE_MOBILE = 3;
const ITEMS_PER_PAGE_DESKTOP = 6;
const PR_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const PR_CACHE_PREFIX = "pr-cache-v1:";

let currentPage = 1;
let itemsPerPage = getItemsPerPage();
let totalCount = 0;

function getItemsPerPage() {
  return MOBILE_QUERY.matches ? ITEMS_PER_PAGE_MOBILE : ITEMS_PER_PAGE_DESKTOP;
}

function prCacheKey(page, perPage) {
  return `${PR_CACHE_PREFIX}${perPage}:${page}`;
}

function readPrCache(page, perPage, { allowStale = false } = {}) {
  try {
    const raw = localStorage.getItem(prCacheKey(page, perPage));
    if (!raw) return null;

    const entry = JSON.parse(raw);
    if (!entry || typeof entry.savedAt !== "number" || !entry.data) return null;

    const isStale = Date.now() - entry.savedAt > PR_CACHE_TTL_MS;
    if (isStale && !allowStale) return null;

    return entry.data;
  } catch {
    return null;
  }
}

function writePrCache(page, perPage, data) {
  try {
    localStorage.setItem(prCacheKey(page, perPage), JSON.stringify({
      savedAt: Date.now(),
      data
    }));
  } catch {
    // Ignore quota / private-mode failures
  }
}

function scrollToContributions() {
  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  document.getElementById("contributions")?.scrollIntoView({
    behavior: prefersReducedMotion ? "auto" : "smooth",
    block: "start"
  });
}

function showPRResults(data, container) {
  container.innerHTML = ""; // Clear loading

  if (data.items && data.items.length > 0) {
    totalCount = data.total_count;
    renderPRs(data.items, container);
    renderPagination(totalCount, itemsPerPage, currentPage);
  } else {
    container.innerHTML = "<p>No contributions found.</p>";
    document.getElementById("pagination-controls").innerHTML = "";
  }
}

function fetchPRs(page, { scroll = false } = {}) {
  if (page < 1) return;

  currentPage = page;
  const container = document.getElementById("pr-container");
  const cached = readPrCache(page, itemsPerPage);

  if (cached) {
    showPRResults(cached, container);
    if (scroll) scrollToContributions();
    return;
  }

  container.innerHTML = '<div class="loading-spinner">Loading contributions...</div>';
  document.getElementById("pagination-controls").innerHTML = ""; // Hide controls while loading

  fetch(`${BASE_API_URL}&page=${page}&per_page=${itemsPerPage}`)
    .then(response => response.json().then(data => ({ response, data })))
    .then(({ response, data }) => {
      const rateLimited = response.status === 403 || response.status === 429
        || /rate limit/i.test(data.message || "");

      if (rateLimited) {
        const stale = readPrCache(page, itemsPerPage, { allowStale: true });
        if (stale) {
          showPRResults(stale, container);
        } else {
          container.innerHTML = "<p>Limit exceeded. Try again later.</p>";
        }
        if (scroll) scrollToContributions();
        return;
      }

      if (data.items) {
        writePrCache(page, itemsPerPage, data);
      }

      showPRResults(data, container);
      if (scroll) scrollToContributions();
    })
    .catch(error => {
      console.error("Error loading GitHub data:", error);
      const stale = readPrCache(page, itemsPerPage, { allowStale: true });
      if (stale) {
        showPRResults(stale, container);
      } else {
        container.innerHTML = "<p>Error loading contributions. Please check console.</p>";
      }
    });
}

function renderPRs(items, container) {
  items.forEach(pr => {
    const card = document.createElement("a");
    card.className = "pr-card";
    card.href = pr.html_url;
    card.target = "_blank";

    // Extract repo name from URL (api url is like .../repos/owner/repo/...)
    const repoName = pr.repository_url.split("/").slice(-2).join("/");
    const date = new Date(pr.closed_at).toLocaleDateString();

    card.innerHTML = `
      <div class="pr-header">
        <span class="pr-repo">${repoName}</span>
        <span class="pr-status ${pr.state}">${pr.state === 'closed' && pr.pull_request.merged_at ? 'Merged' : pr.state}</span>
      </div>
      <h3 class="pr-title">${pr.title}</h3>
      <div class="pr-meta">
        <span>#${pr.number}</span>
        <span>${date}</span>
      </div>
    `;

    container.appendChild(card);
  });
}

function createPaginationButton({
  text,
  compactText,
  ariaLabel,
  page,
  disabled = false,
  current = false,
  extraClass = ""
}) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = `pagination-btn ${extraClass}`.trim();
  btn.disabled = disabled;
  btn.setAttribute("aria-label", ariaLabel);

  if (current) {
    btn.setAttribute("aria-current", "page");
    btn.classList.add("active");
  }

  if (compactText) {
    const full = document.createElement("span");
    full.className = "pagination-label-full";
    full.textContent = text;

    const compact = document.createElement("span");
    compact.className = "pagination-label-compact";
    compact.textContent = compactText;
    compact.setAttribute("aria-hidden", "true");

    btn.append(full, compact);
  } else {
    btn.textContent = text;
  }

  if (!disabled && !current) {
    btn.addEventListener("click", () => fetchPRs(page, { scroll: true }));
  }

  return btn;
}

function renderPagination(totalItems, perPage, current) {
  const totalPages = Math.ceil(totalItems / perPage);
  const nav = document.getElementById("pagination-controls");
  nav.innerHTML = "";

  const status = document.getElementById("pagination-status");
  if (totalPages <= 1) {
    if (status) status.textContent = "";
    return;
  }

  if (status) status.textContent = `Page ${current} of ${totalPages}`;

  nav.appendChild(createPaginationButton({
    text: "First",
    compactText: "«",
    ariaLabel: "First page",
    page: 1,
    disabled: current === 1,
    extraClass: "pagination-btn--first"
  }));

  nav.appendChild(createPaginationButton({
    text: "Prev",
    compactText: "‹",
    ariaLabel: "Previous page",
    page: current - 1,
    disabled: current === 1,
    extraClass: "pagination-btn--prev"
  }));

  const pagesToShow = new Set([1, totalPages, current, current - 1, current + 1]);
  const sortedPages = Array.from(pagesToShow)
    .filter(p => p > 0 && p <= totalPages)
    .sort((a, b) => a - b);

  let lastRendered = 0;
  sortedPages.forEach(p => {
    if (lastRendered > 0 && p - lastRendered > 1) {
      const ellipsis = document.createElement("span");
      ellipsis.className = "pagination-ellipsis";
      ellipsis.setAttribute("aria-hidden", "true");
      ellipsis.textContent = "…";
      nav.appendChild(ellipsis);
    }

    nav.appendChild(createPaginationButton({
      text: String(p),
      ariaLabel: `Page ${p}`,
      page: p,
      current: p === current,
      extraClass: "pagination-btn--page"
    }));

    lastRendered = p;
  });

  nav.appendChild(createPaginationButton({
    text: "Next",
    compactText: "›",
    ariaLabel: "Next page",
    page: current + 1,
    disabled: current === totalPages,
    extraClass: "pagination-btn--next"
  }));

  nav.appendChild(createPaginationButton({
    text: "Last",
    compactText: "»",
    ariaLabel: "Last page",
    page: totalPages,
    disabled: current === totalPages,
    extraClass: "pagination-btn--last"
  }));
}

function handleViewportChange() {
  const nextSize = getItemsPerPage();
  if (nextSize === itemsPerPage) return;

  // Keep the first item of the current page in view after the page size changes
  const firstItemIndex = (currentPage - 1) * itemsPerPage;
  itemsPerPage = nextSize;
  fetchPRs(Math.floor(firstItemIndex / itemsPerPage) + 1);
}

if (typeof MOBILE_QUERY.addEventListener === "function") {
  MOBILE_QUERY.addEventListener("change", handleViewportChange);
} else {
  MOBILE_QUERY.addListener(handleViewportChange);
}

// Initial fetch
fetchPRs(1);
