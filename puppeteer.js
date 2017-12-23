const puppeteer = require('puppeteer');

/** Browser Constants */
const WIDTH = 800;
const HEIGHT = 800;
const HEADLESS = true;

/** Browser reference */
let browser;

/** Selectors */
const LOGIN_BUTTON_SELECTOR = 'a[href*="login"]';
const USERNAME_INPUT_SELECTOR = 'input[name="username"]';
const USERNAME_PASSWORD_SELECTOR = 'input[name="password"]';
const LOGIN_SUBMIT_BUTTON_SELECTOR = '.row-submit button';

const puppeteerLogin = async () => {
  browser = await puppeteer.launch({
    headless: HEADLESS,
    args: [`--window-size=${WIDTH},${HEIGHT}`]
  });
  
  const page = await browser.newPage();
  // Go to the URL and wait for the loaded class to appear
  await page.goto(process.env.APP_LOGIN_URI);
  await page.setViewport({ width: WIDTH, height: HEIGHT });

  await page.waitForSelector(LOGIN_BUTTON_SELECTOR);
  await page.click(LOGIN_BUTTON_SELECTOR);

  await [
    page.waitForSelector(USERNAME_INPUT_SELECTOR),
    page.waitForSelector(USERNAME_PASSWORD_SELECTOR),
    page.waitForSelector(LOGIN_SUBMIT_BUTTON_SELECTOR)
  ];
  
  await page.type(USERNAME_INPUT_SELECTOR, process.env.CLIENT_USERNAME);
  await page.type(USERNAME_PASSWORD_SELECTOR, process.env.CLIENT_PASSWORD);
  await page.click(LOGIN_SUBMIT_BUTTON_SELECTOR);
}

const puppeteerClose = () => {
  browser.close();
}

module.exports.puppeteerLogin = puppeteerLogin;
module.exports.puppeteerClose = puppeteerClose;
