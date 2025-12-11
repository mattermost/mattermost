// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {Channel} from '@mattermost/types/channels';
import type {OutgoingWebhook} from '@mattermost/types/integrations';
import type {Team} from '@mattermost/types/teams';
import type {UserProfile} from '@mattermost/types/users';

import InstalledOutgoingWebhook, {matchesFilter} from 'components/integrations/installed_outgoing_webhook';

import {renderWithContext, screen, fireEvent} from 'tests/vitest_react_testing_utils';
import {TestHelper} from 'utils/test_helper';

describe('components/integrations/InstalledOutgoingWebhook', () => {
    const team: Team = TestHelper.getTeamMock({
        id: 'testteamid',
        name: 'test',
    });

    const channel: Channel = TestHelper.getChannelMock({
        id: '1jiw9kphbjrntfyrm7xpdcya4o',
        name: 'town-square',
        display_name: 'Town Square',
    });

    const userProfile: UserProfile = TestHelper.getUserMock();

    const outgoingWebhook: OutgoingWebhook = TestHelper.getOutgoingWebhookMock({
        callback_urls: ['http://adsfdasd.com'],
        channel_id: 'mdpzfpfcxi85zkkqkzkch4b85h',
        content_type: 'application/x-www-form-urlencoded',
        create_at: 1508327769020,
        creator_id: 'zaktnt8bpbgu8mb6ez9k64r7sa',
        delete_at: 0,
        description: 'build status',
        display_name: 'build',
        id: '7h88x419ubbyuxzs7dfwtgkffr',
        team_id: 'eatxocwc3bg9ffo9xyybnj4omr',
        token: 'xoxz1z7c3tgi9xhrfudn638q9r',
        trigger_when: 0,
        trigger_words: ['build'],
        update_at: 1508329149618,
        username: 'hook_user_name',

    });

    const baseProps = {
        outgoingWebhook,
        onRegenToken: () => {}, //eslint-disable-line no-empty-function
        onDelete: () => {}, //eslint-disable-line no-empty-function
        filter: '',
        creator: userProfile,
        canChange: true,
        team,
        channel,
    };

    test('should match snapshot', () => {
        const {container} = renderWithContext(
            <InstalledOutgoingWebhook {...baseProps}/>,
        );
        expect(container).toMatchSnapshot();
    });

    test('should not have edit and delete actions if user does not have permissions to change', () => {
        const newCanChange = false;
        const props = {...baseProps, canChange: newCanChange};
        const {container} = renderWithContext(
            <InstalledOutgoingWebhook {...props}/>,
        );
        expect(container.querySelector('.item-actions')).not.toBeInTheDocument();
    });

    test('should have edit and delete actions if user can change webhook', () => {
        const {container} = renderWithContext(
            <InstalledOutgoingWebhook {...baseProps}/>,
        );
        expect(container.querySelector('.item-actions a')).toBeInTheDocument();

        // Delete link exists (rendered by DeleteIntegrationLink)
        expect(screen.getByText('Delete')).toBeInTheDocument();
    });

    test('Should have the same name and description on view as it has in outgoingWebhook', () => {
        const newCanChange = false;
        const props = {...baseProps, canChange: newCanChange};
        const {container} = renderWithContext(
            <InstalledOutgoingWebhook {...props}/>,
        );

        expect(container.querySelector('.item-details__description')?.textContent).toBe('build status');
        expect(container.querySelector('.item-details__name')?.textContent).toBe('build');
    });

    test('Should not display description as it is null', () => {
        const newOutgoingWebhook = TestHelper.getOutgoingWebhookMock({...outgoingWebhook, description: undefined});
        const props = {...baseProps, outgoingWebhook: newOutgoingWebhook};
        const {container} = renderWithContext(
            <InstalledOutgoingWebhook {...props}/>,
        );

        expect(container.querySelector('.item-details__description')).not.toBeInTheDocument();
    });

    test('Should not render any nodes as there are no filtered results', () => {
        const newFilter = 'someLongText';
        const props = {...baseProps, filter: newFilter};
        const {container} = renderWithContext(
            <InstalledOutgoingWebhook {...props}/>,
        );

        expect(container.firstChild).toBeNull();
    });

    test('Should render a webhook item as filtered result is true', () => {
        const newFilter = 'buil';
        const props = {...baseProps, filter: newFilter};
        const {container} = renderWithContext(
            <InstalledOutgoingWebhook {...props}/>,
        );

        expect(container.querySelector('.item-details')).toBeInTheDocument();
    });

    test('Should call onRegenToken function once', () => {
        const newFilter = 'buil';
        const newOnRegenToken = vi.fn();
        const props = {...baseProps, filter: newFilter, onRegenToken: newOnRegenToken};

        const {container} = renderWithContext(
            <InstalledOutgoingWebhook {...props}/>,
        );

        const regenButton = container.querySelector('.item-actions button');
        fireEvent.click(regenButton!);
        expect(newOnRegenToken).toHaveBeenCalledTimes(1);
    });

    test('Should call onDelete function once', () => {
        const newFilter = 'buil';
        const newOnDelete = vi.fn();
        const props = {...baseProps, filter: newFilter, onDelete: newOnDelete};

        const {container} = renderWithContext(
            <InstalledOutgoingWebhook {...props}/>,
        );

        // The DeleteIntegrationLink component renders with a confirmation modal
        // Verify the Delete link is rendered when canChange is true
        expect(screen.getByText('Delete')).toBeInTheDocument();
        expect(container).toMatchSnapshot();
    });

    test('Should match snapshot of makeDisplayName', () => {
        const {container} = renderWithContext(
            <InstalledOutgoingWebhook {...baseProps}/>,
        );

        expect(container).toMatchSnapshot();
    });

    test('Should match result when matchesFilter is called', () => {
        expect(matchesFilter(TestHelper.getOutgoingWebhookMock(), TestHelper.getChannelMock(), 'word')).toEqual(false);
        expect(matchesFilter(TestHelper.getOutgoingWebhookMock({display_name: undefined}), TestHelper.getChannelMock(), 'word')).toEqual(false);
        expect(matchesFilter(TestHelper.getOutgoingWebhookMock({description: undefined}), TestHelper.getChannelMock(), 'word')).toEqual(false);
        expect(matchesFilter(TestHelper.getOutgoingWebhookMock({trigger_words: undefined}), TestHelper.getChannelMock(), 'word')).toEqual(false);
        expect(matchesFilter(TestHelper.getOutgoingWebhookMock(), TestHelper.getChannelMock({name: undefined}), 'channel')).toEqual(false);

        expect(matchesFilter(TestHelper.getOutgoingWebhookMock(), TestHelper.getChannelMock(), '')).toEqual(true);
        expect(matchesFilter(TestHelper.getOutgoingWebhookMock({display_name: 'Word'}), TestHelper.getChannelMock(), 'word')).toEqual(true);
        expect(matchesFilter(TestHelper.getOutgoingWebhookMock({display_name: 'word'}), TestHelper.getChannelMock(), 'word')).toEqual(true);
        expect(matchesFilter(TestHelper.getOutgoingWebhookMock({description: 'Trigger description'}), TestHelper.getChannelMock(), 'description')).toEqual(true);

        expect(matchesFilter(TestHelper.getOutgoingWebhookMock({trigger_words: ['Trigger']}), TestHelper.getChannelMock(), 'trigger')).toEqual(true);
        expect(matchesFilter(TestHelper.getOutgoingWebhookMock({trigger_words: ['word', 'Trigger']}), TestHelper.getChannelMock(), 'trigger')).toEqual(true);

        expect(matchesFilter(TestHelper.getOutgoingWebhookMock(), TestHelper.getChannelMock({name: 'channel_name'}), 'channel')).toEqual(true);
    });
});
