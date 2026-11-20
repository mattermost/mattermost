// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Locator} from '@playwright/test';

import {expect} from '../src/aria';

declare const body: any;
declare const parsed: unknown;
declare const locator: Locator;

export async function rules(): Promise<void> {
    // a value whose type isn't known is a value, not an element: every matcher applies
    expect(body).toEqual({id: 'x'});
    expect(body).toBeGreaterThan(1);
    expect(parsed).toBeDefined();

    // a locator gets the locator matchers and the lib's own
    await expect(locator).toBeOn();
    await expect(locator).toHaveHrefPath('/admin_console');

    // @ts-expect-error a locator is not a value
    expect(locator).toEqual(1);
}
