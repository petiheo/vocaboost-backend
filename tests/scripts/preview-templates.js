// scripts/preview-templates.js
// Usage: node scripts/preview-templates.js [template-name]

require('dotenv').config();
const fs = require('fs').promises;
const path = require('path');
const open = require('open'); // npm install open (optional)

// Use a simple HTTP server to preview emails
const http = require('http');
const url = require('url');

// Email service
const emailService = require('../../src/services/email.service');

// Test data for all templates
const templateData = {
  'verify-email': {
    verificationUrl: 'http://localhost:3000/verify?token=preview-token-123456',
  },
  'reset-password': {
    resetUrl: 'http://localhost:3000/reset?token=preview-token-789012',
    userEmail: 'user@example.com',
  },
  welcome: {
    displayName: 'John Doe',
    dashboardUrl: 'http://localhost:3000/dashboard',
  },
  'assignment-notification': {
    studentName: 'Jane Smith',
    teacherName: 'Mr. Johnson',
    className: 'Advanced English Vocabulary',
    assignmentTitle: 'Business English - Unit 5',
    wordCount: 25,
    exerciseType: 'Flashcards',
    dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    assignmentUrl: 'http://localhost:3000/assignments/123',
  },
  'daily-reminder': {
    userName: 'Sarah',
    pendingWords: 15,
    currentStreak: 7,
    streakMilestone: true,
    daysToMilestone: 3,
    nextMilestone: 10,
    totalWordsLearned: 150,
    reviewUrl: 'http://localhost:3000/review',
    motivationalQuote: 'The limits of my language mean the limits of my world.',
  },
  'achievement-unlocked': {
    userName: 'Mike',
    achievementIcon: '🔥',
    achievementTitle: '7-Day Streak Master',
    achievementDescription: 'Completed 7 days of continuous learning!',
    stats: [
      { label: 'Current Streak', value: '7 days' },
      { label: 'Words Learned', value: '105' },
      { label: 'Accuracy Rate', value: '92%' },
    ],
    profileUrl: 'http://localhost:3000/profile/achievements',
  },
  'classroom-invitation': {
    teacherName: 'Ms. Williams',
    className: 'IELTS Preparation Class',
    classDescription: 'Prepare for your IELTS exam with targeted vocabulary',
    joinUrl: 'http://localhost:3000/join?token=invite-token-345678',
  },
};

async function generatePreviews(templateName = null) {
  const previewDir = path.join(__dirname, '../temp/email-previews');
  await fs.mkdir(previewDir, { recursive: true });

  const templates = templateName ? [templateName] : Object.keys(templateData);

  const generatedFiles = [];

  for (const template of templates) {
    try {
      console.log(`📧 Generating preview for: ${template}`);

      const data = templateData[template];
      if (!data) {
        console.error(`❌ No test data found for template: ${template}`);
        continue;
      }

      const html = emailService.renderTemplate(template, {
        ...data,
        subject: `Preview: ${template}`,
        currentYear: new Date().getFullYear(),
      });

      const filename = `${template}.html`;
      const filepath = path.join(previewDir, filename);

      await fs.writeFile(filepath, html);
      generatedFiles.push({ template, filepath, filename });

      console.log(`✅ Generated: ${filename}`);
    } catch (error) {
      console.error(`❌ Error generating ${template}:`, error.message);
    }
  }

  return { previewDir, generatedFiles };
}

async function startPreviewServer(previewDir, files) {
  const PORT = 3333;

  // Create index page
  const indexHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Email Template Previews</title>
      <style>
        body {
          font-family: -apple-system, sans-serif;
          max-width: 800px;
          margin: 0 auto;
          padding: 20px;
          background-color: #f5f5f5;
        }
        h1 { color: #333; }
        .template-list {
          background: white;
          border-radius: 8px;
          padding: 20px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .template-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 15px;
          border-bottom: 1px solid #eee;
        }
        .template-item:last-child {
          border-bottom: none;
        }
        .template-name {
          font-weight: 600;
          color: #333;
        }
        .actions a {
          margin-left: 15px;
          color: #4CAF50;
          text-decoration: none;
        }
        .actions a:hover {
          text-decoration: underline;
        }
        .info {
          margin-top: 20px;
          padding: 15px;
          background: #e3f2fd;
          border-radius: 4px;
          color: #1976d2;
        }
      </style>
    </head>
    <body>
      <h1>VocaBoost Email Template Previews</h1>
      <div class="template-list">
        <h2>Available Templates</h2>
        ${files
          .map(
            (file) => `
          <div class="template-item">
            <span class="template-name">${file.template}</span>
            <div class="actions">
              <a href="/${file.filename}" target="_blank">Preview</a>
              <a href="/${file.filename}" download>Download</a>
            </div>
          </div>
        `
          )
          .join('')}
      </div>
      <div class="info">
        <strong>Tip:</strong> Open templates in different email clients to test compatibility.
        <br>Preview server running on: http://localhost:${PORT}
      </div>
    </body>
    </html>
  `;

  const server = http.createServer(async (req, res) => {
    const parsedUrl = url.parse(req.url);
    const pathname = parsedUrl.pathname;

    if (pathname === '/') {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(indexHtml);
    } else {
      try {
        const filePath = path.join(previewDir, pathname.slice(1));
        const content = await fs.readFile(filePath, 'utf8');
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(content);
      } catch (error) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not found');
      }
    }
  });

  server.listen(PORT, () => {
    console.log(`\n🚀 Preview server running at: http://localhost:${PORT}`);
    console.log('Press Ctrl+C to stop the server\n');
  });

  return server;
}

async function main() {
  const templateName = process.argv[2];

  console.log('🎨 VocaBoost Email Template Preview Generator\n');

  try {
    // Wait for email service to initialize
    await new Promise((resolve) => setTimeout(resolve, 1000));

    const { previewDir, generatedFiles } = await generatePreviews(templateName);

    if (generatedFiles.length === 0) {
      console.error('No templates were generated.');
      process.exit(1);
    }

    console.log(
      `\n✨ Generated ${generatedFiles.length} preview(s) in: ${previewDir}`
    );

    // Start preview server
    const server = await startPreviewServer(previewDir, generatedFiles);

    // Open browser automatically (optional)
    try {
      const open = require('open');
      await open('http://localhost:3333');
    } catch (error) {
      // open package not installed, that's OK
    }

    // Handle graceful shutdown
    process.on('SIGINT', () => {
      console.log('\n\n👋 Shutting down preview server...');
      server.close(() => {
        console.log('Server closed.');
        process.exit(0);
      });
    });
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  main();
}
