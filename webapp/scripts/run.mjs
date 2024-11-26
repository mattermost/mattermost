// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/* eslint-disable no-console, no-process-env */

import chalk from 'chalk';
import concurrently from 'concurrently';

import {makeRunner} from './runner.mjs';
import {getExitCode, getPlatformCommands} from './utils.mjs';

async function watchAll(useRunner) {
    if (!useRunner) {
        console.log(chalk.inverse.bold('Watching web app and all subpackages...'));
    }

    const commands = [
        {command: 'npm:run --workspace=channels', name: 'webapp', prefixColor: 'cyan'},
    ];

    commands.push(...getPlatformCommands('run'));

    let runner;
    if (useRunner) {
        runner = makeRunner(commands);
    }

    console.log('\n');

    const {result, commands: runningCommands} = concurrently(
        commands,
        {
            killOthers: 'failure',
            outputStream: runner?.getOutputStream(),
        },
    );

    runner?.addCloseListener(() => {
        for (const command of runningCommands) {
            command.kill('SIGINT');
        }
    });

    let exitCode = 0;
    try {
        await result;
    } catch (closeEvents) {
        exitCode = getExitCode(closeEvents, 0);
    }
    return exitCode;
}

const useRunner = process.argv[2] === '--runner' || process.env.MM_USE_WEBAPP_RUNNER;

watchAll(useRunner).then((exitCode) => {
    process.exit(exitCode);
});

