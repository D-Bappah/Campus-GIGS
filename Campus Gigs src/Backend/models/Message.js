// =============================================================================
// models/Message.js
// -----------------------------------------------------------------------------
// Represents a single chat message sent between two users.
// Messages are grouped into "conversations" by a compound key of the two
// participant IDs sorted alphabetically. This avoids needing a separate
// Conversation collection for simple 1-on-1 chat.
//
// Conversation ID pattern:
//   conversationId = [userId1, userId2].sort().join("_")
// Both sides of the chat use the same conversationId to query the thread.
//
// [EXTERNAL ACTION REQUIRED] — Real-time delivery
// This model supports POLLING (client re-fetches every N seconds).
// For true real-time (instant delivery without polling), you need WebSockets:
//   1. npm install socket.io in the backend.
//   2. In server.js, wrap your HTTP server: const io = require('socket.io')(server)
//   3. On connection, join a room named after the conversationId.
//   4. After saving a message to MongoDB, emit it to the room:
//        io.to(conversationId).emit('new_message', savedMessage)
//   5. In message.js (frontend), connect via socket.io-client and listen for
//      'new_message' events to append them to the DOM in real time.
//   6. Remove the polling interval once sockets are live.
// =============================================================================

const mongoose = require("mongoose");

const MessageSchema = new mongoose.Schema(
  {
    // -------------------------------------------------------------------------
    // conversationId — the shared key linking both sides of a chat thread.
    // Format: sorted([senderId, receiverId]).join("_")
    // This is computed in the route before creating the document.
    // Indexed because every conversation fetch filters by this exact value.
    // -------------------------------------------------------------------------
    conversationId: {
      type: String,
      required: true,
      index: true,
    },

    // The user who sent this message
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // The user who receives this message
    receiver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // -------------------------------------------------------------------------
    // text — the message body. Plain text only for now.
    //
    // [EXTERNAL ACTION REQUIRED] — File/image attachments
    // Do NOT store files in MongoDB. For chat attachments (images, PDFs):
    //  1. Set up Cloudinary or AWS S3 (same setup as resume uploads).
    //  2. Add an `attachmentUrl` field to this schema.
    //  3. In the send-message route, add multer middleware.
    //  4. After uploading, store the CDN URL in attachmentUrl.
    //  5. In message.js, render <img> or <a> tags for attachments.
    // -------------------------------------------------------------------------
    text: {
      type: String,
      required: [true, "Message text cannot be empty."],
      trim: true,
      maxlength: [2000, "Message cannot exceed 2000 characters."],
    },

    // -------------------------------------------------------------------------
    // read — whether the receiver has seen this message.
    // Used to render the unread badge count in the nav and the conversation list.
    // When the receiver opens the conversation, we bulk-update all unread
    // messages in that thread to read: true.
    // -------------------------------------------------------------------------
    read: {
      type: Boolean,
      default: false,
      index: true, // indexed to make "count unread" queries fast
    },
  },
  { timestamps: true } // createdAt used as the message timestamp
);

// =============================================================================
// COMPOUND INDEX: conversationId + createdAt
// -----------------------------------------------------------------------------
// All conversation fetches sort by createdAt within a conversationId.
// This compound index covers both the filter and the sort in a single index
// scan, making it much faster than two separate indexes.
// =============================================================================
MessageSchema.index({ conversationId: 1, createdAt: 1 });

module.exports = mongoose.model("Message", MessageSchema);
