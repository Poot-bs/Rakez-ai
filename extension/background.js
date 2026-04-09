const connectApp = (payload) => {
  try {
    const ws = new WebSocket("ws://localhost:8080");
    ws.onopen = () => {
      ws.send(JSON.stringify(payload));
      ws.close();
    };
  } catch (e) {
    console.log("Could not connect to Desktop app.");
  }
};

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "hit_distraction") {
    connectApp({
      type: "distraction",
      site: message.site,
      title: message.title || ''
    });
  }

  if (message.type === "context_signal") {
    connectApp({
      type: "context",
      site: message.site,
      title: message.title || ''
    });
  }
});