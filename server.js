require('dotenv').config();
const app = require('./src/app');

const PORT = process.env.PORT || 3000;

// Start server
app.listen(PORT, () => {
    console.log(`VocaBoost Backend running on port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV}`);
});