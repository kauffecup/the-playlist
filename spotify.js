const SpotifyWebApi = require('spotify-web-api-node');
const ProgressBar = require('progress');

const spotify = new SpotifyWebApi({
  clientId: process.env.APP_CLIENT_ID,
  clientSecret: process.env.APP_CLIENT_SECRET,
  redirectUri: process.env.APP_REDIRECT_URI
});

const getOrCreatePlaylist = async (id, title, playlists) => {
  let playlist = playlists.find(({ name }) => name === title);
  if (!playlist) {
    console.log(`No playlist found with name ${title}, creating now`);
    ({ body: playlist } = await spotify.createPlaylist(id, title, { public: true }));
  }
  return playlist;
};

const getAll = async (limit, label, func) => {
  let bar;
  let fetched = [];
  let items = [];
  let offset = 0;
  let total = 50; // temp total value until first response comes back
  while (fetched.length < total) {
    ({ items, total } = await func({ limit, offset }));
    if (!bar) {
      bar = new ProgressBar(`fetching ${label} [:bar] :current/:total (:percent) in :elapseds (time remaining :etas)`, {
        complete: '=',
        incomplete: '-',
        width: 20,
        total
      });
    }
    offset += items.length;
    fetched = fetched.concat(items);
    bar.update(fetched.length / total);
  }
  return fetched;
};

const getAllPlaylists = async (id) =>
  getAll(50, 'playlists', async ({ limit, offset }) => {
    const { body: { items, total } } = await spotify.getUserPlaylists(id, { limit, offset });
    return { items, total };
  });

const getThisWeeksAlbums = async () => {
  const albums = getAll(20, 'albums', async ({ limit, offset }) => {
    let { body: { albums: { items, total } } } = await spotify.searchAlbums('tag:new', { limit, offset });
    ({ body: { albums: items } } = await spotify.getAlbums(items.map(({ id }) => id)));
    return { items, total }
  });
  console.log(albums)
};

module.exports = spotify;
module.exports.getAllPlaylists = getAllPlaylists;
module.exports.getOrCreatePlaylist = getOrCreatePlaylist;
module.exports.getThisWeeksAlbums = getThisWeeksAlbums;
