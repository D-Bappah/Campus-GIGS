// =============================================================================
// frontend/js/job-application.js
// -----------------------------------------------------------------------------
// Handles the proposal submission form on job-application.html.
// Reached from job-details.html via: job-application.html?id=<jobId>
//
// [EXTERNAL ACTION REQUIRED] — Resume Upload
// This form has a resume file input in the HTML. We intentionally do NOT
// handle file uploads here. Do NOT use FormData + multer local storage.
//
// To enable resume uploads:
//  1. Set up a Cloudinary account and create an unsigned upload preset.
//  2. npm install multer multer-storage-cloudinary cloudinary in the backend.
//  3. On the backend route (POST /api/jobs/:id/apply), add:
//       const { CloudinaryStorage } = require('multer-storage-cloudinary');
//       const upload = multer({ storage: new CloudinaryStorage({...}) });
//       router.post('/:id/apply', authMiddleware, upload.single('resume'), handler)
//  4. In this frontend file, switch from JSON fetch to FormData fetch:
//       const formData = new FormData();
//       formData.append('resume', resumeInput.files[0]);
//       formData.append('coverLetter', coverLetter);
//       // ... etc.
//       fetch(url, { method: 'POST', headers: { Authorization: ... }, body: formData })
//       // NOTE: Do NOT set Content-Type when using FormData — the browser sets it
//       // automatically with the correct multipart boundary.
// =============================================================================

const API_BASE = "http://localhost:5000/api";

function getAuthHeaders() {
  const token = localStorage.getItem("token");
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
}

function handleAuthError(response) {
  if (response.status === 401) {
    localStorage.removeItem("token");
    window.location.href = "login.html";
    return true;
  }
  return false;
}

function getJobIdFromUrl() {
  return new URLSearchParams(window.location.search).get("id");
}

// =============================================================================
// CORE: prefillJobContext()
// Fetches the job's title and budget so we can display them at the top of the
// application form as context — "You are applying for: Logo Design (₦15,000)"
// This prevents the applicant from losing track of which job they're bidding on.
// =============================================================================
async function prefillJobContext() {
  const jobId = getJobIdFromUrl();
  if (!jobId) {
    window.location.href = "browse-jobs.html";
    return;
  }

  try {
    const response = await fetch(`${API_BASE}/jobs/${jobId}`, {
      headers: getAuthHeaders(),
    });

    if (handleAuthError(response)) return;

    if (!response.ok) {
      document.getElementById("job-context")?.remove();
      return;
    }

    const job = await response.json();

    // Populate the context banner at the top of the application form
    const setText = (id, text) => {
      const el = document.getElementById(id);
      if (el) el.textContent = text;
    };
    setText("context-job-title", job.title);
    setText(
      "context-job-budget",
      new Intl.NumberFormat("en-NG", {
        style: "currency",
        currency: "NGN",
      }).format(job.budget / 100)
    );
    setText("context-delivery-days", `${job.deliveryDays} day(s)`);

    // Pre-fill the bid amount input with the job's posted budget as a starting
    // point. The applicant can change it, but having a default reduces friction.
    const bidInput = document.getElementById("bid-amount");
    if (bidInput && job.budget) {
      bidInput.value = job.budget / 100; // convert kobo to Naira for display
      bidInput.placeholder = `Client budget: ₦${job.budget / 100}`;
    }

    // Pre-fill delivery days with the job's expected turnaround
    const daysInput = document.getElementById("delivery-days");
    if (daysInput && job.deliveryDays) {
      daysInput.value = job.deliveryDays;
    }
  } catch (err) {
    console.error("prefillJobContext error:", err);
    // Non-fatal — the form is still usable without the context banner
  }
}

// =============================================================================
// CORE: handleApplicationSubmit(event)
// Validates and POSTs the application form data to the backend.
// =============================================================================
async function handleApplicationSubmit(event) {
  event.preventDefault();

  const jobId = getJobIdFromUrl();
  if (!jobId) return;

  const submitBtn = document.getElementById("application-submit-btn");
  const errorEl = document.getElementById("application-error");
  const successEl = document.getElementById("application-success");

  // Clear previous messages
  if (errorEl) errorEl.classList.add("d-none");
  if (successEl) successEl.classList.add("d-none");

  // --- Gather form values ---
  const coverLetter = document.getElementById("cover-letter")?.value.trim();
  const bidAmountNaira = parseFloat(
    document.getElementById("bid-amount")?.value || "0"
  );
  const deliveryDays = parseInt(
    document.getElementById("delivery-days")?.value || "0"
  );

  // --- Client-side validation ---
  if (!coverLetter || coverLetter.length < 50) {
    if (errorEl) {
      errorEl.textContent = "Cover letter must be at least 50 characters.";
      errorEl.classList.remove("d-none");
    }
    return;
  }
  if (!bidAmountNaira || bidAmountNaira < 1) {
    if (errorEl) {
      errorEl.textContent = "Please enter a valid bid amount.";
      errorEl.classList.remove("d-none");
    }
    return;
  }
  if (!deliveryDays || deliveryDays < 1) {
    if (errorEl) {
      errorEl.textContent = "Please enter a valid delivery timeline.";
      errorEl.classList.remove("d-none");
    }
    return;
  }

  // Disable button to prevent duplicate submissions
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerHTML = `
      <span class="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true"></span>
      Submitting...`;
  }

  try {
    const response = await fetch(`${API_BASE}/jobs/${jobId}/apply`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({
        coverLetter,
        bidAmount: bidAmountNaira, // server converts to kobo
        deliveryDays,
      }),
    });

    if (handleAuthError(response)) return;

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || "Failed to submit application.");
    }

    // -------------------------------------------------------------------------
    // Success — show confirmation and disable the form to prevent re-submission.
    // We don't redirect immediately so the user can read the success message
    // and click "View Job" at their own pace.
    // -------------------------------------------------------------------------
    if (successEl) {
      successEl.textContent = data.message || "Application submitted!";
      successEl.classList.remove("d-none");
    }

    // Disable all form inputs after successful submission
    document
      .getElementById("application-form")
      ?.querySelectorAll("input, textarea, button")
      .forEach((el) => (el.disabled = true));

    // Offer a link back to the job or to browse more jobs
    const redirectEl = document.getElementById("post-submit-actions");
    if (redirectEl) {
      redirectEl.innerHTML = `
        <a href="job-details.html?id=${jobId}" class="btn btn-outline-primary me-2">
          View Job
        </a>
        <a href="browse-jobs.html" class="btn btn-outline-secondary">
          Browse More Jobs
        </a>`;
      redirectEl.classList.remove("d-none");
    }
  } catch (err) {
    console.error("handleApplicationSubmit error:", err);
    if (errorEl) {
      errorEl.textContent = err.message;
      errorEl.classList.remove("d-none");
    }
  } finally {
    if (submitBtn && submitBtn.disabled) {
      // Only re-enable if submission failed (success state keeps it disabled)
      const successVisible = !successEl?.classList.contains("d-none");
      if (!successVisible) {
        submitBtn.disabled = false;
        submitBtn.textContent = "Submit Proposal";
      }
    }
  }
}

document.addEventListener("DOMContentLoaded", () => {
  if (!localStorage.getItem("token")) {
    window.location.href = "login.html";
    return;
  }

  prefillJobContext();

  document
    .getElementById("application-form")
    ?.addEventListener("submit", handleApplicationSubmit);
});
