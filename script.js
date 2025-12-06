// ----- Dark Mode Toggle -----
const toggleBtn = document.getElementById("themeToggle");

toggleBtn.addEventListener("click", () => {
  const isDark = document.body.getAttribute("data-theme") === "dark";
  document.body.setAttribute("data-theme", isDark ? "light" : "dark");
  toggleBtn.textContent = isDark ? "Dark Mode" : "Light Mode";
});

// ----- Load Contributions from JSON -----
fetch("contributions.json")
  .then(response => response.json())
  .then(data => {
    const tbody = document.querySelector("#contribTable tbody");

    data.forEach((item, index) => {
      const row = document.createElement("tr");

    row.innerHTML = `
      <td>${index + 1}</td>
      <td>${item.project}</td>
      <td><a href="${item.url}" target="_blank">#${item.pr}</a></td>
      <td>${item.description}</td>
    `;


      tbody.appendChild(row);
    });
  })
  .catch(error => console.error("Error loading JSON:", error));
