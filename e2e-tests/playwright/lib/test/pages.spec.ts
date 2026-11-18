// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Locator} from '@playwright/test';

import {SurfacePage} from '../src/aria/pages';

import {expect, test} from './serve';

/** A page with two layouts, each with its own ready element; only one of them is shown. */
class TwoLayouts extends SurfacePage<string, true> {
    pathFor(origin: string): string {
        return `${origin}/`;
    }

    get ready(): readonly [Locator, Locator] {
        return [this.page.getByTestId('mobile.view'), this.page.getByTestId('desktop.view')];
    }
}

test.describe('goto', () => {
    test('waits for whichever ready element is visible, even when a hidden one comes first', async ({page, server}) => {
        test.setTimeout(5_000);
        await server.open(page, '<p hidden data-testid="mobile.view">m</p><p data-testid="desktop.view">d</p>');
        const layouts = new TwoLayouts(page);
        expect(await layouts.goto(server.origin)).toBe(layouts);
    });

    test('waits for a ready element that shows after navigation', async ({page, server}) => {
        test.setTimeout(5_000);
        await server.open(
            page,
            '<p id="d" hidden data-testid="desktop.view">d</p>' +
                "<script>setTimeout(() => { document.getElementById('d').hidden = false; }, 200)</script>",
        );
        const started = Date.now();
        await new TwoLayouts(page).goto(server.origin);
        expect(Date.now() - started).toBeGreaterThanOrEqual(150);
    });
});
