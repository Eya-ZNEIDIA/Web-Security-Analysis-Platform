const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const alertSchema = new Schema({
  userId: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  auditId: {
    type: Schema.Types.ObjectId,
    ref: "Audit",
    required: true
  },
  vulnerabiliteId: {
    type: Schema.Types.ObjectId,
    ref: "Vulnerabilite"
  },
  level: {
    type: String,
    enum: ["Critique", "critical", "Élevé", "high", "Moyen", "medium", "Faible", "low"],
    required: true
  },
  message: String,
  description: String,
  title: String,
  urlCible: String,
  createdAt: {
    type: Date,
    default: Date.now
  },
  read: {
    type: Boolean,
    default: false
  }
});

// ✅ تأكد من الـ export
module.exports = mongoose.model("Alert", alertSchema);