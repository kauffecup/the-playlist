const SpotifyWebApi = require('spotify-web-api-node');
const ProgressBar = require('progress');
const Promise = require('bluebird');
const moment = require('moment');
const { flatten, take } = require('lodash');

const ALBUM_TYPE = 'album';
const SINGLE_TYPE = 'single';

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
  
  const arrayLength = Math.ceil(total / limit);
  const requestParams = Array.from(new Array(arrayLength)).map((_, i) => ({
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

const getThisWeeksAlbumsAndSingles = async () => {
  const albums = await getAll(20, 'albums', async ({ limit, offset }) => {
    let { body: { albums: { items, total } } } = await spotify.searchAlbums('tag:new', { limit, offset });
    ({ body: { albums: items } } = await spotify.getAlbums(items.map(({ id }) => id)));
    return { items, total }
  });

  const begSaturday = moment().day(-1).subtract(7, 'days').startOf('day');
  const endFriday = moment().day(-2).endOf('day');
  const thisWeek = albums.filter(({ release_date }) => {
    const releaseDate = moment(release_date);
    return begSaturday < releaseDate && releaseDate < endFriday;
  }).sort(({ popularity: aPop }, { popularity: bPop }) => bPop - aPop);

  const thisWeekAlbums = thisWeek.filter(({ album_type }) => album_type === ALBUM_TYPE);
  const thisWeekSingles = thisWeek.filter(({ album_type }) => album_type  === SINGLE_TYPE);
  
  return { albums: thisWeekAlbums.slice(0, 100), singles: thisWeekSingles.slice(0, 100) };
};

const replacePlaylistWithAlbumTracks = async (id, playlistId, playlistName, albums) => {
  const maxUris = 10;
  let trackUris = flatten(albums.map(({ tracks }) => tracks.items.map(({ uri }) => uri)));

  const total = trackUris.length;
  let tracksAdded = 0;
  const bar = new ProgressBar(`Adding tracks to ${playlistName} [:bar] :current/:total (:percent)`, barOpts(total));

  let batch = take(trackUris, maxUris);
  bar.tick(batch.length);
  trackUris = trackUris.slice(maxUris);
  await spotify.replaceTracksInPlaylist(id, playlistId, batch);

  while (trackUris.length) {
    let batch = take(trackUris, maxUris);
    bar.tick(batch.length);
    trackUris = trackUris.slice(maxUris);
    await spotify.addTracksToPlaylist(id, playlistId, batch);
  }
};

const formatAlbums = (albums) => albums.map(({ artists, name, popularity, release_date }) => ({
  artists: artists.map(({ name }) => name).join(', '),
  date: release_date,
  name,
  popularity
}));

module.exports = spotify;
module.exports.getAllPlaylists = getAllPlaylists;
module.exports.getOrCreatePlaylist = getOrCreatePlaylist;
module.exports.getThisWeeksAlbumsAndSingles = getThisWeeksAlbumsAndSingles;
module.exports.replacePlaylistWithAlbumTracks = replacePlaylistWithAlbumTracks;
module.exports.formatAlbums = formatAlbums;
