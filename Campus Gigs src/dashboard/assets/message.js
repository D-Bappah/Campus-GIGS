document.addEventListener('DOMContentLoaded', function () {
    // Elements
    const contentEmptyState = document.getElementById('contentEmptyState');
    const contentChatView = document.getElementById('contentChatView');
    const sidebarListState = document.getElementById('sidebarListState');
    const sidebarEmptyState = document.getElementById('sidebarEmptyState');
    const chatInput = document.querySelector('.chat-input');
    const chatBody = document.querySelector('.chat-body');

    // Select all conversation items
    const conversations = document.querySelectorAll('.conversation-item');

    // Add click event to conversations
    conversations.forEach(item => {
        item.addEventListener('click', function () {
            // Remove active class from all
            conversations.forEach(c => c.classList.remove('active'));
            // Add to clicked
            this.classList.add('active');

            // Open chat view
            openChat();
        });
    });

    function openChat() {
        if (contentEmptyState && contentChatView) {
            contentEmptyState.classList.add('d-none');
            contentChatView.classList.remove('d-none');
            // Scroll to bottom
            scrollToBottom();
        }
    }

    function scrollToBottom() {
        if (chatBody) {
            chatBody.scrollTop = chatBody.scrollHeight;
        }
    }

    // Chat Sending Logic
    // Ensuring the input exists before attaching listener
    if (chatInput) {
        chatInput.addEventListener('keypress', function (e) {
            if (e.key === 'Enter') {
                const text = this.value.trim();
                if (text !== '') {
                    sendMessage(text);
                    this.value = '';
                }
            }
        });
    }

    function sendMessage(text) {
        const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        const msgDiv = document.createElement('div');
        msgDiv.className = 'message-bubble sent';
        msgDiv.innerHTML = `${text}<span class="msg-time">${time}</span>`;

        if (chatBody) {
            chatBody.appendChild(msgDiv);
            scrollToBottom();
        }

        // Simulate a reply after 2 seconds (Optional, kept for "making sure it happens")
        setTimeout(() => {
            receiveMessage("Thanks! I received your message.");
        }, 2000);
    }

    function receiveMessage(text) {
        const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        const msgDiv = document.createElement('div');
        msgDiv.className = 'message-bubble received';
        msgDiv.innerHTML = `${text}<span class="msg-time">${time}</span>`;

        if (chatBody) {
            chatBody.appendChild(msgDiv);
            scrollToBottom();
        }
    }

    // Expose Simulation to Global Window
    // Usage: window.simulateIncomingMessage() to show the "instance" of receiving a message
    window.simulateIncomingMessage = function (senderName, messageText) {
        // 1. Switch sidebar to List View
        if (sidebarListState && sidebarEmptyState) {
            sidebarListState.classList.remove('d-none');
            sidebarEmptyState.classList.add('d-none');
        }

        // 2. Open Chat View (or stay in list if preferred, but simulating "active" receipt usually implies notification or view)
        // For this requirement ("make sure it implies..."), we'll just enable the view machinery.

        // If we also want to simulate the specific message arrival:
        if (contentChatView && !contentChatView.classList.contains('d-none')) {
            receiveMessage(messageText || "New incoming message!");
        } else {
            console.log("Message received in background. Toggle view to see.");
        }
    };

    // Ensure default state is set correctly (Empty)
    if (sidebarListState) sidebarListState.classList.add('d-none');
    if (sidebarEmptyState) sidebarEmptyState.classList.remove('d-none');
    if (contentChatView) contentChatView.classList.add('d-none');
    if (contentEmptyState) contentEmptyState.classList.remove('d-none');

});
