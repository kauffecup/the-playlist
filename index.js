require('dotenv').config();

const app = require('./server');
const { authPromise } = app;
const spotify = require('./spotify');
const { puppeteerLogin, puppeteerClose } = require('./puppeteer');

// Start her up, boys
app.listen(app.get('port'), () => {
  console.log(`Express server listening on port ${app.get('port')}`);
  console.log('attempting headless authentication');
  puppeteerLogin();
});

authPromise.then(() => {
  console.log('authenticated')
  puppeteerClose();
});
