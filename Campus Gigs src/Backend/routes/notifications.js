// =============================================================================
// routes/notifications.js
// -----------------------------------------------------------------------------
// All notification endpoints.
// Base path (registered in server.js): /api/notifications
// =============================================================================

const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const Notification = require("../models/Notification");
const authMiddleware = require("../middleware/authMiddleware");

router.use(authMiddleware);

// =============================================================================
// GET /api/notifications
// -----------------------------------------------------------------------------
// Returns paginated notifications for the current user, newest first.
// Supports filtering by read status.
//
// Query params:
//   page   (default 1)
//   limit  (default 20)
//   unread (boolean) — if "true", only return unread notifications
// =============================================================================
router.get("/", async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    // Build the filter — always scope to this user's notifications
    const filter = { recipient: req.user.id };
    if (req.query.unread === "true") {
      filter.read = false;
    }

    // Run the fetch and count in parallel (same pattern as wallet summary)
    const [notifications, total, unreadCount] = await Promise.all([
      Notification.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),

      Notification.countDocuments(filter),

      // Always return the total unread count regardless of the current filter,
      // so the nav badge stays accurate even when viewing "all" notifications
      Notification.countDocuments({ recipient: req.user.id, read: false }),
    ]);

    res.json({
      notifications,
      unreadCount,
      pagination: {
        total,
        page,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    console.error("GET /api/notifications error:", err);
    res.status(500).json({ message: "Server error fetching notifications." });
  }
});

// =============================================================================
// PUT /api/notifications/:id/read
// -----------------------------------------------------------------------------
// Marks a single notification as read.
// Called when the user clicks a specific notification.
// =============================================================================
router.put("/:id/read", async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: "Invalid notification ID." });
    }

    const notification = await Notification.findOneAndUpdate(
      {
        _id: req.params.id,
        recipient: req.user.id, // ownership gate
      },
      { read: true },
      { new: true } // return the updated document so the frontend can confirm
    );

    if (!notification) {
      return res.status(404).json({ message: "Notification not found." });
    }

    res.json({ message: "Marked as read.", notification });
  } catch (err) {
    console.error("PUT /api/notifications/:id/read error:", err);
    res.status(500).json({ message: "Server error marking notification read." });
  }
});

// =============================================================================
// PUT /api/notifications/read-all
// -----------------------------------------------------------------------------
// Marks ALL unread notifications for the current user as read.
// Called by a "Mark all as read" button in the notifications dropdown.
//
// Uses updateMany for a single DB round-trip regardless of how many
// unread notifications exist.
// =============================================================================
router.put("/read-all", async (req, res) => {
  try {
    const result = await Notification.updateMany(
      { recipient: req.user.id, read: false },
      { read: true }
    );

    res.json({
      message: "All notifications marked as read.",
      updatedCount: result.modifiedCount,
    });
  } catch (err) {
    console.error("PUT /api/notifications/read-all error:", err);
    res.status(500).json({ message: "Server error marking all notifications read." });
  }
});

// =============================================================================
// DELETE /api/notifications/:id
// -----------------------------------------------------------------------------
// Permanently deletes a single notification.
// Optional UI feature — not all apps expose this.
// =============================================================================
router.delete("/:id", async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: "Invalid notification ID." });
    }

    const deleted = await Notification.findOneAndDelete({
      _id: req.params.id,
      recipient: req.user.id,
    });

    if (!deleted) {
      return res.status(404).json({ message: "Notification not found." });
    }

    res.json({ message: "Notification deleted." });
  } catch (err) {
    console.error("DELETE /api/notifications/:id error:", err);
    res.status(500).json({ message: "Server error deleting notification." });
  }
});

module.exports = router;
