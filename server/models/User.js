const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  googleId: String,
  name: String,
  email: String,
  accessToken: String,
  refreshToken: String, // Optional: For token refresh logic
});

// Check if the model is already compiled
const User = mongoose.models.User || mongoose.model("User", userSchema);

module.exports = User;
