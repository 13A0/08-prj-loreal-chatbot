// Paste the HTTPS URL of your deployed Cloudflare Worker here.
const WORKER_URL = "https://loreal-chatbot.giabaotruong06.workers.dev";
const MAX_HISTORY_MESSAGES = 12;
const MAX_REPLY_HISTORY_CHARS = 2000;

const chatForm = document.getElementById("chatForm");
const userInput = document.getElementById("userInput");
const chatWindow = document.getElementById("chatWindow");
const sendBtn = document.getElementById("sendBtn");
const newChatBtn = document.getElementById("newChatBtn");
const suggestions = document.getElementById("suggestions");
const chatStatus = document.getElementById("chatStatus");
const welcomeMessage = chatWindow.firstElementChild.cloneNode(true);

let history = [];
let waitingForReply = false;

function addMessage(role, text) {
  const bubble = document.createElement("p");
  bubble.className = role === "user" ? "msg user" : "msg ai";

  const speaker = document.createElement("span");
  speaker.className = "visually-hidden";
  speaker.textContent = role === "user" ? "You: " : "Advisor: ";

  bubble.append(speaker, document.createTextNode(text));
  chatWindow.append(bubble);
  chatWindow.scrollTop = chatWindow.scrollHeight;
  return bubble;
}

function setStatus(message = "", isError = false) {
  chatStatus.textContent = message;
  chatStatus.classList.toggle("error", isError);
}

chatForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const question = userInput.value.trim();
  if (!question || waitingForReply) return;

  if (!WORKER_URL) {
    setStatus(
      "Chat is offline until the Cloudflare Worker URL is set in script.js.",
      true,
    );
    return;
  }

  waitingForReply = true;
  userInput.readOnly = true;
  sendBtn.disabled = true;
  newChatBtn.disabled = true;
  suggestions.hidden = true;

  const userMessage = { role: "user", content: question };
  const questionBubble = addMessage("user", question);
  userInput.value = "";
  setStatus("Advisor is typing…");

  try {
    const response = await fetch(WORKER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: [...history, userMessage] }),
      signal: AbortSignal.timeout(25000),
    });

    if (response.status === 429) {
      throw new Error("The advisor is busy. Give it a moment, then try again.");
    }
    if (!response.ok) {
      throw new Error(
        "The advisor is unavailable right now. Please try again.",
      );
    }

    const { reply } = await response.json();
    if (typeof reply !== "string" || !reply.trim()) {
      throw new Error("The advisor returned an empty reply. Please try again.");
    }

    addMessage("assistant", reply);
    history = [
      ...history,
      userMessage,
      {
        role: "assistant",
        content: reply.slice(0, MAX_REPLY_HISTORY_CHARS),
      },
    ].slice(-MAX_HISTORY_MESSAGES);
    setStatus();
  } catch (error) {
    questionBubble.remove();
    userInput.value = question;
    suggestions.hidden = history.length > 0;
    const message =
      error.name === "TimeoutError"
        ? "The advisor took too long to respond. Please try again."
        : error instanceof TypeError || error instanceof SyntaxError
          ? "Couldn’t reach the advisor. Check your connection and try again."
          : error.message;
    setStatus(message, true);
  } finally {
    waitingForReply = false;
    userInput.readOnly = false;
    sendBtn.disabled = false;
    newChatBtn.disabled = history.length === 0;

    if (document.activeElement === document.body) userInput.focus();
  }
});

for (const button of suggestions.querySelectorAll("button")) {
  button.addEventListener("click", () => {
    userInput.value = button.dataset.question;
    userInput.focus();
    chatForm.requestSubmit();
  });
}

newChatBtn.addEventListener("click", () => {
  history = [];
  chatWindow.replaceChildren(welcomeMessage.cloneNode(true));
  chatWindow.scrollTop = 0;
  suggestions.hidden = false;
  userInput.value = "";
  setStatus();
  userInput.focus();
  newChatBtn.disabled = true;
});
