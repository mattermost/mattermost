// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Locator} from '@playwright/test';

import {expect} from '@mattermost/playwright-lib';

/** A people picker's user rows on the generated page objects (`<scope>.user:<id>`). */
type UserRows<Row extends {locator: Locator}> = {
    userList: {keys(): Promise<string[]>};
    user(user: {id: string}): Row;
};

/** The user row the keyboard has highlighted: the list marks it with a class, not with ARIA. */
export async function highlightedUser<Row extends {locator: Locator}>(rows: UserRows<Row>): Promise<Row> {
    const ids = await rows.userList.keys();
    // The keyboard highlight is a CSS class with no corresponding ARIA state.
    const classes = await Promise.all(ids.map((id) => rows.user({id}).locator.getAttribute('class')));
    const index = classes.findIndex((c) => c?.split(' ').includes('more-modal__row--selected'));
    expect(index, 'a highlighted row').toBeGreaterThanOrEqual(0);
    return rows.user({id: ids[index]});
}
