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