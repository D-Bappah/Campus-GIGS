// =============================================================================
// frontend/js/payment.js
// -----------------------------------------------------------------------------
// Handles all DOM interactions and API calls for payment.html.
// This file replaces any previous localStorage-based "mirage" balance data
// with real fetch() calls to our Express backend.
//
// Page structure assumed in payment.html:
//   #wallet-available-balance  — span/h2 showing available balance
//   #wallet-escrow-balance     — span showing escrowed funds
//   #wallet-total-earned       — span showing lifetime earnings
//   #transaction-list          — <tbody> or <ul> for transaction rows
//   #pagination-controls       — container for prev/next page buttons
//   #withdraw-form             — the withdrawal request form
//   #withdraw-amount           — number input inside the form
//   #withdraw-bank-name        — text input
//   #withdraw-account-number   — text input
//   #withdraw-account-name     — text input
//   #withdraw-submit-btn       — submit button
//   #wallet-error-msg          — element for displaying error messages
//   #wallet-success-msg        — element for displaying success messages
// =============================================================================

// =============================================================================
// CONSTANTS & STATE
// =============================================================================

const API_BASE = "http://localhost:5000/api";

// Page state — tracks which page of the transaction history we're on.
// Stored in a plain object rather than separate variables so we can pass
// the whole state around easily if we refactor to a state-manager later.
const state = {
  currentPage: 1,
  totalPages: 1,
  isLoading: false,
};

// =============================================================================
// UTILITY: getAuthHeaders()
// -----------------------------------------------------------------------------
// Returns the Authorization header object required by all protected routes.
// Centralised here so we only have one place to change if we rename the
// localStorage key in the future.
// =============================================================================
function getAuthHeaders() {
  const token = localStorage.getItem("token"); // JWT set during login
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
}

// =============================================================================
// UTILITY: handleAuthError(response)
// -----------------------------------------------------------------------------
// Checks if the server responded with 401 Unauthorized.
// If so, clears the stale token and redirects to the login page.
// Returns true if we redirected (caller should abort further processing).
// =============================================================================
function handleAuthError(response) {
  if (response.status === 401) {
    localStorage.removeItem("token");
    window.location.href = "login.html";
    return true;
  }
  return false;
}

// =============================================================================
// UTILITY: formatCurrency(amountInKobo)
// -----------------------------------------------------------------------------
// Converts a kobo integer (e.g. 500000) to a formatted Naira string ("₦5,000.00").
// We store amounts in the smallest currency unit (kobo) to avoid floating-point
// arithmetic errors when adding/subtracting. All display conversion happens
// here at the presentation layer, never in the database or API.
// =============================================================================
function formatCurrency(amountInKobo) {
  const naira = amountInKobo / 100;
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    minimumFractionDigits: 2,
  }).format(naira);
}

// =============================================================================
// UTILITY: formatDate(isoString)
// -----------------------------------------------------------------------------
// Formats an ISO 8601 timestamp into a readable local date string.
// Using toLocaleDateString avoids shipping a date library just for this.
// =============================================================================
function formatDate(isoString) {
  return new Date(isoString).toLocaleDateString("en-NG", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// =============================================================================
// UTILITY: showMessage(elementId, message, isError)
// -----------------------------------------------------------------------------
// Shows a dismissible alert inside a given element. Clears itself after 6s.
// Kept as a generic utility so both the withdrawal form and the page-level
// error banner can use the same pattern.
// =============================================================================
function showMessage(elementId, message, isError = false) {
  const el = document.getElementById(elementId);
  if (!el) return;
  el.textContent = message;
  el.className = `alert ${isError ? "alert-danger" : "alert-success"}`;
  el.classList.remove("d-none");

  // Auto-hide after 6 seconds so the user doesn't need to manually dismiss
  setTimeout(() => el.classList.add("d-none"), 6000);
}

// =============================================================================
// CORE: loadWalletData(page)
// -----------------------------------------------------------------------------
// Fetches the wallet summary (balances + paginated transaction history) from
// the backend and renders it into the DOM.
//
// This function is called:
//   1. On DOMContentLoaded (initial load, page=1)
//   2. When the user clicks pagination prev/next buttons
// =============================================================================
async function loadWalletData(page = 1) {
  // Guard against multiple simultaneous loads (e.g. rapid button clicks)
  if (state.isLoading) return;
  state.isLoading = true;

  // Show a loading skeleton/spinner while data is in flight.
  // We target the transaction list container specifically so the balance
  // cards don't flash — they update independently.
  const listEl = document.getElementById("transaction-list");
  if (listEl) {
    listEl.innerHTML = `
      <tr>
        <td colspan="5" class="text-center py-4">
          <div class="spinner-border text-primary" role="status">
            <span class="visually-hidden">Loading transactions...</span>
          </div>
        </td>
      </tr>`;
  }

  try {
    // -------------------------------------------------------------------------
    // Fetch wallet summary + transaction history from the backend.
    // The `page` query param drives server-side pagination — the server only
    // returns `limit` records at a time, keeping the response payload small.
    // -------------------------------------------------------------------------
    const response = await fetch(
      `${API_BASE}/wallet/summary?page=${page}&limit=10`,
      { headers: getAuthHeaders() }
    );

    // Redirect to login on 401; abort all further processing in this function.
    if (handleAuthError(response)) return;

    if (!response.ok) {
      const errData = await response.json();
      throw new Error(errData.message || "Failed to load wallet data.");
    }

    const data = await response.json();
    // data shape: { summary: {...}, transactions: [...], pagination: {...} }

    // -------------------------------------------------------------------------
    // Update the balance cards in the UI.
    // We use getElementById for each stat so payment.html can lay out the
    // balance cards however it likes without us caring about structure.
    // -------------------------------------------------------------------------
    const setTextById = (id, text) => {
      const el = document.getElementById(id);
      if (el) el.textContent = text;
    };

    setTextById(
      "wallet-available-balance",
      formatCurrency(data.summary.availableBalance)
    );
    setTextById(
      "wallet-escrow-balance",
      formatCurrency(data.summary.escrowBalance)
    );
    setTextById(
      "wallet-total-earned",
      formatCurrency(data.summary.totalEarned)
    );

    // -------------------------------------------------------------------------
    // Sync pagination state BEFORE rendering the list, because renderTransactions
    // might call updatePaginationControls which reads state.totalPages.
    // -------------------------------------------------------------------------
    state.currentPage = data.pagination.page;
    state.totalPages = data.pagination.pages;

    // Render the transaction rows and update the pagination buttons
    renderTransactions(data.transactions);
    updatePaginationControls();
  } catch (err) {
    console.error("loadWalletData error:", err);
    showMessage("wallet-error-msg", err.message, true);

    // Show a friendly empty state in the table rather than leaving the spinner
    if (listEl) {
      listEl.innerHTML = `
        <tr>
          <td colspan="5" class="text-center text-muted py-4">
            Could not load transactions. Please try again.
          </td>
        </tr>`;
    }
  } finally {
    // Always reset loading flag so subsequent calls can proceed
    state.isLoading = false;
  }
}

// =============================================================================
// RENDER: renderTransactions(transactions)
// -----------------------------------------------------------------------------
// Takes an array of transaction objects from the API and builds the HTML rows
// for the transaction history table.
//
// WHY build HTML via template literals instead of using a framework?
// This project is vanilla JS + Bootstrap. For a list that re-renders on
// pagination, building a string of <tr> elements and setting innerHTML once
// is faster than creating/appending DOM nodes individually. It also avoids
// the flicker you'd get from removing and re-adding individual rows.
// =============================================================================
function renderTransactions(transactions) {
  const listEl = document.getElementById("transaction-list");
  if (!listEl) return;

  // Empty state — shown when the user has no transactions yet
  if (!transactions || transactions.length === 0) {
    listEl.innerHTML = `
      <tr>
        <td colspan="5" class="text-center text-muted py-5">
          <i class="bi bi-wallet2 fs-1 d-block mb-2"></i>
          No transactions yet. Complete a job to see your earnings here.
        </td>
      </tr>`;
    return;
  }

  // Build a row for each transaction. We map over the array and join the
  // resulting strings — no intermediate array allocation needed.
  listEl.innerHTML = transactions
    .map((tx) => {
      // -----------------------------------------------------------------------
      // Determine the badge colour and sign prefix for the amount based on the
      // transaction type. This is display logic only — the database always
      // stores amounts as positive numbers.
      // -----------------------------------------------------------------------
      const typeConfig = {
        credit: { badge: "bg-success", label: "Credit", sign: "+" },
        debit: { badge: "bg-danger", label: "Withdrawal", sign: "-" },
        escrow_in: { badge: "bg-warning text-dark", label: "Escrowed", sign: "-" },
        escrow_out: { badge: "bg-info text-dark", label: "Released", sign: "+" },
      };
      const config = typeConfig[tx.type] || {
        badge: "bg-secondary",
        label: tx.type,
        sign: "",
      };

      // Status badge — pending withdrawals get a different visual treatment
      const statusBadge =
        tx.status === "pending"
          ? `<span class="badge bg-warning text-dark ms-1">Pending</span>`
          : "";

      return `
        <tr>
          <td class="text-muted small">${formatDate(tx.createdAt)}</td>
          <td>${tx.description}${statusBadge}</td>
          <td><span class="badge ${config.badge}">${config.label}</span></td>
          <td class="fw-semibold ${tx.type === "credit" || tx.type === "escrow_out" ? "text-success" : "text-danger"}">
            ${config.sign}${formatCurrency(tx.amount)}
          </td>
          <td>
            <a href="#" 
               class="btn btn-sm btn-outline-secondary"
               onclick="viewTransactionDetail('${tx._id}'); return false;">
              View
            </a>
          </td>
        </tr>`;
    })
    .join("");
}

// =============================================================================
// RENDER: updatePaginationControls()
// -----------------------------------------------------------------------------
// Enables/disables the prev/next pagination buttons based on the current page.
// This reads from `state` which was already updated by loadWalletData().
// =============================================================================
function updatePaginationControls() {
  const prevBtn = document.getElementById("pagination-prev");
  const nextBtn = document.getElementById("pagination-next");
  const pageInfo = document.getElementById("pagination-info");

  if (pageInfo) {
    pageInfo.textContent = `Page ${state.currentPage} of ${state.totalPages}`;
  }

  // Disable prev on the first page; disable next on the last page.
  // Using the `disabled` attribute on <button> elements is both accessible
  // and prevents click events, so no extra guard needed in the handlers.
  if (prevBtn) prevBtn.disabled = state.currentPage <= 1;
  if (nextBtn) nextBtn.disabled = state.currentPage >= state.totalPages;
}

// =============================================================================
// ACTION: viewTransactionDetail(transactionId)
// -----------------------------------------------------------------------------
// Fetches a single transaction from the backend and shows it in a Bootstrap
// modal (or redirects to a detail page — payment.html can decide).
// Exposed on window so it's callable from the inline onclick in renderTransactions.
// =============================================================================
window.viewTransactionDetail = async function (transactionId) {
  try {
    const response = await fetch(
      `${API_BASE}/wallet/transactions/${transactionId}`,
      { headers: getAuthHeaders() }
    );

    if (handleAuthError(response)) return;

    if (!response.ok) {
      throw new Error("Could not load transaction details.");
    }

    const tx = await response.json();

    // -------------------------------------------------------------------------
    // Populate the detail modal. If payment.html doesn't have a modal,
    // you can replace this block with a redirect to a transaction-detail page.
    // The modal elements are named with a "txd-" prefix to avoid ID collisions.
    // -------------------------------------------------------------------------
    const setModal = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.textContent = val;
    };

    setModal("txd-description", tx.description);
    setModal("txd-amount", formatCurrency(tx.amount));
    setModal("txd-type", tx.type);
    setModal("txd-status", tx.status);
    setModal("txd-date", formatDate(tx.createdAt));
    setModal("txd-reference", tx.reference || "N/A (internal transfer)");

    // Trigger the Bootstrap modal — requires Bootstrap JS to be loaded in HTML
    const modalEl = document.getElementById("transactionDetailModal");
    if (modalEl && window.bootstrap) {
      new window.bootstrap.Modal(modalEl).show();
    }
  } catch (err) {
    console.error("viewTransactionDetail error:", err);
    showMessage("wallet-error-msg", err.message, true);
  }
};

// =============================================================================
// ACTION: handleWithdrawSubmit(event)
// -----------------------------------------------------------------------------
// Validates the withdrawal form and POSTs to /api/wallet/withdraw.
// Replaces any previous localStorage-based "mirage" withdrawal logic.
// =============================================================================
async function handleWithdrawSubmit(event) {
  event.preventDefault(); // Prevent the default HTML form POST

  const submitBtn = document.getElementById("withdraw-submit-btn");

  // Read form values — using .trim() to strip accidental whitespace
  const amountNaira = parseFloat(
    document.getElementById("withdraw-amount")?.value || "0"
  );
  const bankName = document.getElementById("withdraw-bank-name")?.value.trim();
  const accountNumber = document
    .getElementById("withdraw-account-number")
    ?.value.trim();
  const accountName = document
    .getElementById("withdraw-account-name")
    ?.value.trim();

  // -------------------------------------------------------------------------
  // Client-side validation — catch obvious errors before hitting the network.
  // The server validates too (defence in depth), but client validation gives
  // instant feedback and saves a round-trip.
  // -------------------------------------------------------------------------
  if (!amountNaira || amountNaira < 500) {
    return showMessage(
      "wallet-error-msg",
      "Minimum withdrawal is ₦500.",
      true
    );
  }
  if (!bankName || !accountNumber || !accountName) {
    return showMessage(
      "wallet-error-msg",
      "Please fill in all bank details.",
      true
    );
  }
  if (!/^\d{10}$/.test(accountNumber)) {
    return showMessage(
      "wallet-error-msg",
      "Account number must be exactly 10 digits.",
      true
    );
  }

  // Convert Naira to kobo before sending to the API.
  // The API always works in kobo to avoid floating-point issues.
  const amountInKobo = Math.round(amountNaira * 100);

  // Disable the button and show a loading state to prevent double-submission
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerHTML = `
      <span class="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true"></span>
      Processing...`;
  }

  try {
    const response = await fetch(`${API_BASE}/wallet/withdraw`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({
        amount: amountInKobo,
        bankName,
        accountNumber,
        accountName,
      }),
    });

    if (handleAuthError(response)) return;

    const data = await response.json();

    if (!response.ok) {
      // Server returned a validation error (e.g. insufficient balance)
      throw new Error(data.message || "Withdrawal request failed.");
    }

    // Success — show the confirmation message and reload the wallet data
    // so the updated balance and the new pending transaction appear immediately.
    showMessage("wallet-success-msg", data.message, false);

    // Reset the form fields
    document.getElementById("withdraw-form")?.reset();

    // Reload page 1 of the transaction history to show the new pending debit
    await loadWalletData(1);

    // Close the withdrawal modal if one is open
    const modalEl = document.getElementById("withdrawModal");
    if (modalEl && window.bootstrap) {
      window.bootstrap.Modal.getInstance(modalEl)?.hide();
    }
  } catch (err) {
    console.error("handleWithdrawSubmit error:", err);
    showMessage("wallet-error-msg", err.message, true);
  } finally {
    // Always re-enable the submit button regardless of success or failure
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = "Submit Withdrawal";
    }
  }
}

// =============================================================================
// BOOTSTRAP: DOMContentLoaded
// -----------------------------------------------------------------------------
// Entry point — wires up all event listeners once the DOM is ready.
// We do NOT use inline onXxx attributes in the HTML (except for the dynamic
// renderTransactions rows) because it couples markup to JS behaviour.
// =============================================================================
document.addEventListener("DOMContentLoaded", () => {
  // -------------------------------------------------------------------------
  // Guard: if there's no token in localStorage at all, don't even attempt
  // to load data — redirect straight to login. This prevents a flash of the
  // payment page before the 401 response comes back from the server.
  // -------------------------------------------------------------------------
  if (!localStorage.getItem("token")) {
    window.location.href = "login.html";
    return;
  }

  // Initial data load
  loadWalletData(1);

  // Wire up the withdrawal form submission
  document
    .getElementById("withdraw-form")
    ?.addEventListener("submit", handleWithdrawSubmit);

  // Wire up pagination buttons
  document.getElementById("pagination-prev")?.addEventListener("click", () => {
    if (state.currentPage > 1) loadWalletData(state.currentPage - 1);
  });

  document.getElementById("pagination-next")?.addEventListener("click", () => {
    if (state.currentPage < state.totalPages) loadWalletData(state.currentPage + 1);
  });
});
