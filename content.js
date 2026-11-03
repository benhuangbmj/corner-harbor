(() => {
  const ID = "my-overlay-root";
  const TIMER_DURATION = 5 * 60;
  const DEFAULT_TIMER_STATE = { remaining: TIMER_DURATION, deadline: null };
  let enabled = false;
  let permission = false;
  let enabledChanged = false;
  let permissionChanged = false;
  let timerStateChanged = false;
  let host = null;
  let panel = null;
  let timerDisplay = null;
  let startButton = null;
  let timerRemaining = TIMER_DURATION;
  let timerDeadline = null;
  let timerInterval = null;

  function updatePanelColor() {
    if (panel) {
      panel.style.background = permission ? "green" : "red";
    }
  }

  function updateTimer() {
    if (timerDeadline !== null) {
      timerRemaining = Math.max(0, Math.ceil((timerDeadline - Date.now()) / 1000));
      if (timerRemaining === 0) {
        clearInterval(timerInterval);
        timerInterval = null;
        timerDeadline = null;
        saveTimerState();
      }
    }

    if (!timerDisplay) {
      return;
    }

    startButton.disabled = timerDeadline !== null || timerRemaining === 0;
    const minutes = Math.floor(timerRemaining / 60);
    const seconds = timerRemaining % 60;
    timerDisplay.textContent = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }

  function saveTimerState() {
    chrome.storage.local.set({
      timerState: { remaining: timerRemaining, deadline: timerDeadline },
    }, () => {
      if (chrome.runtime.lastError) {
        console.error("Could not save the timer state:", chrome.runtime.lastError);
      }
    });
  }

  function syncTimerTicker() {
    if (timerDeadline === null || !timerDisplay) {
      clearInterval(timerInterval);
      timerInterval = null;
    } else if (timerInterval === null) {
      timerInterval = setInterval(updateTimer, 250);
    }
  }

  function applyTimerState(state) {
    if (
      !state ||
      !Number.isInteger(state.remaining) ||
      state.remaining < 0 ||
      state.remaining > TIMER_DURATION ||
      (state.deadline !== null && (!Number.isFinite(state.deadline) || state.deadline <= 0))
    ) {
      console.error("Could not apply the timer state: invalid stored timer state.");
      return;
    }

    timerRemaining = state.remaining;
    timerDeadline = state.deadline;
    updateTimer();
    syncTimerTicker();
  }

  function resetTimer() {
    clearInterval(timerInterval);
    timerInterval = null;
    timerDeadline = null;
    timerRemaining = TIMER_DURATION;
    saveTimerState();
    if (startButton) {
      startButton.disabled = false;
    }
    updateTimer();
  }

  function render() {
    if (!enabled) {
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
          color: white;
          font: system-ui, sans-serif;
          user-select: none;
          -webkit-user-select: none;
        }
        .timer {
          box-sizing: border-box;
          width: 100px;
          height: 70px;
          padding: 4px;
          background: blue;
          text-align: center;
        }
        .timer-display {
          display: block;
          font-variant-numeric: tabular-nums;
          font-size: 28px;
          margin-bottom: 2px;
        }
        .timer-controls {
          display: flex;
          justify-content: center;
          gap: 6px;
        }
        .timer-controls button {
          box-sizing: border-box;
          width: 20px;
          height: 20px;
          padding: 0;
          border: 0;
          border-radius: 3px;
          cursor: pointer;
          line-height: 1;
        }
        .timer-controls button:disabled {
          cursor: default;
          opacity: 0.6;
        }
        .panel {
          box-sizing: border-box;
          color: white;
          padding: 4px;
          width: 100px;
          height: 30px;
          font-size: 14px;
          user-select: none;
          -webkit-user-select: none;
          text-align: center;
          display: flex;
          justify-content: center;
          align-items: center;
          gap: 4px;
        }
        .bathroom-reset-button {
          box-sizing: border-box;
          width: 20px;
          height: 20px;
          padding: 0;
          border: 0;
          border-radius: 3px;
          cursor: pointer;
          font: inherit;
          line-height: 1;
        }
        .bathroom-reset-button.wiggle {
          animation: bathroom-wiggle 350ms ease-in-out;
        }
        @keyframes bathroom-wiggle {
          0%, 100% { transform: rotate(0); }
          20%, 60% { transform: rotate(-18deg); }
          40%, 80% { transform: rotate(18deg); }
        }
        @media (prefers-reduced-motion: reduce) {
          .bathroom-reset-button.wiggle {
            animation: none;
          }
        }
      </style>
      <div class="overlay-stack">
        <section class="timer" aria-label="5 minute timer">
          <strong class="timer-display" role="timer" aria-live="off">05:00</strong>
          <div class="timer-controls">
            <button type="button" class="start-button" aria-label="Start timer" title="Start timer">▶</button>
            <button type="button" class="reset-button" aria-label="Reset timer" title="Reset timer">↻</button>
          </div>
        </section>
        <div class="panel">
          <strong>Bathroom</strong>
          <button type="button" class="bathroom-reset-button" aria-label="Reset bathroom countdown" title="Reset bathroom countdown">↻</button>
        </div>
      </div>
    `;
    panel = shadow.querySelector(".panel");
    timerDisplay = shadow.querySelector(".timer-display");
    startButton = shadow.querySelector(".start-button");
    const resetButton = shadow.querySelector(".reset-button");
    const bathroomResetButton = shadow.querySelector(".bathroom-reset-button");
    updatePanelColor();
    updateTimer();
    syncTimerTicker();

    startButton.addEventListener("click", () => {
      if (timerDeadline !== null || timerRemaining === 0) {
        return;
      }

      timerDeadline = Date.now() + timerRemaining * 1000;
      saveTimerState();
      startButton.disabled = true;
      updateTimer();
      syncTimerTicker();
    });

    resetButton.addEventListener("click", resetTimer);

    bathroomResetButton.addEventListener("click", (event) => {
      event.stopPropagation();
      bathroomResetButton.classList.remove("wiggle");
      void bathroomResetButton.offsetWidth;
      bathroomResetButton.classList.add("wiggle");
      const startedAt = Date.now();
      chrome.storage.local.set({
        permission: false,
        bathroomCycle: {
          startedAt,
          enableAt: startedAt + 10 * 60 * 1000,
          disableAt: startedAt + 30 * 60 * 1000,
          phase: "waiting",
        },
      }, () => {
        if (chrome.runtime.lastError) {
          console.error("Could not start the bathroom countdown:", chrome.runtime.lastError);
        }
      });
    });

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
    if (changes.timerState) {
      timerStateChanged = true;
      applyTimerState(changes.timerState.newValue);
    }
    render();
  });

  chrome.storage.local.get({
    enabled: false,
    permission: false,
    timerState: DEFAULT_TIMER_STATE,
  }, (settings) => {
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
    if (!timerStateChanged) {
      applyTimerState(settings.timerState);
    }
    render();
  });
})();