const mongoose = require("mongoose");

const NotificationSchema = new mongoose.Schema(
  {
    targetRole: { type: String, enum: ["admin"], default: "admin", index: true },

    type: {
      type: String,
      enum: ["critical_alert", "audit_event", "user_registered", "user_deleted"],
      required: true,
      index: true,
    },

    level: { type: String, enum: ["info", "warning", "critical"], default: "info" },

    title: { type: String, required: true },
    message: { type: String, required: true },

    audit: { type: mongoose.Schema.Types.ObjectId, ref: "Audit" },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },  // user concerné
    actor: { type: mongoose.Schema.Types.ObjectId, ref: "User" }, // admin déclencheur

    read: { type: Boolean, default: false, index: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Notification", NotificationSchema);