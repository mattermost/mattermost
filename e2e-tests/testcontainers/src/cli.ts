#!/usr/bin/env node
// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Command} from 'commander';
import * as dotenv from 'dotenv';

import {
    registerStartCommand,
    registerStopCommand,
    registerRmCommand,
    registerRmAllCommand,
    registerUpgradeCommand,
    registerRestartCommand,
    registerInfoCommand,
} from './cli/commands';

// Load environment variables
dotenv.config();

const program = new Command();

program.name('mm-tc').description('CLI for managing Mattermost test containers').version('0.1.0');

// Register all commands
registerStartCommand(program);
registerStopCommand(program);
registerRmCommand(program);
registerRmAllCommand(program);
registerUpgradeCommand(program);
registerRestartCommand(program);
registerInfoCommand(program);

program.parse();
