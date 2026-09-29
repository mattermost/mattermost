// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ComponentProps} from 'react';
import React from 'react';

import type {ChannelType} from '@mattermost/types/channels';
import type {ClientResponse} from '@mattermost/types/client4';
import type {PostType} from '@mattermost/types/posts';
import type {ScheduledPost, SchedulingInfo} from '@mattermost/types/schedule_post';
import type {UserProfile, UserStatus} from '@mattermost/types/users';

import {deleteScheduledPost} from 'mattermost-redux/actions/scheduled_posts';
import {Client4} from 'mattermost-redux/client';
import {Preferences} from 'mattermost-redux/constants';
import {getPreferenceKey} from 'mattermost-redux/utils/preference_utils';

import {makeGetDrafts} from 'selectors/drafts';

import TestHelper from 'packages/mattermost-redux/test/test_helper';
import {renderWithContext, screen, userEvent, waitFor} from 'tests/react_testing_utils';
import {StoragePrefixes} from 'utils/constants';

import type {PostDraft} from 'types/store/draft';

import DraftRow from './draft_row';

const SCHEDULED_AT = 1735689600;

type DraftActionProps = {
    onSend: () => void;
    onSchedule: (schedulingInfo: SchedulingInfo) => void;
    onDelete: () => void;
};

type ScheduledPostActionProps = {
    onSend: () => void;
};

jest.mock('components/advanced_text_editor/use_priority', () => () => ({onSubmitCheck: () => false}));

// Interactive fakes: DraftRow's own send/schedule wiring is what is under test here, so the
// action rows are reduced to buttons that invoke the real callbacks DraftRow passes down.
// The real action rows invoke these callbacks with no arguments, so the fakes must too.
jest.mock('components/drafts/draft_actions', () => (props: DraftActionProps) => (
    <div>
        <button onClick={() => props.onSend()}>{'Send draft'}</button>
        <button onClick={() => props.onSchedule({scheduled_at: SCHEDULED_AT})}>{'Schedule draft'}</button>
        <button onClick={() => props.onDelete()}>{'Delete draft'}</button>
    </div>
));
jest.mock('components/drafts/draft_actions/schedule_post_actions/scheduled_post_actions', () => (props: ScheduledPostActionProps) => (
    <div>
        <button onClick={() => props.onSend()}>{'Send scheduled post'}</button>
    </div>
));

jest.mock('components/drafts/draft_title', () => () => <div>{'Draft Title'}</div>);
jest.mock('components/drafts/panel/panel_body', () => () => <div>{'Panel Body'}</div>);
jest.mock('components/edit_scheduled_post', () => () => <div>{'Edit Scheduled Post'}</div>);
jest.mock('components/drafts/placeholder_scheduled_post_title/placeholder_scheduled_posts_title', () => () => (
    <div>{'Placeholder Scheduled Post Title'}</div>
));
jest.mock('mattermost-redux/actions/posts', () => ({
    ...jest.requireActual('mattermost-redux/actions/posts'),
    getPost: () => ({type: 'MOCK_GET_POST'}),
}));
jest.mock('mattermost-redux/actions/scheduled_posts', () => ({
    ...jest.requireActual('mattermost-redux/actions/scheduled_posts'),
    deleteScheduledPost: jest.fn(() => ({type: 'MOCK_DELETE_SCHEDULED_POST'})),
    updateScheduledPost: jest.fn(() => ({type: 'MOCK_UPDATE_SCHEDULED_POST'})),
}));
jest.mock('mattermost-redux/selectors/entities/roles', () => ({
    haveIChannelPermission: () => true,
}));
jest.mock('mattermost-redux/selectors/entities/channels', () => ({
    ...jest.requireActual('mattermost-redux/selectors/entities/channels'),
    isDeactivatedDirectChannel: () => false,
}));

describe('components/drafts/drafts_row', () => {
    const channelId = 'channel_id';
    const teamId = 'team_id';
    const userId = 'user_id';
    const connectionId = 'connection_id';
    const channel = {
        id: channelId,
        team_id: teamId,
        name: 'channel-name',
        display_name: 'Channel Name',
        type: 'O' as ChannelType,
        delete_at: 0,
    };
    const initialState = {
        entities: {
            channels: {channels: {[channelId]: channel}},
            teams: {
                currentTeamId: teamId,
                teams: {[teamId]: {id: teamId, name: 'team-name'}},
            },
            general: {
                config: {
                    MaxPostSize: '16383',
                    BurnOnReadDurationSeconds: '600',

                    // Synced drafts must be on for removeDraft to reach the server.
                    AllowSyncedDrafts: 'true',
                },
                license: {},
            },
            posts: {posts: {}},
            users: {
                currentUserId: userId,
                profiles: {[userId]: {id: userId, username: 'username'}},
            },
            preferences: {
                myPreferences: {
                    [getPreferenceKey(Preferences.CATEGORY_ADVANCED_SETTINGS, Preferences.ADVANCED_SYNC_DRAFTS)]: {value: 'true'},
                },
            },
        },
        storage: {
            storage: {
                [`${StoragePrefixes.DRAFT}${channelId}`]: {
                    value: {
                        message: 'draft message',
                        fileInfos: [],
                        uploadsInProgress: [],
                        channelId,
                        rootId: '',
                        updateAt: 2,
                        show: true,
                    },
                    timestamp: new Date(),
                },

                // A bystander draft, so an emptied drafts list cannot pass for a removed draft.
                [`${StoragePrefixes.DRAFT}other_channel_id`]: {
                    value: {
                        message: 'draft in another channel',
                        fileInfos: [],
                        uploadsInProgress: [],
                        channelId: 'other_channel_id',
                        rootId: '',
                        updateAt: 1,
                        show: true,
                    },
                    timestamp: new Date(),
                },
            },
        },
        websocket: {connectionId},
    };

    const baseProps: ComponentProps<typeof DraftRow> = {
        item: {
            message: 'draft message',
            updateAt: 1234,
            createAt: 1234,
            fileInfos: [],
            uploadsInProgress: [],
            channelId,
            rootId: '',
            type: 'standard' as PostType,
        } as PostDraft,
        user: {id: userId, username: 'username'} as UserProfile,
        status: 'online' as UserStatus['status'],
        displayName: 'test',
        isRemote: false,

    };

    const scheduledPost: ScheduledPost = {
        id: 'scheduled_post_id',
        scheduled_at: SCHEDULED_AT,
        create_at: 1234,
        update_at: 1234,
        user_id: userId,
        channel_id: channelId,
        root_id: '',
        message: 'scheduled message',
        props: {},
        metadata: {
            embeds: [],
            emojis: [],
            files: [],
            images: {},
        },
    };

    let createPostSpy: jest.SpyInstance;
    let deleteDraftSpy: jest.SpyInstance;

    beforeEach(() => {
        createPostSpy = jest.spyOn(Client4, 'createPost').mockResolvedValue(TestHelper.getPostMock({
            id: 'created_post_id',
            channel_id: channelId,
            message: 'draft message',
        }));
        deleteDraftSpy = jest.spyOn(Client4, 'deleteDraft').mockResolvedValue(null);
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('should match snapshot for channel draft', () => {
        const {container} = renderWithContext(
            <DraftRow
                {...baseProps}
            />,
            initialState,
        );
        expect(container).toMatchSnapshot();
    });

    it('should match snapshot for thread draft', () => {
        const props = {
            ...baseProps,
            item: {
                ...baseProps.item,
                rootId: 'some_id',
            } as PostDraft,
        };

        const {container} = renderWithContext(
            <DraftRow
                {...props}
            />,
            initialState,
        );
        expect(container).toMatchSnapshot();
    });

    describe('sending a draft', () => {
        it('deletes the draft from the server once the post is created', async () => {
            renderWithContext(
                <DraftRow
                    {...baseProps}
                />,
                initialState,
            );

            await userEvent.click(screen.getByRole('button', {name: 'Send draft'}));

            await waitFor(() => expect(createPostSpy).toHaveBeenCalledTimes(1));
            expect(createPostSpy.mock.calls[0][0]).toMatchObject({
                channel_id: channelId,
                root_id: '',
                message: 'draft message',
            });

            await waitFor(() => expect(deleteDraftSpy).toHaveBeenCalledTimes(1));
            expect(deleteDraftSpy).toHaveBeenCalledWith(channelId, '', connectionId);
        });

        it('drops the sent draft from the drafts list and leaves other drafts alone', async () => {
            const getDrafts = makeGetDrafts(false);
            const {store} = renderWithContext(
                <DraftRow
                    {...baseProps}
                />,
                initialState,
            );

            expect(getDrafts(store.getState()).map((draft) => draft.value.message)).toEqual(
                ['draft message', 'draft in another channel'],
            );

            await userEvent.click(screen.getByRole('button', {name: 'Send draft'}));

            await waitFor(() => expect(getDrafts(store.getState()).map((draft) => draft.value.message)).toEqual(
                ['draft in another channel'],
            ));
        });

        it('deletes the thread draft from the server using its root id', async () => {
            const rootId = 'root_id';
            const props = {
                ...baseProps,
                item: {
                    ...baseProps.item,
                    rootId,
                } as PostDraft,
            };
            const state = {
                ...initialState,
                entities: {
                    ...initialState.entities,
                    posts: {
                        posts: {
                            [rootId]: {
                                id: rootId,
                                channel_id: channelId,
                                root_id: '',
                                message: 'root message',
                                delete_at: 0,
                            },
                        },
                    },
                },
            };

            renderWithContext(
                <DraftRow
                    {...props}
                />,
                state,
            );

            await userEvent.click(screen.getByRole('button', {name: 'Send draft'}));

            await waitFor(() => expect(createPostSpy).toHaveBeenCalledTimes(1));
            expect(createPostSpy.mock.calls[0][0]).toMatchObject({root_id: rootId});

            await waitFor(() => expect(deleteDraftSpy).toHaveBeenCalledTimes(1));
            expect(deleteDraftSpy).toHaveBeenCalledWith(channelId, rootId, connectionId);
        });

        it('does not delete the server draft when creating the post fails', async () => {
            createPostSpy.mockRejectedValue({message: 'nope', server_error_id: 'api.post.create_post.app_error'});

            const {store} = renderWithContext(
                <DraftRow
                    {...baseProps}
                />,
                initialState,
            );

            await userEvent.click(screen.getByRole('button', {name: 'Send draft'}));

            // The failed post is recorded in the store, which is what lets the user retry it
            // from the channel. Waiting on it also settles the rejected createPost before the
            // negative assertion below.
            await waitFor(() => {
                const posts = Object.values(store.getState().entities.posts.posts);
                expect(posts.some((post) => post.failed)).toBe(true);
            });

            expect(deleteDraftSpy).not.toHaveBeenCalled();
        });
    });

    describe('scheduling a draft', () => {
        it('deletes the draft from the server once the post is scheduled', async () => {
            // createScheduledPost goes through doFetchWithResponse, which wraps the body in `data`.
            const createScheduledPostSpy = jest.spyOn(Client4, 'createScheduledPost').
                mockResolvedValue({data: scheduledPost} as ClientResponse<ScheduledPost>);

            renderWithContext(
                <DraftRow
                    {...baseProps}
                />,
                initialState,
            );

            await userEvent.click(screen.getByRole('button', {name: 'Schedule draft'}));

            await waitFor(() => expect(createScheduledPostSpy).toHaveBeenCalledTimes(1));
            await waitFor(() => expect(deleteDraftSpy).toHaveBeenCalledTimes(1));
            expect(deleteDraftSpy).toHaveBeenCalledWith(channelId, '', connectionId);
            expect(createPostSpy).not.toHaveBeenCalled();
        });

        // Scheduling is the one send path that reports failure through afterSubmit, so it is
        // what proves the draft survives a response that carries an error.
        it('keeps the draft when scheduling fails', async () => {
            const createScheduledPostSpy = jest.spyOn(Client4, 'createScheduledPost').mockRejectedValue({message: 'could not schedule'});

            renderWithContext(
                <DraftRow
                    {...baseProps}
                />,
                initialState,
            );

            await userEvent.click(screen.getByRole('button', {name: 'Schedule draft'}));

            await waitFor(() => expect(createScheduledPostSpy).toHaveBeenCalledTimes(1));

            // The error surfaces on the row instead of the draft being consumed.
            await waitFor(() => expect(screen.getByText('could not schedule')).toBeInTheDocument());
            expect(deleteDraftSpy).not.toHaveBeenCalled();
        });
    });

    describe('sending a scheduled post', () => {
        it('deletes the scheduled post without deleting any draft', async () => {
            renderWithContext(
                <DraftRow
                    {...baseProps}
                    item={scheduledPost}
                />,
                initialState,
            );

            await userEvent.click(screen.getByRole('button', {name: 'Send scheduled post'}));

            await waitFor(() => expect(createPostSpy).toHaveBeenCalledTimes(1));
            await waitFor(() => expect(deleteScheduledPost).toHaveBeenCalledWith(userId, scheduledPost.id, connectionId));
            expect(deleteDraftSpy).not.toHaveBeenCalled();
        });
    });
});
