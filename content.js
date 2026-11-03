(() => {
  const ID = "my-overlay-root";
  let enabled = false;
  let permission = false;
  let enabledChanged = false;
  let permissionChanged = false;
  let host = null;
  let panel = null;
  let timerDisplay = null;
  let startButton = null;
  let timerRemaining = 5 * 60;
  let timerDeadline = null;
  let timerInterval = null;

  function updatePanelColor() {
    if (panel) {
      panel.style.background = permission ? "green" : "red";
    }
  }

  function updateTimer() {
    if (!timerDisplay) {
      return;
    }

    if (timerDeadline !== null) {
      timerRemaining = Math.max(0, Math.ceil((timerDeadline - Date.now()) / 1000));
      if (timerRemaining === 0) {
        clearInterval(timerInterval);
        timerInterval = null;
        timerDeadline = null;
        startButton.disabled = false;
      }
    }

    startButton.disabled = timerDeadline !== null;
    const minutes = Math.floor(timerRemaining / 60);
    const seconds = timerRemaining % 60;
    timerDisplay.textContent = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }

  function resetTimer() {
    clearInterval(timerInterval);
    timerInterval = null;
    timerDeadline = null;
    timerRemaining = 5 * 60;
    if (startButton) {
      startButton.disabled = false;
    }
    updateTimer();
  }

  function render() {
    if (!enabled) {
      resetTimer();
      host?.remove();
      host = null;
      panel = null;
      timerDisplay = null;
      startButton = null;
      return;
    }

    if (host) {
      updatePanelColor();
      return;
    }

    host = document.createElement("div");
    host.id = ID;
    host.style.cssText = "position:fixed; bottom:15px; right:15px; z-index:2147483647;";

    const shadow = host.attachShadow({ mode: "open" });
    shadow.innerHTML = `
      <style>
        .overlay-stack {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 8px;
          color: white;
          font: 12px system-ui, sans-serif;
          user-select: none;
          -webkit-user-select: none;
        }
        .timer {
          box-sizing: border-box;
          width: 150px;
          padding: 10px;
          border-radius: 6px;
          background: #222;
          text-align: center;
        }
        .timer-display {
          display: block;
          margin-bottom: 8px;
          font-size: 24px;
          font-variant-numeric: tabular-nums;
        }
        .timer-controls {
          display: flex;
          justify-content: center;
          gap: 6px;
        }
        .timer-controls button {
          padding: 4px 10px;
          border: 0;
          border-radius: 3px;
          cursor: pointer;
          font: inherit;
        }
        .timer-controls button:disabled {
          cursor: default;
          opacity: 0.6;
        }
        .panel {
          box-sizing: content-box;
          color: white;
          padding: 10px;
          width: 50px;
          height: 50px;
          user-select: none;
          -webkit-user-select: none;
          text-align: center;
          display: flex;
          justify-content: center;
          align-items: center;
        }
      </style>
      <div class="overlay-stack">
        <section class="timer" aria-label="5 minute timer">
          <strong class="timer-display" role="timer" aria-live="off">05:00</strong>
          <div class="timer-controls">
            <button type="button" class="start-button">Start</button>
            <button type="button" class="reset-button">Reset</button>
          </div>
        </section>
        <div class="panel">
          <strong>Bathroom</strong>
        </div>
      </div>
    `;
    panel = shadow.querySelector(".panel");
    timerDisplay = shadow.querySelector(".timer-display");
    startButton = shadow.querySelector(".start-button");
    const resetButton = shadow.querySelector(".reset-button");
    updatePanelColor();
    updateTimer();

    startButton.addEventListener("click", () => {
      if (timerDeadline !== null || timerRemaining === 0) {
        return;
      }

      timerDeadline = Date.now() + timerRemaining * 1000;
      startButton.disabled = true;
      updateTimer();
      timerInterval = setInterval(updateTimer, 250);
    });

    resetButton.addEventListener("click", resetTimer);

    panel.addEventListener("click", () => {
      const previousPermission = permission;
      permission = !permission;
      updatePanelColor();

      chrome.storage.local.set({ permission }, () => {
        if (chrome.runtime.lastError) {
          console.error("Could not save the permission state:", chrome.runtime.lastError);
          permission = previousPermission;
          updatePanelColor();
        }
      });
    });

    document.documentElement.appendChild(host);
  }

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== "local") {
      return;
    }

    if (changes.enabled) {
      enabledChanged = true;
      enabled = changes.enabled.newValue === true;
    }
    if (changes.permission) {
      permissionChanged = true;
      permission = changes.permission.newValue === true;
    }
    render();
  });

  chrome.storage.local.get({ enabled: false, permission: false }, (settings) => {
    if (chrome.runtime.lastError) {
      console.error("Could not read the extension settings:", chrome.runtime.lastError);
      return;
    }

    if (!enabledChanged) {
      enabled = settings.enabled === true;
    }
    if (!permissionChanged) {
      permission = settings.permission === true;
    }
    render();
  });
})();