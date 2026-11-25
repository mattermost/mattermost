// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Type-level test (gap 9): the generated createSurface() is strongly typed. Compiled by the Playwright `tsc -b` step
// against the regenerated surface. Each `@ts-expect-error` must be a real compile error, so tsc fails if the typing
// ever weakens. No runtime: this file asserts types only.

import type {Page} from '@playwright/test';

import {brandKey, createSurface, type PluginId} from '@mattermost/playwright-lib';

declare const page: Page;
const surface = createSurface(page);

// A known scope, name and keyed part type-check.
surface.app_bar().root.locator;
surface.app_bar().plugin(brandKey<PluginId>('com.mattermost.calls'));
surface.channel_settings().classification.check;

// @ts-expect-error unknown scope
surface.not_a_real_scope();

// @ts-expect-error unknown part name on a real scope
surface.app_bar().not_a_real_part;

// @ts-expect-error a bare string is not a branded PluginId: wrong key fails to compile
surface.app_bar().plugin('com.mattermost.calls');

// @ts-expect-error wrong kind: an element part has no state-driver check()
surface.app_bar().root.check;
