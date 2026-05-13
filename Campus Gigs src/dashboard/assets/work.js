// =============================================================================
// frontend/js/work.js
// -----------------------------------------------------------------------------
// Handles data fetching and DOM interactions for:
//   work.html            — list of the user's active and completed contracts
//   contract-details.html — single contract view with status update controls
//
// Both pages share this file. We detect which page we're on by looking for
// page-specific root elements in the DOM.
// =============================================================================

const API_BASE = "http://localhost:5000/api";

// =============================================================================
// SHARED UTILITIES
// =============================================================================

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

// Decode the JWT payload to determine the current user's ID.
// Used to figure out whether this user is the client or the freelancer
// on a given contract, which controls which action buttons are shown.
function getCurrentUserId() {
  try {
    const token = localStorage.getItem("token");
    if (!token) return null;
    const payload = JSON.parse(atob(token.split(".")[1]));
    return payload.id || payload._id || payload.sub;
  } catch {
    return null;
  }
}

function formatCurrency(amountInKobo) {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
  }).format(amountInKobo / 100);
}

function formatDate(isoString) {
  if (!isoString) return "—";
  return new Date(isoString).toLocaleDateString("en-NG", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

// =============================================================================
// STATUS HELPERS
// =============================================================================

// Maps contract status strings to Bootstrap badge classes
const STATUS_BADGES = {
  active: "bg-primary",
  pending_review: "bg-warning text-dark",
  completed: "bg-success",
  disputed: "bg-danger",
  cancelled: "bg-secondary",
};

function statusBadgeHTML(status) {
  const cls = STATUS_BADGES[status] || "bg-secondary";
  const label = status.replace("_", " ").toUpperCase();
  return `<span class="badge ${cls}">${label}</span>`;
}

// =============================================================================
// ─── PAGE: work.html ─────────────────────────────────────────────────────────
// =============================================================================

// =============================================================================
// CORE: loadContractList()
// Fetches all contracts for the current user and renders them in tabs:
//   "Active" tab — status: active or pending_review
//   "Completed" tab — status: completed
//   "History" tab — status: cancelled or disputed
//
// Uses a single API call with no status filter, then partitions client-side.
// This is acceptable for a user who has at most dozens of contracts; for a
// marketplace with thousands of contracts per user, you'd paginate server-side.
// =============================================================================
async function loadContractList() {
  const activeList = document.getElementById("contracts-active");
  const completedList = document.getElementById("contracts-completed");
  const historyList = document.getElementById("contracts-history");

  // Show loading state in all tabs simultaneously
  const loadingHTML = `
    <div class="text-center py-4">
      <div class="spinner-border text-primary" role="status">
        <span class="visually-hidden">Loading...</span>
      </div>
    </div>`;
  if (activeList) activeList.innerHTML = loadingHTML;
  if (completedList) completedList.innerHTML = loadingHTML;
  if (historyList) historyList.innerHTML = loadingHTML;

  try {
    const response = await fetch(`${API_BASE}/contracts`, {
      headers: getAuthHeaders(),
    });

    if (handleAuthError(response)) return;

    if (!response.ok) throw new Error("Failed to load contracts.");

    const { contracts } = await response.json();

    // -------------------------------------------------------------------------
    // Partition into three groups by status.
    // Using filter (which returns new arrays) rather than reducing into a map,
    // because clarity is more important than micro-optimisation here.
    // -------------------------------------------------------------------------
    const active = contracts.filter((c) =>
      ["active", "pending_review"].includes(c.status)
    );
    const completed = contracts.filter((c) => c.status === "completed");
    const history = contracts.filter((c) =>
      ["cancelled", "disputed"].includes(c.status)
    );

    // Update the tab badge counts (e.g. "Active (3)")
    const setBadge = (id, count) => {
      const el = document.getElementById(id);
      if (el) el.textContent = count;
    };
    setBadge("active-count", active.length);
    setBadge("completed-count", completed.length);
    setBadge("history-count", history.length);

    // Render each partition
    if (activeList) activeList.innerHTML = renderContractCards(active, "No active contracts.");
    if (completedList) completedList.innerHTML = renderContractCards(completed, "No completed contracts yet.");
    if (historyList) historyList.innerHTML = renderContractCards(history, "No contract history.");
  } catch (err) {
    console.error("loadContractList error:", err);
    const errHTML = `<p class="text-danger text-center py-3">${err.message}</p>`;
    if (activeList) activeList.innerHTML = errHTML;
    if (completedList) completedList.innerHTML = errHTML;
    if (historyList) historyList.innerHTML = errHTML;
  }
}

// =============================================================================
// RENDER: renderContractCards(contracts, emptyMessage)
// Builds HTML for a list of contract summary cards.
// Each card links to contract-details.html?id=<contractId>.
// =============================================================================
function renderContractCards(contracts, emptyMessage) {
  if (!contracts.length) {
    return `<p class="text-muted text-center py-4">${emptyMessage}</p>`;
  }

  const currentUserId = getCurrentUserId();

  return contracts
    .map((c) => {
      // Determine this user's role on this contract to display the right label
      const isClient = c.client?._id === currentUserId;
      const roleLabel = isClient ? "You (Client)" : "You (Freelancer)";
      const counterparty = isClient ? c.freelancer : c.client;

      return `
        <div class="card mb-3 shadow-sm contract-card">
          <div class="card-body">
            <div class="d-flex justify-content-between align-items-start">
              <div>
                <h6 class="card-title mb-1">
                  <a href="contract-details.html?id=${c._id}" class="text-decoration-none">
                    ${c.job?.title || "Untitled Job"}
                  </a>
                </h6>
                <p class="text-muted small mb-0">
                  ${roleLabel} 
                  ${counterparty ? `• with <strong>${counterparty.name}</strong>` : ""}
                </p>
              </div>
              <div class="text-end">
                ${statusBadgeHTML(c.status)}
                <div class="fw-semibold mt-1">${formatCurrency(c.agreedAmount)}</div>
              </div>
            </div>
            <div class="d-flex justify-content-between align-items-center mt-3">
              <small class="text-muted">
                Deadline: ${formatDate(c.deadline)}
                ${c.isOverdue ? '<span class="badge bg-danger ms-1">OVERDUE</span>' : ""}
              </small>
              <a href="contract-details.html?id=${c._id}" class="btn btn-sm btn-outline-primary">
                View Contract
              </a>
            </div>
          </div>
        </div>`;
    })
    .join("");
}

// =============================================================================
// ─── PAGE: contract-details.html ─────────────────────────────────────────────
// =============================================================================

// =============================================================================
// CORE: loadContractDetails()
// Fetches a single contract and renders the full detail view with action buttons.
// =============================================================================
async function loadContractDetails() {
  const contractId = new URLSearchParams(window.location.search).get("id");

  if (!contractId) {
    renderContractError("No contract ID in URL.");
    return;
  }

  try {
    const response = await fetch(`${API_BASE}/contracts/${contractId}`, {
      headers: getAuthHeaders(),
    });

    if (handleAuthError(response)) return;

    if (response.status === 404) {
      renderContractError("Contract not found.");
      return;
    }

    if (!response.ok) throw new Error("Failed to load contract.");

    const contract = await response.json();

    document.title = `Contract: ${contract.job?.title || contractId} — Campus Gigs`;

    renderContractDetails(contract);
    renderActionButtons(contract);
  } catch (err) {
    console.error("loadContractDetails error:", err);
    renderContractError(err.message);
  }
}

// =============================================================================
// RENDER: renderContractDetails(contract)
// Populates all the static content areas of contract-details.html.
// =============================================================================
function renderContractDetails(contract) {
  const setText = (id, text) => {
    const el = document.getElementById(id);
    if (el) el.textContent = text ?? "—";
  };
  const setHTML = (id, html) => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = html;
  };

  setText("contract-job-title", contract.job?.title);
  setText("contract-job-category", contract.job?.category);
  setText("contract-amount", formatCurrency(contract.agreedAmount));
  setText("contract-deadline", formatDate(contract.deadline));
  setText("contract-start-date", formatDate(contract.createdAt));
  setText("contract-client-name", contract.client?.name);
  setText("contract-freelancer-name", contract.freelancer?.name);

  setHTML("contract-status-badge", statusBadgeHTML(contract.status));

  if (contract.isOverdue) {
    const overdueEl = document.getElementById("contract-overdue-warning");
    if (overdueEl) overdueEl.classList.remove("d-none");
  }

  // Cover letter from the original application
  if (contract.application?.coverLetter) {
    setText("contract-cover-letter", contract.application.coverLetter);
  }

  // Deliverable note (set when freelancer submits work)
  if (contract.deliverableNote) {
    const noteSection = document.getElementById("deliverable-section");
    if (noteSection) noteSection.classList.remove("d-none");
    setText("contract-deliverable-note", contract.deliverableNote);
  }

  if (contract.resolutionNote) {
    const resSection = document.getElementById("resolution-section");
    if (resSection) resSection.classList.remove("d-none");
    setText("contract-resolution-note", contract.resolutionNote);
  }
}

// =============================================================================
// RENDER: renderActionButtons(contract)
// Shows the correct action buttons for this user's role and the contract status.
//
// Role → status → available actions:
//   Freelancer + active       → "Submit Deliverable" button
//   Client + pending_review   → "Approve Work" + "Raise Dispute" buttons
//   Either + active/review    → "Cancel Contract" button
//   completed/cancelled/disputed → no actions (terminal states)
// =============================================================================
function renderActionButtons(contract) {
  const actionsContainer = document.getElementById("contract-actions");
  if (!actionsContainer) return;

  // Terminal states have no further actions
  if (["completed", "cancelled", "disputed"].includes(contract.status)) {
    actionsContainer.innerHTML = `
      <p class="text-muted text-center">
        This contract has reached a final state (${contract.status}) 
        and requires no further action.
      </p>`;
    return;
  }

  const currentUserId = getCurrentUserId();
  const isClient = contract.client?._id?.toString() === currentUserId;
  const isFreelancer = contract.freelancer?._id?.toString() === currentUserId;

  let buttonsHTML = "";

  // --- Freelancer submitting work ---
  if (isFreelancer && contract.status === "active") {
    buttonsHTML += `
      <div class="mb-3">
        <label for="deliverable-input" class="form-label fw-semibold">
          Deliverable / Work Summary
        </label>
        <textarea id="deliverable-input" class="form-control" rows="4"
          placeholder="Describe what you've completed, include links to files, repos, or documents...">
        </textarea>
        <div class="form-text">
          <!-- [EXTERNAL ACTION REQUIRED]: Add a file upload input here once
               Cloudinary is configured. See Contract.js deliverableUrl field. -->
        </div>
      </div>
      <button class="btn btn-primary" 
              onclick="updateContractStatus('${contract._id}', 'pending_review', 'deliverable-input')">
        Submit Deliverable for Review
      </button>`;
  }

  // --- Client reviewing submitted work ---
  if (isClient && contract.status === "pending_review") {
    buttonsHTML += `
      <div class="alert alert-info">
        The freelancer has submitted their deliverable. Please review the work 
        description below before approving or disputing.
      </div>
      <button class="btn btn-success me-2"
              onclick="updateContractStatus('${contract._id}', 'completed')">
        ✓ Approve & Release Payment
      </button>
      <button class="btn btn-warning"
              onclick="updateContractStatus('${contract._id}', 'disputed')">
        ✗ Raise a Dispute
      </button>`;
  }

  // --- Cancellation (either party, non-terminal statuses) ---
  buttonsHTML += `
    <div class="mt-3 border-top pt-3">
      <button class="btn btn-outline-danger btn-sm"
              onclick="promptCancelContract('${contract._id}')">
        Cancel Contract
      </button>
    </div>`;

  actionsContainer.innerHTML = buttonsHTML;
}

// =============================================================================
// ACTION: updateContractStatus(contractId, newStatus, deliverableInputId?)
// POSTs the status update to the backend and reloads the detail view on success.
// Exposed on window so it's callable from the inline onclick attributes
// rendered in renderActionButtons().
// =============================================================================
window.updateContractStatus = async function (
  contractId,
  newStatus,
  deliverableInputId = null
) {
  const confirmMessages = {
    completed: "Approve this work and release payment to the freelancer?",
    pending_review: "Submit your deliverable for client review?",
    disputed: "Raise a dispute? An admin will review the contract.",
    cancelled: "Cancel this contract? This cannot be undone.",
  };

  if (!confirm(confirmMessages[newStatus] || `Set status to "${newStatus}"?`)) {
    return;
  }

  // Collect the deliverable note if this is a submission
  const deliverableNote = deliverableInputId
    ? document.getElementById(deliverableInputId)?.value.trim()
    : undefined;

  if (newStatus === "pending_review" && !deliverableNote) {
    alert("Please describe your deliverable before submitting.");
    return;
  }

  try {
    const response = await fetch(`${API_BASE}/contracts/${contractId}/status`, {
      method: "PUT",
      headers: getAuthHeaders(),
      body: JSON.stringify({ status: newStatus, deliverableNote }),
    });

    if (handleAuthError(response)) return;

    const data = await response.json();

    if (!response.ok) {
      alert(data.message || "Failed to update contract.");
      return;
    }

    // Reload the page to reflect the new status and re-render action buttons
    window.location.reload();
  } catch (err) {
    console.error("updateContractStatus error:", err);
    alert("Network error. Please try again.");
  }
};

// =============================================================================
// ACTION: promptCancelContract(contractId)
// Shows a confirmation dialog asking for a cancellation reason, then calls
// updateContractStatus. Separate function to avoid nesting prompt + confirm.
// =============================================================================
window.promptCancelContract = function (contractId) {
  const reason = prompt(
    "Please provide a reason for cancellation (optional):"
  );
  if (reason === null) return; // user clicked Cancel on the prompt dialog

  // Reuse updateContractStatus but pass the reason as resolutionNote.
  // We do this via a direct fetch here to include the resolutionNote field.
  (async () => {
    try {
      const response = await fetch(`${API_BASE}/contracts/${contractId}/status`, {
        method: "PUT",
        headers: getAuthHeaders(),
        body: JSON.stringify({
          status: "cancelled",
          resolutionNote: reason || "No reason provided.",
        }),
      });

      if (handleAuthError(response)) return;

      const data = await response.json();
      if (!response.ok) {
        alert(data.message || "Failed to cancel contract.");
        return;
      }
      window.location.reload();
    } catch {
      alert("Network error. Please try again.");
    }
  })();
};

function renderContractError(message) {
  const container = document.getElementById("contract-details-container");
  if (container) {
    container.innerHTML = `
      <div class="col-12 text-center py-5">
        <i class="bi bi-exclamation-circle fs-1 text-danger"></i>
        <p class="mt-3 text-muted">${message}</p>
        <a href="work.html" class="btn btn-outline-primary">Back to My Work</a>
      </div>`;
  }
}

// =============================================================================
// BOOTSTRAP: DOMContentLoaded
// Detect which page we're on and call the appropriate initialiser.
// =============================================================================
document.addEventListener("DOMContentLoaded", () => {
  if (!localStorage.getItem("token")) {
    window.location.href = "login.html";
    return;
  }

  // The presence of #contracts-active indicates we're on work.html
  if (document.getElementById("contracts-active")) {
    loadContractList();
    return;
  }

  // The presence of #contract-details-container indicates contract-details.html
  if (document.getElementById("contract-details-container")) {
    loadContractDetails();
  }
});
