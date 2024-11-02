// content.js
console.debug("Loaded dictionary search extension");

let websiteButtonList = [];
let container = null;



function createFloatingButtonContainer(x, y) {
  // reset the button list so that new buttons / links can be created for new text selection
  websiteButtonList = [];

  container = document.createElement("div");

  container.className = "floating-button-container";


  websiteButtonList.push(createWebsiteButtonEnum('Youglish', 'Youglish','images/brandyg.png'));
  websiteButtonList.push(createWebsiteButtonEnum('Youtube', 'Youtube','images/youtube.png'));
  websiteButtonList.push(createWebsiteButtonEnum('Cambridge Dictionary', 'Cambridge','images/cam-dict.jpeg'));
  websiteButtonList.push(createWebsiteButtonEnum('Saying Google', 'Google','images/google.png'));


  container.style.left = x + -20 + "px";
  container.style.top = y + -55 + "px";

  document.body.appendChild(container);
  websiteButtonList.forEach((button) => {
    container.appendChild(button);
  });

  return container;
}

function createWebsiteButtonEnum(btnTitle, DirectionSiteType, iconUrl,word = null) {
  const button = document.createElement("img");
  button.src = chrome.runtime.getURL(iconUrl); // Set the path to your desired image
  button.alt = btnTitle;
  button.className = "floating-button";
  button.style.cursor = "pointer";

  button.addEventListener("click", function (event) {

    const selectedText = word ?? window.getSelection().toString(); //.toLowerCase().trim();

    let url = "";

    switch(DirectionSiteType) {
      case 'Youglish':
        url = getYouglishUrl(selectedText)
        break;
      case 'Youtube':
        url = getYouTubeUrl(selectedText);
        break;
      case 'Cambridge':
          url = getCambridgeUrl(selectedText);
          break;
      case 'Google':
      url = getGoogleUrl(selectedText);
      break;
        default:
          break;

    }

    openWebDict(event, url);
    saveWordToHistory(selectedText);
    if (container) {
      container.remove();
    }
  });
  //websiteButtonList.push(button);
  return button;
}



document.addEventListener("mouseup", function (event) {


  const floatingButtonContainer = document.querySelector(
    ".floating-button-container"
  );
  if (floatingButtonContainer) {
    return;
  }

  chrome.storage.sync.get(['enabled'], (data)=> {
    if(data.enabled) 
    {
      const selectedText = window.getSelection().toString().trim();
      if (selectedText !== "") {
        createFloatingButtonContainer(event.clientX, event.clientY);
      }
    }
  });
});

document.addEventListener("mousedown", function (event) {
  const floatingButtonContainer = document.querySelector(
    ".floating-button-container"
  );

  if (
    floatingButtonContainer &&
    event.target !== floatingButtonContainer &&
    event.target.className !== "floating-button"
  ) {
    floatingButtonContainer.remove();
  }
});

function openWebDict(event, url) {
  const newWindow = {
    left: event.clientX + "px",
    top: event.clientY + "px",
    viewportWidth:
      Math.round(window.innerWidth * 0.33) < 400
        ? 400
        : Math.round(window.innerWidth * 0.33),
    viewportHeight:
      Math.round(window.innerHeight * 0.55) < 600
        ? 600
        : Math.round(window.innerHeight * 0.55),
  };

  window.open(
    url,
    "_blank",
    `width=${newWindow.viewportWidth}, height=${newWindow.viewportHeight}, left=${newWindow.left}, top=${newWindow.top}`
  );
}
