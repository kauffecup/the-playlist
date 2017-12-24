require('dotenv').config();

const server = require('./server');
const { authPromise, app } = server;
const spotify = require('./spotify');
const { puppeteerLogin, puppeteerClose } = require('./puppeteer');

const NEW_ALBUMS = 'New 100 Albums';
const NEW_SINGLES = 'New 100 Singles';

// Start her up, boys
server.listen(app.get('port'), () => {
  console.log(`Express server listening on port ${app.get('port')}`);
  console.log('attempting headless authentication');
  puppeteerLogin();
});

authPromise.then(async () => {
  // once authenitcated can kill puppeteer and the server
  puppeteerClose();
  server.close();
  // get user information for a fun print statement
  const { body: { id, email, display_name } } = await spotify.getMe();
  console.log(`authenticated as ${display_name} (${email})`);
  // find new 100 albums and new 100 singles
  const playlists = await spotify.getAllPlaylists(id);
  const new100albums = await spotify.getOrCreatePlaylist(id, NEW_ALBUMS, playlists);
  const new100singles = await spotify.getOrCreatePlaylist(id, NEW_SINGLES, playlists);
  console.log(`Found "${NEW_ALBUMS}" at ${new100albums.id}`);
  console.log(`Found "${NEW_SINGLES}" at ${new100singles.id}`);
});
