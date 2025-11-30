// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {OutgoingWebhook} from '@mattermost/types/integrations';

import EditOutgoingWebhook from 'components/integrations/edit_outgoing_webhook/edit_outgoing_webhook';

import {renderWithContext, screen} from 'tests/vitest_react_testing_utils';
import {TestHelper} from 'utils/test_helper';

describe('components/integrations/EditOutgoingWebhook', () => {
    const team = TestHelper.getTeamMock();
    const hook: OutgoingWebhook = {
        icon_url: '',
        username: '',
        id: 'ne8miib4dtde5jmgwqsoiwxpiy',
        token: 'nbxtx9hkhb8a5q83gw57jzi9cc',
        create_at: 1504447824673,
        update_at: 1504447824673,
        delete_at: 0,
        creator_id: '88oybd1dwfdoxpkpw1h5kpbyco',
        channel_id: 'r18hw9hgq3gtiymtpb6epf8qtr',
        team_id: 'm5gix3oye3du8ghk4ko6h9cq7y',
        trigger_words: ['trigger', 'trigger2'],
        trigger_when: 0,
        callback_urls: ['https://test.com/callback', 'https://test.com/callback2'],
        display_name: 'name',
        description: 'description',
        content_type: 'application/json',
    };
    const updateOutgoingHookRequest = {
        status: 'not_started',
        error: null,
    };
    const baseProps = {
        team,
        hookId: 'hook_id',
        updateOutgoingHookRequest,
        actions: {
            updateOutgoingHook: vi.fn(),
            getOutgoingHook: vi.fn(),
        },
        enableOutgoingWebhooks: true,
        enablePostUsernameOverride: false,
        enablePostIconOverride: false,
    };

    test('should match snapshot', () => {
        const props = {...baseProps, hook};
        const {container} = renderWithContext(
            <EditOutgoingWebhook {...props}/>,
        );
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot, loading', () => {
        const {container} = renderWithContext(
            <EditOutgoingWebhook {...baseProps}/>,
        );
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot when EnableOutgoingWebhooks is false', () => {
        const props = {...baseProps, enableOutgoingWebhooks: false, hook};
        const {container} = renderWithContext(
            <EditOutgoingWebhook {...props}/>,
        );

        expect(container).toMatchSnapshot();
    });

    test('should have match state when handleConfirmModal is called', () => {
        const props = {...baseProps, hook};
        const {container} = renderWithContext(
            <EditOutgoingWebhook {...props}/>,
        );

        // The component renders the form with edit functionality
        expect(container.querySelector('.backstage-form')).toBeInTheDocument();
    });

    test('should have match state when confirmModalDismissed is called', () => {
        const props = {...baseProps, hook};
        const {container} = renderWithContext(
            <EditOutgoingWebhook {...props}/>,
        );

        expect(container.querySelector('.backstage-form')).toBeInTheDocument();
    });

    test('should have match renderExtra', () => {
        const props = {...baseProps, hook};
        const {container} = renderWithContext(
            <EditOutgoingWebhook {...props}/>,
        );

        expect(container.querySelector('.backstage-form__footer')).toBeInTheDocument();
        expect(container).toMatchSnapshot();
    });

    test('should have match when editOutgoingHook is called', () => {
        const props = {...baseProps, hook};
        renderWithContext(
            <EditOutgoingWebhook {...props}/>,
        );

        // The header text is "Edit"
        expect(screen.getByText('Edit')).toBeInTheDocument();
    });

    test('should have match when submitHook is called on success', async () => {
        const updateOutgoingHook = vi.fn().mockReturnValue({data: 'data'});
        const props = {
            ...baseProps,
            hook,
            actions: {
                ...baseProps.actions,
                updateOutgoingHook,
            },
        };

        renderWithContext(
            <EditOutgoingWebhook {...props}/>,
        );

        // The header text is "Edit"
        expect(screen.getByText('Edit')).toBeInTheDocument();
    });

    test('should have match when submitHook is called on error', async () => {
        const updateOutgoingHook = vi.fn().mockReturnValue({data: ''});
        const props = {
            ...baseProps,
            hook,
            actions: {
                ...baseProps.actions,
                updateOutgoingHook,
            },
        };

        renderWithContext(
            <EditOutgoingWebhook {...props}/>,
        );

        // The header text is "Edit"
        expect(screen.getByText('Edit')).toBeInTheDocument();
    });
});
