// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

const path = require('path');

const chalk = require('chalk');

const packageJson = require('../package.json');

function getWorkspaces() {
    return packageJson.workspaces;
}

function getPlatformPackagesContainingCommand(scriptName) {
    return getWorkspaces().filter((workspace) => {
        if (!workspace.startsWith('platform/')) {
            return false;
        }

        // eslint-disable-next-line global-require
        const workspacePackageJson = require(path.join(__dirname, '..', workspace, 'package.json'));

        return workspacePackageJson?.scripts?.[scriptName];
    });
}

/**
 * Returns an array of concurrently commands to run a given script on every platform workspace that contains it.
 */
function getPlatformCommands(scriptName) {
    return getPlatformPackagesContainingCommand(scriptName).map((workspace) => ({
        command: `npm:${scriptName} --workspace=${workspace}`,
        name: workspace.substring(workspace.lastIndexOf('/') + 1),
        prefixColor: getColorForWorkspace(workspace),
    }));
}

const workspaceColors = ['green', 'magenta', 'yellow', 'red', 'blue'];
function getColorForWorkspace(workspace) {
    const index = getWorkspaces().indexOf(workspace);

    return index === -1 ? chalk.white : workspaceColors[index % workspaceColors.length];
}

module.exports = {
    getPlatformCommands,
};
