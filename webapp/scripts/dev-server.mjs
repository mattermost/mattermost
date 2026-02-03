// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/* eslint-disable no-console */

import chalk from 'chalk';
import concurrently from 'concurrently';

import {getPlatformCommands} from './utils.mjs';

async function watchAllWithDevServer() {
    console.log(chalk.inverse.bold('Watching web app and all subpackages...'));

    const commands = [
        {command: 'npm:dev-server --workspace=channels', name: 'webapp', prefixColor: 'cyan'},
    ];

    commands.push(...getPlatformCommands('run'));

    console.log('\n');

    const {result} = concurrently(
        commands,
        {
            killOthers: 'failure',
        },
    );

    let exitCode = 0;
    try {
        await result;
    } catch (closeEvents) {
        exitCode = getExitCode(closeEvents, 0);
    }
    return exitCode;
}

watchAllWithDevServer().then((exitCode) => {
    process.exit(exitCode);
});
