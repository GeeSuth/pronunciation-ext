// popup.js
document.addEventListener('DOMContentLoaded', () => {
    const english_helper_toggleButton = document.getElementById('english-helper-toggleButton');

    // Initialize button text based on the current state
    chrome.storage.sync.get(['enabled'], (data) => {
        english_helper_toggleButton.textContent = data.enabled ? 'English Helper is On' : 'English Helper is Off';
        if (!data.enabled) {
            english_helper_toggleButton.style.backgroundColor = '#dc3545'; // Red background when off
        }
    });

    // Add click event to toggle state
    english_helper_toggleButton.addEventListener('click', () => {
        chrome.storage.sync.get(['enabled'], (data) => {
            const newState = !data.enabled;
            chrome.storage.sync.set({ enabled: newState }, () => {
                english_helper_toggleButton.textContent = newState ? 'English Helper is On' : 'English Helper is Off';
                english_helper_toggleButton.style.backgroundColor = newState ? '#4CAF50' : '#dc3545'; // Green when on, red when off
            });
        });
    });
});


document.addEventListener('DOMContentLoaded', () => {
    const openButton = document.getElementById('openHistoryPage');
    openButton.addEventListener('click', () => {
      chrome.tabs.create({ url: chrome.runtime.getURL('history.html') });
    });
  });