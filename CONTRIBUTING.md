# Contributing

## Set up

Install Node.js and run `npm install` in the repository root.

## Run the extension

`npm start` opens a temporary Firefox with the extension from `src/`.

## Check a change

`npm run check` runs ESLint and `web-ext lint`.
Run it at the end of every implementation change, because it fails on unused symbols and unreachable code.
