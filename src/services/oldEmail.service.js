const nodemailer = require('nodemailer');

class EmailService {
  constructor() {
    this.transporter = nodemailer.createTransport({
      service: 'Gmail',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    (async () => {
      try {
        await this.transporter.verify();
        console.log('Configure SMTP successfully');
      } catch (err) {
        console.error('Configure SMTP failed: ', err);
      }
    })();
  }

  async sendEmailVerification(to, verificationToken) {
    try {
      await this.transporter.sendMail({
        from: `"VocaBoost" <${process.env.FROM_EMAIL}>`,
        to,
        subject: 'Welcome to VocaBoost - Verify account',
        html: `<a href="${process.env.FRONTEND_URL}/verify-email?token=${verificationToken}"> Verify Email </a>`,
        text: `${process.env.FRONTEND_URL}/verify-email?token=${verificationToken}`,
      });
      console.log('Send verification email successfully!');
    } catch (error) {
      throw error;
    }
  }

  async sendPasswordReset(to, resetToken) {
    try {
      await this.transporter.sendMail({
        from: `"VocaBoost" <${process.env.FROM_EMAIL}>`,
        to,
        subject: 'VocaBoost - Reset Password',
        html: `<a href="${process.env.FRONTEND_URL}/reset-password?token=${resetToken}"> Reset Password </a>`,
        text: `Reset password at: ${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`,
      });
    } catch (error) {
      throw error;
    }
  }
}

module.exports = new EmailService();
