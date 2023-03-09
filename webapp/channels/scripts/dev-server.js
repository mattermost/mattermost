// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/* eslint-disable no-console */

const chalk = require('chalk');
const concurrently = require('concurrently');

const {getProductStartCommands, getWorkspaceCommands} = require('./utils.js');

async function watchAllWithDevServer() {
    console.log(chalk.inverse.bold('Watching web app and all subpackages...'));

    const commands = [
        {command: 'npm:dev-server:webapp', name: 'webapp', prefixColor: 'cyan'},
    ];

    const productCommands = getProductStartCommands();
    if (productCommands.length > 0) {
        console.log(chalk.green('Found products: ' + productCommands.map((command) => command.name).join(', ')));
    } else {
        console.log(chalk.yellow('No products found'));
    }
    commands.push(...productCommands);

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
