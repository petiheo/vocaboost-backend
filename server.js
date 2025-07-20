require('dotenv').config();
const PORT = process.env.PORT;

app = require('./src/app');
app.listen(PORT, () => {
  console.log(`URL of app: http://127.0.0.1:${PORT}/`);
});
