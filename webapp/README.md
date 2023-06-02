# Mattermost Web App

This folder contains the client code for the Mattermost web app. It's broken up into multiple packages each of which either contains an area of the app (such as `playbooks` or `boards`) or shared logic used across other packages (such as the packages located in the `platform` directory). For anyone who's used to working in [the mattermost/mattermost-webapp repo](https://github.com/mattermost/mattermost-webapp), most of that is now located in `channels`.

## npm Workspaces

To interact with a workspace using npm, such as to add a dependency or run a script, use the `--workspace` (or `--workspaces`) flag. This can be done when using built-in npm commands such as `npm add` or when running scripts. Those commands should be run from this directory.

```sh
# Add a dependency to a single package
npm add react --workspace=boards

# Build multiple packages
npm run build --workspace=platform/client --workspace=platform/components

# Test all workspaces
npm test --workspaces

# Clean all workspaces that have a clean script defined
npm run clean --workspaces --if-present
```

To install dependencies for a workspace, simply run `npm install` from this folder as you would do normally. Most packages' dependencies will be included in the root `node_modules`, and all packages' dependencies will appear in the `package-lock.json`. A `node_modules` will only be created inside a package if one of its dependencies conflicts with that of another package.

## Useful Links

- [Developer setup](https://developers.mattermost.com/contribute/developer-setup/), now included with the Mattermost server developer setup
- [Web app developer documentation](https://developers.mattermost.com/contribute/more-info/webapp/)
