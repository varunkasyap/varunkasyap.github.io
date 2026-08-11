// ----- Dark Mode Toggle -----
const toggleBtn = document.getElementById("themeToggle");

toggleBtn.addEventListener("click", () => {
  const isDark = document.body.getAttribute("data-theme") === "dark";
  document.body.setAttribute("data-theme", isDark ? "light" : "dark");
  toggleBtn.textContent = isDark ? "Dark Mode" : "Light Mode";
});

// ----- Load Contributions from JSON -----
// ----- Load Contributions from GitHub API -----
// ----- Load Contributions from GitHub API -----
const BASE_API_URL = "https://api.github.com/search/issues?q=is:pr+is:merged+author:varunkasyap";
let currentPage = 1;
const itemsPerPage = 6;
let totalCount = 0;

function fetchPRs(page) {
  currentPage = page;
  const container = document.getElementById("pr-container");
  container.innerHTML = '<div class="loading-spinner">Loading contributions...</div>';
  document.getElementById("pagination-controls").innerHTML = ""; // Hide controls while loading

  fetch(`${BASE_API_URL}&page=${page}&per_page=${itemsPerPage}`)
    .then(response => response.json())
    .then(data => {
      container.innerHTML = ""; // Clear loading

      if (data.items && data.items.length > 0) {
        totalCount = data.total_count;
        renderPRs(data.items, container);
        renderPagination(totalCount, itemsPerPage, currentPage);
      } else {
        container.innerHTML = "<p>No contributions found.</p>";
      }
    })
    .catch(error => {
      console.error("Error loading GitHub data:", error);
      container.innerHTML = "<p>Error loading contributions. Please check console.</p>";
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

function renderPagination(totalItems, perPage, current) {
  const totalPages = Math.ceil(totalItems / perPage);
  const paginationContainer = document.getElementById("pagination-controls");
  paginationContainer.innerHTML = "";

  if (totalPages <= 1) return;

  // Prev Button
  const prevBtn = document.createElement("button");
  prevBtn.className = "pagination-btn";
  prevBtn.textContent = "Prev";
  prevBtn.disabled = current === 1;
  prevBtn.onclick = () => fetchPRs(current - 1);
  paginationContainer.appendChild(prevBtn);

  // Page Numbers (Simple version: just current page logic or limited range)
  // Let's show: 1 ... current-1 current current+1 ... total
  // For simplicity given the likely number of PRs, we can just show Prev | Page X of Y | Next
  // Or a simple list of numbers. Let's do a simple list but limit it if there are many.

  // Let's implement a smart visible range: always 1, last, and neighbors of current.

  const pagesToShow = new Set([1, totalPages, current, current - 1, current + 1]);
  const sortedPages = Array.from(pagesToShow).filter(p => p > 0 && p <= totalPages).sort((a, b) => a - b);

  let lastPage = 0;
  sortedPages.forEach(p => {
    if (lastPage > 0 && p - lastPage > 1) {
      const span = document.createElement("span");
      span.textContent = "...";
      // span.style.padding = "0 5px"; // Optional spacing
      paginationContainer.appendChild(span);
    }

    const btn = document.createElement("button");
    btn.className = `pagination-btn ${p === current ? 'active' : ''}`;
    btn.textContent = p;
    btn.onclick = () => fetchPRs(p);
    paginationContainer.appendChild(btn);

    lastPage = p;
  });

  // Next Button
  const nextBtn = document.createElement("button");
  nextBtn.className = "pagination-btn";
  nextBtn.textContent = "Next";
  nextBtn.disabled = current === totalPages;
  nextBtn.onclick = () => fetchPRs(current + 1);
  paginationContainer.appendChild(nextBtn);
}

// Initial fetch
fetchPRs(1);
