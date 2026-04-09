const connectApp = (site) => {
  try {
    const ws = new WebSocket("ws://localhost:8080");
    ws.onopen = () => {
      ws.send(JSON.stringify({ type: "distraction", site: site }));
      ws.close();
    };
  } catch (e) {
    console.log("Could not connect to Desktop app.");
  }
};

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "hit_distraction") {
    connectApp(message.site);
  }
});