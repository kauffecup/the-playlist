const SpotifyWebApi = require('spotify-web-api-node');
const ProgressBar = require('progress');
const Promise = require('bluebird');
const { flatten } = require('lodash');

const MAX_RETRIES = 5;
const RETRY_INTERVAL = 10 * 1000;

const barOpts = total => ({
  complete: '=',
  incomplete: '-',
  width: 20,
  total
});

const asyncTimeout = (duration) => new Promise((resolve) => setTimeout(resolve, duration))

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
  // first request to get total + initialize bar
  const { total } = await func({ limit });
  const bar = new ProgressBar(`${label} [:bar] :current/:total (:percent) in :elapseds (time remaining :etas)`, barOpts(total));

  const doFunc = async (args, retries) => {
    try {
      const response = await func(args);
      return response;
    } catch(e) {
      if (retries > 0) {
        bar.interrupt('request failed: ' + e.message + '. retrying!');
        await asyncTimeout(RETRY_INTERVAL);
        return doFunc(args, retries - 1);
      } else {
        throw e;
      }
    }
  }
  
  const requestParams = Array.from(new Array(Math.ceil(total / limit))).map((_, i) => ({
    limit,
    offset: i * limit
  }));

  let totalFetched = 0;
  return Promise.map(
    requestParams,
    async ({ limit, offset }) => {
      const { items } = await doFunc({ limit, offset }, MAX_RETRIES);
      totalFetched += items.length;
      bar.update(totalFetched / total)
      return items;
    },
    { concurrency: 3 }
  ).then(flatten);
};

const getAllPlaylists = async (id) =>
  getAll(50, 'playlists', async ({ limit, offset }) => {
    const { body: { items, total } } = await spotify.getUserPlaylists(id, { limit, offset });
    return { items, total };
  });

const getThisWeeksAlbums = async () => {
  const albums = await getAll(20, 'albums', async ({ limit, offset }) => {
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
