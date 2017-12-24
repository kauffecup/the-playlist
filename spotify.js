const SpotifyWebApi = require('spotify-web-api-node');

const spotify = new SpotifyWebApi({
  clientId: process.env.APP_CLIENT_ID,
  clientSecret: process.env.APP_CLIENT_SECRET,
  redirectUri: process.env.APP_REDIRECT_URI
});

const getAllPlaylists = async (id) => {
  const limit = 50;
  let playlists = [];
  let items = [];
  let offset = 0;
  let total = 50; // temp total value until first response comes back
  while (playlists.length < total) {
    ({ body: { items, total } } = await spotify.getUserPlaylists(id, { limit, offset }));
    offset += items.length;
    playlists = playlists.concat(items);
  }
  return playlists;
}

const getOrCreatePlaylist = async (id, title, playlists) => {
  let playlist = playlists.find(({ name }) => name === title);
  if (!playlist) {
    console.log(`No playlist found with name ${title}, creating now`);
    ({ body: playlist } = await spotify.createPlaylist(id, title, { public: true }));
  }
  return playlist;
}

module.exports = spotify;
module.exports.getAllPlaylists = getAllPlaylists;
module.exports.getOrCreatePlaylist = getOrCreatePlaylist;
