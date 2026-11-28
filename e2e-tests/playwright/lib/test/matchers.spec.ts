// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect} from '../src/aria/matchers';

import {expect as playwrightExpect, test, unexpected} from './serve';

/** A save button that is saving (disabled and busy), then ends as `end` after a moment. */
const saving = (end: 'saved' | 'error') => `
<button data-testid="x.save--button" disabled aria-busy="true">Save</button>
<script>
    setTimeout(() => {
        const b = document.querySelector('button');
        b.removeAttribute('aria-busy');
        ${end === 'error' ? 'b.disabled = false; // a failed save can be retried' : ''}
    }, 300);
</script>`;

test.describe('toBeSaved', () => {
    test('passes once a save finishes: disabled and no longer busy', async ({page, server}) => {
        await server.open(page, saving('saved'));
        await expect(page.getByTestId('x.save--button')).toBeSaved({timeout: 2_000});
    });

    test('fails when a save ends in an error: never disabled and not busy at once', async ({page, server}) => {
        await server.open(page, saving('error'));
        const error = await expect(page.getByTestId('x.save--button'))
            .toBeSaved({timeout: 1_000})
            .then(unexpected, (e: unknown) => e as Error);
        playwrightExpect(error.message).toContain('expected the save to finish');
        playwrightExpect(error.message).toContain('last seen: enabled, not busy');
    });
});
