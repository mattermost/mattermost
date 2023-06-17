# Mattermost Client

This package contains the JavaScript/TypeScript client for [Mattermost](https://github.com/mattermost/mattermost-server). It's used by [the Mattermost web app](https://github.com/mattermost/mattermost-webapp) and related projects.

## Compilation and Packaging

As a member of Mattermost with write access to our NPM organization, you can build and publish this package by running the following commands:

```bash
npm run build --workspace=platform/client
npm publish --workspace=platform/client
```

Make sure to increment the version number in `package.json` first! You can add `-0`, `-1`, etc for pre-release versions.
