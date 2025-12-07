// ----- Dark Mode Toggle -----
const toggleBtn = document.getElementById("themeToggle");

toggleBtn.addEventListener("click", () => {
  const isDark = document.body.getAttribute("data-theme") === "dark";
  document.body.setAttribute("data-theme", isDark ? "light" : "dark");
  toggleBtn.textContent = isDark ? "Dark Mode" : "Light Mode";
});

// ----- Load Contributions from JSON -----
// ----- Load Contributions from GitHub API -----
const GITHUB_API_URL = "https://api.github.com/search/issues?q=is:pr+is:merged+author:varunkasyap&per_page=100";

fetch(GITHUB_API_URL)
  .then(response => response.json())
  .then(data => {
    const container = document.getElementById("pr-container");
    container.innerHTML = ""; // Clear loading text

    if (data.items && data.items.length > 0) {
      data.items.forEach(pr => {
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
    } else {
      container.innerHTML = "<p>No contributions found.</p>";
    }
  })
  .catch(error => {
    console.error("Error loading GitHub data:", error);
    document.getElementById("pr-container").innerHTML = "<p>Error loading contributions. Please check console.</p>";
  });

// ----- Code Playground Logic -----
const languageSelect = document.getElementById("languageSelect");
const runBtn = document.getElementById("runBtn");
const codeEditor = document.getElementById("codeEditor");
const output = document.getElementById("output");

// Piston API endpoints
const RUNTMES_URL = "https://emkc.org/api/v2/piston/runtimes";
const EXECUTE_URL = "https://emkc.org/api/v2/piston/execute";

// Fetch supported languages
fetch(RUNTMES_URL)
  .then(res => res.json())
  .then(runtimes => {
    // Filter common languages or just show all. Let's show all but sort them.
    runtimes.sort((a, b) => a.language.localeCompare(b.language));

    languageSelect.innerHTML = rtimesToOptions(runtimes);

    // Set default to python if available, else first one
    if (runtimes.find(r => r.language === 'python')) {
      languageSelect.value = 'python';
      codeEditor.value = 'print("Hello, World!")';
    } else {
      codeEditor.value = '// Select a language and write code';
    }
  });

function rtimesToOptions(runtimes) {
  return runtimes.map(r => `<option value="${r.language}" data-version="${r.version}">${r.language} (${r.version})</option>`).join('');
}

// Reset code editor when language changes (optional, maybe just keep code)
// languageSelect.addEventListener('change', () => { ... });

runBtn.addEventListener("click", () => {
  const language = languageSelect.value;
  const version = languageSelect.options[languageSelect.selectedIndex].getAttribute("data-version");
  const code = codeEditor.value;

  if (!language || !version) {
    output.textContent = "Please select a language.";
    return;
  }

  output.textContent = "Running...";

  fetch(EXECUTE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      language: language,
      version: version,
      files: [{ content: code }]
    })
  })
    .then(res => res.json())
    .then(result => {
      if (result.run) {
        output.textContent = result.run.output || (result.run.stderr ? "Error:\n" + result.run.stderr : "No output");
      } else {
        output.textContent = "Error executing code.";
      }
    })
    .catch(err => {
      console.error(err);
      output.textContent = "Network error or API issue.";
    });
});
