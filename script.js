const {
  PR_FETCH_PER_PAGE,
  createPrCache,
  isRateLimited,
  itemsPerPageFor,
  nextTheme,
  normalizeTheme,
  resolveInitialTheme,
  themeColorFor,
  pageAfterViewportChange,
  pageSlice,
  prStatus,
  repoNameFromUrl,
  shouldFetchNextPage,
  slimPR,
  themeButtonLabel,
  visiblePageNumbers
} = globalThis.PortfolioLib;

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

function applyTheme(theme, { persist = true } = {}) {
  const next = normalizeTheme(theme);
  document.documentElement.setAttribute("data-theme", next);
  document.body.setAttribute("data-theme", next);
  toggleBtn.textContent = themeButtonLabel(next);

  const themeColor = document.querySelector('meta[name="theme-color"]');
  if (themeColor) themeColor.setAttribute("content", themeColorFor(next));

  if (!persist) return;

  try {
    localStorage.setItem("theme", next);
  } catch {
    // Ignore quota / private-mode failures
  }
}

const storedTheme = (() => {
  try {
    return localStorage.getItem("theme");
  } catch {
    return null;
  }
})();
const hasStoredTheme = storedTheme === "dark" || storedTheme === "light";
const prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;

applyTheme(resolveInitialTheme(storedTheme, prefersDark), { persist: hasStoredTheme });

toggleBtn.addEventListener("click", () => {
  applyTheme(nextTheme(document.documentElement.getAttribute("data-theme")));
});

// ----- Load Contributions from JSON -----
// ----- Load Contributions from GitHub API -----
// ----- Load Contributions from GitHub API -----
const BASE_API_URL = "https://api.github.com/search/issues?q=is:pr+is:merged+author:varunkasyap";
const MOBILE_QUERY = window.matchMedia("(max-width: 600px)");
const prCache = createPrCache({ storage: localStorage });

let currentPage = 1;
let itemsPerPage = getItemsPerPage();
let totalCount = 0;
let allPRs = null;
let prsRequest = null;

function getItemsPerPage() {
  return itemsPerPageFor(MOBILE_QUERY.matches);
}

function readPrCache(options) {
  return prCache.read(options);
}

function writePrCache(items) {
  prCache.write(items);
}

function fetchAllPRsFromApi() {
  function fetchPage(page, collected) {
    return fetch(`${BASE_API_URL}&page=${page}&per_page=${PR_FETCH_PER_PAGE}`)
      .then(response => response.json().then(data => ({ response, data })))
      .then(({ response, data }) => {
        if (isRateLimited(response, data)) {
          const error = new Error("RATE_LIMIT");
          error.stale = readPrCache({ allowStale: true });
          throw error;
        }

        const batch = (data.items || []).map(slimPR);
        const next = collected.concat(batch);
        const total = data.total_count || next.length;

        if (!shouldFetchNextPage(batch.length, next.length, total, page)) {
          return next;
        }

        return fetchPage(page + 1, next);
      });
  }

  return fetchPage(1, []);
}

function loadAllPRs() {
  if (allPRs) return Promise.resolve(allPRs);
  if (prsRequest) return prsRequest;

  const cached = readPrCache();
  if (cached) {
    allPRs = cached;
    return Promise.resolve(allPRs);
  }

  prsRequest = fetchAllPRsFromApi()
    .then(items => {
      allPRs = items;
      writePrCache(items);
      return allPRs;
    })
    .finally(() => {
      prsRequest = null;
    });

  return prsRequest;
}

function scrollToContributions() {
  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  document.getElementById("contributions")?.scrollIntoView({
    behavior: prefersReducedMotion ? "auto" : "smooth",
    block: "start"
  });
}

function showPRResults(items, container) {
  container.innerHTML = ""; // Clear loading
  totalCount = items.length;

  const pageItems = pageSlice(items, currentPage, itemsPerPage);

  if (pageItems.length > 0) {
    renderPRs(pageItems, container);
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

  if (allPRs) {
    showPRResults(allPRs, container);
    if (scroll) scrollToContributions();
    return;
  }

  const cached = readPrCache();
  if (cached) {
    allPRs = cached;
    showPRResults(allPRs, container);
    if (scroll) scrollToContributions();
    return;
  }

  container.innerHTML = '<div class="loading-spinner">Loading contributions...</div>';
  document.getElementById("pagination-controls").innerHTML = ""; // Hide controls while loading

  loadAllPRs()
    .then(items => {
      showPRResults(items, container);
      if (scroll) scrollToContributions();
    })
    .catch(error => {
      console.error("Error loading GitHub data:", error);

      const stale = (error && error.stale) || readPrCache({ allowStale: true });
      if (stale) {
        allPRs = stale;
        showPRResults(stale, container);
      } else if (error && error.message === "RATE_LIMIT") {
        container.innerHTML = "<p>Limit exceeded. Try again later.</p>";
      } else {
        container.innerHTML = "<p>Error loading contributions. Please check console.</p>";
      }

      if (scroll) scrollToContributions();
    });
}

function renderPRs(items, container) {
  items.forEach(pr => {
    const card = document.createElement("a");
    card.className = "pr-card";
    card.href = pr.html_url;
    card.target = "_blank";

    // Extract repo name from URL (api url is like .../repos/owner/repo/...)
    const repoName = repoNameFromUrl(pr.repository_url);
    const date = new Date(pr.closed_at).toLocaleDateString();

    card.innerHTML = `
      <div class="pr-header">
        <span class="pr-repo">${repoName}</span>
        <span class="pr-status ${pr.state}">${prStatus(pr)}</span>
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

  const sortedPages = visiblePageNumbers(current, totalPages);

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
  const nextPage = pageAfterViewportChange(currentPage, itemsPerPage, nextSize);
  itemsPerPage = nextSize;
  fetchPRs(nextPage);
}

if (typeof MOBILE_QUERY.addEventListener === "function") {
  MOBILE_QUERY.addEventListener("change", handleViewportChange);
} else {
  MOBILE_QUERY.addListener(handleViewportChange);
}

// Initial fetch
fetchPRs(1);
