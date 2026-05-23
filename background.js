// background.js
// Background script to handle API calls for user karma data

const karmaCache = new Map();

// Listen for messages from content scripts
chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
  if (request.action === "getKarma") {
    getUserKarma(request.username)
      .then((karma) => {
        sendResponse({ karma: karma });
      })
      .catch((error) => {
        console.error(`Error getting karma for ${request.username}:`, error);
        sendResponse({ karma: null });
      });

    // Return true to indicate we'll send a response asynchronously
    return true;
  }
});

async function getUserKarma(username) {
  // Check if we have cached data for this user
  if (karmaCache.has(username)) {
    const cachedData = karmaCache.get(username);

    // Return cached data if it's less than 24 hours (1 day) old
    if (Date.now() - cachedData.timestamp < 24 * 60 * 60 * 1000) {
      return cachedData.karma;
    }
  }

  try {
    // Fetch user data from HN API
    const response = await fetch(
      `https://hacker-news.firebaseio.com/v0/user/${encodeURIComponent(username)}.json`,
    );

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const userData = await response.json();

    if (userData && userData.karma !== undefined) {
      // Cache the result
      karmaCache.set(username, {
        karma: userData.karma,
        timestamp: Date.now(),
      });

      return userData.karma;
    } else {
      // User not found or no karma data
      return null;
    }
  } catch (error) {
    console.error(`Error fetching karma for user ${username}:`, error);
    return null;
  }
}

// Clean up cache periodically to prevent memory leaks
// Remove entries older than 24 hours; run cleanup hourly
setInterval(
  () => {
    const now = Date.now();
    for (const [username, data] of karmaCache.entries()) {
      // Remove entries older than 24 hours (1 day)
      if (now - data.timestamp > 24 * 60 * 60 * 1000) {
        karmaCache.delete(username);
      }
    }
  },
  60 * 60 * 1000,
); // Run cleanup every hour
