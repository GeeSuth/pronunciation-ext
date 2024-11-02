document.querySelectorAll('.sortable').forEach(header => {
    header.addEventListener('click', () => {
        const sortKey = header.dataset.sort;
        const tbody = document.getElementById('listContainer');
        const rows = Array.from(tbody.getElementsByTagName('tr'));
        
        // Toggle sort direction
        const isAsc = header.classList.contains('sort-asc');
        document.querySelectorAll('th').forEach(th => {
            th.classList.remove('sort-asc', 'sort-desc');
        });
        header.classList.add(isAsc ? 'sort-desc' : 'sort-asc');

        // Sort rows
        rows.sort((a, b) => {
            const aValue = a.getElementsByTagName('td')[sortKey === 'word' ? 0 : 1].textContent;
            const bValue = b.getElementsByTagName('td')[sortKey === 'word' ? 0 : 1].textContent;
            return isAsc ? 
                bValue.localeCompare(aValue) :
                aValue.localeCompare(bValue);
        });

        // Reorder rows
        rows.forEach(row => tbody.appendChild(row));
    });
});


function saveWordToHistory(word) {
    console.log("English Helper Searching for : " + word);
    chrome.storage.local.get(['helperList'], (data) => {
        let currentList = data.helperList || [];
        
        // Try to find existing word entry
        const existingItemIndex = currentList.findIndex(item => item.word.toLowerCase() === word.toLowerCase());
        
        if (existingItemIndex !== -1) {
            // Word exists, increment count
            currentList[existingItemIndex].count = (currentList[existingItemIndex].count || 1) + 1;
            currentList[existingItemIndex].datetime = new Date().toLocaleString(); // Update datetime
        } else {
            // New word, add it
            const newItem = {
                id: Date.now(),
                word: word,
                datetime: new Date().toLocaleString(),
                count: 1
            };
            currentList.push(newItem);
        }

        chrome.storage.local.set({helperList: currentList}, () => {
            if (chrome.runtime.lastError) {
                console.error('Error saving to storage:', chrome.runtime.lastError);
            }
        });
    });
}


// options.js
document.addEventListener('DOMContentLoaded', () => {
    const listContainer = document.getElementById('listContainer');
    
    // Function to render the list
    function renderList() {
        // Clear existing list
        listContainer.innerHTML = '';

        // Get the list from storage
        chrome.storage.local.get(['helperList'], (data) => {
            const currentList = data.helperList || [];

            // Create a list item for each word object
            currentList.forEach((item) => {
                const row = document.createElement('tr');
                
                // Create word cell
                const wordCell = document.createElement('td');
                wordCell.textContent = item.word;
                row.appendChild(wordCell);

                // Create datetime cell
                const dateCell = document.createElement('td'); 
                dateCell.textContent = item.datetime;
                row.appendChild(dateCell);


                 // Create Count cell
                 const countCell = document.createElement('td'); 
                 countCell.textContent = item.count??1;
                 row.appendChild(countCell);

                // Review
                const reviewCell = document.createElement('td');
                const reviewDiv = document.createElement('div');
                
                const youglishBtn = createWebsiteButtonEnum('Youglish', 'Youglish','images/brandyg.png',item.word);
                const youtubeBtn = createWebsiteButtonEnum('Youtube', 'Youtube','images/youtube.png',item.word);
                const cambridgeBtn = createWebsiteButtonEnum('Cambridge Dictionary', 'Cambridge','images/cam-dict.jpeg',item.word);
                const googleBtn = createWebsiteButtonEnum('Saying Google', 'Google','images/google.png',item.word);
                
                reviewDiv.appendChild(youglishBtn);
                reviewDiv.appendChild(youtubeBtn); 
                reviewDiv.appendChild(cambridgeBtn);
                reviewDiv.appendChild(googleBtn);
                reviewCell.appendChild(reviewDiv);
                row.appendChild(reviewCell);

                // Create actions cell with remove button
                const actionsCell = document.createElement('td');
                const removeButton = document.createElement('button');
                removeButton.textContent = 'Remove';
                removeButton.className = 'remove-btn';
                removeButton.addEventListener('click', () => {
                    removeItem(item.id);
                });
                actionsCell.appendChild(removeButton);
                row.appendChild(actionsCell);

                // Add row to table body
                listContainer.appendChild(row);
            });
        });
    }

    // Function to remove an item by ID
    function removeItem(id) {
        chrome.storage.local.get(['helperList'], (data) => {
            const currentList = data.helperList || [];
            // Filter out the item with the matching ID
            const updatedList = currentList.filter(item => item.id !== id);
            // Update storage with the modified list
            chrome.storage.local.set({ helperList: updatedList }, () => {
                // Re-render the list after removal
                renderList();
            });
        });
    }

    // Initial render of the list
    renderList();
});
