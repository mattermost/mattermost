// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/* eslint-disable no-console */

const chalk = require('chalk');
const concurrently = require('concurrently');

const {getPlatformCommands} = require('./utils.js');

async function watchAllWithDevServer() {
    console.log(chalk.inverse.bold('Watching web app and all subpackages...'));

    const commands = [
        {command: 'npm:dev-server --workspace=channels', name: 'webapp', prefixColor: 'cyan'},
    ];

    const useProductDevServers = process.env.MM_USE_PRODUCT_DEV_SERVERS !== 'false';
    if (useProductDevServers) {
        commands.push({command: 'npm:start:dev-server --workspace=boards', name: 'boards', prefixColor: 'blue'});
        commands.push({command: 'npm:start:dev-server --workspace=playbooks', name: 'playbooks', prefixColor: 'red'});
    } else {
        commands.push({command: 'npm:start --workspace=boards', name: 'boards', prefixColor: 'blue'});
        commands.push({command: 'npm:start --workspace=playbooks', name: 'playbooks', prefixColor: 'red'});
    }

    commands.push(...getPlatformCommands('run'));

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
