const Notification = require("../models/Notification");

class NotificationService {
  static async createAdminNotification(payload) {
    return Notification.create({
      targetRole: "admin",
      ...payload,
    });
  }
}

module.exports = NotificationService;