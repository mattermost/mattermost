// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import yargs from 'yargs';
import {hideBin} from 'yargs/helpers';

export async function initializeYargs() {
    return yargs(hideBin(process.argv)).
        default('includeFile', '').
        default('excludeFile', '').
        argv;
}
