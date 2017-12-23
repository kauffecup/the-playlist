const SpotifyWebApi = require('spotify-web-api-node');

const spotify = new SpotifyWebApi({
  clientId: process.env.APP_CLIENT_ID,
  clientSecret: process.env.APP_CLIENT_SECRET,
  redirectUri: process.env.APP_REDIRECT_URI
});

module.exports = spotify;
