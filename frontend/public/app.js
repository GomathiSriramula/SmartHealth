const API_BASE_URL = "http://127.0.0.1:5000";
const API_KEY = "secret-key";

let allReports = [];
let currentPage = 1;
const reportsPerPage = 10;
let sortColumn = null;
let sortDirection = "asc";

document.addEventListener("DOMContentLoaded", () => {
  initializeNavigation();
  initializeReportsPage();
  initializeAddReportPage();
  setDefaultDateTime();
});

function initializeNavigation() {
  const navButtons = document.querySelectorAll(".nav-btn");
  const pages = document.querySelectorAll(".page");

  navButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const targetPage = button.dataset.page;

      navButtons.forEach((btn) => btn.classList.remove("active"));
      button.classList.add("active");

      pages.forEach((page) => {
        page.classList.remove("active");
        if (page.id === `${targetPage}-page`) {
          page.classList.add("active");
        }
      });

      if (targetPage === "dashboard") {
        loadReports();
      }
    });
  });
}

function initializeReportsPage() {
  const refreshBtn = document.getElementById("refresh-btn");
  const prevBtn = document.getElementById("prev-btn");
  const nextBtn = document.getElementById("next-btn");
  const tableHeaders = document.querySelectorAll("th[data-sort]");

  refreshBtn.addEventListener("click", () => {
    loadReports();
  });

  prevBtn.addEventListener("click", () => {
    if (currentPage > 1) {
      currentPage--;
      renderTable();
    }
  });

  nextBtn.addEventListener("click", () => {
    const totalPages = Math.ceil(allReports.length / reportsPerPage);
    if (currentPage < totalPages) {
      currentPage++;
      renderTable();
    }
  });

  tableHeaders.forEach((header) => {
    header.addEventListener("click", () => {
      const column = header.dataset.sort;
      if (sortColumn === column) {
        sortDirection = sortDirection === "asc" ? "desc" : "asc";
      } else {
        sortColumn = column;
        sortDirection = "asc";
      }

      document
        .querySelectorAll("th")
        .forEach((th) => th.classList.remove("sorted"));
      header.classList.add("sorted");

      const icon = header.querySelector(".sort-icon");
      if (icon) {
        icon.textContent = sortDirection === "asc" ? "↑" : "↓";
      }

      sortReports();
      renderTable();
    });
  });

  loadReports();
}

async function loadReports() {
  const tbody = document.getElementById("reports-tbody");
  tbody.innerHTML =
    '<tr><td colspan="10" class="loading">Loading reports...</td></tr>';

  try {
    const response = await fetch(`${API_BASE_URL}/reports`, {
      method: "GET",
      headers: {
        "x-api-key": API_KEY,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    allReports = data.reports || data || [];
    currentPage = 1;
    renderTable();
  } catch (error) {
    console.error("Error loading reports:", error);
    tbody.innerHTML = `<tr><td colspan="10" class="loading" style="color: #d32f2f;">Error loading reports: ${error.message}</td></tr>`;
  }
}

function sortReports() {
  if (!sortColumn) return;

  allReports.sort((a, b) => {
    let aVal = a[sortColumn];
    let bVal = b[sortColumn];

    if (aVal === null || aVal === undefined) return 1;
    if (bVal === null || bVal === undefined) return -1;

    if (typeof aVal === "string") aVal = aVal.toLowerCase();
    if (typeof bVal === "string") bVal = bVal.toLowerCase();

    if (aVal < bVal) return sortDirection === "asc" ? -1 : 1;
    if (aVal > bVal) return sortDirection === "asc" ? 1 : -1;
    return 0;
  });
}

function renderTable() {
  const tbody = document.getElementById("reports-tbody");
  const pageInfo = document.getElementById("page-info");
  const prevBtn = document.getElementById("prev-btn");
  const nextBtn = document.getElementById("next-btn");

  const totalPages = Math.ceil(allReports.length / reportsPerPage);
  const startIndex = (currentPage - 1) * reportsPerPage;
  const endIndex = startIndex + reportsPerPage;
  const pageReports = allReports.slice(startIndex, endIndex);

  if (pageReports.length === 0) {
    tbody.innerHTML =
      '<tr><td colspan="10" class="loading">No reports found</td></tr>';
    pageInfo.textContent = "Page 0 of 0";
    prevBtn.disabled = true;
    nextBtn.disabled = true;
    return;
  }

  tbody.innerHTML = pageReports
    .map(
      (report) => `
        <tr>
            <td>${escapeHtml(report.id || "N/A")}</td>
            <td>${escapeHtml(report.patient_age || "N/A")}</td>
            <td>${escapeHtml(report.sex || "N/A")}</td>
            <td>${escapeHtml(report.lat || "N/A")}</td>
            <td>${escapeHtml(report.lng || "N/A")}</td>
            <td>${escapeHtml(formatSymptoms(report.symptoms))}</td>
            <td>${escapeHtml(report.reporter_type || "N/A")}</td>
            <td>${escapeHtml(report.reporter_id || "N/A")}</td>
            <td>${formatDateTime(report.reported_at)}</td>
            <td>${formatDateTime(report.created_at)}</td>
        </tr>
    `
    )
    .join("");

  pageInfo.textContent = `Page ${currentPage} of ${totalPages}`;
  prevBtn.disabled = currentPage === 1;
  nextBtn.disabled = currentPage === totalPages;
}

function formatSymptoms(symptoms) {
  if (!symptoms) return "N/A";
  if (Array.isArray(symptoms)) return symptoms.join(", ");
  if (typeof symptoms === "string") return symptoms;
  return "N/A";
}

function formatDateTime(dateString) {
  if (!dateString) return "N/A";
  try {
    const date = new Date(dateString);
    return date.toLocaleString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch (error) {
    return dateString;
  }
}

function escapeHtml(text) {
  if (text === null || text === undefined) return "";
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

function initializeAddReportPage() {
  const form = document.getElementById("report-form");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    await submitReport(form);
  });
}

function setDefaultDateTime() {
  const reportedAtInput = document.getElementById("reported_at");
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");

  reportedAtInput.value = `${year}-${month}-${day}T${hours}:${minutes}`;
}

async function submitReport(form) {
  const messageBox = document.getElementById("message-box");
  const submitBtn = form.querySelector(".submit-btn");

  submitBtn.disabled = true;
  submitBtn.textContent = "Submitting...";

  const formData = new FormData(form);
  const symptoms = Array.from(formData.getAll("symptoms"));

  const reportData = {
    reporter_type: formData.get("reporter_type"),
    reporter_id: formData.get("reporter_id"),
    patient_age: parseInt(formData.get("patient_age")),
    sex: formData.get("sex"),
    lat: parseFloat(formData.get("lat")),
    lng: parseFloat(formData.get("lng")),
    symptoms: symptoms,
    reported_at: formData.get("reported_at"),
  };

  try {
    const response = await fetch(`${API_BASE_URL}/report`, {
      method: "POST",
      headers: {
        "x-api-key": API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(reportData),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();

    messageBox.className = "message-box success";
    messageBox.textContent = "Report submitted successfully!";

    form.reset();
    setDefaultDateTime();

    setTimeout(() => {
      messageBox.style.display = "none";
    }, 5000);
  } catch (error) {
    console.error("Error submitting report:", error);
    messageBox.className = "message-box error";
    messageBox.textContent = `Error submitting report: ${error.message}`;
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "Submit Report";
  }
}
