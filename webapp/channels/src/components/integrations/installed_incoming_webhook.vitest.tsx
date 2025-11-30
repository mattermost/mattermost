// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {IncomingWebhook} from '@mattermost/types/integrations';

import InstalledIncomingWebhook from 'components/integrations/installed_incoming_webhook';

import {renderWithContext, screen} from 'tests/vitest_react_testing_utils';

describe('components/integrations/InstalledIncomingWebhook', () => {
    const incomingWebhook: IncomingWebhook = {
        id: '9w96t4nhbfdiij64wfqors4i1r',
        channel_id: '1jiw9kphbjrntfyrm7xpdcya4o',
        create_at: 1502455422406,
        delete_at: 0,
        description: 'build status',
        display_name: 'build',
        team_id: 'eatxocwc3bg9ffo9xyybnj4omr',
        update_at: 1502455422406,
        user_id: 'zaktnt8bpbgu8mb6ez9k64r7sa',
        username: 'username',
        icon_url: 'http://test/icon.png',
        channel_locked: false,
    };

    const teamId = 'testteamid';

    const baseProps = {
        incomingWebhook,
        onDelete: () => {}, //eslint-disable-line no-empty-function
        creator: {username: 'creator'},
        canChange: true,
        team: {
            id: teamId,
            name: 'test',
            create_at: 1502455422406,
            delete_at: 0,
            update_at: 1502455422406,
            type: 'O' as const,
            display_name: 'name',
            scheme_id: 'id',
            allow_open_invite: false,
            group_constrained: false,
            description: '',
            email: '',
            company_name: '',
            allowed_domains: '',
            invite_id: '',
        },
        channel: {
            id: '1jiw9kphbjrntfyrm7xpdcya4o',
            name: 'town-square',
            create_at: 1502455422406,
            delete_at: 0,
            update_at: 1502455422406,
            team_id: teamId,
            type: 'O' as const,
            display_name: 'name',
            header: 'header',
            purpose: 'purpose',
            last_post_at: 0,
            last_root_post_at: 0,
            creator_id: 'id',
            scheme_id: 'id',
            group_constrained: false,
        },
    };

    test('should match snapshot', () => {
        const {container} = renderWithContext(
            <InstalledIncomingWebhook {...baseProps}/>,
        );
        expect(container).toMatchSnapshot();
    });

    test('should not have edit and delete actions if user does not have permissions to change', () => {
        const props = {...baseProps, canChange: false};
        const {container} = renderWithContext(
            <InstalledIncomingWebhook {...props}/>,
        );
        expect(container.querySelector('.item-actions')).not.toBeInTheDocument();
    });

    test('should have edit and delete actions if user can change webhook', () => {
        const {container} = renderWithContext(
            <InstalledIncomingWebhook {...baseProps}/>,
        );
        expect(container.querySelector('.item-actions a')).toBeInTheDocument();

        // Delete link exists (rendered by DeleteIntegrationLink)
        expect(screen.getByText('Delete')).toBeInTheDocument();
    });

    test('Should have the same name and description on view as it has in incomingWebhook', () => {
        const props = {...baseProps, canChange: false};
        const {container} = renderWithContext(
            <InstalledIncomingWebhook {...props}/>,
        );

        expect(container.querySelector('.item-details__description')?.textContent).toBe('build status');
        expect(container.querySelector('.item-details__name')?.textContent).toBe('build');
    });

    test('Should not display description as it is null', () => {
        const newIncomingWebhook: IncomingWebhook = {...incomingWebhook, description: ''};
        const props = {...baseProps, incomingWebhook: newIncomingWebhook, canChange: false};
        const {container} = renderWithContext(
            <InstalledIncomingWebhook {...props}/>,
        );
        expect(container.querySelector('.item-details__description')).not.toBeInTheDocument();
    });

    test('Should not render any nodes as there are no filtered results', () => {
        const props = {...baseProps, filter: 'someLongText', canChange: false};
        const {container} = renderWithContext(
            <InstalledIncomingWebhook {...props}/>,
        );
        expect(container.firstChild).toBeNull();
    });

    test('Should render a webhook item as filtered result is true', () => {
        const props = {...baseProps, filter: 'buil', canChange: true};
        const {container} = renderWithContext(
            <InstalledIncomingWebhook {...props}/>,
        );
        expect(container.querySelector('.item-details')).toBeInTheDocument();
    });
});
