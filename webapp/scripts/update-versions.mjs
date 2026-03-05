// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {execSync} from 'node:child_process';

function exitWithUsageMessage() {
    console.log('Usage: node scripts/update-versions.mjs monorepo_version');
    process.exit(1);
}

if (process.argv.length !== 3) {
    exitWithUsageMessage();
}

const version = process.argv[2];
if (!(/^\d+\.\d+\.\d+(\-\d+)?$/).test(version)) {
    // The version provided appears to be invalid
    exitWithUsageMessage();
}

// These workspaces and packages within the monorepo all synchronize their versions with the web app and server
const workspaces = [
    'channels',
    'platform/client',
    'platform/mattermost-redux',
    'platform/types',
];
const packages = [
    '@mattermost/client',
    '@mattermost/types',
];

// Update any explicit dependencies between packages so that, for example, mattermost-redux@12.13.14 will depend on
// @mattermost/client@12.13.14
for (const workspace of workspaces) {
    for (const packageName of packages) {
        const escapedName = packageName.replace('/', '\\/');
        execSync(`sed -i "" "s/\\"${escapedName}\\": \\"[0-9]*\\.[0-9]*\\.[0-9]*\\",/\\"${escapedName}\\": \\"${version}\\",/g" ${workspace}/package.json`);
    }
}

// Update the versions of the packages in their package.jsons and apply the dependency updates made above to the
// package-lock.json
const workspacesArguments = workspaces.map((workspace) => `-w ${workspace}`).join(' ');
execSync(`npm version ${version} --no-git-tag-version ${workspacesArguments}`);
