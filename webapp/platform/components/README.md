# Mattermost Components

The goal of this package is to be a place where components common to all products can be shared.

Currently a work in progress. Next steps involve implementing webpack module federation in the webapp and locking down how the development experience will work for the webapp multi product architecture.

## Usage

Coming soon with multi product architecture.

## Compilation

Building is done using rollup. This must be done so the webapp webpack will pick up the changes. (multi product development experience coming soon)

```bash
npm run build
```

or from the root of the webapp with

```bash
npm run build --workspace=packages/mattermost
```

