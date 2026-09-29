// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ComponentProps} from 'react';
import React from 'react';

import type {ChannelType} from '@mattermost/types/channels';
import type {ClientResponse} from '@mattermost/types/client4';
import type {Draft} from '@mattermost/types/drafts';
import type {Post, PostType} from '@mattermost/types/posts';
import type {ScheduledPost, SchedulingInfo} from '@mattermost/types/schedule_post';
import type {UserProfile, UserStatus} from '@mattermost/types/users';

import {deleteScheduledPost} from 'mattermost-redux/actions/scheduled_posts';
import {Client4} from 'mattermost-redux/client';
import {Preferences} from 'mattermost-redux/constants';
import {getPreferenceKey} from 'mattermost-redux/utils/preference_utils';

import {getDrafts as getDraftsForTeam} from 'actions/views/drafts';
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

    const serverDraft = (override: Partial<Draft>): Draft => ({
        create_at: 1,
        update_at: 1,
        delete_at: 0,
        user_id: userId,
        channel_id: channelId,
        root_id: '',
        message: '',
        props: {},
        file_ids: [],
        ...override,
    });

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

        it('does not resurrect the sent draft when drafts are refetched', async () => {
            // Stands in for the server's draft table: deleteDraft removes from it, and
            // getUserDrafts serves it back the way a team switch or a reload would.
            const serverDrafts = [
                serverDraft({channel_id: channelId, message: 'draft message', update_at: 2}),
                serverDraft({channel_id: 'other_channel_id', message: 'draft in another channel', update_at: 1}),
            ];
            deleteDraftSpy.mockImplementation((deletedChannelId: string, deletedRootId: string) => {
                const index = serverDrafts.findIndex(
                    (draft) => draft.channel_id === deletedChannelId && draft.root_id === deletedRootId,
                );
                if (index !== -1) {
                    serverDrafts.splice(index, 1);
                }
                return Promise.resolve(null);
            });
            jest.spyOn(Client4, 'getUserDrafts').mockImplementation(() => Promise.resolve([...serverDrafts]));

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
            await waitFor(() => expect(deleteDraftSpy).toHaveBeenCalledTimes(1));

            // * The send reached the server's copy, not just the local one
            expect(serverDrafts.map((draft) => draft.message)).toEqual(['draft in another channel']);

            // # Refetch the team's drafts, as switching teams or reloading the page does
            await store.dispatch(getDraftsForTeam(teamId));

            // * The sent draft did not come back, and the bystander draft is untouched
            expect(getDrafts(store.getState()).map((draft) => draft.value.message)).toEqual(
                ['draft in another channel'],
            );
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

        // A rejected createPost never reaches afterSubmit at all, so what this pins is that
        // the delete waits for the created post instead of firing when the row is clicked.
        it('does not delete the server draft until the post is created', async () => {
            let resolveCreatePost: (post: Post) => void = () => {};
            createPostSpy.mockImplementation(() => new Promise<Post>((resolve) => {
                resolveCreatePost = resolve;
            }));

            renderWithContext(
                <DraftRow
                    {...baseProps}
                />,
                initialState,
            );

            await userEvent.click(screen.getByRole('button', {name: 'Send draft'}));

            // * The request is in flight and the draft has not been deleted yet
            await waitFor(() => expect(createPostSpy).toHaveBeenCalledTimes(1));
            expect(deleteDraftSpy).not.toHaveBeenCalled();

            resolveCreatePost(TestHelper.getPostMock({id: 'created_post_id', channel_id: channelId}));

            // * Only once the post exists is the draft deleted
            await waitFor(() => expect(deleteDraftSpy).toHaveBeenCalledWith(channelId, '', connectionId));
        });
    });

    describe('scheduling a draft', () => {
        it('deletes the draft from the server once the post is scheduled', async () => {
            // createScheduledPost goes through doFetchWithResponse, which wraps the body in `data`.
            const createScheduledPostSpy = jest.spyOn(Client4, 'createScheduledPost').
                mockResolvedValue({data: scheduledPost} as ClientResponse<ScheduledPost>);

            const getDrafts = makeGetDrafts(false);
            const {store} = renderWithContext(
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

            // Scheduling never reaches createPost, so handleOnDelete is the only thing that
            // clears the local copy and the row would otherwise stay in the panel.
            await waitFor(() => expect(getDrafts(store.getState()).map((draft) => draft.value.message)).toEqual(
                ['draft in another channel'],
            ));
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
        it('deletes the scheduled post and leaves the channel draft alone', async () => {
            const getDrafts = makeGetDrafts(false);
            const {store} = renderWithContext(
                <DraftRow
                    {...baseProps}
                    item={scheduledPost}
                />,
                initialState,
            );

            await userEvent.click(screen.getByRole('button', {name: 'Send scheduled post'}));

            await waitFor(() => expect(createPostSpy).toHaveBeenCalledTimes(1));
            await waitFor(() => expect(deleteScheduledPost).toHaveBeenCalledWith(userId, scheduledPost.id, connectionId));

            // * The live draft in the same channel is neither deleted server-side nor cleared
            expect(deleteDraftSpy).not.toHaveBeenCalled();
            expect(getDrafts(store.getState()).map((draft) => draft.value.message)).toEqual(
                ['draft message', 'draft in another channel'],
            );

            // * A second send still targets the scheduled post, not the channel draft
            await userEvent.click(screen.getByRole('button', {name: 'Send scheduled post'}));

            await waitFor(() => expect(createPostSpy).toHaveBeenCalledTimes(2));
            expect(deleteDraftSpy).not.toHaveBeenCalled();
        });
    });
});
