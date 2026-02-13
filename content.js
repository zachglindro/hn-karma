// content.js
// This script runs on Hacker News pages to display user karma next to usernames

(function () {
  // Wait for the page to load completely
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initializeKarmaDisplay);
  } else {
    initializeKarmaDisplay();
  }

  function initializeKarmaDisplay() {
    processComments();

    // Set up MutationObserver to handle dynamically loaded comments
    const observer = new MutationObserver(function (mutations) {
      let shouldProcess = false;

      mutations.forEach(function (mutation) {
        if (mutation.type === "childList") {
          mutation.addedNodes.forEach(function (node) {
            if (node.nodeType === 1) {
              // Element node
              if (
                node.classList &&
                (node.classList.contains("comment") ||
                  node.classList.contains("comtr"))
              ) {
                // Check if this is a top-level comment (indent="0")
                const indentElement = node.querySelector
                  ? node.querySelector('td.ind[indent="0"]')
                  : null;
                if (indentElement) {
                  shouldProcess = true;
                }
              } else if (
                node.querySelector &&
                node.querySelector('tr.athing.comtr td.ind[indent="0"]')
              ) {
                // Also check if the added node contains a top-level comment
                shouldProcess = true;
              }
            }
          });
        }
      });

      if (shouldProcess) {
        setTimeout(processComments, 100); // Small delay to ensure elements are fully loaded
      }
    });

    // Start observing
    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });
  }

  function processComments() {
    const topLevelUserLinks = [];
    const childUserLinks = [];

    const commentRows = document.querySelectorAll("tr.athing.comtr");

    commentRows.forEach(function (row) {
      const indentElement = row.querySelector('td.ind[indent="0"]');

      if (indentElement) {
        // This is a top-level comment, get the username
        const userLink = row.querySelector("a.hnuser");
        if (userLink) {
          topLevelUserLinks.push(userLink);
        }
      } else {
        // This is a child comment, get the username
        const userLink = row.querySelector("a.hnuser");
        if (userLink) {
          childUserLinks.push(userLink);
        }
      }
    });

    // Process top-level comments
    topLevelUserLinks.forEach(function (userLink) {
      const username = userLink.textContent.trim();

      if (!username || userLink.getAttribute("data-karma-checked")) {
        return;
      }

      userLink.setAttribute("data-karma-checked", "true");

      // Create a temporary element to hold the karma info
      // We'll update it later when we get the karma data
      const karmaSpan = document.createElement("span");
      karmaSpan.className = "hn-karma";
      karmaSpan.style.marginLeft = "4px";
      karmaSpan.style.fontSize = "0.9em";
      karmaSpan.style.opacity = "0.8";
      karmaSpan.textContent = `(${username}'s karma)`; // Placeholder text

      userLink.parentNode.insertBefore(karmaSpan, userLink.nextSibling);

      // Request karma data from background script
      chrome.runtime.sendMessage(
        {
          action: "getKarma",
          username: username,
        },
        function (response) {
          if (response && response.karma !== undefined) {
            karmaSpan.textContent = `(${response.karma})`;
          } else {
            karmaSpan.style.display = "none";
          }
        },
      );
    });

    // Process child comments
    childUserLinks.forEach(function (userLink) {
      const username = userLink.textContent.trim();
      if (!username || userLink.getAttribute("data-child-karma-checked")) {
        return;
      }

      userLink.setAttribute("data-child-karma-checked", "true");

      // Create a clickable "load" button to fetch karma
      const loadButton = document.createElement("span");
      loadButton.className = "hn-karma-load";
      loadButton.style.marginLeft = "4px";
      loadButton.style.fontSize = "0.9em";
      loadButton.style.cursor = "pointer";
      loadButton.style.color = "#828282";
      loadButton.style.textDecoration = "underline";
      loadButton.textContent = "(load)";

      // Add click event to fetch and display karma
      loadButton.addEventListener("click", function (event) {
        event.preventDefault();

        // Show loading indicator
        loadButton.textContent = "(...)";
        loadButton.style.cursor = "default";
        loadButton.style.textDecoration = "none";

        // Request karma data from background script
        chrome.runtime.sendMessage(
          {
            action: "getKarma",
            username: username,
          },
          function (response) {
            if (response && response.karma !== undefined) {
              // Update the button with the actual karma value
              loadButton.textContent = `(${response.karma})`;
              loadButton.style.opacity = "0.8";
              loadButton.style.color = "#828282";
            } else {
              loadButton.textContent = "(no data)";
              loadButton.style.opacity = "0.5";
            }
          },
        );
      });

      userLink.parentNode.insertBefore(loadButton, userLink.nextSibling);
    });
  }
})();
