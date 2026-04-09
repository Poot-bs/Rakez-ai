fetch("http://localhost:8081/status")
  .then((response) => response.json())
  .then((data) => {
    if (data.focusMode) {
      chrome.runtime.sendMessage({ type: "hit_distraction", site: window.location.hostname });

      // ── 5-minute warning banner (top left) ──────────────────────
      let secondsLeft = 5 ;

      const banner = document.createElement("div");
      banner.style.cssText = `
        position: fixed;
        top: 16px;
        left: 16px;
        z-index: 999999;
        background: rgba(0, 0, 0, 0.85);
        color: white;
        font-family: sans-serif;
        padding: 12px 18px;
        border-radius: 10px;
        border-left: 4px solid #e94560;
        font-size: 14px;
        line-height: 1.6;
        backdrop-filter: blur(6px);
        box-shadow: 0 4px 20px rgba(0,0,0,0.4);
      `;

      const formatTime = (s) => {
        const m = Math.floor(s / 60);
        const sec = String(s % 60).padStart(2, "0");
        return `${m}:${sec}`;
      };

      const updateBanner = () => {
        banner.innerHTML = `
          ⚠️ <strong style="color:#e94560;">Focus Guardian</strong><br/>
          This page will be blocked in 
          <strong style="color:#ffcc00; font-size:16px;">${formatTime(secondsLeft)}</strong>
        `;
      };

      updateBanner();
      document.body.appendChild(banner);

      // ── Countdown ticker ────────────────────────────────────────
      const countdown = setInterval(() => {
        secondsLeft--;
        updateBanner();

        // Pulse red in the last 60 seconds
        if (secondsLeft <= 60) {
          banner.style.borderLeftColor = "#ff0000";
          banner.style.animation = "fg-pulse 1s infinite";
        }

        if (secondsLeft <= 0) {
          clearInterval(countdown);
          banner.remove();
          showBlockOverlay();
        }
      }, 1000);

      // ── Full block overlay (after 5 min) ────────────────────────
      function showBlockOverlay() {
        const overlay = document.createElement("div");
        overlay.style.cssText = `
          position: fixed;
          top: 0; left: 0;
          width: 100vw; height: 100vh;
          background-color: rgba(0, 0, 0, 0.95);
          color: white;
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          z-index: 999999;
          font-family: sans-serif;
        `;
        overlay.innerHTML = `
          <h1 style="color:#e94560; font-size:3rem;">Site Blocked by Focus Guardian</h1>
          <p style="font-size:1.5rem;">You are in focus mode. Please return to work.</p>
        `;
        document.body.appendChild(overlay);
      }
    }
  })
  .catch(() => {
    // Desktop app may be off, do nothing
  });