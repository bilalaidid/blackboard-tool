const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema({
  googleId: { type: String, required: true }, // Store the Google ID
  name: { type: String, required: true },
  email: { type: String, required: true },
  accessToken: { type: String }, // Access token for authenticated API calls
  refreshToken: { type: String }, // Refresh token to renew the access token
});

module.exports = mongoose.model("User", UserSchema);
