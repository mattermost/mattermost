// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import path from 'node:path';

// Resolved relative to this module's own location (not the caller's cwd or the monorepo), so it
// keeps working once `@mattermost/playwright-lib` is installed as an npm package with no access
// to the rest of the repo. `preserveModules` keeps `containers/assets` alongside this file's
// compiled output in `dist`, same as `src`.
//
// `__dirname` rather than `import.meta.url`: despite `"type": "module"`, Playwright loads this
// package via `require()`, not `import()` — and Node's require()-of-ESM interop disallows
// `import.meta` (throws "Cannot use 'import.meta' outside a module"), while `__dirname` still
// resolves since Node wraps the module as CommonJS to support that require() call.
const assetsDir = path.join(__dirname, 'assets');

export function containerAssetPath(...segments: string[]): string {
    return path.join(assetsDir, ...segments);
}
