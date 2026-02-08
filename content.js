// content.js
// This script runs on Hacker News pages to display user karma next to usernames

(function () {
  // Store karma values for sorting
  const karmaStore = new Map();
  
  // Wait for the page to load completely
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initializeKarmaDisplay);
  } else {
    initializeKarmaDisplay();
  }

  function initializeKarmaDisplay() {
    // Process existing comments on page load
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
    const topLevelComments = [];

    const commentRows = document.querySelectorAll("tr.athing.comtr");

    commentRows.forEach(function (row) {
      const indentElement = row.querySelector('td.ind[indent="0"]');

      if (indentElement) {
        // This is a top-level comment, get the username
        const userLink = row.querySelector("a.hnuser");
        if (userLink) {
          topLevelUserLinks.push(userLink);
          topLevelComments.push(row);
        }
      } else {
        // This is a child comment, get the username
        const userLink = row.querySelector("a.hnuser");
        if (userLink) {
          childUserLinks.push(userLink);
        }
      }
    });

    // Process top-level comments and fetch their karma
    const karmaPromises = topLevelUserLinks.map(function (userLink) {
      const username = userLink.textContent.trim();

      if (!username || userLink.getAttribute("data-karma-checked")) {
        return Promise.resolve({ username, karma: null, userLink });
      }

      userLink.setAttribute("data-karma-checked", "true");

      // Create a temporary element to hold the karma info
      const karmaSpan = document.createElement("span");
      karmaSpan.className = "hn-karma";
      karmaSpan.style.marginLeft = "4px";
      karmaSpan.style.fontSize = "0.9em";
      karmaSpan.style.opacity = "0.8";
      karmaSpan.textContent = `(${username}'s karma)`; // Placeholder text

      // Insert the karma span after the username link
      userLink.parentNode.insertBefore(karmaSpan, userLink.nextSibling);

      // Request karma data from background script
      return new Promise(function (resolve) {
        chrome.runtime.sendMessage(
          {
            action: "getKarma",
            username: username,
          },
          function (response) {
            if (response && response.karma !== undefined) {
              // Update the karma display with the actual value
              karmaSpan.textContent = `(${response.karma})`;
              karmaStore.set(username, response.karma);
              resolve({ username, karma: response.karma, userLink });
            } else {
              // Hide the karma span if no data is available
              karmaSpan.style.display = "none";
              resolve({ username, karma: null, userLink });
            }
          },
        );
      });
    });

    // Wait for all karma data to be fetched, then sort
    Promise.all(karmaPromises).then(function (results) {
      sortCommentsByKarma(topLevelComments, results);
    });

    // Process child comments
    childUserLinks.forEach(function (userLink) {
      const username = userLink.textContent.trim();

      // Skip if we've already processed this user or if it's empty
      if (!username || userLink.getAttribute("data-child-karma-checked")) {
        return;
      }

      // Mark as checked to prevent duplicate processing
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
              // Show error message if no data is available
              loadButton.textContent = "(no data)";
              loadButton.style.opacity = "0.5";
            }
          },
        );
      });

      // Insert the load button after the username link
      userLink.parentNode.insertBefore(loadButton, userLink.nextSibling);
    });
  }

  function sortCommentsByKarma(topLevelComments, karmaResults) {
    // Create a map of username to karma for O(1) lookups
    const usernameToKarmaMap = new Map();
    karmaResults.forEach(function (result) {
      if (result.karma !== null) {
        usernameToKarmaMap.set(result.username, result.karma);
      }
    });

    // Create a map of comment row to karma
    const commentKarmaMap = new Map();

    topLevelComments.forEach(function (commentRow) {
      const userLink = commentRow.querySelector("a.hnuser");
      if (userLink) {
        const username = userLink.textContent.trim();
        const karma = usernameToKarmaMap.get(username);
        if (karma !== undefined) {
          commentKarmaMap.set(commentRow, karma);
        }
      }
    });

    // Group comments with their nested replies
    const commentGroups = [];
    topLevelComments.forEach(function (topLevelComment) {
      const group = [topLevelComment];
      let currentRow = topLevelComment.nextElementSibling;

      // Collect all nested comments that belong to this top-level comment
      while (
        currentRow &&
        currentRow.classList.contains("athing") &&
        currentRow.classList.contains("comtr")
      ) {
        const indentElement = currentRow.querySelector("td.ind");
        if (indentElement) {
          const indent = indentElement.getAttribute("indent");
          if (indent === "0") {
            // We've reached the next top-level comment
            break;
          }
          // This is a nested comment, add it to the group
          group.push(currentRow);
        }
        currentRow = currentRow.nextElementSibling;
      }

      commentGroups.push({
        topLevelComment,
        group,
        karma: commentKarmaMap.get(topLevelComment) || 0,
      });
    });

    // Sort comment groups by karma (highest first)
    commentGroups.sort(function (a, b) {
      return b.karma - a.karma;
    });

    // Reorder the DOM
    const parentTable = topLevelComments[0]?.parentNode;
    if (!parentTable) return;

    // Find the insertion point (after the header row)
    let insertionPoint = null;
    const allRows = parentTable.querySelectorAll("tr");
    for (let i = 0; i < allRows.length; i++) {
      const row = allRows[i];
      if (row.classList.contains("athing") && row.classList.contains("comtr")) {
        insertionPoint = row;
        break;
      }
    }

    if (!insertionPoint) return;

    // Remove all comment rows from the DOM
    commentGroups.forEach(function (commentGroup) {
      commentGroup.group.forEach(function (row) {
        row.parentNode.removeChild(row);
      });
    });

    // Insert sorted comment groups back into the DOM
    commentGroups.forEach(function (commentGroup, index) {
      for (let i = 0; i < commentGroup.group.length; i++) {
        const row = commentGroup.group[i];
        if (index === 0 && i === 0) {
          // Insert the first comment group at the insertion point
          parentTable.insertBefore(row, insertionPoint);
        } else {
          // Insert subsequent rows after the previous one
          const previousRow = i > 0 ? commentGroup.group[i - 1] : commentGroups[index - 1].group[commentGroups[index - 1].group.length - 1];
          parentTable.insertBefore(row, previousRow.nextSibling);
        }
      }
    });
  }
})();
