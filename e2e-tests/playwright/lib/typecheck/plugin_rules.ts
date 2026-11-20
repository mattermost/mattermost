// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Page} from '@playwright/test';

import {pluginSurfaces} from '../src/aria';

// a plugin's test package adds its surface by declaration merging
declare module '../src/aria/plugins' {
    interface Plugins {
        comExampleDemo: {readonly greetButton: string};
    }
}

declare const page: Page;

export const greet: string = pluginSurfaces(page).comExampleDemo.greetButton;
