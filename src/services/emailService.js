// services/EmailService.js
let nodemailer;
let handlebars;
try {
  nodemailer = require("nodemailer");
  handlebars = require("handlebars");
} catch (err) {
  nodemailer = null;
  handlebars = { compile: () => () => "" };
}
const fs = require("fs").promises;
const { error } = require("console");
const path = require("path");

class EmailService {
  constructor() {
    if (nodemailer) {
      this.transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: process.env.SMTP_PORT,
        secure: process.env.SMTP_SECURE === "true",
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });
    } else {
      // Fallback stub transporter
      this.transporter = { sendMail: async () => {} };
    }

    this.templates = new Map();
    // await this.loadTemplates();
  }

  async loadTemplates() {
    try {
      const templatesDir = path.join(__dirname, "../templates/emails");
      const templateFiles = await fs.readdir(templatesDir);

      for (const file of templateFiles) {
        if (file.endsWith(".hbs")) {
          const templateName = file.replace(".hbs", "");
          const templateContent = await fs.readFile(
            path.join(templatesDir, file),
            "utf-8"
          );
          this.templates.set(templateName, handlebars.compile(templateContent));
        }
      }
      console.info("Load templates successfully");
    } catch (error) {
      console.error("Failed to load email templates:", error);
    }
  }

  // Gửi email xác nhận đăng ký
  async sendRegistrationVerification({ to, fullName, verificationToken }) {
    try {
      await this.loadTemplates();
      const template = this.templates.get("registration-verification");
      if (!template) throw new Error("Template not found");

      const html = template({
        fullName,
        verificationUrl: `${process.env.FRONTEND_URL}/verify-email?token=${verificationToken}`,
        supportEmail: process.env.SUPPORT_EMAIL,
      });

      await this.transporter.sendMail(
        {
          from: `"VocaBoost" <${process.env.FROM_EMAIL}>`,
          to,
          subject: "Welcome to VocaBoost - Verify account",
          html,
          text: `Hi ${fullName}, please verify your account at: ${process.env.FRONTEND_URL}/confirm-email?token=${verificationToken}`,
        },
        (error, info) => {
          if (error) {
            // Phân tích loại lỗi để xử lý phù hợp
            if (error.code === "EAUTH") {
              console.log("❌ Lỗi xác thực: Email hoặc password không đúng");
              // Giải pháp: Kiểm tra lại credentials
            } else if (error.code === "ENOTFOUND") {
              console.log("❌ Lỗi mạng: Không tìm thấy email server");
              // Giải pháp: Kiểm tra kết nối internet
            } else if (error.responseCode === 535) {
              console.log("❌ Gmail từ chối: Có thể cần App Password");
              // Giải pháp: Tạo App Password trong Google Account
            } else {
              console.log("❌ Lỗi khác:", error.message);
            }
          } else {
            console.log("✅ Gửi thành công:", info.messageId);
          }
        }
      );

      return { success: true };
    } catch (error) {
      console.error("Registration email error:", error);
      throw new Error("Không thể gửi email xác nhận");
    }
  }

  // Gửi email reset mật khẩu
  async sendPasswordReset({ to, fullName, resetToken }) {
    try {
      await this.loadTemplates();
      const template = this.templates.get("password-reset");
      const html = template({
        fullName,
        resetUrl: `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`,
        expirationTime: "1 hour",
      });

      await this.transporter.sendMail({
        from: `"VocaBoost" <${process.env.FROM_EMAIL}>`,
        to,
        subject: "Reset password VocaBoost",
        html,
        text: `Reset password at: ${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`,
      });

      return { success: true };
    } catch (error) {
      console.error("Password reset email error:", error);
      throw new Error("Failed to send email reset password");
    }
  }

  // Gửi lời mời tham gia lớp học
  async sendClassroomInvitation({
    to,
    classroomName,
    teacherName,
    inviteCode,
    message,
    classCode,
  }) {
    try {
      await this.loadTemplates();
      const template = this.templates.get("classroom-invitation");
      const html = template({
        classroomName,
        teacherName,
        message,
        joinUrl: `${process.env.FRONTEND_URL}/join-classroom?code=${classCode}`,
        inviteCode,
        classCode,
      });

      await this.transporter.sendMail({
        from: `"${teacherName} via VocaBoost" <${process.env.FROM_EMAIL}>`,
        to,
        subject: `Lời mời tham gia lớp "${classroomName}"`,
        html,
        text: `${teacherName} mời bạn tham gia lớp "${classroomName}". Mã lớp: ${classCode}`,
      });

      return { success: true };
    } catch (error) {
      console.error("Classroom invitation error:", error);
      throw new Error("Không thể gửi lời mời lớp học");
    }
  }

  // Gửi báo cáo tiến độ hàng tuần
  async sendWeeklyProgress({ to, fullName, stats, achievements }) {
    try {
      await this.loadTemplates();
      const template = this.templates.get("weekly-progress");
      const html = template({
        fullName,
        stats: {
          ...stats,
          wordsLearned: stats.newWords || 0,
          accuracy: `${stats.accuracy}%`,
          streak: stats.currentStreak,
        },
        achievements,
        hasAchievements: achievements && achievements.length > 0,
      });

      await this.transporter.sendMail({
        from: `"VocaBoost" <${process.env.FROM_EMAIL}>`,
        to,
        subject: `Báo cáo tiến độ tuần này - ${stats.wordsLearned || 0} từ mới`,
        html,
        text: `Tuần này bạn đã học ${
          stats.newWords || 0
        } từ mới với độ chính xác ${stats.accuracy}%`,
      });

      return { success: true };
    } catch (error) {
      console.error("Weekly progress email error:", error);
      throw new Error("Không thể gửi báo cáo tiến độ");
    }
  }

  // Gửi thông báo bài tập mới
  async sendAssignmentNotification({
    to,
    studentName,
    assignmentTitle,
    dueDate,
    classroomName,
    teacherName,
  }) {
    try {
      await this.loadTemplates();
      const template = this.templates.get("assignment-notification");
      const html = template({
        studentName,
        assignmentTitle,
        dueDate: new Date(dueDate).toLocaleDateString("vi-VN"),
        classroomName,
        teacherName,
        assignmentUrl: `${process.env.FRONTEND_URL}/assignments`,
      });

      await this.transporter.sendMail({
        from: `"${teacherName} via VocaBoost" <${process.env.FROM_EMAIL}>`,
        to,
        subject: `Bài tập mới: ${assignmentTitle}`,
        html,
        text: `Bạn có bài tập mới "${assignmentTitle}" từ ${teacherName}, hạn nộp: ${new Date(
          dueDate
        ).toLocaleDateString("vi-VN")}`,
      });

      return { success: true };
    } catch (error) {
      console.error("Assignment notification error:", error);
      throw new Error("Không thể gửi thông báo bài tập");
    }
  }

  // Bulk email cho admin
  async sendBulkEmail({ recipients, subject, template, data }) {
    try {
      await this.loadTemplates();
      const compiledTemplate = this.templates.get(template);
      if (!compiledTemplate) throw new Error(`Template ${template} not found`);

      const results = [];
      const batchSize = 10; // Gửi từng batch để tránh rate limit

      for (let i = 0; i < recipients.length; i += batchSize) {
        const batch = recipients.slice(i, i + batchSize);
        const promises = batch.map(async (recipient) => {
          try {
            const html = compiledTemplate({ ...data, ...recipient });

            await this.transporter.sendMail({
              from: `"VocaBoost" <${process.env.FROM_EMAIL}>`,
              to: recipient.email,
              subject,
              html,
            });

            return { email: recipient.email, status: "sent" };
          } catch (error) {
            console.error(`Failed to send to ${recipient.email}:`, error);
            return {
              email: recipient.email,
              status: "failed",
              error: error.message,
            };
          }
        });

        const batchResults = await Promise.all(promises);
        results.push(...batchResults);

        // Delay between batches
        if (i + batchSize < recipients.length) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      }

      return {
        success: true,
        results,
        total: recipients.length,
        sent: results.filter((r) => r.status === "sent").length,
        failed: results.filter((r) => r.status === "failed").length,
      };
    } catch (error) {
      console.error("Bulk email error:", error);
      throw new Error("Không thể gửi email hàng loạt");
    }
  }

  // Kiểm tra trạng thái SMTP
  async checkConnection() {
    try {
      await this.transporter.verify();
      return { status: "connected", message: "SMTP connection successful" };
    } catch (error) {
      return { status: "failed", message: error.message };
    }
  }
}

module.exports = EmailService;
