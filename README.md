# Snake: Together

Desktop Snake project recovered into its own standalone workspace.

## Local run

1. Open this folder in a terminal.
2. Install dependencies with `npm install`.
3. Start the desktop app with `npm run desktop`.

## Windows installer build

1. Make sure `snake3d.github.json` is filled in with your GitHub details.
2. Build the installer with `npm run package:win`.
3. The installer and update metadata are written into the `release/` folder.

## GitHub setup

This project is prepared for:

- a source repository
- a GitHub releases repository for installers and update files

Recommended split:

1. Source repo: `Snake-Together`
2. Release repo: `Snake-Together` (same repo is fine for now)

The app updater reads `snake3d.github.json`. Set:

- `owner`
- `releaseRepo`
- `enabled: true`

## Auto update notes

- Windows auto update is wired for the NSIS installer path, not the portable build.
- Publish the generated installer plus `latest.yml` to GitHub Releases for the configured release repo.
- The game exposes a manual updater button in Settings so players can check for updates and install the newest build.
