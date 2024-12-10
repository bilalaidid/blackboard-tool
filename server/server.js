const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });
const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const mongoose = require("mongoose");
const express = require("express");
const bodyParser = require("express");
const session = require("express-session");
const { fetchAssignments } = require("./services/gmailUtils");
const {
  createCalendarEvent,
  getCalendarEvents,
} = require("./services/calendarUtils");
const User = require("./models/User");

// Debugging environment variables
console.log("GOOGLE_CLIENT_ID:", process.env.GOOGLE_CLIENT_ID);
console.log("GOOGLE_CLIENT_SECRET:", process.env.GOOGLE_CLIENT_SECRET);
console.log("CALLBACK_URL:", process.env.CALLBACK_URL);
console.log("MONGO_URI:", process.env.MONGO_URI);
console.log("SESSION_SECRET:", process.env.SESSION_SECRET);

// Check if required environment variables are defined
if (
  !process.env.GOOGLE_CLIENT_ID ||
  !process.env.GOOGLE_CLIENT_SECRET ||
  !process.env.CALLBACK_URL ||
  !process.env.MONGO_URI ||
  !process.env.SESSION_SECRET
) {
  throw new Error(
    "Missing required environment variables. Please check your .env file."
  );
}

// MongoDB connection
const uri =
  process.env.MONGO_URI ||
  "mongodb+srv://bilalaidid2018:2Lp2rY1Jufsx3HTx@cluster0.gvopg.mongodb.net/?retryWrites=true&w=majority";

mongoose
  .connect(uri, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => {
    console.log("Connected to MongoDB");
  })
  .catch((error) => {
    console.error("Error connecting to MongoDB:", error);
  });

// Passport configuration
passport.serializeUser((user, done) => {
  done(null, user); // Store the entire user object in the session
});

passport.deserializeUser((user, done) => {
  done(null, user); // Retrieve the user object directly from the session
});

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: process.env.CALLBACK_URL,
      scope: [
        "profile",
        "email",
        "https://www.googleapis.com/auth/calendar.events",
        "https://www.googleapis.com/auth/calendar",
      ],
    },
    async (accessToken, refreshToken, profile, done) => {
      return done(null, { profile, accessToken, refreshToken });
    }
  )
);

const app = express();
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, "../public")));
console.log("Static files served from:", path.join(__dirname, "public"));


// Set the view engine to ejs
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "../views"));

app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
  })
);
app.use(passport.initialize());
app.use(passport.session());

// Routes
app.get("/", (req, res) => res.redirect("/home"));

app.get("/home", (req, res) => {
    res.render("home"); // This renders the home.ejs file
  });
  

app.get(
  "/auth/google",
  passport.authenticate("google", {
    scope: [
      "profile",
      "email",
      "https://www.googleapis.com/auth/gmail.readonly",
      "https://www.googleapis.com/auth/calendar.events",
      "https://www.googleapis.com/auth/calendar",
    ],
  })
);

app.get(
  "/auth/google/callback",
  passport.authenticate("google", {
    failureRedirect: "/home",
  }),
  (req, res) => {
    res.redirect("/dashboard");
  }
);

app.get("/dashboard", async (req, res) => {
  if (!req.isAuthenticated()) return res.redirect("/home");

  try {
    const accessToken = req.user.accessToken;

    // Initialize Gmail API
    const { google } = require("googleapis");
    const authClient = new google.auth.OAuth2();
    authClient.setCredentials({ access_token: accessToken });

    const gmail = google.gmail({ version: "v1", auth: authClient });

    // Fetch Gmail labels
    const labelsRes = await gmail.users.labels.list({ userId: "me" });
    const labelMap = labelsRes.data.labels.reduce((map, label) => {
      map[label.id] = label.name;
      return map;
    }, {});

    console.log("Fetched Labels:", labelMap);

    // Fetch emails
    const resMessages = await gmail.users.messages.list({
      userId: "me",
      q: "label:Assignment OR label:Quiz OR label:Reflection OR label:FeedBack OR label:Project",
    });
    const assignments = resMessages.data.messages || [];

    const emails = await Promise.all(
      assignments.map(async (message) => {
        const msg = await gmail.users.messages.get({
          userId: "me",
          id: message.id,
        });

        const payload = msg.data.payload;
        const headers = payload.headers;

        const subject =
          headers.find((header) => header.name === "Subject")?.value ||
          "No Subject";

        // Extract only the year/month/day from the email date
        const datePattern = /\d{4}-\d{2}-\d{2}/; // Matches dates in YYYY-MM-DD format
        const bodyData = payload.parts?.find(
          (part) =>
            part.mimeType === "text/plain" || part.mimeType === "text/html"
        )?.body?.data;

        const decodedBody = bodyData
          ? Buffer.from(bodyData, "base64").toString("utf-8")
          : "";

        const extractedDate = decodedBody.match(datePattern);
        const emailDate = extractedDate ? extractedDate[0] : "No Date Found";

        const labelIds = msg.data.labelIds || [];
        const labels = labelIds
          .map((id) => labelMap[id] || id) // Map label IDs to names
          .map((label) => (label.includes("_") ? label.split("_")[1] : label)); // Remove prefixes

        return {
          date: emailDate,
          subject,
          labels, // Pass labels as an array
        };
      })
    );

    console.log("Processed Emails with Labels:", emails);

    // Pass data to the EJS template
    res.render("dashboard", {
      name: req.user.name,
      email: req.user.email,
      emails: emails.map((email) => ({
        date: email.date,
        subject: email.subject,
        labels: email.labels || [], // Ensure labels is always an array
      })),
    });
  } catch (err) {
    console.error("Error loading dashboard:", err);
    res.status(500).send("An error occurred while loading the dashboard.");
  }
});

app.get("/logout", (req, res) => {
  req.logout((err) => {
    if (err) {
      return res.status(500).send("Error logging out");
    }
    res.redirect("/");
  });
});

// Start the server
const PORT = 5001;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

app.post("/process-emails", async (req, res) => {
  try {
    // Extract emails and validate the data
    const { emails = [] } = req.body;

    if (!Array.isArray(emails)) {
      console.error("Invalid emails data:", emails);
      return res.status(400).send("Invalid email data");
    }

    const addedEvents = [];
    const failedEvents = [];

    // Initialize Google Calendar API
    const { google } = require("googleapis");
    const authClient = new google.auth.OAuth2();
    authClient.setCredentials({ access_token: req.user.accessToken });

    const calendar = google.calendar({ version: "v3", auth: authClient });

    // Iterate over emails to add events to the calendar
    for (const email of emails) {
      if (!email.date || !email.subject) {
        console.log(`Skipping invalid email:`, email);
        continue;
      }

      try {
        await calendar.events.insert({
          calendarId: "primary",
          resource: {
            summary: email.subject,
            start: { date: email.date },
            end: { date: email.date }, // Single-day events
          },
        });
        console.log(`Added event: ${email.subject}`);
        addedEvents.push(email.subject);
      } catch (error) {
        console.error(`Failed to add event for: ${email.subject}`, error);
        failedEvents.push(email.subject);
      }
    }

    console.log("Added events:", addedEvents);
    console.log("Failed events:", failedEvents);

    // Redirect to Google Calendar
    return res.redirect("https://calendar.google.com/calendar/");
  } catch (error) {
    console.error("Error processing emails:", error);
    res.status(500).send("An error occurred while processing emails.");
  }
});
