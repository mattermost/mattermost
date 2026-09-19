// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import chalk from 'chalk';

const PREFIX = chalk.cyan('[testcontainers]');

export function logTestcontainers(message: string): void {
    // eslint-disable-next-line no-console
    console.log(`${PREFIX} ${message}`);
}

export function warnTestcontainers(message: string): void {
    // eslint-disable-next-line no-console
    console.warn(`${PREFIX} ${message}`);
}

export function errorTestcontainers(message: string): void {
    // eslint-disable-next-line no-console
    console.error(`${PREFIX} ${message}`);
}
