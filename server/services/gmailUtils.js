const { google } = require("googleapis");

/**
 * Fetch assignments from Gmail
 * @param {string} accessToken - The access token for the Gmail API
 * @returns {Promise<Array>} - List of assignment-related messages
 */
async function fetchAssignments(accessToken) {
  if (!accessToken) {
    throw new Error("Missing access token. Please re-authenticate.");
  }

  const authClient = new google.auth.OAuth2();
  authClient.setCredentials({ access_token: accessToken });

  const gmail = google.gmail({ version: "v1", auth: authClient });

  try {
    const res = await gmail.users.messages.list({
      userId: "me",
      q: "is:unread label:important", // Query for unread messages in the "Important" label
    });
    
    if (!res.data.messages || res.data.messages.length === 0) {
      console.log("No relevant messages found.");
      return [];
    }
    
    // Fetch message details
    const messages = await Promise.all(
      res.data.messages.map(async (message) => {
        const msg = await gmail.users.messages.get({
          userId: "me",
          id: message.id,
        });
    
        const payload = msg.data.payload;
        const headers = payload.headers;
    
        const subject = headers.find((header) => header.name === "Subject")?.value || "No Subject";
        const from = headers.find((header) => header.name === "From")?.value || "Unknown Sender";
    
        // Extract the snippet or the body of the message
        const body = msg.data.snippet || "No message body";
    
        // Extract labels from the message
        const labels = msg.data.labelIds || []; // Use Gmail's label IDs for filtering
    
        return {
          id: message.id,
          subject,
          from,
          body,
          labels,
        };
      })
    );
    
    // Filter messages based on specific labels or subjects
    const filteredMessages = messages.filter((message) => {
      const lowerCaseSubject = message.subject.toLowerCase();
      return (
        message.labels.includes("Assignment") ||
        message.labels.includes("Quiz") ||
        message.labels.includes("Reflection") ||
        message.labels.includes("Project") ||
        lowerCaseSubject.includes("assignment") ||
        lowerCaseSubject.includes("quiz") ||
        lowerCaseSubject.includes("reflection") ||
        lowerCaseSubject.includes("project")
      );
    });
    
    return filteredMessages;
    

    return assignments;
  } catch (err) {
    console.error("Error fetching assignments:", err);
    throw err;
  }
}

module.exports = { fetchAssignments };
