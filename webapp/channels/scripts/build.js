// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/* eslint-disable no-console */

const chalk = require('chalk');
const concurrently = require('concurrently');

const {getWorkspaceCommands} = require('./utils.js');

async function buildAll() {
    console.log(chalk.inverse.bold('Building subpackages...') + '\n');

    try {
        const {result} = concurrently(
            getWorkspaceCommands('build'),
            {
                killOthers: 'failure',
            },
        );

        await result;
    } catch (e) {
        console.error(chalk.inverse.bold.red('Failed to build subpackages'), e);
        return;
    }

    console.log('\n' + chalk.inverse.bold('Subpackages built! Building web app...') + '\n');

    try {
        // It's not necessary to run this single command through concurrently, but it makes the output consistent
        const {result} = concurrently(
            [
                {command: 'npm:build:webapp', name: 'webapp', prefixColor: 'cyan'},
            ],
        );

        await result;
    } catch (e) {
        console.error(chalk.inverse.bold.red('Failed to build web app'), e);
        return;
    }

    console.log('\n' + chalk.inverse.bold('Web app built!'));
}

buildAll();
