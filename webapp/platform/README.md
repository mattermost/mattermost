This folder contains a number of packages intended to be built and shipped separately on NPM as well as a few legacy packages for internal use only (`reselect` and `mattermost-redux`). The following documentation only applies to the newer packages and not to the legacy ones.

### Working with subpackages

To interact with one or more packages in a workspace, such as to add a dependency or run a script, use the `--workspace` (or `--workspaces`) flag. This can be done when using built-in NPM commands such as `npm add` or when running scripts. This doesn't need to be done from inside the package.

```sh
# Add a dependency to a single package
npm add react --workspace=packages/apple

# Build multiple packages
npm run build --workspace=packages/banana --workspace=packages/carrot

# Clean all workspaces
npm run clean --workspaces
```

To install dependencies for a workspace, simply run `npm install` from the root of the source tree as you would do normally. Every packages' dependencies will be included in `node_modules` and in the `package-lock.json` which are shared across the repo.

### Importing a subpackage

Subpackages should be imported using their full name, both inside the web app and when installing them using `npm`. They should not be imported using a relative path, and the `src` folder shouldn't be necessary to include.

```javascript
// Correct
import {Client4} from '@mattermost/client';
import {UserProfile} from '@mattermost/types/users';

// Incorrect
import Client4 from 'packages/client/src/client4.ts';
import {UserProfile} from '../../types/src/users';
```

Some tools have difficulty doing this on their own, but they often support import path aliases so that we can keep them consistent acrosss the code base. More details on how to do this will be provided in packages where this is necessary such as `types`.

#### Importing one subpackage into another

When building packages that depend on each other, be careful to:

1. Avoid import loops. While JavaScript lets us get away with these in most cases within a project, we cannot have two packages that depend directly with each other.
1. Not compile one subpackage into another. We don't want the published libraries to include code from one subpackage into another. They should be set up so that they're peer dependencies in the `package.json`, and if a project wants to use multiple packages, they can install them each separately.

As above, some tooling may need additional configuration to have one subpackage use code from another. For example, in packages compiled with the TypeScript compiler (tsc), you'll need to have the `tsconfig.json` from the dependent pacakge reference its dependency using the `references` field.

### Versioning subpackages

At this time, we'll have the version of each package match the version of the web app. Versions can be incremented for each affected package by using [`npm version`](https://docs.npmjs.com/cli/v6/commands/npm-version), and then `npm install` should be run to propagate those changes into the shared `package-lock.json`.

```sh
# Set a version of a single package
npm version 6.7.8 --workspace=packages/apple

# Increment the version of each package to the next minor version
npm version minor --workspaces

## Increment the version of a package to a pre-release version of the next minor version
npm version preminor --workspace=packages/apple
```

When a subpackage imports another, it should be set to depend on the `*` version of the other subpackage.

### Adding a new subpackage

To set up a new package:

1. Add a `package.json` and `README.md` for that package.
1. Ensure all source files are located in `src` and all compiled files are built to `lib`.
1. Add an entry to the `workspaces` section of the root `package.json` so that NPM is aware of your package.
1. Set up import aliases so that the package is visible from the web app to the following tools:
    1. **TypeScript** - In the root `tsconfig.json`, add an entry to the `compilerOptions.paths` section pointing to the `src` folder and an entry to the `references` section pointing to the root of your package which should contain its own `tsconfig.json`.
    
        Note that the `compilerOptions.paths` entry will differ based on if your package exports just a single module (ie a single `index.js` file) or if it exports multiple submodules.

        ```json5
        {
            "compilerOptions": {
                "paths": {
                    "@mattermost/apple": ["packages/apple/lib"], // import * as Apple from '@mattermost/apple';
                    "@mattermost/banana/*": ["packages/banana/lib/*"], // import Yellow from    '@mattermost/banana/yellow';
                }
            },
            "references": [
                {"path": "./packages/apple"},
                {"path": "./packages/banana"},
            ]
        }
        ```

    1. **Jest** - Add an entry to the `jest.moduleNameMapper` section of the root `jest.config.js` for your package. Since that setting supports regexes, you can add these to the existing patterns used by the `client` and `types` packages.
    
        Similar to TypeScript, this will differ based on if the package exports a single module or multiple modules.

        ```json
        {
            "jest": {
                "moduleNameMapper": {
                    "^@mattermost/(apple|client)$": "<rootDir>/packages/$1/src",
                    "^@mattermost/(banana|types)/(.*)$": "<rootDir>/packages/$1/src/$2",
                }
            }
        }
        ```
1. Add the compiled code to the CircleCI dependency cache. This is done by modifying the `paths` used by the `save_cache` step in `.circleci/config.yml`
    ```yml
    aliases:
      - &save_cache
        save_cache:
          paths:
            - ~/mattermost/mattermost-webapp/packages/apple/lib
            - ~/mattermost/mattermost-webapp/packages/banana/lib
    ```

### Publishing a subpackage

The following is the rough process for releasing these packages. They'll require someone with write access on our NPM organization to run them, and they'll likely change over time as we improve this process.

For full releases accompanying new versions of Mattermost:

1. Clean the repo.

    ```sh
    make clean
    ```

1. Update the version of the desired packages to match the server/web app as described above.

1. Download an up to date copy of the dependencies and update package-lock.json.

    ```sh
    make node_modules
    ```

1. Check in the changes to the package-lock.json.

1. Build the desired packages.

    ```sh
    npm run build --workspace=packages/apple --workspace=packages/banana
    ```

1. Test everything in the web app. This will be needed until the packages get their own standalone tests.

    ```sh
    make check-style check-types test
    ```

1. Assuming those pass, you can now publish those packages to npm. You can also do a dry run first or use `npm pack` to see exactly which files will be pushed.

    ```sh
    # Run a dry run which will list all the files to be included in the published package.
    npm publish --dry-run --workspace=packages/apple

    # Generate the tar file that will be uploaded to NPM for inspection.
    npm pack --workspace=packages/apple

    # Actually publish these packages. You can also use --workspaces to publish everything.
    npm publish --access=public --workspace=packages/apple --workspace=packages/banana
    ```

    The packages have now been published! There's still a few remaining cleanup tasks to do though.

1. Tag the commit for each package that has been updated. The tag name should be of the form `@mattermost/package-name@x.y.z`.

1. Push that commit and the corresponding tags up to GitHub

   ```sh
   git push release-x.y
   git push origin @mattermost/apple@x.y.z @mattermost/banana@x.y.z
   ```

#### Publishing a pre-release version

Similarly, you can publish a pre-release version of the package. This can be done either to use changes from master while developing another product/plugin or to generate a release candidate.

This process is the same as above, except the version will have a suffix like `-1`, `-2`, etc. As explained above, this can be automatically done by using `npm version preminor` for minor releases, `npm version premajor` for major releases, and `npm version prerelease` for patch releases. These versions won't be automatically installed when people add them using `npm add` without a version, but they can be installed by specifying the version number manually.

### Caveats

1. Currently, all packages are treated by CI as if they're part of the web app. This means that, for example, their style checking and tests are ran as part of the web app. In turn, that means that regardless of what tooling we use to build each package, they'll be compiled into the web app using webpack directly from source, and that it's possible for them to behave slightly differently in development compared to after release.

    Eventually, we hope to get these building in parallel (so instead of having webpack watch the whole repo for changes during development, we'll have multiple watchers for the web app and each package) which should solve this issue, but that requires much larger changes that we're not ready to do yet.
1. For packages that export multiple submodules (such as `types`), we've chosen to expose these using Node's [subpath exports](https://nodejs.org/api/packages.html#subpath-exports) feature. Some tools like Webpack support this natively, but others like TypeScript and Jest don't support it yet. We've provided steps on how to support this in the `README.md` for the `types` package, but this may vary depending on the project's setup.
