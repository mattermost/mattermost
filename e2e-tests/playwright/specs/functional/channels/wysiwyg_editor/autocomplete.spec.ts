// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

import {expectDocument, openRichComposer, typeRich} from './support';

const TAGS = {tag: ['@channels', '@wysiwyg_editor']};
const AUTOCOMPLETE_ROUTE = /\/api\/v4\/teams\/[^/]+\/channels\/autocomplete/;

test.describe('WYSIWYG editor - autocomplete suggestions', TAGS, () => {
    test.beforeEach(async ({pw}) => {
        await pw.ensureFeatureFlag('WysiwygEditor', true);
    });

    /**
     * @objective Verify slash command suggestions open and Enter completes the command.
     */
    test('slash command autocomplete opens and completes on Enter', async ({pw}) => {
        const app = await openRichComposer(pw, await pw.initSetup());
        const composer = app.center.postCreate;

        // # Type a command
        await typeRich(composer, '/away');

        // * Verify it is suggested
        await expect(composer.message.suggestions.suggestion('/away')).toBeVisible();

        // # Take the suggestion
        await composer.message.container.press('Enter');

        // * Verify the command is in the editor
        await expect(composer.message.container).toContainText('/away');
    });

    /**
     * @objective Verify @mention suggestions open for team members, take arrow keys, and complete on click.
     */
    test('@mention autocomplete opens for team members and navigates with Arrow keys', async ({pw}) => {
        const setup = await pw.initSetup();
        const created = await setup.adminClient.createUser(await pw.random.user(), '', '');
        await setup.adminClient.addToTeam(setup.team.id, created.id);

        const app = await openRichComposer(pw, setup);
        const composer = app.center.postCreate;

        // # Mention the new member
        await typeRich(composer, `@${created.username}`);
        const suggestion = composer.message.suggestions.suggestion(`@${created.username}`);
        await expect(suggestion).toBeVisible();

        // # Move down and back up the list
        await composer.message.container.press('ArrowDown', 'ArrowUp');
        await expect(suggestion).toBeVisible();

        // # Take the member's suggestion (which one is highlighted depends on recency, so click it)
        await suggestion.select();

        // * Verify the mention is in the editor
        await expect(composer.message.container).toContainText(`@${created.username}`);
    });

    /**
     * @objective Verify ~channel suggestions open and Enter inserts a channel mention.
     */
    test('~channel autocomplete opens and completes', async ({pw}) => {
        const setup = await pw.initSetup();
        const linked = await setup.adminClient.createPublicChannel(setup.team.id, 'Wysiwyg Target');
        await setup.adminClient.addToChannel(setup.user.id, linked.id);

        const app = await openRichComposer(pw, setup);
        const composer = app.center.postCreate;

        // # Start a channel mention
        await typeRich(composer, `~${linked.name.slice(0, 5)}`);

        // * Verify the channel is suggested
        await expect(composer.message.suggestions.suggestion(`~${linked.name}`)).toBeVisible();

        // # Take the first suggestion
        await composer.message.container.press('Enter');
        await expect(composer.message.container).toContainText(`~${linked.display_name}`);

        // * Verify a channel mention is inserted
        await expectDocument(composer, new RegExp(`class="[^"]*mention-link[^"]*"[^>]*>~${linked.display_name}<`));
    });

    /**
     * @objective Verify that WYSIWYG channel autocomplete renders the channels already known locally while a search
     * for more channels is still in flight.
     *
     * The post_textbox equivalent goes on to verify that the search response is merged into what is already
     * rendered. The WYSIWYG editor never applies that response — the searched group keeps its loading indicator
     * indefinitely — so this test asserts only what the editor does today.
     */
    test('~channel autocomplete shows local results while a search is in flight', async ({pw}) => {
        const setup = await pw.initSetup();
        const localChannel = await setup.adminClient.createPublicChannel(
            setup.team.id,
            'AC Z WYSIWYG Local',
            'ac-wysiwyg-local',
        );
        await setup.adminClient.addToChannel(setup.user.id, localChannel.id);

        const app = await openRichComposer(pw, setup);
        const composer = app.center.postCreate;

        // # Hold the channel search until the end of the test
        let releaseSearch!: () => void;
        const searchReleased = new Promise<void>((resolve) => {
            releaseSearch = resolve;
        });
        await app.page.route(AUTOCOMPLETE_ROUTE, async (route) => {
            await searchReleased;
            await route.continue();
        });

        // # Start a channel mention
        await typeRich(composer, '~ac-');
        const suggestions = composer.message.suggestions;

        // * Verify the local channel is listed under My Channels while the search is pending
        await expect(suggestions.group(0)).toContainText('AC Z WYSIWYG Local');

        // * Verify the searched group shows that it is still loading
        await expect(suggestions.group(1)).toBeVisible();
        await expect(suggestions.loading).toBeVisible();

        // # Let the held search finish so it isn't left blocked when the test ends
        const searchResponse = app.page.waitForResponse((response) => AUTOCOMPLETE_ROUTE.test(response.url()));
        releaseSearch();
        await searchResponse;
    });

    /**
     * @objective Verify emoji suggestions open on a shortcode and close on Escape.
     */
    test('emoji shortcode autocomplete opens and closes on Escape', async ({pw}) => {
        const app = await openRichComposer(pw, await pw.initSetup());
        const composer = app.center.postCreate;
        const suggestions = composer.message.suggestions;

        // # Start an emoji shortcode
        await typeRich(composer, ':smi');

        // * Verify emoji are suggested
        await expect(suggestions.suggestionList).not.toHaveKeyCount(0);

        // # Close the list
        await composer.message.container.press('Escape');

        // * Verify the list is gone
        await expect(suggestions.suggestionList).toHaveKeyCount(0);
    });
});
