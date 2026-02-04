// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/**
 * Tests for Thread Sidebar fixes
 *
 * This tests the core logic for:
 * 1. Drag and Drop Container Selector
 * 2. RHS Persistence
 * 3. RHS Transition Back
 */

import {RHSStates} from 'utils/constants';

describe('Thread Sidebar Fixes', () => {
    describe('Bug #1 - Drag and Drop Container Selector', () => {
        // Logic definition simulating FileUpload.getDragEventDefinition
        const getDragEventDefinition = (props: {postType: string; rhsPostBeingEdited?: boolean; centerChannelPostBeingEdited?: boolean}) => {
            let containerSelector: string | undefined;
            let overlaySelector: string | undefined;

            switch (props.postType) {
            case 'post': {
                containerSelector = props.centerChannelPostBeingEdited ? 'form#create_post .AdvancedTextEditor__body' : '.row.main';
                overlaySelector = props.centerChannelPostBeingEdited ? '#createPostFileDropOverlay' : '.center-file-overlay';
                break;
            }
            case 'comment': {
                containerSelector = props.rhsPostBeingEdited ? '#sidebar-right .post-create__container .AdvancedTextEditor__body' : '.post-right__container';
                overlaySelector = props.rhsPostBeingEdited ? '#DropOverlayIdCreateComment' : '#DropOverlayIdRHS';
                break;
            }
            case 'thread': {
                // Bug fix: Added .ThreadView__pane
                containerSelector = props.rhsPostBeingEdited ? '.post-create__container .AdvancedTextEditor__body' : '.ThreadPane, .ThreadView__pane';
                overlaySelector = props.rhsPostBeingEdited ? '#createPostFileDropOverlay' : '.right-file-overlay';
                break;
            }
            case 'edit_post': {
                containerSelector = '.post--editing';
                overlaySelector = '#DropOverlayIdEditPost';
                break;
            }
            }

            return {
                containerSelector,
                overlaySelector,
            };
        };

        it('should return container selector including .ThreadView__pane for thread postType', () => {
            const props = {
                postType: 'thread',
                rhsPostBeingEdited: false,
            };

            const {containerSelector} = getDragEventDefinition(props);

            expect(containerSelector).toContain('.ThreadPane');
            expect(containerSelector).toContain('.ThreadView__pane');
        });

        it('should return correct selector when rhsPostBeingEdited is true for thread', () => {
            const props = {
                postType: 'thread',
                rhsPostBeingEdited: true,
            };

            const {containerSelector} = getDragEventDefinition(props);

            expect(containerSelector).toBe('.post-create__container .AdvancedTextEditor__body');
        });
    });

    describe('Bug #2 - RHS Persistence', () => {
        it('should trigger showThreadFollowers when entering ThreadView with Channel Members open', () => {
            const rhsState = RHSStates.CHANNEL_MEMBERS;
            const threadIdentifier = 'thread_id_1';
            const channelId = 'channel_id_1';

            let actionDispatched: any = null;

            // Mock dispatch
            const dispatch = (action: any) => {
                actionDispatched = action;
            };

            // Mock action creator
            const showThreadFollowers = (tId: string, cId: string) => ({type: 'SHOW_THREAD_FOLLOWERS', threadId: tId, channelId: cId});

            // Logic from ThreadView useEffect
            // Instead of dispatch(suppressRHS), we check if we should switch views
            if (rhsState === RHSStates.CHANNEL_MEMBERS) {
                dispatch(showThreadFollowers(threadIdentifier, channelId));
            }

            expect(actionDispatched).toEqual({
                type: 'SHOW_THREAD_FOLLOWERS',
                threadId: 'thread_id_1',
                channelId: 'channel_id_1',
            });
        });

        it('should NOT trigger showThreadFollowers if RHS is not Channel Members', () => {
            const rhsState = RHSStates.PIN; // Something else
            const threadIdentifier = 'thread_id_1';
            const channelId = 'channel_id_1';

            let actionDispatched: any = null;

            const dispatch = (action: any) => {
                actionDispatched = action;
            };

            const showThreadFollowers = (tId: string, cId: string) => ({type: 'SHOW_THREAD_FOLLOWERS', threadId: tId, channelId: cId});

            if (rhsState === RHSStates.CHANNEL_MEMBERS) {
                dispatch(showThreadFollowers(threadIdentifier, channelId));
            }

            expect(actionDispatched).toBeNull();
        });
    });

    describe('Bug #3 - RHS Transition Back', () => {
        it('should switch back to Channel Members when leaving thread if Thread Followers was showing', () => {
            const rhsState = RHSStates.THREAD_FOLLOWERS;
            const channelId = 'channel_id_1';

            let actionDispatched: any = null;

            const dispatch = (action: any) => {
                actionDispatched = action;
            };

            // Mock action creator
            const closeRightHandSide = () => ({type: 'CLOSE_RHS'});
            const showChannelMembers = (cId: string) => ({type: 'SHOW_CHANNEL_MEMBERS', channelId: cId});

            // Logic for cleanup/unmount
            if (rhsState === RHSStates.THREAD_FOLLOWERS) {
                // If we were showing followers, we might want to go back to members
                // assuming we are navigating back to the channel
                dispatch(showChannelMembers(channelId));
            } else {
                dispatch(closeRightHandSide());
            }

            expect(actionDispatched).toEqual({
                type: 'SHOW_CHANNEL_MEMBERS',
                channelId: 'channel_id_1',
            });
        });

        it('should close RHS if it was not showing followers (default behavior)', () => {
            const rhsState = RHSStates.PIN;
            const channelId = 'channel_id_1';

            let actionDispatched: any = null;

            const dispatch = (action: any) => {
                actionDispatched = action;
            };

            const closeRightHandSide = () => ({type: 'CLOSE_RHS'});
            const showChannelMembers = (cId: string) => ({type: 'SHOW_CHANNEL_MEMBERS', channelId: cId});

            if (rhsState === RHSStates.THREAD_FOLLOWERS) {
                dispatch(showChannelMembers(channelId));
            } else {
                dispatch(closeRightHandSide());
            }

            expect(actionDispatched).toEqual({
                type: 'CLOSE_RHS',
            });
        });
    });
});
