const API_BASE = "http://localhost:5000/api";
const SOCKET_URL = "http://localhost:5000";

let activeConversationUserId = null;
let activeConversationId = null;
let socket = null;

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

function initSocket() {
  socket = io(SOCKET_URL, { withCredentials: true });
}

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
        const sender = conv.senderProfile;
        const receiver = conv.receiverProfile;
        const other = sender?._id?.toString() === currentUserId ? receiver : sender;
        const isActive = other?._id?.toString() === activeConversationUserId;

        return `
          <div class="conversation-item p-3 border-bottom d-flex align-items-center gap-2
                      ${isActive ? "bg-light" : ""} cursor-pointer"
               onclick="openConversation('${other?._id}')">
            <img src="${other?.avatarUrl || "assets/images/default-avatar.png"}"
                 alt="${other?.name}"
                 class="rounded-circle"
                 width="40" height="40"
                 style="object-fit: cover;">
            <div class="flex-grow-1 overflow-hidden">
              <div class="d-flex justify-content-between">
                <strong class="text-truncate">${other?.displayName || other?.firstName || "Unknown"}</strong>
                <small class="text-muted text-nowrap ms-1">
                  ${formatConversationDate(conv.lastMessage?.createdAt)}
                </small>
              </div>
              <div class="d-flex justify-content-between align-items-center">
                <small class="text-muted text-truncate">
                  ${conv.lastMessage?.text || ""}
                </small>
                ${conv.unreadCount > 0
                  ? `<span class="badge bg-primary rounded-pill ms-1">${conv.unreadCount}</span>`
                  : ""}
              </div>
            </div>
          </div>`;
      })
      .join("");

    const totalUnread = conversations.reduce((sum, c) => sum + (c.unreadCount || 0), 0);
    updateGlobalUnreadBadge(totalUnread);
  } catch (err) {
    console.error("loadConversationList error:", err);
    const listEl = document.getElementById("conversation-list");
    if (listEl) listEl.innerHTML = `<p class="text-danger p-3">${err.message}</p>`;
  }
}

window.openConversation = async function (otherUserId) {
  if (!otherUserId) return;

  // Leave the previous socket room
  if (activeConversationId) {
    socket?.emit('leave_conversation', activeConversationId);
  }

  activeConversationUserId = otherUserId;
  activeConversationId = [getCurrentUserId(), otherUserId].sort().join("_");

  // Join the new room
  socket?.emit('join_conversation', activeConversationId);

  const url = new URL(window.location);
  url.searchParams.set("with", otherUserId);
  window.history.pushState({}, "", url);

  const chatEl = document.getElementById("chat-messages");
  if (chatEl) chatEl.innerHTML = `
    <div class="text-center py-5">
      <div class="spinner-border text-primary" role="status"></div>
    </div>`;

  await fetchAndRenderMessages(otherUserId);
  await loadConversationList();

  const input = document.getElementById("message-input");
  const btn = document.getElementById("message-send-btn");
  if (input) input.disabled = false;
  if (btn) btn.disabled = false;
};

async function fetchAndRenderMessages(otherUserId) {
  try {
    const response = await fetch(`${API_BASE}/messages/${otherUserId}`, {
      headers: getAuthHeaders(),
    });

    if (handleAuthError(response)) return;
    if (!response.ok) throw new Error("Failed to load messages.");

    const { messages, otherUser } = await response.json();
    renderChatHeader(otherUser);
    renderMessages(messages);
  } catch (err) {
    console.error("fetchAndRenderMessages error:", err);
  }
}

function appendMessageBubble(msg) {
  const chatEl = document.getElementById("chat-messages");
  if (!chatEl) return;

  const currentUserId = getCurrentUserId();
  const isMe = msg.sender?._id?.toString() === currentUserId || msg.sender?.toString() === currentUserId;
  const senderName = msg.sender?.displayName || msg.sender?.firstName || "Unknown";
  const avatar = msg.sender?.avatarUrl || "assets/images/default-avatar.png";

  // Remove "no messages" placeholder if present
  const placeholder = chatEl.querySelector('.text-center.text-muted');
  if (placeholder) placeholder.remove();

  const bubble = document.createElement('div');
  bubble.className = `d-flex ${isMe ? "justify-content-end" : "justify-content-start"} mb-2`;
  bubble.innerHTML = `
    ${!isMe ? `<img src="${avatar}" class="rounded-circle me-2 align-self-end" width="28" height="28" style="object-fit:cover;" alt="${senderName}">` : ""}
    <div class="mw-75">
      <div class="px-3 py-2 rounded-3 ${isMe ? "bg-primary text-white" : "bg-light border"}">
        ${msg.text}
      </div>
      <small class="text-muted d-block ${isMe ? "text-end" : ""}">
        ${formatTime(msg.createdAt)}
      </small>
    </div>
    ${isMe ? `<img src="${avatar}" class="rounded-circle ms-2 align-self-end" width="28" height="28" style="object-fit:cover;" alt="You">` : ""}
  `;
  chatEl.appendChild(bubble);
  chatEl.scrollTop = chatEl.scrollHeight;
}

function renderChatHeader(otherUser) {
  const headerEl = document.getElementById("chat-header");
  if (!headerEl || !otherUser) return;

  headerEl.innerHTML = `
    <img src="${otherUser.avatarUrl || "assets/images/default-avatar.png"}"
         alt="${otherUser.displayName || otherUser.firstName}"
         class="rounded-circle me-2"
         width="36" height="36"
         style="object-fit: cover;">
    <div>
      <strong>${otherUser.displayName || otherUser.firstName}</strong>
      <small class="text-muted d-block">${otherUser.university || ""}</small>
    </div>`;
}

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
      const senderName = msg.sender?.displayName || msg.sender?.firstName || "Unknown";
      const avatar = msg.sender?.avatarUrl || "assets/images/default-avatar.png";

      return `
        <div class="d-flex ${isMe ? "justify-content-end" : "justify-content-start"} mb-2">
          ${!isMe ? `<img src="${avatar}" class="rounded-circle me-2 align-self-end" width="28" height="28" style="object-fit:cover;" alt="${senderName}">` : ""}
          <div class="mw-75">
            <div class="px-3 py-2 rounded-3 ${isMe ? "bg-primary text-white" : "bg-light border"}">
              ${msg.text}
            </div>
            <small class="text-muted d-block ${isMe ? "text-end" : ""}">
              ${formatTime(msg.createdAt)}
              ${isMe && msg.read ? " · Seen" : ""}
            </small>
          </div>
          ${isMe ? `<img src="${avatar}" class="rounded-circle ms-2 align-self-end" width="28" height="28" style="object-fit:cover;" alt="You">` : ""}
        </div>`;
    })
    .join("");

  chatEl.scrollTop = chatEl.scrollHeight;
}

async function sendMessage(event) {
  event.preventDefault();

  if (!activeConversationUserId) return;

  const input = document.getElementById("message-input");
  const text = input?.value.trim();

  if (!text) return;
  input.value = "";

  try {
    const response = await fetch(`${API_BASE}/messages/${activeConversationUserId}`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({ text }),
    });

    if (handleAuthError(response)) return;

    if (!response.ok) {
      const err = await response.json();
      if (input) input.value = text;
      alert(err.message || "Failed to send message.");
      return;
    }

    // Socket will echo the message back via 'new_message' event;
    // no need to re-fetch the full thread
  } catch (err) {
    console.error("sendMessage error:", err);
    if (input) input.value = text;
    alert("Network error. Please check your connection.");
  }
}

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

document.addEventListener("DOMContentLoaded", async () => {
  if (!localStorage.getItem("token")) {
    window.location.href = "login.html";
    return;
  }

  initSocket();

  socket.on('new_message', (msg) => {
    const convId = [getCurrentUserId(), activeConversationUserId].sort().join("_");
    if (msg.conversationId === convId) {
      appendMessageBubble(msg);
    }
    loadConversationList();
  });

  const input = document.getElementById("message-input");
  const btn = document.getElementById("message-send-btn");
  if (input) {
    input.disabled = true;
    input.placeholder = "Select a conversation to start chatting...";
  }
  if (btn) btn.disabled = true;

  document.getElementById("message-form")?.addEventListener("submit", sendMessage);

  input?.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      sendMessage(e);
    }
  });

  await loadConversationList();

  const targetUserId = new URLSearchParams(window.location.search).get("with");
  if (targetUserId) {
    await openConversation(targetUserId);
  }
});
