const mongoose = require("mongoose");

const AssignmentSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" }, // Link assignments to a user
  title: { type: String, required: true },
  dueDate: { type: Date, required: true },
  description: { type: String },
});

module.exports = mongoose.model("Assignment", AssignmentSchema);
