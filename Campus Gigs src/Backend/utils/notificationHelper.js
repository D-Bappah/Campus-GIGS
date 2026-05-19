// A thin wrapper around Notification.createForUser() that encapsulates all
// the notification-creation calls across the app in one place.
//
// WHY a helper instead of calling Notification.createForUser() directly?
//   1. Single responsibility: route files handle HTTP; this file handles the
//      "what notification should fire for this event?" logic.
//   2. When push notifications (FCM/APNs) are added or email alerts later, I
//      add them here once — not scattered across every route file.
//   3. Notifications are non-critical side effects. If one fails, the main
//      action (accepting an application, completing a contract) should still
//      succeed. Centralising here makes it easy to wrap all calls in
//      try/catch without cluttering the route handlers.
//
// USAGE in a route file:
//   const notify = require('../utils/notificationHelper');
//   await notify.newApplication(job.postedBy, job, application);
//
// All functions are async and fire-and-forget safe (callers don't need to await
// them if the notification is non-critical, but awaiting is fine too).
// =============================================================================

const Notification = require("../models/Notification");

// =============================================================================
// INTERNAL HELPER: safeCreate(recipientId, type, message, link, relatedInfo)
// -----------------------------------------------------------------------------
// Wraps Notification.createForUser() in a try/catch so a notification failure
// never crashes the calling route. Logs the error for debugging but does not
// propagate it.
// =============================================================================
async function safeCreate(recipientId, type, message, link = null, relatedInfo = {}) {
  try {
    await Notification.createForUser(recipientId, type, message, link, relatedInfo);
  } catch (err) {
    // Log but do NOT re-throw — notifications are a non-critical side effect.
    // The main database operation (create contract, update status, etc.) has
    // already succeeded by the time we get here.
    console.error(`[NotificationHelper] Failed to create "${type}" notification:`, err.message);
  }
}

// =============================================================================
// EXPORTED NOTIFICATION TRIGGERS
// =============================================================================

const notify = {

  // ---------------------------------------------------------------------------
  // newApplication(clientId, job, application)
  // Called when: a freelancer submits a proposal on a job.
  // Recipient: the client who posted the job.
  // ---------------------------------------------------------------------------
  newApplication: (clientId, job, application) =>
    safeCreate(
      clientId,
      "new_application",
      `New proposal received for "${job.title}". Review it now.`,
      `job-details.html?id=${job._id}#applications`,
      { model: "Application", id: application._id }
    ),

  // ---------------------------------------------------------------------------
  // applicationAccepted(freelancerId, job, contract)
  // Called when: a client accepts a freelancer's bid.
  // Recipient: the winning freelancer.
  // ---------------------------------------------------------------------------
  applicationAccepted: (freelancerId, job, contract) =>
    safeCreate(
      freelancerId,
      "application_accepted",
      `Your proposal for "${job.title}" was accepted! A contract has been created.`,
      `contract-details.html?id=${contract._id}`,
      { model: "Contract", id: contract._id }
    ),

  // ---------------------------------------------------------------------------
  // applicationRejected(freelancerId, job)
  // Called when: a client rejects a freelancer's bid.
  // Recipient: the rejected freelancer.
  // ---------------------------------------------------------------------------
  applicationRejected: (freelancerId, job) =>
    safeCreate(
      freelancerId,
      "application_rejected",
      `Your proposal for "${job.title}" was not selected this time. Keep applying!`,
      `browse-jobs.html`,
      { model: "Job", id: job._id }
    ),

  // ---------------------------------------------------------------------------
  // contractCreated(clientId, freelancerId, contract, job)
  // Called when: a new contract document is created.
  // Recipients: BOTH parties get a notification.
  // ---------------------------------------------------------------------------
  contractCreated: async (clientId, freelancerId, contract, job) => {
    // Notify client
    await safeCreate(
      clientId,
      "contract_created",
      `Contract created for "${job.title}". Work begins now!`,
      `contract-details.html?id=${contract._id}`,
      { model: "Contract", id: contract._id }
    );
    // Notify freelancer (same event, slightly different message)
    await safeCreate(
      freelancerId,
      "contract_created",
      `Your contract for "${job.title}" is live. Good luck!`,
      `contract-details.html?id=${contract._id}`,
      { model: "Contract", id: contract._id }
    );
  },

  // ---------------------------------------------------------------------------
  // workSubmitted(clientId, contract, job)
  // Called when: the freelancer submits a deliverable for review.
  // Recipient: the client.
  // ---------------------------------------------------------------------------
  workSubmitted: (clientId, contract, job) =>
    safeCreate(
      clientId,
      "work_submitted",
      `The freelancer has submitted work for "${job.title}". Please review and approve.`,
      `contract-details.html?id=${contract._id}`,
      { model: "Contract", id: contract._id }
    ),

  // ---------------------------------------------------------------------------
  // contractCompleted(freelancerId, contract, job)
  // Called when: the client approves the deliverable and releases payment.
  // Recipient: the freelancer.
  // ---------------------------------------------------------------------------
  contractCompleted: (freelancerId, contract, job) =>
    safeCreate(
      freelancerId,
      "contract_completed",
      `The client approved your work on "${job.title}". Payment has been released to your wallet!`,
      `payment.html`,
      { model: "Contract", id: contract._id }
    ),

  // ---------------------------------------------------------------------------
  // contractDisputed(freelancerId, contract, job)
  // Called when: a client raises a dispute on submitted work.
  // Recipient: the freelancer.
  // ---------------------------------------------------------------------------
  contractDisputed: (freelancerId, contract, job) =>
    safeCreate(
      freelancerId,
      "contract_disputed",
      `The client raised a dispute on "${job.title}". An admin will review shortly.`,
      `contract-details.html?id=${contract._id}`,
      { model: "Contract", id: contract._id }
    ),

  // ---------------------------------------------------------------------------
  // contractCancelled(clientId, freelancerId, contract, job)
  // Called when: either party cancels a contract.
  // Recipients: BOTH parties.
  // ---------------------------------------------------------------------------
  contractCancelled: async (clientId, freelancerId, contract, job) => {
    await safeCreate(
      clientId,
      "contract_cancelled",
      `Contract for "${job.title}" has been cancelled. Your escrow has been refunded.`,
      `work.html`,
      { model: "Contract", id: contract._id }
    );
    await safeCreate(
      freelancerId,
      "contract_cancelled",
      `Contract for "${job.title}" has been cancelled.`,
      `work.html`,
      { model: "Contract", id: contract._id }
    );
  },

  // ---------------------------------------------------------------------------
  // newMessage(recipientId, senderName)
  // Called when: a new message is sent. Fallback for users without WebSockets.
  // Used sparingly — if WebSockets are active, skip this to avoid spam.
  // ---------------------------------------------------------------------------
  newMessage: (recipientId, senderName) =>
    safeCreate(
      recipientId,
      "new_message",
      `New message from ${senderName}.`,
      `message.html`,
      {}
    ),

  // ---------------------------------------------------------------------------
  // paymentReceived(userId, amountNaira)
  // Called when: a credit is added to a user's wallet.
  // ---------------------------------------------------------------------------
  paymentReceived: (userId, amountNaira) =>
    safeCreate(
      userId,
      "payment_received",
      `₦${amountNaira.toLocaleString()} has been credited to your wallet.`,
      `payment.html`,
      {}
    ),

  // ---------------------------------------------------------------------------
  // withdrawalProcessed(userId, amountNaira)
  // Called when: a withdrawal is confirmed by the payment gateway webhook.
  // ---------------------------------------------------------------------------
  withdrawalProcessed: (userId, amountNaira) =>
    safeCreate(
      userId,
      "withdrawal_processed",
      `Your withdrawal of ₦${amountNaira.toLocaleString()} has been processed.`,
      `payment.html`,
      {}
    ),
};

module.exports = notify;
