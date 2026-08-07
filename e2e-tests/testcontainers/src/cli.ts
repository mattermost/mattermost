#!/usr/bin/env node
// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import * as fs from 'fs';
import * as path from 'path';

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

// Read version and description from package.json at runtime
const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf-8'));

const program = new Command();

const binName = Object.keys(pkg.bin)[0];
program.name(binName).description(pkg.description).version(pkg.version, '-v, --version');

// Register all commands
registerStartCommand(program);
registerStopCommand(program);
registerRmCommand(program);
registerRmAllCommand(program);
registerUpgradeCommand(program);
registerRestartCommand(program);
registerInfoCommand(program);

program.parse();
