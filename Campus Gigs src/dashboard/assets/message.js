// =============================================================================
// frontend/js/message.js
// -----------------------------------------------------------------------------
// Handles the messaging UI on message.html.
//
// Layout assumed:
//   #conversation-list        — sidebar list of all conversation threads
//   #chat-header              — header showing the other user's name/avatar
//   #chat-messages            — scrollable area containing message bubbles
//   #message-form             — the send-message form at the bottom
//   #message-input            — textarea for typing a new message
//   #message-send-btn         — submit button inside the form
//   #unread-badge             — nav badge showing total unread messages
//
// The URL can optionally include ?with=<userId> to open a specific conversation
// on page load (e.g. when clicking "Message" from a user's profile page).
//
// [EXTERNAL ACTION REQUIRED] — Real-time (WebSockets)
// Currently uses polling (setInterval) to check for new messages every 10s.
// This is functional but not instant. Replace with Socket.io when ready.
// See Message.js in the backend for full Socket.io integration instructions.
//
// [EXTERNAL ACTION REQUIRED] — File attachments
// The HTML may include a file input. DO NOT handle uploads here.
// See Message.js → text field comment for Cloudinary attachment instructions.
// =============================================================================

const API_BASE = "http://localhost:5000/api";

// Currently open conversation partner's user ID
let activeConversationUserId = null;

// Polling interval handle — stored so we can clear it when switching threads
let pollingInterval = null;

// =============================================================================
// UTILITIES
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

// Decode the JWT to get the current user's ID.
// Needed to distinguish "my" bubbles (right-aligned) from "theirs" (left).
function getCurrentUserId() {
  try {
    const payload = JSON.parse(atob(localStorage.getItem("token").split(".")[1]));
    return payload.id || payload._id || payload.sub;
  } catch {
    return null;
  }
}

function formatTime(isoString) {
  return new Date(isoString).toLocaleTimeString("en-NG", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatConversationDate(isoString) {
  const date = new Date(isoString);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  if (date.toDateString() === today.toDateString()) return "Today";
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
  return date.toLocaleDateString("en-NG", { month: "short", day: "numeric" });
}

// =============================================================================
// CORE: loadConversationList()
// Fetches all conversation threads and renders them in the sidebar.
// Called once on page load and whenever we want to refresh unread counts.
// =============================================================================
async function loadConversationList() {
  const listEl = document.getElementById("conversation-list");
  if (!listEl) return;

  try {
    const response = await fetch(`${API_BASE}/messages/conversations`, {
      headers: getAuthHeaders(),
    });

    if (handleAuthError(response)) return;
    if (!response.ok) throw new Error("Failed to load conversations.");

    const { conversations } = await response.json();

    if (!conversations.length) {
      listEl.innerHTML = `
        <div class="text-center text-muted p-4">
          <i class="bi bi-chat-square-text fs-2 d-block mb-2"></i>
          No messages yet.
        </div>`;
      return;
    }

    const currentUserId = getCurrentUserId();

    listEl.innerHTML = conversations
      .map((conv) => {
        // -----------------------------------------------------------------------
        // Determine which profile is "the other person" in this conversation.
        // The server sends both sender and receiver profiles; we pick the one
        // that is NOT the current user.
        // -----------------------------------------------------------------------
        const sender = conv.senderProfile;
        const receiver = conv.receiverProfile;
        const other =
          sender?._id?.toString() === currentUserId ? receiver : sender;

        const isActive = other?._id?.toString() === activeConversationUserId;

        return `
          <div class="conversation-item p-3 border-bottom d-flex align-items-center gap-2 
                      ${isActive ? "bg-light" : ""} 
                      cursor-pointer"
               onclick="openConversation('${other?._id}')">
            <img src="${other?.avatarUrl || "assets/images/default-avatar.png"}"
                 alt="${other?.name}"
                 class="rounded-circle"
                 width="40" height="40"
                 style="object-fit: cover;">
            <div class="flex-grow-1 overflow-hidden">
              <div class="d-flex justify-content-between">
                <strong class="text-truncate">${other?.name || "Unknown"}</strong>
                <small class="text-muted text-nowrap ms-1">
                  ${formatConversationDate(conv.lastMessage?.createdAt)}
                </small>
              </div>
              <div class="d-flex justify-content-between align-items-center">
                <small class="text-muted text-truncate">
                  ${conv.lastMessage?.text || ""}
                </small>
                ${
                  conv.unreadCount > 0
                    ? `<span class="badge bg-primary rounded-pill ms-1">${conv.unreadCount}</span>`
                    : ""
                }
              </div>
            </div>
          </div>`;
      })
      .join("");

    // Update the total unread badge in the nav
    const totalUnread = conversations.reduce(
      (sum, c) => sum + (c.unreadCount || 0),
      0
    );
    updateGlobalUnreadBadge(totalUnread);
  } catch (err) {
    console.error("loadConversationList error:", err);
    const listEl = document.getElementById("conversation-list");
    if (listEl)
      listEl.innerHTML = `<p class="text-danger p-3">${err.message}</p>`;
  }
}

// =============================================================================
// CORE: openConversation(otherUserId)
// Opens a chat thread with the specified user.
// Updates the active state, fetches messages, starts the polling loop.
// Exposed on window so it's callable from the inline onclick in the sidebar.
// =============================================================================
window.openConversation = async function (otherUserId) {
  if (!otherUserId) return;

  // Clear any existing poll for the previous conversation
  if (pollingInterval) clearInterval(pollingInterval);

  activeConversationUserId = otherUserId;

  // Update the URL without reloading so the user can bookmark/share the link
  const url = new URL(window.location);
  url.searchParams.set("with", otherUserId);
  window.history.pushState({}, "", url);

  // Show a loading state in the chat area
  const chatEl = document.getElementById("chat-messages");
  if (chatEl) chatEl.innerHTML = `
    <div class="text-center py-5">
      <div class="spinner-border text-primary" role="status"></div>
    </div>`;

  await fetchAndRenderMessages(otherUserId);

  // Re-render the sidebar to update the active highlight and clear unread badges
  await loadConversationList();

  // Enable the message input now that a conversation is active
  const input = document.getElementById("message-input");
  const btn = document.getElementById("message-send-btn");
  if (input) input.disabled = false;
  if (btn) btn.disabled = false;

  // -------------------------------------------------------------------------
  // Start polling for new messages every 10 seconds.
  // This is a simple but functional substitute for WebSockets.
  // It means messages appear within 10s of being sent, which is acceptable
  // for a student marketplace but not for a real-time chat app.
  //
  // [EXTERNAL ACTION REQUIRED]: Replace this interval with a Socket.io listener:
  //   socket.on('new_message', (msg) => appendMessageBubble(msg))
  // -------------------------------------------------------------------------
  pollingInterval = setInterval(
    () => fetchAndRenderMessages(otherUserId),
    10000
  );
};

// =============================================================================
// CORE: fetchAndRenderMessages(otherUserId)
// Fetches the latest message history and updates the chat UI.
// Called both on conversation open and by the polling interval.
// =============================================================================
async function fetchAndRenderMessages(otherUserId) {
  try {
    const response = await fetch(`${API_BASE}/messages/${otherUserId}`, {
      headers: getAuthHeaders(),
    });

    if (handleAuthError(response)) return;
    if (!response.ok) throw new Error("Failed to load messages.");

    const { messages, otherUser } = await response.json();

    // Update the chat header with the other user's info
    renderChatHeader(otherUser);

    // Render message bubbles
    renderMessages(messages);
  } catch (err) {
    console.error("fetchAndRenderMessages error:", err);
  }
}

// =============================================================================
// RENDER: renderChatHeader(otherUser)
// Populates the chat panel header with the conversation partner's info.
// =============================================================================
function renderChatHeader(otherUser) {
  const headerEl = document.getElementById("chat-header");
  if (!headerEl || !otherUser) return;

  headerEl.innerHTML = `
    <img src="${otherUser.avatarUrl || "assets/images/default-avatar.png"}"
         alt="${otherUser.name}"
         class="rounded-circle me-2"
         width="36" height="36"
         style="object-fit: cover;">
    <div>
      <strong>${otherUser.name}</strong>
      <small class="text-muted d-block">${otherUser.university || ""}</small>
    </div>`;
}

// =============================================================================
// RENDER: renderMessages(messages)
// Renders all messages in the active chat thread.
// "My" messages appear on the right (justify-content-end), others on the left.
//
// After rendering, scrolls to the bottom so the user sees the newest message
// without having to scroll manually.
// =============================================================================
function renderMessages(messages) {
  const chatEl = document.getElementById("chat-messages");
  if (!chatEl) return;

  const currentUserId = getCurrentUserId();

  if (!messages.length) {
    chatEl.innerHTML = `
      <div class="text-center text-muted py-5">
        No messages yet. Say hello!
      </div>`;
    return;
  }

  chatEl.innerHTML = messages
    .map((msg) => {
      const isMe = msg.sender._id?.toString() === currentUserId ||
                   msg.sender?.toString() === currentUserId;
      const senderName = msg.sender?.name || "Unknown";
      const avatar = msg.sender?.avatarUrl || "assets/images/default-avatar.png";

      return `
        <div class="d-flex ${isMe ? "justify-content-end" : "justify-content-start"} mb-2">
          ${
            !isMe
              ? `<img src="${avatar}" class="rounded-circle me-2 align-self-end"
                      width="28" height="28" style="object-fit:cover;" alt="${senderName}">`
              : ""
          }
          <div class="mw-75">
            <div class="px-3 py-2 rounded-3
                        ${isMe ? "bg-primary text-white" : "bg-light border"}">
              ${msg.text}
            </div>
            <small class="text-muted d-block ${isMe ? "text-end" : ""}">
              ${formatTime(msg.createdAt)}
              ${isMe && msg.read ? " · Seen" : ""}
            </small>
          </div>
          ${
            isMe
              ? `<img src="${avatar}" class="rounded-circle ms-2 align-self-end"
                      width="28" height="28" style="object-fit:cover;" alt="You">`
              : ""
          }
        </div>`;
    })
    .join("");

  // Scroll to the bottom of the chat area so the newest message is visible.
  // We set scrollTop to scrollHeight rather than using scrollIntoView() to
  // avoid disrupting the page-level scroll position on mobile.
  chatEl.scrollTop = chatEl.scrollHeight;
}

// =============================================================================
// ACTION: sendMessage(event)
// Handles the send-message form submission.
// =============================================================================
async function sendMessage(event) {
  event.preventDefault();

  if (!activeConversationUserId) return;

  const input = document.getElementById("message-input");
  const text = input?.value.trim();

  if (!text) return;

  // Optimistically clear the input so the user can keep typing
  // while the request is in flight
  input.value = "";

  try {
    const response = await fetch(
      `${API_BASE}/messages/${activeConversationUserId}`,
      {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({ text }),
      }
    );

    if (handleAuthError(response)) return;

    if (!response.ok) {
      const err = await response.json();
      // Restore the message text if send failed
      if (input) input.value = text;
      alert(err.message || "Failed to send message.");
      return;
    }

    // Immediately re-fetch the thread to show the sent message.
    // A slight delay is acceptable here since we just sent the message;
    // the polling interval would catch it within 10s anyway.
    await fetchAndRenderMessages(activeConversationUserId);
  } catch (err) {
    console.error("sendMessage error:", err);
    if (input) input.value = text; // Restore on network failure
    alert("Network error. Please check your connection.");
  }
}

// =============================================================================
// UTILITY: updateGlobalUnreadBadge(count)
// Updates the unread count badge on the navigation bar's Messages link.
// =============================================================================
function updateGlobalUnreadBadge(count) {
  const badge = document.getElementById("unread-badge");
  if (!badge) return;
  if (count > 0) {
    badge.textContent = count > 99 ? "99+" : count;
    badge.classList.remove("d-none");
  } else {
    badge.classList.add("d-none");
  }
}

// =============================================================================
// BOOTSTRAP: DOMContentLoaded
// =============================================================================
document.addEventListener("DOMContentLoaded", async () => {
  if (!localStorage.getItem("token")) {
    window.location.href = "login.html";
    return;
  }

  // Disable the message input until a conversation is selected
  const input = document.getElementById("message-input");
  const btn = document.getElementById("message-send-btn");
  if (input) {
    input.disabled = true;
    input.placeholder = "Select a conversation to start chatting...";
  }
  if (btn) btn.disabled = true;

  // Wire up the send form
  document
    .getElementById("message-form")
    ?.addEventListener("submit", sendMessage);

  // Also allow Ctrl+Enter / Cmd+Enter to send (ergonomic shortcut)
  input?.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      sendMessage(e);
    }
  });

  // Load the conversation list sidebar
  await loadConversationList();

  // If the URL contains ?with=<userId>, open that conversation automatically.
  // This handles links from profile pages: "Message this user"
  const targetUserId = new URLSearchParams(window.location.search).get("with");
  if (targetUserId) {
    await openConversation(targetUserId);
  }
});
