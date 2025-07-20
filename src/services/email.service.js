const nodemailer = require('nodemailer');
const handlebars = require('handlebars');
const fs = require('fs').promises;
const path = require('path');

class EmailService {
  constructor() {
    this.transporter = null;
    this.templates = new Map();
    this.initializeService();
  }

  async initializeService() {
    // Initialize SMTP transporter
    await this.initializeTransporter();

    // Compile email templates
    await this.compileTemplates();

    // Register Handlebars helpers
    this.registerHelpers();
  }

  async initializeTransporter() {
    try {
      this.transporter = nodemailer.createTransport({
        service: 'Gmail',
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
        pool: true,
        maxConnections: 5,
        maxMessages: 100,
        rateDelta: 1000,
        rateLimit: 5,
      });

      await this.transporter.verify();
      console.log('✅ SMTP configuration verified successfully');
    } catch (error) {
      console.error('❌ SMTP configuration failed:', error.message);
      this.transporter = null;
    }
  }

  async compileTemplates() {
    try {
      const templatesDir = path.join(__dirname, '../templates/emails');

      // Register partials
      const partialsDir = path.join(templatesDir, 'partials');
      const partialFiles = await fs.readdir(partialsDir);

      for (const file of partialFiles) {
        if (file.endsWith('.hbs')) {
          const name = path.basename(file, '.hbs');
          const content = await fs.readFile(
            path.join(partialsDir, file),
            'utf8'
          );
          handlebars.registerPartial(name, content);
        }
      }

      // Compile base layout
      const layoutPath = path.join(templatesDir, 'layouts/base.hbs');
      const layoutContent = await fs.readFile(layoutPath, 'utf8');
      this.baseLayout = handlebars.compile(layoutContent);

      // Compile email templates
      const templatesPath = path.join(templatesDir, 'templates');
      const templateFiles = await fs.readdir(templatesPath);

      for (const file of templateFiles) {
        if (file.endsWith('.hbs')) {
          const name = path.basename(file, '.hbs');
          const content = await fs.readFile(
            path.join(templatesPath, file),
            'utf8'
          );
          this.templates.set(name, handlebars.compile(content));
        }
      }

      console.log(`✅ Compiled ${this.templates.size} email templates`);
    } catch (error) {
      console.error('❌ Failed to compile templates:', error);
      // Fallback to inline templates if file loading fails
      this.setupFallbackTemplates();
    }
  }

  registerHelpers() {
    // Helper to format dates
    handlebars.registerHelper('formatDate', (date) => {
      return new Date(date).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    });

    // Helper for conditional classes
    handlebars.registerHelper('ifEquals', function (arg1, arg2, options) {
      return arg1 === arg2 ? options.fn(this) : options.inverse(this);
    });

    // Helper to get current year
    handlebars.registerHelper('currentYear', () => {
      return new Date().getFullYear();
    });
  }

  setupFallbackTemplates() {
    // Simple fallback templates if file loading fails
    this.templates.set(
      'verify-email',
      handlebars.compile(`
      <h2>Verify Your Email</h2>
      <p>Please click the link below to verify your email:</p>
      <p><a href="{{verificationUrl}}">{{verificationUrl}}</a></p>
    `)
    );

    this.templates.set(
      'reset-password',
      handlebars.compile(`
      <h2>Reset Your Password</h2>
      <p>Click the link below to reset your password:</p>
      <p><a href="{{resetUrl}}">{{resetUrl}}</a></p>
    `)
    );
  }

  renderTemplate(templateName, data) {
    const template = this.templates.get(templateName);
    if (!template) {
      throw new Error(`Template "${templateName}" not found`);
    }

    // Render the template content
    const body = template(data);

    // If we have a base layout, wrap the content
    if (this.baseLayout) {
      return this.baseLayout({
        ...data,
        body,
        currentYear: new Date().getFullYear(),
      });
    }

    // Fallback to just the body
    return body;
  }

  async sendEmail(options) {
    if (!this.transporter) {
      console.error('Email service is not available');
      return;
    }

    try {
      const info = await this.transporter.sendMail({
        from: `"VocaBoost" <${process.env.FROM_EMAIL}>`,
        ...options,
      });

      console.log(`✅ Email sent: ${info.messageId}`);

      // Log to audit trail
      await this.logEmailSent(options.to, options.subject);

      return info;
    } catch (error) {
      console.error('❌ Failed to send email:', error.message);
      throw error;
    }
  }

  async sendEmailVerification(to, verificationToken) {
    const verificationUrl = `${process.env.FRONTEND_URL}/verify-email?token=${verificationToken}`;

    const html = this.renderTemplate('verify-email', {
      verificationUrl,
      subject: 'Verify Your Email',
    });

    return this.sendEmail({
      to,
      subject: '✨ Welcome to VocaBoost - Verify Your Email',
      html,
      text: `Welcome to VocaBoost! Please verify your email by visiting: ${verificationUrl}`,
    });
  }

  async sendPasswordReset(to, resetToken) {
    const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;

    const html = this.renderTemplate('reset-password', {
      resetUrl,
      userEmail: to,
      subject: 'Password Reset Request',
    });

    return this.sendEmail({
      to,
      subject: '🔐 VocaBoost - Password Reset Request',
      html,
      text: `Reset your password by visiting: ${resetUrl}. This link expires in 15 minutes.`,
    });
  }

  async sendWelcomeEmail(to, displayName) {
    const dashboardUrl = `${process.env.FRONTEND_URL}/dashboard`;

    const html = this.renderTemplate('welcome', {
      displayName: displayName || 'Learner',
      dashboardUrl,
      subject: 'Welcome to VocaBoost!',
    });

    return this.sendEmail({
      to,
      subject: "🎉 Welcome to VocaBoost - Let's Get Started!",
      html,
      text: `Welcome to VocaBoost, ${displayName}! Visit your dashboard at: ${dashboardUrl}`,
    });
  }

  // Helper method to send custom emails
  async sendCustomEmail(to, subject, templateName, data) {
    const html = this.renderTemplate(templateName, {
      ...data,
      subject,
    });

    return this.sendEmail({
      to,
      subject,
      html,
      text: data.textFallback || subject,
    });
  }

  // Batch email sending
  async sendBatchEmails(emailList) {
    const results = await Promise.allSettled(
      emailList.map(({ to, subject, template, data }) =>
        this.sendCustomEmail(to, subject, template, data)
      )
    );

    const successful = results.filter((r) => r.status === 'fulfilled').length;
    const failed = results.filter((r) => r.status === 'rejected').length;

    console.log(`Batch email results: ${successful} sent, ${failed} failed`);
    return { successful, failed, results };
  }

  // Audit logging
  async logEmailSent(to, subject) {
    // In production, this would write to database
    console.log(
      `📧 Email sent to: ${to}, Subject: ${subject}, Time: ${new Date().toISOString()}`
    );
  }

  // Preview email in development
  async previewEmail(templateName, data) {
    if (process.env.NODE_ENV !== 'development') {
      throw new Error('Email preview only available in development');
    }

    const html = this.renderTemplate(templateName, data);
    const previewPath = path.join(
      __dirname,
      `../temp/email-preview-${Date.now()}.html`
    );
    await fs.writeFile(previewPath, html);

    console.log(`📧 Email preview saved to: ${previewPath}`);
    return previewPath;
  }

  async sendTeacherApprovalEmail(to, displayName) {
    const dashboardUrl = `${process.env.FRONTEND_URL}/teacher/dashboard`;
    const helpUrl = `${process.env.FRONTEND_URL}/help/teacher-guide`;

    const html = this.renderTemplate('teacher-approval', {
      displayName: displayName || 'Teacher',
      dashboardUrl,
      helpUrl,
      subject: 'Teacher Account Approved',
    });

    return this.sendEmail({
      to,
      subject: '🎉 VocaBoost - Your Teacher Account is Approved!',
      html,
      text: `Congratulations! Your teacher account has been approved. Visit your dashboard at: ${dashboardUrl}`,
    });
  }

  async sendTeacherRejectionEmail(to, displayName, rejectionReason) {
    const resubmitUrl = `${process.env.FRONTEND_URL}/teacher/verification`;
    const supportUrl = `${process.env.FRONTEND_URL}/support`;

    const html = this.renderTemplate('teacher-rejection', {
      displayName: displayName || 'User',
      rejectionReason,
      resubmitUrl,
      supportUrl,
      subject: 'Teacher Verification Update',
    });

    return this.sendEmail({
      to,
      subject: '📋 VocaBoost - Teacher Verification Update',
      html,
      text: `Your teacher verification request was not approved. Reason: ${rejectionReason}. You can submit a new request after 24 hours.`,
    });
  }
}

module.exports = new EmailService();
