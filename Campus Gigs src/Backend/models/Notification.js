// =============================================================================
// models/Notification.js
// -----------------------------------------------------------------------------
// Stores in-app alert events for users — new application received, contract
// completed, message received, etc.
//
// Notifications are written by the server when significant events occur
// (e.g. inside the jobs route when an application is accepted) and read
// by the frontend on a polling interval or on-demand.
//
// Design decision: We store notifications as individual documents rather than
// embedding an array in the User model. This keeps User documents small and
// avoids the MongoDB 16MB document size limit if a power user accumulates
// thousands of notifications. It also lets us query, paginate, and delete
// notifications independently.
// =============================================================================

const mongoose = require("mongoose");

const NotificationSchema = new mongoose.Schema(
  {
    // The user who should see this notification
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    // -------------------------------------------------------------------------
    // type — a machine-readable event category. Used by the frontend to render
    // the appropriate icon and colour without parsing the message string.
    // -------------------------------------------------------------------------
    type: {
      type: String,
      enum: [
        "new_application",   // client received a bid on their job
        "application_accepted", // freelancer's bid was accepted
        "application_rejected", // freelancer's bid was rejected
        "contract_created",  // contract was initialised
        "work_submitted",    // freelancer submitted deliverable for review
        "contract_completed",// client approved work; payment released
        "contract_disputed", // client raised a dispute
        "contract_cancelled",// contract was cancelled
        "new_message",       // received a chat message (fallback if no WebSocket)
        "payment_received",  // credit added to wallet
        "withdrawal_processed", // withdrawal completed
        "system",            // generic system-level alert
      ],
      required: true,
    },

    // Human-readable message shown in the notification dropdown
    message: {
      type: String,
      required: true,
      maxlength: 300,
    },

    // -------------------------------------------------------------------------
    // link — the URL the user should navigate to when clicking the notification.
    // Frontend-relative paths (e.g. "contract-details.html?id=xxxx").
    // Stored as a string rather than a reference so it's flexible — not all
    // notifications link to a MongoDB document.
    // -------------------------------------------------------------------------
    link: {
      type: String,
      default: null,
    },

    // Whether the user has seen/dismissed this notification
    read: {
      type: Boolean,
      default: false,
      index: true, // indexed to make "unread count" queries fast
    },

    // Optional reference to the related document (for context in future features)
    relatedModel: {
      type: String,
      enum: ["Job", "Contract", "Application", "Message", null],
      default: null,
    },
    relatedId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
  },
  { timestamps: true }
);

// =============================================================================
// STATIC METHOD: createForUser(recipientId, type, message, link, relatedInfo?)
// -----------------------------------------------------------------------------
// Factory method to create a notification. Using a static method means all
// the callers in other route files don't need to import and construct the
// object shape manually — they just call Notification.createForUser(...).
// =============================================================================
NotificationSchema.statics.createForUser = function (
  recipientId,
  type,
  message,
  link = null,
  relatedInfo = {}
) {
  return this.create({
    recipient: recipientId,
    type,
    message,
    link,
    relatedModel: relatedInfo.model || null,
    relatedId: relatedInfo.id || null,
  });
};

module.exports = mongoose.model("Notification", NotificationSchema);
