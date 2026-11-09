// content.js
// This script runs on Hacker News pages to display user karma next to usernames

(function () {
  let pendingKarmaRequests = 0;
  let allKarmaLoaded = false;
  let isCommentsKarmaSorted = false;
  let originalCommentOrder = [];
  let isPostsScoreSorted = false;
  let originalPostOrder = [];

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initializeKarmaDisplay);
  } else {
    initializeKarmaDisplay();
  }

  function initializeKarmaDisplay() {
    processSubmissionAuthor();
    processComments();
    addPostSortButton();

    if (allKarmaLoaded || pendingKarmaRequests === 0) {
      addSortButtons();
    } else {
      showKarmaLoadingIndicator();
    }

    const observer = new MutationObserver(function (mutations) {
      let shouldProcess = false;

      mutations.forEach(function (mutation) {
        if (mutation.type === "childList") {
          mutation.addedNodes.forEach(function (node) {
            if (node.nodeType === 1) {
              if (
                node.classList &&
                (node.classList.contains("comment") ||
                  node.classList.contains("comtr") ||
                  node.classList.contains("submission"))
              ) {
                shouldProcess = true;
              } else if (
                node.querySelector &&
                (node.querySelector("tr.athing.comtr") ||
                  node.querySelector("tr.athing.submission"))
              ) {
                shouldProcess = true;
              }
            }
          });
        }
      });

      if (shouldProcess) {
        setTimeout(function () {
          processSubmissionAuthor();
          processComments();
          addPostSortButton();
          if (allKarmaLoaded || pendingKarmaRequests === 0) {
            addSortButtons();
          }
        }, 100);
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });
  }

  function getUsernameFromLink(link) {
    if (!link) return null;
    try {
      const url = new URL(link.href, window.location.origin);
      return url.searchParams.get("id");
    } catch {
      return link.textContent.trim();
    }
  }

  // Display karma for the post/story submitter
  function processSubmissionAuthor() {
    const postSubline = document.querySelector(".subtext span.subline");
    if (!postSubline) return;

    const userLink = postSubline.querySelector('a[href^="user?id="]');
    if (!userLink || userLink.getAttribute("data-karma-checked")) return;

    const username = getUsernameFromLink(userLink);
    if (!username) return;

    userLink.setAttribute("data-karma-checked", "true");

    const karmaSpan = document.createElement("span");
    karmaSpan.className = "hn-karma";
    karmaSpan.style.marginLeft = "4px";
    karmaSpan.style.fontSize = "0.9em";
    karmaSpan.style.opacity = "0.8";
    karmaSpan.textContent = "(...)";

    userLink.parentNode.insertBefore(karmaSpan, userLink.nextSibling);

    chrome.runtime.sendMessage(
      { action: "getKarma", username: username },
      function (response) {
        if (response && response.karma !== null && response.karma !== undefined) {
          karmaSpan.textContent = `(${response.karma})`;
          userLink.setAttribute("data-karma", response.karma);
        } else {
          karmaSpan.style.display = "none";
        }
      }
    );
  }

  function processComments() {
    const topLevelUserLinks = [];
    const childUserLinks = [];
    const commentRows = document.querySelectorAll("tr.athing.comtr");

    commentRows.forEach(function (row) {
      // Find author link using href prefix instead of class
      const userLink = row.querySelector('.comhead a[href^="user?id="]');
      if (!userLink) return;

      const indentElement = row.querySelector('td.ind[indent="0"]');
      if (indentElement) {
        topLevelUserLinks.push(userLink);
      } else {
        childUserLinks.push(userLink);
      }
    });

    // Process top-level comments (automatic fetch)
    topLevelUserLinks.forEach(function (userLink) {
      const username = getUsernameFromLink(userLink);
      if (!username || userLink.getAttribute("data-karma-checked")) return;

      userLink.setAttribute("data-karma-checked", "true");
      pendingKarmaRequests++;
      allKarmaLoaded = false;

      const karmaSpan = document.createElement("span");
      karmaSpan.className = "hn-karma";
      karmaSpan.style.marginLeft = "4px";
      karmaSpan.style.fontSize = "0.9em";
      karmaSpan.style.opacity = "0.8";
      karmaSpan.textContent = "(...)";

      userLink.parentNode.insertBefore(karmaSpan, userLink.nextSibling);

      chrome.runtime.sendMessage(
        { action: "getKarma", username: username },
        function (response) {
          if (response && response.karma !== null && response.karma !== undefined) {
            karmaSpan.textContent = `(${response.karma})`;
            userLink.setAttribute("data-karma", response.karma);
          } else {
            karmaSpan.style.display = "none";
          }

          pendingKarmaRequests--;
          if (pendingKarmaRequests <= 0) {
            allKarmaLoaded = true;
            addSortButtons();
          }
        }
      );
    });

    // Process child comments (click-to-load)
    childUserLinks.forEach(function (userLink) {
      const username = getUsernameFromLink(userLink);
      if (!username || userLink.getAttribute("data-child-karma-checked")) return;

      userLink.setAttribute("data-child-karma-checked", "true");

      const loadButton = document.createElement("span");
      loadButton.className = "hn-karma-load";
      loadButton.style.marginLeft = "4px";
      loadButton.style.fontSize = "0.9em";
      loadButton.style.cursor = "pointer";
      loadButton.style.color = "#828282";
      loadButton.style.textDecoration = "underline";
      loadButton.textContent = "(load)";

      loadButton.addEventListener("click", function (event) {
        event.preventDefault();
        loadButton.textContent = "(...)";
        loadButton.style.cursor = "default";
        loadButton.style.textDecoration = "none";

        chrome.runtime.sendMessage(
          { action: "getKarma", username: username },
          function (response) {
            if (response && response.karma !== null && response.karma !== undefined) {
              loadButton.textContent = `(${response.karma})`;
              loadButton.style.opacity = "0.8";
              userLink.setAttribute("data-karma", response.karma);
            } else {
              loadButton.textContent = "(no data)";
              loadButton.style.opacity = "0.5";
            }
          }
        );
      });

      userLink.parentNode.insertBefore(loadButton, userLink.nextSibling);
    });

    if (topLevelUserLinks.length === 0 || pendingKarmaRequests === 0) {
      allKarmaLoaded = true;
      addSortButtons();
    }
  }

  function showKarmaLoadingIndicator() {
    const allLinks = document.querySelectorAll(".subtext span.subline a");
    const commentsLink = Array.from(allLinks).find((link) =>
      /comment|discuss/i.test(link.textContent || "")
    );

    if (commentsLink) {
      let loadingIndicator = document.getElementById("karma-loading-indicator");
      if (!loadingIndicator) {
        loadingIndicator = document.createElement("span");
        loadingIndicator.id = "karma-loading-indicator";
        loadingIndicator.style.marginLeft = "4px";
        loadingIndicator.style.fontSize = "0.9em";
        loadingIndicator.style.color = "#828282";
        commentsLink.parentNode.insertBefore(
          loadingIndicator,
          commentsLink.nextSibling
        );
      }

      loadingIndicator.textContent = `(loading karma... ${pendingKarmaRequests})`;

      const checkAndRemoveIndicator = setInterval(() => {
        if (allKarmaLoaded && pendingKarmaRequests <= 0) {
          clearInterval(checkAndRemoveIndicator);
          const indicator = document.getElementById("karma-loading-indicator");
          if (indicator) indicator.remove();
        } else {
          const indicator = document.getElementById("karma-loading-indicator");
          if (indicator) {
            indicator.textContent = `(loading karma... ${pendingKarmaRequests})`;
          }
        }
      }, 100);
    }
  }

  function addSortButtons() {
    addCommentSortButton();
    addPostSortButton();
  }

  function addCommentSortButton() {
    if (!window.location.href.includes("item?id=")) return;

    const allLinks = document.querySelectorAll(".subtext span.subline a");
    const commentsLink = Array.from(allLinks).find((link) =>
      /comment|discuss/i.test(link.textContent || "")
    );

    if (commentsLink && !document.getElementById("karma-sort-btn")) {
      const sortButton = document.createElement("a");
      sortButton.id = "karma-sort-btn";
      sortButton.href = "#";
      sortButton.textContent = isCommentsKarmaSorted ? "unsort/karma" : "sort/karma";
      sortButton.style.color = "#828282";

      const separator = document.createTextNode(" | ");
      commentsLink.parentNode.insertBefore(separator, commentsLink.nextSibling);
      commentsLink.parentNode.insertBefore(sortButton, separator.nextSibling);

      const progressIndicator = document.createElement("span");
      progressIndicator.id = "karma-sort-progress";
      progressIndicator.style.marginLeft = "4px";
      progressIndicator.style.fontSize = "0.9em";
      progressIndicator.style.display = "none";
      commentsLink.parentNode.insertBefore(
        progressIndicator,
        sortButton.nextSibling
      );

      sortButton.addEventListener("click", function (e) {
        e.preventDefault();
        if (progressIndicator) {
          progressIndicator.style.display = "inline";
          progressIndicator.textContent = "(...)";
        }
        toggleCommentSortByKarma(progressIndicator, sortButton);
      });
    }
  }

  function toggleCommentSortByKarma(progressIndicator, sortButton) {
    if (isCommentsKarmaSorted) {
      restoreOriginalCommentOrder();
      isCommentsKarmaSorted = false;
      sortButton.textContent = "sort/karma";
    } else {
      sortCommentsByKarma();
      isCommentsKarmaSorted = true;
      sortButton.textContent = "unsort/karma";
    }

    if (progressIndicator) {
      progressIndicator.textContent = "✓";
      setTimeout(function () {
        progressIndicator.style.display = "none";
      }, 1200);
    }
  }

  function restoreOriginalCommentOrder() {
    if (!originalCommentOrder.length) return;

    const commentRows = Array.from(document.querySelectorAll("tr.athing.comtr"));
    const rowsById = new Map();
    commentRows.forEach((row) => rowsById.set(row.id, row));

    const commentTree =
      document.querySelector(".comment-tree tbody") ||
      document.querySelector(".comment-tree");
    if (!commentTree) return;

    const fragment = document.createDocumentFragment();
    originalCommentOrder.forEach((id) => {
      if (rowsById.has(id)) {
        fragment.appendChild(rowsById.get(id));
        rowsById.delete(id);
      }
    });

    // In case any new row was added dynamically
    rowsById.forEach((row) => {
      fragment.appendChild(row);
    });

    commentTree.innerHTML = "";
    commentTree.appendChild(fragment);
  }

  function sortCommentsByKarma() {
    const commentRows = Array.from(document.querySelectorAll("tr.athing.comtr"));
    if (!commentRows.length) return;

    if (!originalCommentOrder.length) {
      originalCommentOrder = commentRows.map((row) => row.id);
    }

    const allComments = [];

    commentRows.forEach(function (row) {
      const userLink = row.querySelector('.comhead a[href^="user?id="]');
      const karma = userLink
        ? parseInt(userLink.getAttribute("data-karma"), 10) || -1
        : -1;
      const indentCell = row.querySelector("td.ind");
      let indentValue = 0;
      if (indentCell) {
        indentValue = parseInt(indentCell.getAttribute("indent") || "0", 10);
      }

      allComments.push({
        element: row,
        karma: karma,
        indent: indentValue,
        id: row.id,
      });
    });

    const topComments = allComments.filter((c) => c.indent === 0);
    topComments.sort((a, b) => b.karma - a.karma);

    const commentTree =
      document.querySelector(".comment-tree tbody") ||
      document.querySelector(".comment-tree");
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
  }

  function addPostSortButton() {
    // Only applies to frontpage / submission list pages
    if (window.location.href.includes("item?id=")) return;

    const existingControls = document.getElementById("score-post-sort-controls");
    if (existingControls) {
      positionPostSortControls();
      return;
    }

    const firstPostSubline = document.querySelector(
      "tr.athing.submission + tr .subtext .subline"
    );
    if (!firstPostSubline) return;

    const firstCommentsLink = Array.from(firstPostSubline.querySelectorAll("a")).find(
      (link) => /comment|discuss/i.test(link.textContent || "")
    );
    if (!firstCommentsLink) return;

    const controls = document.createElement("span");
    controls.id = "score-post-sort-controls";

    const separator = document.createTextNode(" | ");
    controls.appendChild(separator);

    const sortButton = document.createElement("a");
    sortButton.id = "score-post-sort-btn";
    sortButton.href = "#";
    sortButton.textContent = "sort/score";
    sortButton.style.color = "#828282";
    controls.appendChild(sortButton);

    const progressIndicator = document.createElement("span");
    progressIndicator.id = "score-post-sort-progress";
    progressIndicator.style.marginLeft = "4px";
    progressIndicator.style.fontSize = "0.9em";
    progressIndicator.style.display = "none";
    controls.appendChild(progressIndicator);

    firstCommentsLink.parentNode.insertBefore(controls, firstCommentsLink.nextSibling);

    sortButton.addEventListener("click", function (e) {
      e.preventDefault();
      if (progressIndicator) {
        progressIndicator.style.display = "inline";
        progressIndicator.textContent = "(...)";
      }
      togglePostSortByScore(progressIndicator, sortButton);
    });

    positionPostSortControls();
  }

  function positionPostSortControls() {
    const controls = document.getElementById("score-post-sort-controls");
    if (!controls) return;

    const firstPostSubline = document.querySelector(
      "tr.athing.submission + tr .subtext .subline"
    );
    if (!firstPostSubline) return;

    const firstCommentsLink = Array.from(firstPostSubline.querySelectorAll("a")).find(
      (link) => /comment|discuss/i.test(link.textContent || "")
    );
    if (!firstCommentsLink) return;

    firstCommentsLink.parentNode.insertBefore(controls, firstCommentsLink.nextSibling);
  }

  function togglePostSortByScore(progressIndicator, sortButton) {
    if (isPostsScoreSorted) {
      restoreOriginalPostOrder();
      isPostsScoreSorted = false;
      sortButton.textContent = "sort/score";
    } else {
      sortPostsByScore();
      isPostsScoreSorted = true;
      sortButton.textContent = "unsort/score";
    }

    if (progressIndicator) {
      progressIndicator.textContent = "✓";
      setTimeout(function () {
        progressIndicator.style.display = "none";
      }, 1200);
    }
  }

  function sortPostsByScore() {
    const postGroups = getPostGroups();
    if (!postGroups.length) return;

    if (!originalPostOrder.length) {
      originalPostOrder = postGroups.map((g) => g.id);
    }

    postGroups.sort((a, b) => b.score - a.score);
    applyPostOrder(postGroups);
  }

  function restoreOriginalPostOrder() {
    if (!originalPostOrder.length) return;

    const postGroups = getPostGroups();
    const groupsById = new Map();
    postGroups.forEach((g) => groupsById.set(g.id, g));

    const orderedGroups = [];
    originalPostOrder.forEach((id) => {
      if (groupsById.has(id)) {
        orderedGroups.push(groupsById.get(id));
        groupsById.delete(id);
      }
    });

    applyPostOrder(orderedGroups);
  }

  function getPostGroups() {
    const submissionRows = Array.from(
      document.querySelectorAll("tr.athing.submission")
    );

    return submissionRows
      .map(function (submissionRow) {
        const subtextRow = submissionRow.nextElementSibling;
        const spacerCandidate = subtextRow ? subtextRow.nextElementSibling : null;
        const spacerRow =
          spacerCandidate && spacerCandidate.classList.contains("spacer")
            ? spacerCandidate
            : null;

        const scoreSpan = subtextRow ? subtextRow.querySelector("span.score") : null;
        let score = -1;
        if (scoreSpan) {
          const parsedScore = parseInt(scoreSpan.textContent, 10);
          score = Number.isNaN(parsedScore) ? -1 : parsedScore;
        }

        return {
          id: submissionRow.id,
          row: submissionRow,
          subtextRow: subtextRow,
          spacerRow: spacerRow,
          score: score,
        };
      })
      .filter((g) => !!g.subtextRow);
  }

  function applyPostOrder(postGroups) {
    if (!postGroups.length) return;

    const parent = postGroups[0].row.parentNode;
    const insertionAnchor = parent.querySelector("tr.morespace");
    const fragment = document.createDocumentFragment();

    postGroups.forEach(function (group) {
      fragment.appendChild(group.row);
      fragment.appendChild(group.subtextRow);
      if (group.spacerRow) {
        fragment.appendChild(group.spacerRow);
      }
    });

    parent.insertBefore(fragment, insertionAnchor || null);
    positionPostSortControls();
  }

  function findAllChildren(allComments, parentComment) {
    const children = [];
    const parentIndent = parentComment.indent;
    const parentIndex = allComments.indexOf(parentComment);

    if (parentIndex === -1) return children;

    for (let i = parentIndex + 1; i < allComments.length; i++) {
      const current = allComments[i];
      if (current.indent <= parentIndent) break;
      children.push(current);
    }

    return children;
  }
})();