// =============================================================================
// -----------------------------------------------------------------------------
// All messaging endpoints.
// Base path (registered in server.js): /api/messages
// =============================================================================

const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const Message = require("../models/Message");
const User = require("../models/User");
const authMiddleware = require("../middleware/authMiddleware");

router.use(authMiddleware);

// =============================================================================
// HELPER: buildConversationId(idA, idB)
// -----------------------------------------------------------------------------
// Generates a deterministic conversation ID from two user ObjectIds.
// Sorting ensures that user A messaging user B and user B messaging user A
// both produce the same conversationId — they share one thread.
// =============================================================================
function buildConversationId(idA, idB) {
  return [idA.toString(), idB.toString()].sort().join("_");
}

// =============================================================================
// GET /api/messages/conversations
// -----------------------------------------------------------------------------
// Returns a list of all unique conversation threads for the current user,
// each with the latest message and unread count.
//
// This is used to render the conversation sidebar/list on message.html.
//
// Strategy: We use aggregation to group messages by conversationId, get the
// latest message per thread, and look up the counterparty's profile.
// =============================================================================
router.get("/conversations", async (req, res) => {
  try {
    const userId = req.user.id;

    const conversations = await Message.aggregate([
      {
        // Step 1: Find all messages where this user is sender OR receiver.
        // We cast userId to ObjectId because aggregation $match does NOT
        // do the automatic type coercion that Mongoose queries do.
        $match: {
          $or: [
            { sender: new mongoose.Types.ObjectId(userId) },
            { receiver: new mongoose.Types.ObjectId(userId) },
          ],
        },
      },
      {
        // Step 2: Sort all messages oldest→newest BEFORE grouping.
        // This ensures that within each group, the $last operator picks
        // the most recent message (since $last takes the final document in
        // each group's input stream).
        $sort: { createdAt: 1 },
      },
      {
        // Step 3: Group by conversationId to collapse individual messages
        // into one document per thread.
        $group: {
          _id: "$conversationId",
          lastMessage: { $last: "$$ROOT" }, // most recent message in thread
          unreadCount: {
            // Count messages in this thread that are unread AND sent to ME
            // (not sent by me — I don't want to count my own sent messages)
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ["$read", false] },
                    {
                      $eq: [
                        "$receiver",
                        new mongoose.Types.ObjectId(userId),
                      ],
                    },
                  ],
                },
                1,
                0,
              ],
            },
          },
        },
      },
      {
        // Step 4: Sort conversations newest-first (most recent message at top)
        $sort: { "lastMessage.createdAt": -1 },
      },
      {
        // Step 5: Look up the counterparty user profile.
        // We don't know which user in the conversationId is "me" vs "them",
        // so we look up both sender and receiver and merge them below.
        $lookup: {
          from: "users",
          localField: "lastMessage.sender",
          foreignField: "_id",
          as: "senderProfile",
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "lastMessage.receiver",
          foreignField: "_id",
          as: "receiverProfile",
        },
      },
      {
        // Step 6: Reshape the output to include only what the frontend needs.
        $project: {
          conversationId: "$_id",
          lastMessage: {
            text: "$lastMessage.text",
            createdAt: "$lastMessage.createdAt",
            senderId: "$lastMessage.sender",
          },
          unreadCount: 1,
          // Send both profiles; let the frontend filter out "me" to show "them"
          senderProfile: {
            $arrayElemAt: ["$senderProfile", 0],
          },
          receiverProfile: {
            $arrayElemAt: ["$receiverProfile", 0],
          },
        },
      },
    ]);

    res.json({ conversations });
  } catch (err) {
    console.error("GET /api/messages/conversations error:", err);
    res.status(500).json({ message: "Server error fetching conversations." });
  }
});

// =============================================================================
// GET /api/messages/:otherUserId
// -----------------------------------------------------------------------------
// Returns the full message history between the current user and otherUserId,
// sorted oldest to newest (natural reading order).
//
// Also marks all unread messages in this thread as read (the "seen" update).
// We do this server-side on open rather than requiring a separate PATCH call,
// because a message is considered read the moment the recipient loads the thread.
// =============================================================================
router.get("/:otherUserId", async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.otherUserId)) {
      return res.status(400).json({ message: "Invalid user ID." });
    }

    const conversationId = buildConversationId(
      req.user.id,
      req.params.otherUserId
    );

    // Mark all unread messages SENT TO ME in this thread as read.
    // We do this before fetching so the response reflects the updated state.
    // updateMany is a single DB round-trip regardless of how many messages exist.
    await Message.updateMany(
      {
        conversationId,
        receiver: req.user.id, // only mark messages addressed to me
        read: false,
      },
      { read: true }
    );

    // Fetch the full thread history, oldest first (for natural chat display)
    const messages = await Message.find({ conversationId })
      .populate("sender", "name avatarUrl")
      .populate("receiver", "name avatarUrl")
      .sort({ createdAt: 1 })
      .lean();

    // Also fetch the other user's profile for the chat header
    const otherUser = await User.findById(req.params.otherUserId)
      .select("name avatarUrl university")
      .lean();

    res.json({ messages, otherUser });
  } catch (err) {
    console.error("GET /api/messages/:otherUserId error:", err);
    res.status(500).json({ message: "Server error fetching messages." });
  }
});

// =============================================================================
// POST /api/messages/:otherUserId
// -----------------------------------------------------------------------------
// Sends a new message from the current user to otherUserId.
//
// [EXTERNAL ACTION REQUIRED] — Real-time delivery via WebSocket
// After saving to MongoDB, emit the message via Socket.io:
//   io.to(conversationId).emit('new_message', savedMessage)
// See Message.js schema file for full Socket.io integration instructions.
//
// [EXTERNAL ACTION REQUIRED] — File attachments
// See Message.js → text field comment for Cloudinary attachment instructions.
//
// Request body: { text: String }
// =============================================================================
router.post("/:otherUserId", async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.otherUserId)) {
      return res.status(400).json({ message: "Invalid recipient user ID." });
    }

    // Prevent messaging yourself
    if (req.params.otherUserId === req.user.id) {
      return res.status(400).json({ message: "You cannot message yourself." });
    }

    const { text } = req.body;

    if (!text || !text.trim()) {
      return res.status(400).json({ message: "Message text cannot be empty." });
    }

    // Verify the recipient exists so we don't create phantom conversations
    const recipientExists = await User.exists({ _id: req.params.otherUserId });
    if (!recipientExists) {
      return res.status(404).json({ message: "Recipient user not found." });
    }

    const conversationId = buildConversationId(
      req.user.id,
      req.params.otherUserId
    );

    const message = await Message.create({
      conversationId,
      sender: req.user.id,
      receiver: req.params.otherUserId,
      text: text.trim(),
    });

    // Populate sender info so the frontend can render the message bubble
    // immediately without a second request
    await message.populate("sender", "name avatarUrl");

    // [EXTERNAL ACTION REQUIRED]: Emit to Socket.io room here when ready
    // io.to(conversationId).emit('new_message', message);

    res.status(201).json(message);
  } catch (err) {
    console.error("POST /api/messages/:otherUserId error:", err);
    res.status(500).json({ message: "Server error sending message." });
  }
});

// =============================================================================
// GET /api/messages/unread/count
// -----------------------------------------------------------------------------
// Returns the total count of unread messages across ALL conversations.
// Used to update the notification badge on the Messages nav link.
// Kept as a lightweight endpoint so it can be polled frequently (every 30s)
// without significant DB load.
// =============================================================================
router.get("/unread/count", async (req, res) => {
  try {
    const count = await Message.countDocuments({
      receiver: req.user.id,
      read: false,
    });
    res.json({ unreadCount: count });
  } catch (err) {
    console.error("GET /api/messages/unread/count error:", err);
    res.status(500).json({ message: "Server error fetching unread count." });
  }
});

module.exports = router;
