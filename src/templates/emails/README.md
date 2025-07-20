# Email Templates Setup Guide

## 📁 Directory Structure

```
src/
├── templates/
│   └── emails/
│       ├── layouts/
│       │   └── base.hbs          # Base HTML layout
│       ├── partials/
│       │   ├── header.hbs        # Email header
│       │   ├── footer.hbs        # Email footer
│       │   └── button.hbs        # Reusable button component
│       └── templates/
│           ├── verify-email.hbs  # Email verification
│           ├── reset-password.hbs # Password reset
│           └── welcome.hbs       # Welcome email
└── services/
    └── email.service.js          # Email service with Handlebars
```

## 🚀 Quick Start

### 1. Install Dependencies

```bash
npm install handlebars
```

### 2. How to use

```javascript
// In auth.controller.js
const emailService = require('../services/email.service');

// Send verification email
await emailService.sendEmailVerification(user.email, token);

// Send password reset
await emailService.sendPasswordReset(user.email, resetToken);

// Send welcome email after verification
await emailService.sendWelcomeEmail(user.email, user.displayName);
```

## 🎨 Creating New Templates

### 1. Create Template File

Create a new file in `templates/emails/templates/`:

```handlebars
{{!-- new-feature.hbs --}}
<h2>{{title}}</h2>
<p>Hi {{userName}},</p>
<p>{{message}}</p>
{{> button url=actionUrl text=actionText}}
```

### 2. Add Send Method

In `email.service.js`:

```javascript
async sendNewFeatureEmail(to, data) {
  const html = this.renderTemplate('new-feature', data);
  return this.sendEmail({
    to,
    subject: data.subject,
    html,
    text: data.textFallback
  });
}
```

## 🔧 Customization

### Handlebars Helpers

Add custom helpers in `email.service.js`:

```javascript
// Format currency
handlebars.registerHelper('currency', (amount) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
});

// Conditional styling
handlebars.registerHelper('statusColor', (status) => {
  const colors = {
    success: '#28a745',
    warning: '#ffc107',
    error: '#dc3545',
  };
  return colors[status] || '#6c757d';
});
```

### Using Helpers in Templates

```handlebars
<p>Amount: {{currency price}}</p>
<span style='color: {{statusColor status}}'>{{statusText}}</span>
```

## 📧 Email Preview (Development)

Preview emails during development:

```javascript
// Preview email without sending
const previewPath = await emailService.previewEmail('welcome', {
  displayName: 'Test User',
  dashboardUrl: 'http://localhost:3000/dashboard',
});
```

## 📝 Best Practices

1. **Always test templates** with different data
2. **Include text fallback** for all HTML emails
3. **Keep templates simple** - some email clients have limited CSS support
4. **Use inline CSS** for better compatibility
5. **Test on multiple clients** (Gmail, Outlook, Apple Mail)
6. **Optimize images** - use absolute URLs and keep sizes small
7. **Add alt text** to all images
8. **Keep subject lines short** (< 50 characters)

## 🧪 Testing Templates

```javascript
// Test script
const emailService = require('./src/services/email.service');

async function testEmails() {
  // Test email data
  const testEmail = 'test@example.com';

  // Preview all templates
  await emailService.previewEmail('verify-email', {
    verificationUrl: 'http://localhost:3000/verify?token=123',
  });

  await emailService.previewEmail('reset-password', {
    resetUrl: 'http://localhost:3000/reset?token=456',
    userEmail: testEmail,
  });

  await emailService.previewEmail('welcome', {
    displayName: 'Test User',
    dashboardUrl: 'http://localhost:3000/dashboard',
  });
}

testEmails();
```

## 🛠️ Troubleshooting

### Templates not loading?

- Check file paths and extensions (.hbs)
- Ensure templates directory exists
- Check console for compilation errors

### Emails not sending?

- Verify SMTP credentials
- Check spam folder
- Enable "less secure apps" for Gmail
- Use app-specific password for Gmail

### Styling issues?

- Use inline CSS
- Test with email testing tools
- Avoid modern CSS features
- Use table-based layouts for compatibility
