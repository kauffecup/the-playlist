const SpotifyWebApi = require('spotify-web-api-node');
const ProgressBar = require('progress');
const Promise = require('bluebird');
const moment = require('moment');
const { flatten, take } = require('lodash');

/** Constants for filtering albums by type */
const ALBUM_TYPE = 'album';
const SINGLE_TYPE = 'single';

/** Constants for retrying requests */
const MAX_RETRIES = 5;
const RETRY_INTERVAL = 10 * 1000; // 10 seconds

/** Generate Options for progress bar */
const barOpts = total => ({
  complete: '=',
  incomplete: '-',
  width: 20,
  total
});

/** Helper necessary for "awaiting" a timeout */
const asyncTimeout = (duration) => new Promise((resolve) => setTimeout(resolve, duration))

/** Initialize spotify api */
const spotify = new SpotifyWebApi({
  clientId: process.env.APP_CLIENT_ID,
  clientSecret: process.env.APP_CLIENT_SECRET,
  redirectUri: process.env.APP_REDIRECT_URI
});

/**
 * Resolve with a playlist object for a given user id and playlist title.
 * Create the playlist if it doesn't exist.
 *
 * @param {String} id - The user's id
 * @param {String} title - The title of the playlist
 * @param {Array.<Playlist>} playlists - Array containing all of the user's playlists
 * @returns {Promise.<Playlist>}
 */
const getOrCreatePlaylist = async (id, title, playlists) => {
  let playlist = playlists.find(({ name }) => name === title);
  if (!playlist) {
    console.log(`No playlist found with name ${title}, creating now`);
    ({ body: playlist } = await spotify.createPlaylist(id, title, { public: true }));
  }
  return playlist;
};

/**
 * Helper method for getting all items following spotifys paging model. Formats
 * request parameters/options and passes them in to the given function. Handles
 * retrying the request if it doesn't succeed (Spotify can be flaky). Shoots off
 * multiple requests at a time in parallel.
 *
 * @param {Number} limit - Limit passed in to func with offset.
 *    TODO can be more functional and remove the need for this.
 * @param {String} label - Used for fun console logging.
 * @param {Function} func - Paging function. Takes ({ limit, offset }). Must
 *    resolve with ({ total, items }).
 * @returns {Promise.<Array.<item>>}
 */
const getAll = async (limit, label, func) => {
  // first request to get total + initialize bar
  const { total } = await func({ limit });
  const bar = new ProgressBar(`${label} [:bar] :current/:total (:percent) in :elapseds (time remaining :etas)`, barOpts(total));

  // helper func for retrying the requests upon failure
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
  
  // format the request params
  const arrayLength = Math.ceil(total / limit);
  const requestParams = Array.from(new Array(arrayLength)).map((_, i) => ({
    limit,
    offset: i * limit
  }));

  // concurrently shoot off all requests to the passed in fetch func
  // keep track of items to update the progress bar
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

/**
 * Fetch all users playlists by id.
 * Format a fetch func to pass to getAll()
 *
 * @param {String} id - User's id
 * @returns {Promise.<Array.<Playlist>>}
 */
const getAllPlaylists = async (id) =>
  getAll(50, 'playlists', async ({ limit, offset }) => {
    const { body: { items, total } } = await spotify.getUserPlaylists(id, { limit, offset });
    return { items, total };
  });

/**
 * Get top 100 albums and singles that came out between last last saturday and last
 * friday sorted by popularity.
 *
 * @returns {Promise.<{albums: Array.<Albums>, singles: Array.<Albums>}>}
 */
const getThisWeeksAlbumsAndSingles = async () => {
  // first fetch all albums tagged with new. our fetch func is two-part:
  //   1) get the partial album objects via querying `tag:new`
  //   2) fill out the full album objects that contain release_date and popularity
  const albums = await getAll(20, 'albums', async ({ limit, offset }) => {
    let { body: { albums: { items, total } } } = await spotify.searchAlbums('tag:new', { limit, offset });
    ({ body: { albums: items } } = await spotify.getAlbums(items.map(({ id }) => id)));
    return { items, total }
  });

  // filter out by date and sort by popularity
  const begSaturday = moment().day(-1).subtract(7, 'days').startOf('day');
  const endFriday = moment().day(-2).endOf('day');
  const thisWeek = albums.filter(({ release_date }) => {
    const releaseDate = moment(release_date);
    return begSaturday < releaseDate && releaseDate < endFriday;
  }).sort(({ popularity: aPop }, { popularity: bPop }) => bPop - aPop);

  // separate albums and singles. (filter preserves order so we only need to sort once)
  const thisWeekAlbums = thisWeek.filter(({ album_type }) => album_type === ALBUM_TYPE);
  const thisWeekSingles = thisWeek.filter(({ album_type }) => album_type  === SINGLE_TYPE);
  
  // return top 100 albums and singles
  return { albums: thisWeekAlbums.slice(0, 100), singles: thisWeekSingles.slice(0, 100) };
};

/**
 * Given an array of albums, replace a given playlistId for a given user with the
 * tracks on the albums.
 *
 * @param {String} id - The user's id
 * @param {String} playlistId - The playlist's id
 * @param {String} playlistName - The name of the playlist (used only for fun print statements)
 * @param {Array.<Album>} albums - Array of album objects containing tracks to upload
 * @returns {Promise} - Resolves when complete
 */
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

/**
 * Convert an array of albums into an array of formatted albums for helpful logging.
 * Condenses artists to one key/value and omits fields we don't want to print.
 *
 * @param {Array.<Album>} albums - Unformatted albums
 * @returns {Array.<Object>} An array of formatted albums
 */
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
