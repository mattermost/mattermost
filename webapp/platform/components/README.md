# Mattermost Components

The goal of this package is to be a place where components common to all products can be shared.

Currently a work in progress. Next steps involve implementing webpack module federation in the webapp and locking down how the development experience will work for the webapp multi product architecture.

## Usage

Coming soon with multi product architecture.

## Peer dependencies

Components in this package render [`@mattermost/compass-ui`](https://www.npmjs.com/package/@mattermost/compass-ui)
primitives (`Button`, and more over time), so `@mattermost/compass-ui` is a required peer
dependency. Consumers must install it at the same version this package pins in
`peerDependencies`; otherwise npm resolves two copies and the Compass CSS custom properties
(`--button-fg`, and friends) no longer line up across the tree.

## Compilation

Building is done using rollup. This must be done so the webapp webpack will pick up the changes. (multi product development experience coming soon)

```bash
npm run build
```

or from the root of the webapp with

```bash
npm run build --workspace=platform/components
```

