const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const {
  ITEMS_PER_PAGE_DESKTOP,
  ITEMS_PER_PAGE_MOBILE,
  PR_CACHE_KEY,
  PR_CACHE_TTL_MS,
  createPrCache,
  exportLib,
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
} = require("../lib.js");

function createMemoryStorage(initial = {}) {
  const data = { ...initial };
  return {
    getItem(key) {
      return Object.prototype.hasOwnProperty.call(data, key) ? data[key] : null;
    },
    setItem(key, value) {
      data[key] = String(value);
    },
    removeItem(key) {
      delete data[key];
    },
    key(index) {
      return Object.keys(data)[index] ?? null;
    },
    get length() {
      return Object.keys(data).length;
    }
  };
}

describe("itemsPerPageFor", () => {
  it("uses 3 items on mobile and 6 on desktop", () => {
    assert.equal(itemsPerPageFor(true), ITEMS_PER_PAGE_MOBILE);
    assert.equal(itemsPerPageFor(false), ITEMS_PER_PAGE_DESKTOP);
  });
});

describe("slimPR", () => {
  it("keeps only the fields the cards need", () => {
    assert.deepEqual(slimPR({
      html_url: "https://github.com/django/django/pull/1",
      repository_url: "https://api.github.com/repos/django/django",
      state: "closed",
      pull_request: { merged_at: "2026-01-01T00:00:00Z", url: "https://api.github.com/ignored" },
      title: "Fix a bug",
      number: 1,
      closed_at: "2026-01-01T00:00:00Z",
      user: { login: "varunkasyap" },
      labels: [{ name: "bug" }]
    }), {
      html_url: "https://github.com/django/django/pull/1",
      repository_url: "https://api.github.com/repos/django/django",
      state: "closed",
      pull_request: { merged_at: "2026-01-01T00:00:00Z" },
      title: "Fix a bug",
      number: 1,
      closed_at: "2026-01-01T00:00:00Z"
    });
  });

  it("handles a missing pull_request object", () => {
    assert.equal(slimPR({ title: "Open", state: "open" }).pull_request, null);
  });
});

describe("isRateLimited", () => {
  it("detects 403, 429, and rate-limit messages", () => {
    assert.equal(isRateLimited({ status: 403 }, {}), true);
    assert.equal(isRateLimited({ status: 429 }, {}), true);
    assert.equal(isRateLimited({ status: 200 }, { message: "API rate limit exceeded" }), true);
    assert.equal(isRateLimited({ status: 200 }, { items: [] }), false);
    assert.equal(isRateLimited({ status: 200 }, undefined), false);
    assert.equal(isRateLimited({ status: 200 }, null), false);
  });
});

describe("pageSlice", () => {
  it("returns the current page of results", () => {
    const items = [1, 2, 3, 4, 5, 6, 7];
    assert.deepEqual(pageSlice(items, 1, 3), [1, 2, 3]);
    assert.deepEqual(pageSlice(items, 2, 3), [4, 5, 6]);
    assert.deepEqual(pageSlice(items, 3, 3), [7]);
  });
});

describe("visiblePageNumbers", () => {
  it("always includes first, last, and neighbors of the current page", () => {
    assert.deepEqual(visiblePageNumbers(1, 1), [1]);
    assert.deepEqual(visiblePageNumbers(5, 10), [1, 4, 5, 6, 10]);
    assert.deepEqual(visiblePageNumbers(1, 10), [1, 2, 10]);
    assert.deepEqual(visiblePageNumbers(10, 10), [1, 9, 10]);
  });
});

describe("pageAfterViewportChange", () => {
  it("keeps the first visible item on screen when page size changes", () => {
    assert.equal(pageAfterViewportChange(2, 6, 3), 3);
    assert.equal(pageAfterViewportChange(3, 3, 6), 2);
    assert.equal(pageAfterViewportChange(1, 6, 3), 1);
  });
});

describe("shouldFetchNextPage", () => {
  it("stops when the batch is short, the list is complete, or the page cap is hit", () => {
    assert.equal(shouldFetchNextPage(100, 100, 250, 1), true);
    assert.equal(shouldFetchNextPage(29, 29, 29, 1), false);
    assert.equal(shouldFetchNextPage(100, 1000, 1200, 10), false);
  });
});

describe("repoNameFromUrl and prStatus", () => {
  it("extracts owner/repo from a GitHub API repository URL", () => {
    assert.equal(
      repoNameFromUrl("https://api.github.com/repos/django/django"),
      "django/django"
    );
    assert.equal(repoNameFromUrl(undefined), "");
    assert.equal(repoNameFromUrl(""), "");
  });

  it("labels merged closed PRs as Merged", () => {
    assert.equal(prStatus({
      state: "closed",
      pull_request: { merged_at: "2026-01-01T00:00:00Z" }
    }), "Merged");
    assert.equal(prStatus({ state: "open", pull_request: {} }), "open");
    assert.equal(prStatus({ state: "closed", pull_request: {} }), "closed");
    assert.equal(prStatus({ state: "closed" }), "closed");
  });
});

describe("theme helpers", () => {
  it("normalizes unknown values to light", () => {
    assert.equal(normalizeTheme("dark"), "dark");
    assert.equal(normalizeTheme("light"), "light");
    assert.equal(normalizeTheme(null), "light");
  });

  it("toggles theme and button label", () => {
    assert.equal(nextTheme("dark"), "light");
    assert.equal(nextTheme("light"), "dark");
    assert.equal(themeButtonLabel("dark"), "Light Mode");
    assert.equal(themeButtonLabel("light"), "Dark Mode");
  });

  it("uses a stored theme, otherwise the OS preference", () => {
    assert.equal(resolveInitialTheme("dark", false), "dark");
    assert.equal(resolveInitialTheme("light", true), "light");
    assert.equal(resolveInitialTheme(null, true), "dark");
    assert.equal(resolveInitialTheme(null, false), "light");
    assert.equal(resolveInitialTheme("nope", true), "dark");
  });

  it("maps themes to browser chrome colors", () => {
    assert.equal(themeColorFor("dark"), "#000000");
    assert.equal(themeColorFor("light"), "#ffffff");
    assert.equal(themeColorFor(null), "#ffffff");
  });
});

describe("createPrCache", () => {
  it("returns null when empty, invalid, or expired", () => {
    const empty = createPrCache({ storage: createMemoryStorage() });
    assert.equal(empty.read(), null);

    const invalid = createPrCache({
      storage: createMemoryStorage({ [PR_CACHE_KEY]: "{not-json" })
    });
    assert.equal(invalid.read(), null);

    assert.equal(createPrCache({
      storage: createMemoryStorage({ [PR_CACHE_KEY]: JSON.stringify({ savedAt: "nope", items: [] }) })
    }).read(), null);

    assert.equal(createPrCache({
      storage: createMemoryStorage({ [PR_CACHE_KEY]: JSON.stringify({ savedAt: 1, items: "nope" }) })
    }).read(), null);

    assert.equal(createPrCache({
      storage: createMemoryStorage({ [PR_CACHE_KEY]: "null" })
    }).read(), null);

    const storage = createMemoryStorage();
    const writer = createPrCache({ storage, now: () => 1_000 });
    writer.write([{ number: 1 }]);

    const reader = createPrCache({ storage, now: () => 1_000 + PR_CACHE_TTL_MS + 1 });
    assert.equal(reader.read(), null);
    assert.deepEqual(reader.read({ allowStale: true }), [{ number: 1 }]);
  });

  it("round-trips a fresh list and clears legacy v1 keys", () => {
    const storage = createMemoryStorage({
      "pr-cache-v1:6:1": "old"
    });
    const cache = createPrCache({ storage, now: () => 42 });
    cache.write([{ number: 7 }]);

    assert.equal(storage.getItem("pr-cache-v1:6:1"), null);
    assert.deepEqual(cache.read(), [{ number: 7 }]);
    assert.equal(JSON.parse(storage.getItem(PR_CACHE_KEY)).savedAt, 42);
  });

  it("uses the default clock for a fresh write", () => {
    const storage = createMemoryStorage();
    const cache = createPrCache({ storage });
    cache.write([{ number: 3 }]);
    assert.deepEqual(cache.read(), [{ number: 3 }]);
  });

  it("ignores write failures and skips empty storage keys", () => {
    const storage = createMemoryStorage({ "pr-cache-v1:6:1": "old" });
    const originalKey = storage.key.bind(storage);
    storage.key = index => (index === 0 ? "" : originalKey(index));
    storage.setItem = () => {
      throw new Error("quota");
    };

    const cache = createPrCache({ storage, now: () => 1 });
    assert.doesNotThrow(() => cache.write([{ number: 9 }]));
    assert.equal(cache.read(), null);
  });
});

describe("browser export", () => {
  it("assigns module.exports in Node and PortfolioLib in the browser", () => {
    const cjsModule = { exports: {} };
    exportLib({}, { ok: true }, cjsModule);
    assert.deepEqual(cjsModule.exports, { ok: true });

    const root = {};
    exportLib(root, { ok: true }, null);
    assert.deepEqual(root.PortfolioLib, { ok: true });
  });

  it("attaches PortfolioLib when module.exports is unavailable", () => {
    const source = fs.readFileSync(path.join(__dirname, "..", "lib.js"), "utf8");
    const sandbox = { globalThis: {} };
    vm.runInNewContext(source, sandbox);
    assert.equal(typeof sandbox.globalThis.PortfolioLib.slimPR, "function");
    assert.equal(sandbox.globalThis.PortfolioLib.normalizeTheme("dark"), "dark");
  });
});


