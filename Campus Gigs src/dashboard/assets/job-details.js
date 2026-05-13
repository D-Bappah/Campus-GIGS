// =============================================================================
// frontend/js/job-details.js
// -----------------------------------------------------------------------------
// Handles data fetching and DOM rendering for job-details.html.
//
// This page is reached by appending ?id=<jobId> to the URL, e.g.:
//   job-details.html?id=64a1f2b3c4d5e6f7a8b9c0d1
//
// The page is PUBLIC (viewable without login) but the "Apply" button
// is only shown to logged-in users who are not the job's poster.
// =============================================================================

const API_BASE = "http://localhost:5000/api";

// =============================================================================
// UTILITY: getAuthHeaders — returns auth header if token exists, else {}
// We use this instead of a guard so public parts of the page still render
// even when the user is not logged in.
// =============================================================================
function getAuthHeaders() {
  const token = localStorage.getItem("token");
  return token
    ? { "Content-Type": "application/json", Authorization: `Bearer ${token}` }
    : { "Content-Type": "application/json" };
}

function handleAuthError(response) {
  if (response.status === 401) {
    localStorage.removeItem("token");
    window.location.href = "login.html";
    return true;
  }
  return false;
}

// =============================================================================
// UTILITY: getJobIdFromUrl()
// Parses the `id` query parameter from the current URL.
// Returns null if not present, triggering a "job not found" state.
// =============================================================================
function getJobIdFromUrl() {
  return new URLSearchParams(window.location.search).get("id");
}

// =============================================================================
// CORE: loadJobDetails()
// Fetches the single job document from the API and renders the full detail view.
// =============================================================================
async function loadJobDetails() {
  const jobId = getJobIdFromUrl();

  if (!jobId) {
    renderError("No job ID provided. Please go back and select a job.");
    return;
  }

  try {
    const response = await fetch(`${API_BASE}/jobs/${jobId}`, {
      headers: getAuthHeaders(),
    });

    if (handleAuthError(response)) return;

    if (response.status === 404) {
      renderError("This job posting no longer exists.");
      return;
    }

    if (!response.ok) {
      throw new Error("Failed to load job details.");
    }

    const job = await response.json();

    // Update the browser tab title so bookmarks/history are meaningful
    document.title = `${job.title} — Campus Gigs`;

    renderJobDetails(job);
    configureApplyButton(job);
  } catch (err) {
    console.error("loadJobDetails error:", err);
    renderError("Could not load job details. Please try again.");
  }
}

// =============================================================================
// RENDER: renderJobDetails(job)
// Populates all the static content areas of job-details.html with real data.
// =============================================================================
function renderJobDetails(job) {
  const setText = (id, text) => {
    const el = document.getElementById(id);
    if (el) el.textContent = text ?? "—";
  };
  const setHTML = (id, html) => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = html;
  };
  const setAttr = (id, attr, val) => {
    const el = document.getElementById(id);
    if (el) el.setAttribute(attr, val);
  };

  // --- Core job info ---
  setText("job-title", job.title);
  setText("job-category", job.category);
  setText("job-status", job.status);
  setText("job-application-count", `${job.applicationCount} proposal(s)`);
  setText("job-delivery-days", `${job.deliveryDays} day(s)`);
  setText(
    "job-budget",
    new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN" }).format(
      job.budget / 100
    )
  );
  setText(
    "job-posted-date",
    new Date(job.createdAt).toLocaleDateString("en-NG", {
      year: "numeric", month: "long", day: "numeric",
    })
  );

  // --- Description (preserve line breaks) ---
  setHTML(
    "job-description",
    job.description
      ? job.description.replace(/\n/g, "<br>")
      : "<em>No description provided.</em>"
  );

  // --- Skills tags ---
  const skillsEl = document.getElementById("job-skills");
  if (skillsEl && Array.isArray(job.skills) && job.skills.length > 0) {
    skillsEl.innerHTML = job.skills
      .map((s) => `<span class="badge bg-secondary me-1">${s}</span>`)
      .join("");
  }

  // --- Client info (populated from User) ---
  if (job.postedBy) {
    setText("client-name", job.postedBy.name);
    setText("client-university", job.postedBy.university || "University not set");
    const avatarEl = document.getElementById("client-avatar");
    if (avatarEl) {
      avatarEl.src =
        job.postedBy.avatarUrl || "assets/images/default-avatar.png";
      avatarEl.alt = `${job.postedBy.name}'s avatar`;
    }
  }

  // --- Status badge colour ---
  const statusBadge = document.getElementById("job-status-badge");
  if (statusBadge) {
    const colours = {
      open: "bg-success",
      in_progress: "bg-warning text-dark",
      completed: "bg-secondary",
      cancelled: "bg-danger",
    };
    statusBadge.className = `badge ${colours[job.status] || "bg-secondary"}`;
    statusBadge.textContent = job.status.replace("_", " ").toUpperCase();
  }
}

// =============================================================================
// RENDER: configureApplyButton(job)
// Shows or hides the Apply button based on the viewer's authentication state
// and relationship to the job.
// =============================================================================
function configureApplyButton(job) {
  const applyBtn = document.getElementById("apply-btn");
  const applyMsg = document.getElementById("apply-message");

  if (!applyBtn) return;

  const token = localStorage.getItem("token");

  if (!token) {
    // Visitor is not logged in — show a prompt to sign up/in
    applyBtn.style.display = "none";
    if (applyMsg) {
      applyMsg.textContent = "Sign in to apply for this job.";
      applyMsg.className = "text-muted small";
    }
    return;
  }

  // Decode the JWT payload to get the current user's ID.
  // We don't verify the signature here (that's the server's job) — we just
  // need the ID to compare against the job's poster.
  let currentUserId = null;
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    currentUserId = payload.id || payload._id || payload.sub;
  } catch {
    // Malformed token — treat as logged out
    localStorage.removeItem("token");
    window.location.href = "login.html";
    return;
  }

  const isOwner =
    job.postedBy && job.postedBy._id.toString() === currentUserId;
  const isOpen = job.status === "open";

  if (isOwner) {
    applyBtn.style.display = "none";
    if (applyMsg) {
      applyMsg.textContent = "This is your own job posting.";
      applyMsg.className = "text-muted small";
    }
  } else if (!isOpen) {
    applyBtn.disabled = true;
    applyBtn.textContent = "Applications Closed";
    if (applyMsg) {
      applyMsg.textContent = "This job is no longer accepting proposals.";
      applyMsg.className = "text-warning small";
    }
  } else {
    // User can apply — wire the button to navigate to the application form
    applyBtn.addEventListener("click", () => {
      window.location.href = `job-application.html?id=${job._id}`;
    });
  }
}

// =============================================================================
// RENDER: renderError(message)
// Shows a full-page error state instead of an empty broken layout.
// =============================================================================
function renderError(message) {
  const container = document.getElementById("job-details-container");
  if (container) {
    container.innerHTML = `
      <div class="col-12 text-center py-5">
        <i class="bi bi-exclamation-circle fs-1 text-danger"></i>
        <p class="mt-3 text-muted">${message}</p>
        <a href="browse-jobs.html" class="btn btn-outline-primary mt-2">
          Back to Browse Jobs
        </a>
      </div>`;
  }
}

document.addEventListener("DOMContentLoaded", loadJobDetails);
