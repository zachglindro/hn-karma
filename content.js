// content.js
// This script runs on Hacker News pages to display user karma next to usernames

(function () {
  // Counter to track pending karma requests
  let pendingKarmaRequests = 0;
  let allKarmaLoaded = false;

  // Wait for the page to load completely
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initializeKarmaDisplay);
  } else {
    initializeKarmaDisplay();
  }

  function initializeKarmaDisplay() {
    processComments();

    if (allKarmaLoaded) {
      addSortButton();
    } else if (pendingKarmaRequests > 0) {
      showKarmaLoadingIndicator();
    }

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

        if (allKarmaLoaded) {
          setTimeout(addSortButton, 150);
        } else if (pendingKarmaRequests > 0) {
          showKarmaLoadingIndicator();
        }
      }
    });

    // Start observing
    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });
  }

  // Function to show a loading indicator when karma is being fetched
  function showKarmaLoadingIndicator() {
    const allLinks = document.querySelectorAll(".subtext span.subline a");
    let commentsLink = null;

    // Find the link that contains "comment" in its text content (e.g., "15 comments", "17 comments")
    for (let link of allLinks) {
      if (link.textContent.includes("comment")) {
        commentsLink = link;
        break;
      }
    }

    if (commentsLink) {
      let loadingIndicator = document.getElementById("karma-loading-indicator");

      // Create a loading indicator if it doesn't exist
      if (!loadingIndicator) {
        loadingIndicator = document.createElement("span");
        loadingIndicator.id = "karma-loading-indicator";
        loadingIndicator.style.marginLeft = "4px";
        loadingIndicator.style.fontSize = "0.9em";
        loadingIndicator.style.color = "#828282";

        commentsLink.parentNode.insertBefore(
          loadingIndicator,
          commentsLink.nextSibling,
        );
      }

      loadingIndicator.textContent = `(loading karma... ${pendingKarmaRequests})`;

      // Remove the loading indicator when all karma is loaded
      const checkAndRemoveIndicator = setInterval(() => {
        if (allKarmaLoaded && pendingKarmaRequests <= 0) {
          clearInterval(checkAndRemoveIndicator);
          const indicator = document.getElementById("karma-loading-indicator");
          if (indicator) {
            indicator.remove();
          }
        } else {
          const indicator = document.getElementById("karma-loading-indicator");
          if (indicator) {
            indicator.textContent = `(loading karma... ${pendingKarmaRequests})`;
          }
        }
      }, 100);
    }
  }

  function addSortButton() {
    if (!window.location.href.includes("item?id=")) {
      return;
    }

    const allLinks = document.querySelectorAll(".subtext span.subline a");
    let commentsLink = null;

    // Find the link that contains "comment" in its text content (e.g., "15 comments", "17 comments")
    for (let link of allLinks) {
      if (link.textContent.includes("comment")) {
        commentsLink = link;
        break;
      }
    }

    if (commentsLink && !document.getElementById("karma-sort-btn")) {
      // Create the sort button
      const sortButton = document.createElement("a");
      sortButton.id = "karma-sort-btn";
      sortButton.href = "#";
      sortButton.textContent = "sort/karma";
      sortButton.style.color = "#828282";

      const separator = document.createTextNode(" | ");
      commentsLink.parentNode.insertBefore(separator, commentsLink.nextSibling);
      commentsLink.parentNode.insertBefore(sortButton, separator.nextSibling);

      // Create progress indicator element
      const progressIndicator = document.createElement("span");
      progressIndicator.id = "karma-sort-progress";
      progressIndicator.style.marginLeft = "4px";
      progressIndicator.style.fontSize = "0.9em";
      progressIndicator.style.display = "none";
      commentsLink.parentNode.insertBefore(
        progressIndicator,
        sortButton.nextSibling,
      );

      // Add click event to sort comments by karma
      sortButton.addEventListener("click", function (e) {
        e.preventDefault();

        const progressIndicator = document.getElementById(
          "karma-sort-progress",
        );
        if (progressIndicator) {
          progressIndicator.style.display = "inline";
          progressIndicator.textContent = "(0%)";
        }

        sortCommentsByKarma(progressIndicator);
      });
    }
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

      pendingKarmaRequests++;
      allKarmaLoaded = false;

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
            userLink.setAttribute("data-karma", response.karma);
          } else {
            karmaSpan.style.display = "none";
          }

          pendingKarmaRequests--;
          if (pendingKarmaRequests <= 0) {
            allKarmaLoaded = true;
            addSortButton();
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

        pendingKarmaRequests++;
        allKarmaLoaded = false;

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

              // Store karma value in the user link for later sorting
              userLink.setAttribute("data-karma", response.karma);
            } else {
              loadButton.textContent = "(no data)";
              loadButton.style.opacity = "0.5";
            }

            pendingKarmaRequests--;
            if (pendingKarmaRequests <= 0) {
              allKarmaLoaded = true;
              addSortButton();
            }
          },
        );
      });

      userLink.parentNode.insertBefore(loadButton, userLink.nextSibling);
    });
  }

  // Function to sort comments by karma
  async function sortCommentsByKarma(progressIndicator) {
    // First, ensure all karma values are loaded
    const commentRows = document.querySelectorAll("tr.athing.comtr");
    const promises = [];
    const totalComments = commentRows.length;

    // Count how many comments need karma values to be fetched
    let commentsToFetch = 0;
    commentRows.forEach(function (row) {
      const userLink = row.querySelector("a.hnuser");
      if (userLink) {
        const karmaAttr = userLink.getAttribute("data-karma");
        if (!karmaAttr) {
          const username = userLink.textContent.trim();
          if (username) {
            commentsToFetch++;
          }
        }
      }
    });

    let processedCount = 0;

    commentRows.forEach(function (row) {
      const userLink = row.querySelector("a.hnuser");
      if (userLink) {
        const karmaAttr = userLink.getAttribute("data-karma");
        if (!karmaAttr) {
          // If karma is not available, fetch it
          const username = userLink.textContent.trim();
          if (username) {
            pendingKarmaRequests++;
            allKarmaLoaded = false;

            const promise = new Promise((resolve) => {
              chrome.runtime.sendMessage(
                {
                  action: "getKarma",
                  username: username,
                },
                function (response) {
                  if (response && response.karma !== undefined) {
                    userLink.setAttribute("data-karma", response.karma);
                  } else {
                    userLink.setAttribute("data-karma", "-1"); // Default value for sorting
                  }

                  // Update progress
                  processedCount++;
                  if (progressIndicator && commentsToFetch > 0) {
                    const progressPercentage = Math.round(
                      (processedCount / commentsToFetch) * 100,
                    );
                    progressIndicator.textContent = `(${progressPercentage}%)`;
                  }

                  pendingKarmaRequests--;
                  if (pendingKarmaRequests <= 0) {
                    allKarmaLoaded = true;
                  }

                  resolve();
                },
              );
            });
            promises.push(promise);
          }
        }
      }
    });

    // If no comments need to fetch karma, update progress to 100%
    if (commentsToFetch === 0 && progressIndicator) {
      progressIndicator.textContent = "(100%)";
    }

    // Wait for all karma values to be fetched
    if (promises.length > 0) {
      await Promise.all(promises);
      await new Promise((resolve) => setTimeout(resolve, 200));
    }

    // Collect all comments with their karma values and indentation levels
    const allComments = [];

    commentRows.forEach(function (row) {
      const userLink = row.querySelector("a.hnuser");

      if (userLink) {
        const karma = parseInt(userLink.getAttribute("data-karma")) || -1;

        // Determine the indentation level
        const indentCell = row.querySelector("td.ind");
        let indentValue = 0;
        if (indentCell) {
          indentValue = parseInt(indentCell.getAttribute("indent") || "0");
        }

        allComments.push({
          element: row,
          karma: karma,
          username: userLink.textContent.trim(),
          indent: indentValue,
          id: row.id,
        });
      }
    });

    // Group comments by parent-child relationships
    const topComments = allComments.filter((comment) => comment.indent === 0);
    topComments.sort((a, b) => b.karma - a.karma);

    // Reorder the comments in the DOM
    const commentTree = document.querySelector(".comment-tree tbody");
    if (commentTree) {
      const fragment = document.createDocumentFragment();

      for (const topComment of topComments) {
        fragment.appendChild(topComment.element);

        const children = findAllChildren(allComments, topComment);
        for (const child of children) {
          fragment.appendChild(child.element);
        }
      }

      commentTree.innerHTML = "";
      commentTree.appendChild(fragment);
    }

    if (progressIndicator) {
      progressIndicator.textContent = "✓";

      // Hide the indicator after a short delay
      setTimeout(() => {
        progressIndicator.style.display = "none";
      }, 2000);
    }
  }

  // Helper function to find all children of a given comment
  function findAllChildren(allComments, parentComment) {
    const children = [];
    const parentIndent = parentComment.indent;
    const parentIndex = allComments.indexOf(parentComment);

    if (parentIndex === -1) return children;

    for (let i = parentIndex + 1; i < allComments.length; i++) {
      const current = allComments[i];

      if (current.indent <= parentIndent) {
        break;
      }

      if (current.indent === parentIndent + 1) {
        children.push(current);
      }
    }

    return children;
  }
})();
