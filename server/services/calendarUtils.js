const { google } = require("googleapis");

/**
 * Fetch calendar events from Google Calendar
 * @param {string} accessToken - The access token for the Google Calendar API
 * @returns {Promise<Array>} - List of calendar events
 */
async function getCalendarEvents(accessToken) {
  if (!accessToken) {
    throw new Error("Missing access token. Please re-authenticate.");
  }

  const authClient = new google.auth.OAuth2();
  authClient.setCredentials({ access_token: accessToken });

  const calendar = google.calendar({ version: "v3", auth: authClient });

  try {
    const res = await calendar.events.list({
      calendarId: "primary",
      timeMin: new Date().toISOString(),
      maxResults: 10,
      singleEvents: true,
      orderBy: "startTime",
    });

    if (!res.data.items || res.data.items.length === 0) {
      console.log("No upcoming events found.");
      return [];
    }

    return res.data.items.map((event) => ({
      id: event.id,
      summary: event.summary,
      start: event.start.dateTime || event.start.date,
      end: event.end.dateTime || event.end.date,
    }));
  } catch (err) {
    console.error("Error fetching calendar events:", err);
    throw err;
  }
}

module.exports = { getCalendarEvents };
