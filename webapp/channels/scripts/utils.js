// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

const fs = require('fs');
const path = require('path');

const chalk = require('chalk');

const packageJson = require('../../package.json');

function getProductStartCommands() {
    const commands = [];

    if (fs.existsSync('../focalboard')) {
        commands.push({command: 'make watch-product', cwd: '../focalboard', name: 'boards', prefixColor: 'blue'});
    }

    if (fs.existsSync('../playbooks')) {
        commands.push({command: 'npm run start:product', cwd: '../playbooks', name: 'playbooks', prefixColor: 'green'});
    }

    return commands;
}

function getWorkspaces() {
    return packageJson.workspaces;
}

function getWorkspacesContainingScript(scriptName) {
    return getWorkspaces().filter((workspace) => {
        // eslint-disable-next-line global-require
        const workspacePackageJson = require(path.join(__dirname, '..', workspace, 'package.json'));

        return workspacePackageJson?.scripts?.[scriptName];
    });
}

/**
 * Returns an array of concurrently commands to run a given script on every workspace that contains it.
 */
function getWorkspaceCommands(scriptName) {
    return getWorkspacesContainingScript(scriptName).map((workspace) => ({
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
    getProductStartCommands,
    getWorkspaces,
    getWorkspaceCommands,
};
