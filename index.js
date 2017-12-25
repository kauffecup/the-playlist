require('dotenv').config();

const columnify = require('columnify');
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
  // once playlists exist, begin fetching all albums that came out this week
  const { albums, singles } = await spotify.getThisWeeksAlbumsAndSingles();
  console.log('Found top 100 albums and top 100 singles');
  // once we have the albums and singles, add their tracks to our playlists
  await spotify.replacePlaylistWithAlbumTracks(id, new100albums.id, NEW_ALBUMS, albums);
  await spotify.replacePlaylistWithAlbumTracks(id, new100singles.id, NEW_SINGLES, singles);
  console.log('we did it!');
  const columns = ['name', 'artists', 'popularity', 'date'];
  console.log('\n\n\nAlbums:')
  console.log(columnify(spotify.formatAlbums(albums), { columns }));
  console.log('\n\n\nSingles:');
  console.log(columnify(spotify.formatAlbums(singles), { columns }));
});
