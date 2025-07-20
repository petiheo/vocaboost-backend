# Email Testing Guide & Commands

## 🚀 Quick Start

### 1. Install Test Dependencies

```bash
npm install --save-dev jest supertest
npm install --save-dev @types/jest  # For better IDE support
```

### 2. Install Optional Dependencies

```bash
npm install --save-dev open  # Auto-open browser for previews
```

## 📝 Testing Commands

### Manual Testing

```bash
# Interactive email test (send real emails)
npm run test:email

# With specific email
node scripts/test-emails.js your-email@gmail.com

# Preview all templates in browser
npm run test:preview

# Preview specific template
node scripts/preview-templates.js welcome
```

### Automated Testing

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run only unit tests
npm run test:unit

# Run only integration tests
npm run test:integration

# Generate coverage report
npm run test:coverage
```

## ✅ Testing Checklist

### Before Testing

- [ ] Set up `.env` file with test SMTP credentials
- [ ] Create `/temp` directory for previews
- [ ] Install all dependencies

### Template Testing

- [ ] All templates render without errors
- [ ] Dynamic data displays correctly
- [ ] Fallback for missing data works
- [ ] Links are clickable and correct
- [ ] Images have alt text
- [ ] Mobile responsive design

### Email Delivery Testing

- [ ] Emails send successfully
- [ ] Subject lines are correct
- [ ] From address is correct
- [ ] Text fallback included
- [ ] Attachments work (if any)

### Error Handling

- [ ] Invalid email addresses handled
- [ ] SMTP connection failures handled
- [ ] Rate limiting works
- [ ] Retry mechanism works
- [ ] Queue processing works

### Cross-Client Testing

- [ ] Gmail
- [ ] Outlook/Hotmail
- [ ] Apple Mail
- [ ] Yahoo Mail
- [ ] Mobile email apps

## 🛠️ Development Workflow

### 1. Create/Edit Template

```bash
# Edit template file
code src/templates/emails/templates/new-template.hbs
```

### 2. Preview Template

```bash
# Preview in browser
node scripts/preview-templates.js new-template
```

### 3. Test Sending

```bash
# Send test email
node scripts/test-emails.js your@email.com
# Select template from menu
```

### 4. Run Unit Tests

```bash
# Test specific file
npm test email.service.test.js
```

### 5. Check Coverage

```bash
npm run test:coverage
# Open coverage/lcov-report/index.html
```

## 🐛 Common Issues & Solutions

### SMTP Connection Failed

```bash
# Check credentials
echo $SMTP_USER
echo $SMTP_PASS

# Test with ethereal email
# Use test account from https://ethereal.email
```

### Template Not Found

```bash
# Check file exists
ls src/templates/emails/templates/

# Check template name matches
grep -r "templates.set" src/services/email.service.js
```

### Rate Limiting Issues

```bash
# Reduce concurrent sends
# Add delays between emails
# Use email queue
```

## 📊 Test Coverage Goals

- **Statements**: > 80%
- **Branches**: > 70%
- **Functions**: > 80%
- **Lines**: > 80%

## 🔍 Debugging Tips

### Enable Debug Logs

```javascript
// In email.service.js
console.log('Rendering template:', templateName);
console.log('Template data:', JSON.stringify(data, null, 2));
```

### Check Email Headers

```javascript
// Add custom headers for debugging
{
  headers: {
    'X-Test-ID': Date.now(),
    'X-Template': templateName
  }
}
```

### Use Mail Catcher

```bash
# Install MailCatcher (Ruby required)
gem install mailcatcher

# Start MailCatcher
mailcatcher

# Configure SMTP
SMTP_HOST=localhost
SMTP_PORT=1025
```

## 📚 Resources

- [Nodemailer Docs](https://nodemailer.com/)
- [Handlebars Docs](https://handlebarsjs.com/)
- [Jest Docs](https://jestjs.io/)
- [Email Client CSS Support](https://www.caniemail.com/)
- [Litmus Email Testing](https://litmus.com/)
- [Email on Acid](https://www.emailonacid.com/)
