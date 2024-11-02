// popup.js
document.addEventListener('DOMContentLoaded', () => {
    const english_helper_toggleButton = document.getElementById('english-helper-toggleButton');

    // Initialize button text based on the current state
    chrome.storage.sync.get(['enabled'], (data) => {
        english_helper_toggleButton.textContent = data.enabled ? 'English Helper is On' : 'English Helper is Off';
    });

    // Add click event to toggle state
    english_helper_toggleButton.addEventListener('click', () => {
        chrome.storage.sync.get(['enabled'], (data) => {
            const newState = !data.enabled;
            chrome.storage.sync.set({ enabled: newState }, () => {
                english_helper_toggleButton.textContent = newState ? 'English Helper is On' : 'English Helper is Off';
            });
        });
    });
});
