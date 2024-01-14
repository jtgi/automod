# Farcaster Landscape

A project by esdotge.eth: https://zora.co/collect/zora:0x0d299f28f6c3d01332bbd73b51bcee3dcd71eb26/2

## Development

### Google API Credentials

Setup Google Sheets credentials and fill out the .env file

- https://medium.com/@a.marenkov/how-to-get-credentials-for-google-sheets-456b7e88c430

From your terminal:

```sh
npm run dev
```

This starts your app in development mode, rebuilding assets on file changes.

## Deployment

```sh
npm run build
```

Then run the app in production mode:

```sh
npm start
```

Now you'll need to pick a host to deploy it to.

## CI/CD

Commits to main deploy on fly
