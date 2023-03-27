// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/* eslint-disable no-console */

const chalk = require('chalk');
const concurrently = require('concurrently');

const {getWorkspaceCommands} = require('./utils.js');

async function watchAllWithDevServer() {
    console.log(chalk.inverse.bold('Watching web app and all subpackages...'));

    const commands = [
        {command: 'npm:dev-server:webapp', name: 'webapp', prefixColor: 'cyan'},
        {command: 'npm:start:product --workspace=boards', name: 'boards', prefixColor: 'blue'},
        {command: 'npm:start:product --workspace=playbooks', name: 'playbooks', prefixColor: 'red'},
    ];

    commands.push(...getWorkspaceCommands('run'));

    console.log('\n');

    const {result} = concurrently(
        commands,
        {
            killOthers: 'failure',
        },
    );
    await result;
}

watchAllWithDevServer();
