// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {screen} from '@testing-library/react';
import React from 'react';

import type {IncomingWebhook} from '@mattermost/types/integrations';

import InstalledIncomingWebhook from 'components/integrations/installed_incoming_webhook';

import {renderWithContext} from 'tests/react_testing_utils';

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

    const initialState = {
        entities: {
            general: {
                config: {},
            },
            users: {
                currentUserId: 'currentUserId',
            },
        },
    };

    const baseProps = {
        incomingWebhook,
        onDelete: jest.fn(),
        creator: {username: 'creator'},
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
            <InstalledIncomingWebhook
                {...baseProps}
                canChange={true}
            />,
            initialState,
        );
        expect(container).toMatchSnapshot();
    });

    test('should not have edit and delete actions if user does not have permissions to change', () => {
        const {container} = renderWithContext(
            <InstalledIncomingWebhook
                {...baseProps}
                canChange={false}
            />,
            initialState,
        );
        expect(container.querySelector('.item-actions')).toBeNull();
    });

    test('should have edit and delete actions if user can change webhook', () => {
        const {container} = renderWithContext(
            <InstalledIncomingWebhook
                {...baseProps}
                canChange={true}
            />,
            initialState,
        );
        expect(container.querySelector('.item-actions')).not.toBeNull();
        expect(screen.getByText('Edit')).toBeInTheDocument();
        expect(screen.getByText('Delete')).toBeInTheDocument();
    });

    test('Should have the same name and description on view as it has in incomingWebhook', () => {
        const {container} = renderWithContext(
            <InstalledIncomingWebhook
                {...baseProps}
                canChange={false}
            />,
            initialState,
        );

        expect(container.querySelector('.item-details__description')!.textContent).toBe('build status');
        expect(container.querySelector('.item-details__name')!.textContent).toBe('build');
    });

    test('Should not display description as it is null', () => {
        const newIncomingWebhook: IncomingWebhook = {...incomingWebhook, description: ''};
        const {container} = renderWithContext(
            <InstalledIncomingWebhook
                {...baseProps}
                incomingWebhook={newIncomingWebhook}
                canChange={false}
            />,
            initialState,
        );
        expect(container.querySelector('.item-details__description')).toBeNull();
    });

    test('Should not render any nodes as there are no filtered results', () => {
        const {container} = renderWithContext(
            <InstalledIncomingWebhook
                {...baseProps}
                filter={'someLongText'}
                canChange={false}
            />,
            initialState,
        );
        expect(container.firstChild).toBeNull();
    });

    test('Should render a webhook item as filtered result is true', () => {
        const {container} = renderWithContext(
            <InstalledIncomingWebhook
                {...baseProps}
                filter={'buil'}
                canChange={true}
            />,
            initialState,
        );
        expect(container.querySelector('.item-details')).not.toBeNull();
    });
});
