# The Playlist(s)

[New 100 Albums](https://open.spotify.com/user/kauffecup/playlist/5qLUWpA1QY1fokpsexfyLz)

[New 100 Singles](https://open.spotify.com/user/kauffecup/playlist/01frpX1uAprT3s2gPcFXeN)

## To Run

### Set Up

#### Install Dependencies

```sh
npm install
```

### Set Environment Variables

Create a `.env` file based off of `.env.example`. Set the following fields:

```sh
APP_CLIENT_ID=<Spotify Application ID>
APP_CLIENT_SECRET=<Spotify Application Secret>

APP_LOGIN_URI=<Login Uri (http://localhost:3000/login)>
APP_REDIRECT_URI=<Redirect Uri (http://localhost:3000/callback)>

CLIENT_USERNAME=<Your Spotify Login>
CLIENT_PASSWORD=<Your Spotify Password>
```

### Run

```sh
npm run start
```

This runs `node index.js` which:

  1. Kicks off a server
  1. Spins up puppeteer to authenticate with Spotify's OAuth2
  1. Once it has the token ensures both Top 100 Albums and Top 100 Singles
     playlists exist for authenticated user
  1. Loads everything spotify tags as `new`
  1. Filters out albums and singles to those released from last last Saturday to
     last Friday
  1. Sorts albums and singles by popularity
  1. Replaces playlist tracks with tracks from newly filtered/sorted albums and
     singles
