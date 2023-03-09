# Mattermost Types

This package contains shared type definitions used by [the Mattermost web app](https://github.com/mattermost/mattermost-webapp) and related projects.

## Usage

For technologies that support [subpath exports](https://nodejs.org/api/packages.html#subpath-exports), such as Node.js, Webpack, and Babel, you can import these types directly from individual files.

```javascript
import {UserProfile} from '@mattermost/types/users';
```

For technologies that don't support that yet, you can add an alias in its package resolution settings to support that.

### TypeScript

In the `tsconfig.json`, you can use `compilerOptions.paths` to add that alias. This also requires a `compilerOptions.baseUrl` if you haven't set that already.

```json
{
    "compilerOptions": {
        "baseUrl": ".",
        "paths": {
            "@mattermost/types/*": ["node_modules/@mattermost/types/lib/*"]
        }
    }
}
```

### Jest

In your Jest config, you can use the `moduleNameMapper` field to add that alias.

```json
{
    "moduleNameMapper": {
        "^@mattermost/types/(.*)$": "<rootDir>/node_modules/@mattermost/types/lib/$1"
    }
}
```

## Compilation and Packaging

As a member of Mattermost with write access to our NPM organization, you can build and publish this package by running the following commands:

```bash
npm run build --workspace=packages/types
npm publish --workspace=packages/types
```

Make sure to increment the version number in `package.json` first! You can add `-0`, `-1`, etc for pre-release versions.
