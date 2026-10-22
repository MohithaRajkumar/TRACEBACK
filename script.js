const STORAGE_KEY = "traceback_reports_v1";
const $ = (id) => document.getElementById(id);

let reports = [];
try {
  const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  if (Array.isArray(saved)) reports = saved;
} catch {
  reports = [];
}

function saveReports() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(reports));
}

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);
}

function normalize(value) {
  return String(value || "").toLowerCase().trim();
}

function matchScore(a, b) {
  if (a.type === b.type || a.status === "resolved" || b.status === "resolved") {
    return 0;
  }

  let score = 0;
  if (a.category === b.category) score += 30;
  if (normalize(a.colour) === normalize(b.colour)) score += 25;

  if (normalize(a.itemName) === normalize(b.itemName)) score += 30;
  else {
    const wordsA = normalize(a.itemName).split(/\s+/);
    const wordsB = normalize(b.itemName).split(/\s+/);
    if (wordsA.some(word => word.length > 2 && wordsB.includes(word))) score += 15;
  }

  if (normalize(a.location) === normalize(b.location)) score += 15;

  const days = Math.abs(
    new Date(a.date + "T12:00:00") - new Date(b.date + "T12:00:00")
  ) / 86400000;

  if (Number.isFinite(days) && days <= 7) score += 10;
  return Math.min(score, 100);
}

function render() {
  $("totalCount").textContent = reports.length;
  $("lostCount").textContent = reports.filter(r => r.type === "lost" && r.status !== "resolved").length;
  $("foundCount").textContent = reports.filter(r => r.type === "found" && r.status !== "resolved").length;
  $("resolvedCount").textContent = reports.filter(r => r.status === "resolved").length;

  const query = normalize($("search").value);
  const filter = $("filterType").value;

  const visible = reports.filter(r => {
    const text = normalize([r.itemName, r.category, r.colour, r.location, r.description].join(" "));
    return (!query || text.includes(query)) &&
      (filter === "all" || r.type === filter);
  });

  $("itemList").innerHTML = visible.map(r => `
    <article class="item-card">
      <div class="item-top">
        <span class="pill ${r.type}">${r.type.toUpperCase()}</span>
        <span class="muted">${escapeHTML(r.date)}</span>
      </div>
      <h3>${escapeHTML(r.itemName)}</h3>
      <p>
        Category: ${escapeHTML(r.category)}<br>
        Colour: ${escapeHTML(r.colour)}<br>
        Location: ${escapeHTML(r.location)}<br>
        ${escapeHTML(r.description || "No extra description")}
      </p>
      <div class="item-top">
        <span class="pill">${escapeHTML(r.status.toUpperCase())}</span>
      </div>
      <div class="card-actions">
        ${r.status !== "resolved" ? `
          <button class="small-btn" data-action="resolve" data-id="${r.id}">
            Mark resolved
          </button>` : ""}
        <button class="small-btn" data-action="delete" data-id="${r.id}">
          Delete
        </button>
      </div>
    </article>
  `).join("");

  $("emptyMessage").hidden = visible.length > 0;
  renderMatches();
}

function renderMatches() {
  const openReports = reports.filter(r => r.status !== "resolved");
  const pairs = [];

  for (let i = 0; i < openReports.length; i++) {
    for (let j = i + 1; j < openReports.length; j++) {
      const a = openReports[i];
      const b = openReports[j];

      if (a.type === b.type) continue;

      const score = matchScore(a, b);
      if (score >= 55) pairs.push({ a, b, score });
    }
  }

  pairs.sort((a, b) => b.score - a.score);
  const box = $("matches");

  if (!pairs.length) {
    box.hidden = true;
    box.innerHTML = "";
    return;
  }

  box.hidden = false;
  box.innerHTML = "<strong>Possible matches</strong><br>" +
    pairs.slice(0, 5).map(p =>
      `${escapeHTML(p.a.itemName)} (${p.a.type}) ↔ ` +
      `${escapeHTML(p.b.itemName)} (${p.b.type}) — ${p.score}% similarity`
    ).join("<br>") +
    "<br><small>Suggestions are rule-based, not verified matches. Check the item details before resolving a report.</small>";
}

$("reportForm").addEventListener("submit", event => {
  event.preventDefault();

  const report = {
    id: Date.now().toString() + Math.random().toString(36).slice(2, 7),
    type: $("type").value,
    itemName: $("itemName").value.trim(),
    category: $("category").value,
    colour: $("colour").value.trim(),
    location: $("location").value.trim(),
    date: $("date").value,
    description: $("description").value.trim(),
    status: "open"
  };

  if (!report.itemName || !report.colour || !report.location || !report.date) {
    $("formMessage").textContent = "Please fill in all required fields.";
    return;
  }

  reports.unshift(report);
  saveReports();
  event.target.reset();
  $("date").value = new Date().toLocaleDateString("en-CA");
  $("formMessage").textContent = "Report saved successfully on this browser!";
  render();
  $("results");
});

$("itemList").addEventListener("click", event => {
  const button = event.target.closest("button[data-action]");
  if (!button) return;

  const report = reports.find(r => r.id === button.dataset.id);
  if (!report) return;

  if (button.dataset.action === "resolve") {
    report.status = "resolved";
  } else if (button.dataset.action === "delete") {
    if (!confirm("Delete this report from this browser?")) return;
    reports = reports.filter(r => r.id !== button.dataset.id);
  }

  saveReports();
  render();
});

$("search").addEventListener("input", render);
$("filterType").addEventListener("change", render);
$("date").value = new Date().toLocaleDateString("en-CA");
render();