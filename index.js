require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const spotify = require('./spotify');

const app = express();
const router = new express.Router();
const port = process.env.PORT || 3000;

const STATE_KEY = 'spotify_auth_state';
const scopes = ['user-read-private', 'user-read-email'];

let authResolve;
let authReject;
const authPromise = new Promise((resolve, reject) => {
  authResolve = resolve;
  authReject = reject;
});

/** Generates a random string containing numbers and letters of N characters */
const generateRandomString = N => (Math.random().toString(36)+Array(N).join('0')).slice(2, N+2);

/**
 * The /login endpoint
 * Redirect the client to the spotify authorize url, but first set that user's
 * state in the cookie.
 */
router.get('/login', (_, res) => {
  const state = generateRandomString(16);
  res.cookie(STATE_KEY, state);
  res.redirect(spotify.createAuthorizeURL(scopes, state));
});

/**
 * The /callback endpoint - hit after the user logs in to spotify
 * Verify that the state we put in the cookie matches the state in the query
 * parameter. Then, if all is good, redirect the user to the user page. If all
 * is not good, redirect the user to an error page
 */
router.get('/callback', async (req, res) => {
  const { code, state } = req.query;
  const storedState = req.cookies ? req.cookies[STATE_KEY] : null;

  // first do state validation
  if (state === null || state !== storedState) {
    authReject();
    return res.status(400).send('error: state mismatch');
  }

  // if the state is valid, get the authorization code and pass it on to the client
  res.clearCookie(STATE_KEY);

  // Retrieve an access token and a refresh token
  const { body: { expires_in, access_token, refresh_token } } =
    await spotify.authorizationCodeGrant(code);

  // Set the access token on the API object to use it in later calls
  spotify.setAccessToken(access_token);
  spotify.setRefreshToken(refresh_token);

  // close our request
  authResolve();
  res.send();
});

// configure the express server
app.set('port', port);
app.use(cookieParser())
  .use(bodyParser.json())
  .use(bodyParser.urlencoded({ extended: false }))
  .use('/', router);

// Start her up, boys
app.listen(app.get('port'), () => {
  console.log('Express server listening on port ' + app.get('port'));
});

authPromise.then(() => console.log('authenticated'));
