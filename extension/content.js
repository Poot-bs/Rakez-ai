fetch("http://localhost:8081/status")
  .then((response) => response.json())
  .then((data) => {
    if (data.focusMode) {
      // Notify backend immediately
      chrome.runtime.sendMessage({ type: "hit_distraction", site: window.location.hostname });

      // Render an overlay blocking the site
      const overlay = document.createElement("div");
      overlay.style.position = "fixed";
      overlay.style.top = "0";
      overlay.style.left = "0";
      overlay.style.width = "100vw";
      overlay.style.height = "100vh";
      overlay.style.backgroundColor = "rgba(0, 0, 0, 0.95)";
      overlay.style.color = "white";
      overlay.style.display = "flex";
      overlay.style.flexDirection = "column";
      overlay.style.justifyContent = "center";
      overlay.style.alignItems = "center";
      overlay.style.zIndex = "999999";
      overlay.style.fontFamily = "sans-serif";

      overlay.innerHTML = `
        <h1 style="color: #e94560; font-size: 3rem;">Site Blocked by Focus Guardian</h1>
        <p style="font-size: 1.5rem;">You are in focus mode. Please return to work.</p>
      `;

      document.body.appendChild(overlay);
    }
  })
  .catch((err) => {
    // Desktop app may be off, do nothing
  });