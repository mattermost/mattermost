// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import type {MouseEvent} from 'react';

import {General} from 'mattermost-redux/constants';

import ActivityLogModal from 'components/activity_log_modal/activity_log_modal';

import {renderWithContext, screen, userEvent, waitFor} from 'tests/react_testing_utils';

jest.mock('components/activity_log_modal/components/activity_log', () => {
    return jest.fn().mockImplementation(({submitRevoke, currentSession}) => {
        return (
            <div
                data-testid='activity-log'
                data-session-id={currentSession.id}
                onClick={(e) => submitRevoke(currentSession.id, e as MouseEvent)}
            >
                {'Activity Log Item'}
            </div>
        );
    });
});

describe('components/ActivityLogModal', () => {
    const baseProps = {
        sessions: [],
        currentUserId: '',
        onHide: jest.fn(),
        actions: {
            getSessions: jest.fn(),
            revokeSession: jest.fn(),
        },
        locale: General.DEFAULT_LOCALE,
    };

    test('should render empty state when no sessions exist', () => {
        renderWithContext(<ActivityLogModal {...baseProps}/>);

        expect(screen.getByText('Active Sessions')).toBeInTheDocument();
        expect(screen.queryByTestId('activity-log')).not.toBeInTheDocument();
    });

    test('should render sessions when they exist', () => {
        const sessions = [
            {id: 'session1', props: {type: 'Web'}},
            {id: 'session2', props: {type: 'Web'}},
        ] as any;

        renderWithContext(
            <ActivityLogModal
                {...baseProps}
                sessions={sessions}
            />,
        );

        expect(screen.getAllByTestId('activity-log')).toHaveLength(2);
    });

    test('should filter out UserAccessToken sessions', () => {
        const sessions = [
            {id: 'session1', props: {type: 'Web'}},
            {id: 'session2', props: {type: 'UserAccessToken'}},
        ] as any;

        renderWithContext(
            <ActivityLogModal
                {...baseProps}
                sessions={sessions}
            />,
        );

        expect(screen.getAllByTestId('activity-log')).toHaveLength(1);
    });

    test('should call getSessions on mount', () => {
        const actions = {
            getSessions: jest.fn(),
            revokeSession: jest.fn(),
        };
        const props = {...baseProps, actions};

        renderWithContext(<ActivityLogModal {...props}/>);
        expect(actions.getSessions).toHaveBeenCalledTimes(1);
        expect(actions.getSessions).toHaveBeenCalledWith('');
    });

    test('should call revokeSession when session is revoked', async () => {
        const revokeSession = jest.fn().mockImplementation(
            () => {
                return new Promise<void>((resolve) => {
                    process.nextTick(() => resolve());
                });
            },
        );
        const getSessions = jest.fn();
        const actions = {
            getSessions,
            revokeSession,
        };

        const sessions = [
            {id: 'session1', props: {type: 'Web'}},
        ] as any;

        renderWithContext(
            <ActivityLogModal
                {...baseProps}
                sessions={sessions}
                actions={actions}
                currentUserId='user1'
            />,
        );

        await userEvent.click(screen.getByTestId('activity-log'));

        expect(revokeSession).toHaveBeenCalledTimes(1);
        expect(revokeSession).toHaveBeenCalledWith('user1', 'session1');

        // Wait for the promise to resolve
        await waitFor(() => {
            expect(getSessions).toHaveBeenCalledTimes(2); // Once on mount, once after revoke
            expect(getSessions).toHaveBeenLastCalledWith('user1');
        });
    });

    test('should call onHide when modal is closed', async () => {
        const onHide = jest.fn();
        renderWithContext(
            <ActivityLogModal
                {...baseProps}
                onHide={onHide}
            />,
        );

        await waitFor(() => screen.getByText('Active Sessions'));
        await userEvent.click(screen.getByLabelText('Close'));

        expect(onHide).toHaveBeenCalledTimes(1);
    });
});
