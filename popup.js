
async function ensureContentScript(tabId) {
  try {

    await chrome.tabs.sendMessage(tabId, { action: "ping" });
  } catch (error) {

    await chrome.scripting.executeScript({
      target: { tabId: tabId },
      files: ["content.js"]
    });

    await chrome.scripting.insertCSS({
      target: { tabId: tabId },
      files: ["styles.css"]
    });
  }
}

async function handleAction(action) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  
  if (!tab.url.startsWith("http")) {
    alert("This extension only works on web pages (not browser settings or new tab).");
    return;
  }

  try {

    await ensureContentScript(tab.id);
    chrome.tabs.sendMessage(tab.id, { action: action });
    window.close();
  } catch (err) {
    alert("Error: Could not start extension.\nPlease refresh the page and try again.");
    console.error(err);
  }
}

document.getElementById('pick-btn').addEventListener('click', () => handleAction("start_selection"));
document.getElementById('manage-btn').addEventListener('click', () => handleAction("open_manager"));