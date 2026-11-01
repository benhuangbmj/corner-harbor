(() => {
  const ID = "my-overlay-root";
  let enabled = false;
  let permission = false;
  let enabledChanged = false;
  let permissionChanged = false;
  let host = null;
  let panel = null;

  function updatePanelColor() {
    if (panel) {
      panel.style.background = permission ? "green" : "red";
    }
  }

  function render() {
    if (!enabled) {
      host?.remove();
      host = null;
      panel = null;
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
        .panel {
          box-sizing: content-box;
          font: 12px system-ui, sans-serif;
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
      <div class="panel">
        <strong>Bathroom</strong>
      </div>
    `;
    panel = shadow.querySelector(".panel");
    updatePanelColor();

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