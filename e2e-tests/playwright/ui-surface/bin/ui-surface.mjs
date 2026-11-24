#!/usr/bin/env node
// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {runCli} from '../dist/cli.js';

const code = await runCli(process.argv.slice(2));
process.exitCode = code;
