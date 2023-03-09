// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/* eslint-disable no-console, no-process-env */

const chalk = require('chalk');
const concurrently = require('concurrently');

const {makeRunner} = require('./runner.js');

async function watchAll(useRunner) {
    if (!useRunner) {
        console.log(chalk.inverse.bold('Watching web app and all subpackages...'));
    }

    const commands = [
        {command: 'npm:run:webapp', name: 'webapp', prefixColor: 'cyan'},
        {command: 'npm run start:product', cwd: '../playbooks', name: 'playbooks', prefixColor: 'green'},
        {command: `npm:run`, cwd: 'src/packages/client', name: 'client', prefixColor: 'red'},
        {command: `npm:run`, cwd: 'src/packages/types', name: 'types', prefixColor: 'magenta'},
        {command: `npm:run`, cwd: 'src/packages/components', name: 'components', prefixColor: 'blue'},
    ];

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

    await result;
}

const useRunner = process.argv[2] === '--runner' || process.env.MM_USE_WEBAPP_RUNNER;

watchAll(useRunner);
