// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import nock from 'nock';
import React from 'react';

import type {ScheduledPost} from '@mattermost/types/schedule_post';

import {Client4} from 'mattermost-redux/client';
import {Permissions} from 'mattermost-redux/constants';

import {setGlobalItem} from 'actions/storage';

import {act, fireEvent, renderWithContext, screen, waitFor} from 'tests/react_testing_utils';
import {ModalIdentifiers, StoragePrefixes} from 'utils/constants';
import {TestHelper} from 'utils/test_helper';

import EditPost from './edit_post';
import type {Props} from './edit_post';

import EditScheduledPost from './index';

describe('components/edit_scheduled_post/edit_post', () => {
    const channel = TestHelper.getChannelMock({id: 'channel_id', team_id: 'team_id'});
    const post = TestHelper.getPostMock({id: 'post_id', channel_id: channel.id, message: ''});

    const baseProps: Props = {
        canEditPost: true,
        canDeletePost: true,
        teamId: channel.team_id,
        channelId: channel.id,
        codeBlockOnCtrlEnter: false,
        ctrlSend: false,
        draft: {message: '', fileInfos: [], uploadsInProgress: []} as unknown as Props['draft'],
        config: {},
        maxPostSize: 4000,
        useChannelMentions: true,
        editingPost: {post, postId: post.id},
        isRHSOpened: false,
        isEditHistoryShowing: false,
        actions: {
            addMessageIntoHistory: jest.fn(),
            editPost: jest.fn(),
            setDraft: jest.fn(),
            unsetEditingPost: jest.fn(),
            scrollPostListToBottom: jest.fn(),
            runMessageWillBeUpdatedHooks: jest.fn(),
            updateScheduledPost: jest.fn(),
        },
    };

    const initialState = {
        entities: {
            channels: {channels: {[channel.id]: channel}},
            teams: {currentTeamId: channel.team_id, teams: {[channel.team_id]: TestHelper.getTeamMock({id: channel.team_id})}},
        },
    };

    function pasteHtml(html: string) {
        renderWithContext(<EditPost {...baseProps}/>, initialState);

        const textbox = screen.getByTestId('edit_textbox') as HTMLTextAreaElement;

        fireEvent.paste(textbox, {
            clipboardData: {
                items: [1],
                types: ['text/html', 'text/plain'],
                getData: (type: string) => (type === 'text/plain' ? 'unformatted' : html),
            },
        });

        return textbox;
    }

    test('should convert pasted emphasis into markdown', () => {
        expect(pasteHtml('<p>a <strong>bold</strong> word</p>').value).toBe('a **bold** word');
    });

    test('should convert a pasted list into markdown', () => {
        expect(pasteHtml('<ul><li>one</li><li>two</li></ul>').value).toBe('-   one\n-   two');
    });

    test('should leave html without any formatting to the browser', () => {
        expect(pasteHtml('<span style="color: red">a * b</span>').value).toBe('');
    });

    describe('editing a scheduled post', () => {
        const user = TestHelper.getUserMock({id: 'user_id', roles: 'system_user'});
        const scheduledPost: ScheduledPost = {
            id: 'scheduled_post_id',
            scheduled_at: 1234,
            create_at: 1234,
            update_at: 1234,
            user_id: user.id,
            channel_id: channel.id,
            root_id: '',
            message: 'Original scheduled message',
            props: {},
        };
        const draftStorageKey = `${StoragePrefixes.EDIT_DRAFT}${scheduledPost.id}`;

        const scheduledPostState = {
            entities: {
                ...initialState.entities,
                users: {currentUserId: user.id, profiles: {[user.id]: user}},
                roles: {
                    roles: {
                        system_user: TestHelper.getRoleMock({permissions: [Permissions.EDIT_POST, Permissions.DELETE_POST]}),
                    },
                },
            },
        };

        function renderEditor(state: Record<string, unknown> = scheduledPostState) {
            const afterSave = jest.fn();
            const onCancel = jest.fn();
            const onDeleteScheduledPost = jest.fn().mockResolvedValue({});
            const editor = (
                <EditScheduledPost
                    scheduledPost={scheduledPost}
                    afterSave={afterSave}
                    onCancel={onCancel}
                    onDeleteScheduledPost={onDeleteScheduledPost}
                />
            );
            const result = renderWithContext(editor, state);

            return {
                ...result,
                afterSave,
                onCancel,
                onDeleteScheduledPost,
                remount: () => {
                    result.rerender(<></>);
                    result.rerender(editor);
                },
            };
        }

        const getTextbox = () => screen.getByTestId('edit_textbox') as HTMLTextAreaElement;

        async function typeAndPersistDraft(store: ReturnType<typeof renderEditor>['store'], message: string) {
            fireEvent.input(getTextbox(), {target: {value: message}});
            await waitFor(() => {
                expect(store.getState().storage.storage[draftStorageKey]?.value?.message).toBe(message);
            });
        }

        beforeAll(() => {
            Client4.setUrl('http://localhost:8065');
            nock.disableNetConnect();
        });

        afterEach(() => {
            nock.cleanAll();
        });

        afterAll(() => {
            nock.enableNetConnect();
        });

        test.each([
            ['clicking Cancel', () => fireEvent.click(screen.getByText('Cancel'))],
            ['pressing Escape', () => fireEvent.keyDown(getTextbox(), {key: 'Escape', keyCode: 27})],
        ])('should discard the saved edit draft after %s', async (_, cancel) => {
            const {store, remount, onCancel} = renderEditor();

            await typeAndPersistDraft(store, 'Discarded edit');

            cancel();

            expect(onCancel).toHaveBeenCalledTimes(1);
            expect(store.getState().storage.storage[draftStorageKey].value).toBeNull();

            remount();

            expect(getTextbox().value).toBe('Original scheduled message');
            expect(store.getState().storage.storage[draftStorageKey].value).toBeNull();
        });

        test('should restore an unsaved edit draft when the editor is closed without cancelling', () => {
            const {remount} = renderEditor();

            fireEvent.input(getTextbox(), {target: {value: 'Unsaved edit'}});
            remount();

            expect(getTextbox().value).toBe('Unsaved edit');
        });

        test('should keep the editor open when the message is cleared and the delete confirmation is shown', async () => {
            const {store, afterSave} = renderEditor();

            fireEvent.input(getTextbox(), {target: {value: ''}});
            fireEvent.click(screen.getByText('Save'));

            await waitFor(() => {
                expect(store.getState().views.modals.modalState[ModalIdentifiers.DELETE_DRAFT]?.open).toBe(true);
            });
            expect(afterSave).not.toHaveBeenCalled();
        });

        test('should keep the editor open and show the error when the server rejects the update', async () => {
            nock(Client4.getBaseRoute()).
                put(`/posts/schedule/${scheduledPost.id}`).
                reply(400, {message: 'Unable to update scheduled post'});

            const {afterSave} = renderEditor();

            fireEvent.input(getTextbox(), {target: {value: 'Updated message'}});
            fireEvent.click(screen.getByText('Save'));

            expect(await screen.findByText('Unable to update scheduled post')).toBeInTheDocument();
            expect(afterSave).not.toHaveBeenCalled();
        });

        test('should close the editor once and clear the edit draft after a successful update', async () => {
            nock(Client4.getBaseRoute()).
                put(`/posts/schedule/${scheduledPost.id}`).
                reply(200, {...scheduledPost, message: 'Updated message'});

            const {store, afterSave} = renderEditor();

            await typeAndPersistDraft(store, 'Updated message');
            fireEvent.click(screen.getByText('Save'));

            await waitFor(() => {
                expect(afterSave).toHaveBeenCalled();
            });
            await act(async () => {});
            expect(afterSave).toHaveBeenCalledTimes(1);
            expect(store.getState().storage.storage[draftStorageKey].value).toBeNull();
        });

        test('should close the editor when saving an unchanged message', async () => {
            const {afterSave} = renderEditor();

            fireEvent.click(screen.getByText('Save'));

            await waitFor(() => {
                expect(afterSave).toHaveBeenCalledTimes(1);
            });
        });

        test('should allow retrying the save after a server error without changing the text', async () => {
            nock(Client4.getBaseRoute()).
                put(`/posts/schedule/${scheduledPost.id}`).
                reply(400, {message: 'Unable to update scheduled post'});
            const retry = nock(Client4.getBaseRoute()).
                put(`/posts/schedule/${scheduledPost.id}`).
                reply(200, {...scheduledPost, message: 'Updated message'});

            const {afterSave} = renderEditor();

            fireEvent.input(getTextbox(), {target: {value: 'Updated message'}});
            fireEvent.click(screen.getByText('Save'));
            expect(await screen.findByText('Unable to update scheduled post')).toBeInTheDocument();

            fireEvent.click(screen.getByText('Save'));

            await waitFor(() => {
                expect(afterSave).toHaveBeenCalledTimes(1);
            });
            expect(retry.isDone()).toBe(true);
            expect(screen.queryByText('Unable to update scheduled post')).not.toBeInTheDocument();
        });

        test('should allow retrying the save after a plugin hook error without changing the text', async () => {
            const hook = jest.fn().
                mockResolvedValueOnce({error: {message: 'Rejected by plugin'}}).
                mockImplementation((newPost) => Promise.resolve({post: newPost}));
            const update = nock(Client4.getBaseRoute()).
                put(`/posts/schedule/${scheduledPost.id}`).
                reply(200, {...scheduledPost, message: 'Updated message'});

            const {afterSave} = renderEditor({
                ...scheduledPostState,
                plugins: {components: {MessageWillBeUpdated: [{id: 'hook', pluginId: 'plugin', hook}]}},
            });

            fireEvent.input(getTextbox(), {target: {value: 'Updated message'}});
            fireEvent.click(screen.getByText('Save'));
            expect(await screen.findByText('Rejected by plugin')).toBeInTheDocument();
            expect(afterSave).not.toHaveBeenCalled();

            fireEvent.click(screen.getByText('Save'));

            await waitFor(() => {
                expect(afterSave).toHaveBeenCalledTimes(1);
            });
            expect(hook).toHaveBeenCalledTimes(2);
            expect(update.isDone()).toBe(true);
        });

        test('should block saving a message over the length limit until it is shortened', async () => {
            const update = nock(Client4.getBaseRoute()).
                put(`/posts/schedule/${scheduledPost.id}`).
                reply(200, {...scheduledPost, message: 'Short'});

            const {afterSave} = renderEditor({
                ...scheduledPostState,
                entities: {...scheduledPostState.entities, general: {config: {MaxPostSize: '10'}}},
            });

            fireEvent.input(getTextbox(), {target: {value: 'This message is far too long'}});
            fireEvent.click(screen.getByText('Save'));
            await act(async () => {});

            expect(update.isDone()).toBe(false);
            expect(afterSave).not.toHaveBeenCalled();

            fireEvent.input(getTextbox(), {target: {value: 'Short'}});
            fireEvent.click(screen.getByText('Save'));

            await waitFor(() => {
                expect(afterSave).toHaveBeenCalledTimes(1);
            });
            expect(update.isDone()).toBe(true);
        });

        test('should not write an edit draft when the editor is opened and closed without typing', async () => {
            const {store, remount} = renderEditor();

            remount();
            await act(async () => {
                await new Promise((resolve) => setTimeout(resolve, 600));
            });

            expect(store.getState().storage.storage[draftStorageKey]).toBeUndefined();
            expect(getTextbox().value).toBe('Original scheduled message');
        });

        test('should not rewrite the edit draft on unmount once it has already been saved', async () => {
            const {store, remount} = renderEditor();

            await typeAndPersistDraft(store, 'Saved edit');
            store.dispatch(setGlobalItem(draftStorageKey, null));
            remount();

            expect(store.getState().storage.storage[draftStorageKey].value).toBeNull();
        });

        test('should not discard the stored draft when the delete confirmation is shown', async () => {
            const {store} = renderEditor();

            await typeAndPersistDraft(store, 'Draft text');
            fireEvent.input(getTextbox(), {target: {value: ''}});
            fireEvent.click(screen.getByText('Save'));

            await waitFor(() => {
                expect(store.getState().views.modals.modalState[ModalIdentifiers.DELETE_DRAFT]?.open).toBe(true);
            });

            expect(store.getState().storage.storage[draftStorageKey].value).not.toBeNull();
        });

        test('should not leave an edit draft behind when the scheduled post is deleted', async () => {
            const {store, unmount, onDeleteScheduledPost} = renderEditor();

            await typeAndPersistDraft(store, 'Text before deleting');
            fireEvent.input(getTextbox(), {target: {value: ''}});
            fireEvent.click(screen.getByText('Save'));

            await waitFor(() => {
                expect(store.getState().views.modals.modalState[ModalIdentifiers.DELETE_DRAFT]?.open).toBe(true);
            });

            await act(async () => {
                await store.getState().views.modals.modalState[ModalIdentifiers.DELETE_DRAFT].dialogProps.onConfirm();
            });
            unmount();

            expect(onDeleteScheduledPost).toHaveBeenCalledTimes(1);
            expect(store.getState().storage.storage[draftStorageKey]?.value ?? null).toBeNull();
        });

        test('should restore text added by a markdown hotkey when the editor is closed without cancelling', () => {
            const {remount} = renderEditor();

            fireEvent.keyDown(getTextbox(), {key: 'b', keyCode: 66, ctrlKey: true});
            const hotkeyText = getTextbox().value;
            expect(hotkeyText).not.toBe('Original scheduled message');
            remount();

            expect(getTextbox().value).toBe(hotkeyText);
        });

        test('should restore text added by a line break key combo when the editor is closed without cancelling', () => {
            const {remount} = renderEditor();

            fireEvent.keyDown(getTextbox(), {key: 'Enter', keyCode: 13, altKey: true});
            expect(getTextbox().value).toContain('\n');
            const lineBreakText = getTextbox().value;
            remount();

            expect(getTextbox().value).toBe(lineBreakText);
        });

        test('should restore pasted markdown when the editor is closed without cancelling', () => {
            const {remount} = renderEditor();

            fireEvent.paste(getTextbox(), {
                clipboardData: {
                    items: [1],
                    types: ['text/html', 'text/plain'],
                    getData: (type: string) => (type === 'text/plain' ? 'unformatted' : '<strong>bold</strong>'),
                },
            });
            const pastedText = getTextbox().value;
            expect(pastedText).toContain('**bold**');
            remount();

            expect(getTextbox().value).toBe(pastedText);
        });

        test('should fall back to the scheduled message when the stored edit draft is whitespace only', () => {
            renderEditor({
                ...scheduledPostState,
                storage: {
                    storage: {
                        [draftStorageKey]: {
                            value: {message: '   ', fileInfos: [], uploadsInProgress: []},
                            timestamp: new Date(),
                        },
                    },
                },
            });

            expect(getTextbox().value).toBe('Original scheduled message');
        });
    });
});
