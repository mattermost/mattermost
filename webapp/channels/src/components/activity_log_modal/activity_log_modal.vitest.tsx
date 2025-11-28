// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import type {MouseEvent} from 'react';
import {describe, test, expect, vi} from 'vitest';

import {General} from 'mattermost-redux/constants';

import ActivityLogModal from 'components/activity_log_modal/activity_log_modal';

import {fireEvent, renderWithContext, screen, waitFor} from 'tests/vitest_react_testing_utils';

vi.mock('components/activity_log_modal/components/activity_log', () => {
    return {
        default: vi.fn().mockImplementation(({submitRevoke, currentSession}) => {
            return (
                <div
                    data-testid='activity-log'
                    data-session-id={currentSession.id}
                    onClick={(e) => submitRevoke(currentSession.id, e as MouseEvent)}
                >
                    {'Activity Log Item'}
                </div>
            );
        }),
    };
});

describe('components/ActivityLogModal', () => {
    const baseProps = {
        sessions: [],
        currentUserId: '',
        onHide: vi.fn(),
        actions: {
            getSessions: vi.fn(),
            revokeSession: vi.fn(),
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
            getSessions: vi.fn(),
            revokeSession: vi.fn(),
        };
        const props = {...baseProps, actions};

        renderWithContext(<ActivityLogModal {...props}/>);
        expect(actions.getSessions).toHaveBeenCalledTimes(1);
        expect(actions.getSessions).toHaveBeenCalledWith('');
    });

    test('should call revokeSession when session is revoked', async () => {
        const revokeSession = vi.fn().mockImplementation(
            () => {
                return new Promise<void>((resolve) => {
                    process.nextTick(() => resolve());
                });
            },
        );
        const getSessions = vi.fn();
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

        fireEvent.click(screen.getByTestId('activity-log'));

        expect(revokeSession).toHaveBeenCalledTimes(1);
        expect(revokeSession).toHaveBeenCalledWith('user1', 'session1');

        // Wait for the promise to resolve
        await waitFor(() => {
            expect(getSessions).toHaveBeenCalledTimes(2); // Once on mount, once after revoke
            expect(getSessions).toHaveBeenLastCalledWith('user1');
        });
    });

    test('should call onHide when modal is closed', async () => {
        const onHide = vi.fn();
        renderWithContext(
            <ActivityLogModal
                {...baseProps}
                onHide={onHide}
            />,
        );

        await waitFor(() => screen.getByText('Active Sessions'));
        fireEvent.click(screen.getByLabelText('Close'));

        expect(onHide).toHaveBeenCalledTimes(1);
    });
});
