const BATHROOM_ENABLE_ALARM = "bathroom-enable";
const BATHROOM_DISABLE_ALARM = "bathroom-disable";
const BATHROOM_ENABLE_DELAY = 10 * 60 * 1000;
const BATHROOM_DISABLE_DELAY = 30 * 60 * 1000;

function clearBathroomAlarms() {
  chrome.alarms.clear(BATHROOM_ENABLE_ALARM);
  chrome.alarms.clear(BATHROOM_DISABLE_ALARM);
}

function syncBathroomCycle() {
  chrome.storage.local.get({ bathroomCycle: null }, ({ bathroomCycle }) => {
    if (chrome.runtime.lastError) {
      console.error("Could not read the bathroom countdown:", chrome.runtime.lastError);
      return;
    }

    if (!bathroomCycle) {
      clearBathroomAlarms();
      return;
    }

    const { startedAt, enableAt, disableAt, phase } = bathroomCycle;
    if (
      !Number.isFinite(startedAt) ||
      !Number.isFinite(enableAt) ||
      !Number.isFinite(disableAt) ||
      enableAt !== startedAt + BATHROOM_ENABLE_DELAY ||
      disableAt !== startedAt + BATHROOM_DISABLE_DELAY ||
      !["waiting", "enabled", "complete"].includes(phase)
    ) {
      console.error("Could not schedule the bathroom countdown: invalid stored state.");
      clearBathroomAlarms();
      return;
    }

    const now = Date.now();
    let nextPhase = phase;
    let nextPermission;

    if (now >= disableAt) {
      nextPhase = "complete";
      nextPermission = false;
      clearBathroomAlarms();
    } else if (now >= enableAt) {
      nextPhase = "enabled";
      nextPermission = true;
      chrome.alarms.create(BATHROOM_DISABLE_ALARM, { when: disableAt });
      chrome.alarms.clear(BATHROOM_ENABLE_ALARM);
    } else {
      nextPhase = "waiting";
      chrome.alarms.create(BATHROOM_ENABLE_ALARM, { when: enableAt });
      chrome.alarms.create(BATHROOM_DISABLE_ALARM, { when: disableAt });
    }

    if (nextPhase !== phase) {
      const updates = {
        bathroomCycle: { ...bathroomCycle, phase: nextPhase },
      };
      if (nextPermission !== undefined) {
        updates.permission = nextPermission;
      }
      chrome.storage.local.set(updates, () => {
        if (chrome.runtime.lastError) {
          console.error("Could not update the bathroom countdown:", chrome.runtime.lastError);
        }
      });
    } else if (nextPermission !== undefined) {
      chrome.storage.local.get({ permission: false }, ({ permission }) => {
        if (chrome.runtime.lastError) {
          console.error("Could not read the bathroom permission state:", chrome.runtime.lastError);
          return;
        }

        if (permission !== nextPermission) {
          chrome.storage.local.set({ permission: nextPermission }, () => {
            if (chrome.runtime.lastError) {
              console.error("Could not update the bathroom permission state:", chrome.runtime.lastError);
            }
          });
        }
      });
    }
  });
}

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === BATHROOM_ENABLE_ALARM || alarm.name === BATHROOM_DISABLE_ALARM) {
    syncBathroomCycle();
  }
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === "local" && changes.bathroomCycle) {
    syncBathroomCycle();
  }
});

chrome.runtime.onStartup.addListener(syncBathroomCycle);
chrome.runtime.onInstalled.addListener(syncBathroomCycle);
syncBathroomCycle();

chrome.action.onClicked.addListener((tab) => {
  chrome.storage.local.get({ enabled: false }, ({ enabled }) => {
    if (chrome.runtime.lastError) {
      console.error("Could not read the extension enabled state:", chrome.runtime.lastError);
      return;
    }

    chrome.storage.local.set({ enabled: !enabled }, () => {
      if (chrome.runtime.lastError) {
        console.error("Could not save the extension enabled state:", chrome.runtime.lastError);
      }
    });
  });
});