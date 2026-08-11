(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  } else {
    root.PortfolioLib = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const PR_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
  const PR_CACHE_KEY = "pr-cache-v2";
  const ITEMS_PER_PAGE_MOBILE = 3;
  const ITEMS_PER_PAGE_DESKTOP = 6;
  const PR_FETCH_PER_PAGE = 100;
  const PR_FETCH_MAX_PAGES = 10;

  function itemsPerPageFor(isMobile) {
    return isMobile ? ITEMS_PER_PAGE_MOBILE : ITEMS_PER_PAGE_DESKTOP;
  }

  function slimPR(pr) {
    return {
      html_url: pr.html_url,
      repository_url: pr.repository_url,
      state: pr.state,
      pull_request: pr.pull_request ? { merged_at: pr.pull_request.merged_at } : null,
      title: pr.title,
      number: pr.number,
      closed_at: pr.closed_at
    };
  }

  function isRateLimited(response, data) {
    return response.status === 403 || response.status === 429
      || /rate limit/i.test((data && data.message) || "");
  }

  function pageSlice(items, page, perPage) {
    const start = (page - 1) * perPage;
    return items.slice(start, start + perPage);
  }

  function visiblePageNumbers(current, totalPages) {
    const pagesToShow = new Set([1, totalPages, current, current - 1, current + 1]);
    return Array.from(pagesToShow)
      .filter(page => page > 0 && page <= totalPages)
      .sort((a, b) => a - b);
  }

  function pageAfterViewportChange(currentPage, oldPerPage, newPerPage) {
    const firstItemIndex = (currentPage - 1) * oldPerPage;
    return Math.floor(firstItemIndex / newPerPage) + 1;
  }

  function shouldFetchNextPage(batchLength, collectedLength, total, page, perPage = PR_FETCH_PER_PAGE, maxPages = PR_FETCH_MAX_PAGES) {
    return batchLength >= perPage && collectedLength < total && page < maxPages;
  }

  function repoNameFromUrl(url) {
    return String(url || "").split("/").slice(-2).join("/");
  }

  function prStatus(pr) {
    return pr.state === "closed" && pr.pull_request && pr.pull_request.merged_at
      ? "Merged"
      : pr.state;
  }

  function normalizeTheme(theme) {
    return theme === "dark" ? "dark" : "light";
  }

  function nextTheme(theme) {
    return normalizeTheme(theme) === "dark" ? "light" : "dark";
  }

  function themeButtonLabel(theme) {
    return normalizeTheme(theme) === "dark" ? "Light Mode" : "Dark Mode";
  }

  function createPrCache({
    storage,
    now = () => Date.now(),
    ttlMs = PR_CACHE_TTL_MS,
    key = PR_CACHE_KEY
  } = {}) {
    function storageKeys() {
      const keys = [];
      for (let i = 0; i < storage.length; i += 1) {
        const storageKey = storage.key(i);
        if (storageKey) keys.push(storageKey);
      }
      return keys;
    }

    return {
      read({ allowStale = false } = {}) {
        try {
          const entry = JSON.parse(storage.getItem(key) || "null");
          if (!entry || typeof entry.savedAt !== "number" || !Array.isArray(entry.items)) {
            return null;
          }

          const isStale = now() - entry.savedAt > ttlMs;
          if (isStale && !allowStale) return null;

          return entry.items;
        } catch {
          return null;
        }
      },

      write(items) {
        try {
          storageKeys()
            .filter(storageKey => storageKey.startsWith("pr-cache-v1:"))
            .forEach(storageKey => storage.removeItem(storageKey));

          storage.setItem(key, JSON.stringify({
            savedAt: now(),
            items
          }));
        } catch {
          // Ignore quota / private-mode failures
        }
      }
    };
  }

  return {
    PR_CACHE_TTL_MS,
    PR_CACHE_KEY,
    ITEMS_PER_PAGE_MOBILE,
    ITEMS_PER_PAGE_DESKTOP,
    PR_FETCH_PER_PAGE,
    PR_FETCH_MAX_PAGES,
    itemsPerPageFor,
    slimPR,
    isRateLimited,
    pageSlice,
    visiblePageNumbers,
    pageAfterViewportChange,
    shouldFetchNextPage,
    repoNameFromUrl,
    prStatus,
    normalizeTheme,
    nextTheme,
    themeButtonLabel,
    createPrCache
  };
});

