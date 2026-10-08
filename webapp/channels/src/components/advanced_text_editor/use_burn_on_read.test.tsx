// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {renderHook} from '@testing-library/react';
import React from 'react';
import {Provider} from 'react-redux';

import type {Channel} from '@mattermost/types/channels';
import type {PostType} from '@mattermost/types/posts';

import {PostTypes} from 'mattermost-redux/constants/posts';
import {getChannel} from 'mattermost-redux/selectors/entities/channels';
import {getCurrentUser} from 'mattermost-redux/selectors/entities/users';

import {
    isBurnOnReadEnabled,
    getBurnOnReadDurationMinutes,
} from 'selectors/burn_on_read';

import {useCreateBurnOnReadAccess} from 'components/common/hooks/useCreateBurnOnReadAccess';

import type {GlobalState} from 'types/store';
import type {PostDraft} from 'types/store/draft';

import useBurnOnRead from './use_burn_on_read';

// Mock the selectors
jest.mock('selectors/burn_on_read', () => ({
    isBurnOnReadEnabled: jest.fn(),
    getBurnOnReadDurationMinutes: jest.fn(),
}));

jest.mock('mattermost-redux/selectors/entities/channels', () => ({
    getChannel: jest.fn(),
}));

// Mocked rather than driven through redux state: the hook's own test file covers the
// fetch/cache plumbing, and what matters here is how this hook composes the decision.
jest.mock('components/common/hooks/useCreateBurnOnReadAccess', () => ({
    useCreateBurnOnReadAccess: jest.fn(),
}));

jest.mock('mattermost-redux/selectors/entities/users', () => ({
    getCurrentUser: jest.fn(),
    getUser: jest.fn(),
}));

// Import mocked selectors

describe('useBurnOnRead', () => {
    const mockHandleDraftChange = jest.fn();
    const mockFocusTextbox = jest.fn();

    const createMockStore = (state: Partial<GlobalState> = {}) => ({
        getState: () => state,
        dispatch: jest.fn(),
        subscribe: jest.fn(),
        replaceReducer: jest.fn(),
        [Symbol.observable]: jest.fn(),
    });

    const createMockChannel = (type: 'O' | 'P' | 'D' | 'G', name?: string): Channel => ({
        id: 'channel-id',
        create_at: 0,
        update_at: 0,
        delete_at: 0,
        team_id: 'team-id',
        type,
        display_name: 'Test Channel',
        name: name || 'test-channel',
        header: '',
        purpose: '',
        last_post_at: 0,
        last_root_post_at: 0,
        creator_id: 'user-id',
        scheme_id: '',
        group_constrained: false,
    });

    const createMockDraft = (type?: PostType): PostDraft => ({
        message: 'test message',
        fileInfos: [],
        uploadsInProgress: [],
        channelId: 'channel-id',
        rootId: '',
        type,
        props: {},
        createAt: 0,
        updateAt: 0,
        show: true,
    });

    const wrapper = ({children}: {children: React.ReactNode}) => (
        <Provider store={createMockStore()}>
            {children}
        </Provider>
    );

    beforeEach(() => {
        jest.clearAllMocks();
        (isBurnOnReadEnabled as jest.Mock).mockReturnValue(true);
        (getBurnOnReadDurationMinutes as jest.Mock).mockReturnValue(10);
        (getCurrentUser as jest.Mock).mockReturnValue({id: 'user-id', is_bot: false});
        (useCreateBurnOnReadAccess as jest.Mock).mockReturnValue(true);
    });

    describe('button visibility in different channel types', () => {
        it('should show burn-on-read button in direct messages (DM) with another user', () => {
            // DM with another user - channel name is user-id__other-user-id
            const dmChannel = createMockChannel('D', 'other-user-id__user-id');
            (getChannel as jest.Mock).mockReturnValue(dmChannel);

            const {result} = renderHook(
                () => useBurnOnRead(
                    createMockDraft(),
                    mockHandleDraftChange,
                    mockFocusTextbox,
                    false,
                    true,
                ),
                {wrapper},
            );

            // DMs with another user should show the button
            expect(result.current.additionalControl).toBeDefined();
        });

        it('should hide burn-on-read button in self-DMs', () => {
            // Self-DM - channel name is user-id__user-id
            const selfDMChannel = createMockChannel('D', 'user-id__user-id');
            (getChannel as jest.Mock).mockReturnValue(selfDMChannel);

            const {result} = renderHook(
                () => useBurnOnRead(
                    createMockDraft(),
                    mockHandleDraftChange,
                    mockFocusTextbox,
                    false,
                    true,
                ),
                {wrapper},
            );

            // Self-DMs should hide the button
            expect(result.current.additionalControl).toBeUndefined();
        });

        it('should hide burn-on-read button in DMs with bots/AI agents', () => {
            const {getUser} = require('mattermost-redux/selectors/entities/users');

            // DM with a bot - channel name is user-id__bot-id
            const dmWithBotChannel = createMockChannel('D', 'bot-id__user-id');
            (getChannel as jest.Mock).mockReturnValue(dmWithBotChannel);
            (getUser as jest.Mock).mockReturnValue({id: 'bot-id', is_bot: true});

            const {result} = renderHook(
                () => useBurnOnRead(
                    createMockDraft(),
                    mockHandleDraftChange,
                    mockFocusTextbox,
                    false,
                    true,
                ),
                {wrapper},
            );

            // DMs with bots should hide the button
            expect(result.current.additionalControl).toBeUndefined();
        });

        it('should show burn-on-read button in group messages (GM)', () => {
            const gmChannel = createMockChannel('G');
            (getChannel as jest.Mock).mockReturnValue(gmChannel);

            const {result} = renderHook(
                () => useBurnOnRead(
                    createMockDraft(),
                    mockHandleDraftChange,
                    mockFocusTextbox,
                    false,
                    true,
                ),
                {wrapper},
            );

            expect(result.current.additionalControl).toBeDefined();
        });

        it('should show burn-on-read button in public channels', () => {
            const publicChannel = createMockChannel('O');
            (getChannel as jest.Mock).mockReturnValue(publicChannel);

            const {result} = renderHook(
                () => useBurnOnRead(
                    createMockDraft(),
                    mockHandleDraftChange,
                    mockFocusTextbox,
                    false,
                    true,
                ),
                {wrapper},
            );

            expect(result.current.additionalControl).toBeDefined();
        });

        it('should show burn-on-read button in private channels', () => {
            const privateChannel = createMockChannel('P');
            (getChannel as jest.Mock).mockReturnValue(privateChannel);

            const {result} = renderHook(
                () => useBurnOnRead(
                    createMockDraft(),
                    mockHandleDraftChange,
                    mockFocusTextbox,
                    false,
                    true,
                ),
                {wrapper},
            );

            expect(result.current.additionalControl).toBeDefined();
        });

        it('should hide burn-on-read button in shared channels', () => {
            const sharedChannel = {...createMockChannel('O'), shared: true};
            (getChannel as jest.Mock).mockReturnValue(sharedChannel);

            const {result} = renderHook(
                () => useBurnOnRead(
                    createMockDraft(),
                    mockHandleDraftChange,
                    mockFocusTextbox,
                    false,
                    true,
                ),
                {wrapper},
            );

            expect(result.current.additionalControl).toBeUndefined();
        });

        it('should show burn-on-read button in non-shared channels', () => {
            const nonSharedChannel = {...createMockChannel('O'), shared: false};
            (getChannel as jest.Mock).mockReturnValue(nonSharedChannel);

            const {result} = renderHook(
                () => useBurnOnRead(
                    createMockDraft(),
                    mockHandleDraftChange,
                    mockFocusTextbox,
                    false,
                    true,
                ),
                {wrapper},
            );

            expect(result.current.additionalControl).toBeDefined();
        });
    });

    describe('button visibility with feature flags', () => {
        it('should hide button when burn-on-read is disabled', () => {
            (isBurnOnReadEnabled as jest.Mock).mockReturnValue(false);
            const publicChannel = createMockChannel('O');
            (getChannel as jest.Mock).mockReturnValue(publicChannel);

            const {result} = renderHook(
                () => useBurnOnRead(
                    createMockDraft(),
                    mockHandleDraftChange,
                    mockFocusTextbox,
                    false,
                    true,
                ),
                {wrapper},
            );

            expect(result.current.additionalControl).toBeUndefined();
        });

        it('should hide button when the ABAC policy denies the action', () => {
            const publicChannel = createMockChannel('O');
            (getChannel as jest.Mock).mockReturnValue(publicChannel);
            (useCreateBurnOnReadAccess as jest.Mock).mockReturnValue(false);

            const {result} = renderHook(
                () => useBurnOnRead(
                    createMockDraft(),
                    mockHandleDraftChange,
                    mockFocusTextbox,
                    false,
                    true,
                ),
                {wrapper},
            );

            expect(result.current.additionalControl).toBeUndefined();
        });

        it('should show button when the ABAC policy allows the action', () => {
            const publicChannel = createMockChannel('O');
            (getChannel as jest.Mock).mockReturnValue(publicChannel);
            (useCreateBurnOnReadAccess as jest.Mock).mockReturnValue(true);

            const {result} = renderHook(
                () => useBurnOnRead(
                    createMockDraft(),
                    mockHandleDraftChange,
                    mockFocusTextbox,
                    false,
                    true,
                ),
                {wrapper},
            );

            expect(result.current.additionalControl).toBeDefined();
        });

        it('should show button when user is a bot (bots can send BoR for OTP, integrations)', () => {
            (getCurrentUser as jest.Mock).mockReturnValue({id: 'bot-user-id', is_bot: true});
            const publicChannel = createMockChannel('O');
            (getChannel as jest.Mock).mockReturnValue(publicChannel);

            const {result} = renderHook(
                () => useBurnOnRead(
                    createMockDraft(),
                    mockHandleDraftChange,
                    mockFocusTextbox,
                    false,
                    true,
                ),
                {wrapper},
            );

            expect(result.current.additionalControl).toBeDefined();
        });
    });

    describe('button visibility in threads', () => {
        it('should hide burn-on-read button in thread replies', () => {
            const publicChannel = createMockChannel('O');
            (getChannel as jest.Mock).mockReturnValue(publicChannel);

            const draftWithRootId: PostDraft = {
                ...createMockDraft(),
                rootId: 'root-post-id',
            };

            const {result} = renderHook(
                () => useBurnOnRead(
                    draftWithRootId,
                    mockHandleDraftChange,
                    mockFocusTextbox,
                    false,
                    true,
                ),
                {wrapper},
            );

            expect(result.current.additionalControl).toBeUndefined();
        });
    });

    describe('edge cases', () => {
        it('should hide button when channel is missing (fail-closed)', () => {
            (getChannel as jest.Mock).mockReturnValue(null);

            const {result} = renderHook(
                () => useBurnOnRead(
                    createMockDraft(),
                    mockHandleDraftChange,
                    mockFocusTextbox,
                    false,
                    true,
                ),
                {wrapper},
            );

            // Should hide button when channel is missing (fail-closed: if we can't validate, don't show)
            expect(result.current.additionalControl).toBeUndefined();
        });

        it('should hide button when currentUser is missing (fail-closed principle)', () => {
            (getCurrentUser as jest.Mock).mockReturnValue(null);
            const publicChannel = createMockChannel('O');
            (getChannel as jest.Mock).mockReturnValue(publicChannel);

            const {result} = renderHook(
                () => useBurnOnRead(
                    createMockDraft(),
                    mockHandleDraftChange,
                    mockFocusTextbox,
                    false,
                    true,
                ),
                {wrapper},
            );

            // Should hide button when currentUser is missing (fail-closed: if we can't validate, don't show)
            expect(result.current.additionalControl).toBeUndefined();
        });
    });

    describe('label visibility', () => {
        it('should show label when burn-on-read is active', () => {
            const publicChannel = createMockChannel('O');
            (getChannel as jest.Mock).mockReturnValue(publicChannel);

            const draftWithBoR = createMockDraft(PostTypes.BURN_ON_READ);

            const {result} = renderHook(
                () => useBurnOnRead(
                    draftWithBoR,
                    mockHandleDraftChange,
                    mockFocusTextbox,
                    false,
                    true,
                ),
                {wrapper},
            );

            expect(result.current.labels).toBeDefined();
        });

        // The policy gates the button but deliberately not the label. A draft already
        // marked burn-on-read keeps showing it, and UnifiedLabelsWrapper's remove-all
        // clears it, so a denied user is never stuck with an invisible marking.
        it('should still show the label when the policy denies the action', () => {
            const publicChannel = createMockChannel('O');
            (getChannel as jest.Mock).mockReturnValue(publicChannel);
            (useCreateBurnOnReadAccess as jest.Mock).mockReturnValue(false);

            const {result} = renderHook(
                () => useBurnOnRead(
                    createMockDraft(PostTypes.BURN_ON_READ),
                    mockHandleDraftChange,
                    mockFocusTextbox,
                    false,
                    true,
                ),
                {wrapper},
            );

            expect(result.current.additionalControl).toBeUndefined();
            expect(result.current.labels).toBeDefined();
        });

        it('should hide label in thread replies even if burn-on-read is active', () => {
            const publicChannel = createMockChannel('O');
            (getChannel as jest.Mock).mockReturnValue(publicChannel);

            const draftWithBoRAndRootId: PostDraft = {
                ...createMockDraft(PostTypes.BURN_ON_READ),
                rootId: 'root-post-id',
            };

            const {result} = renderHook(
                () => useBurnOnRead(
                    draftWithBoRAndRootId,
                    mockHandleDraftChange,
                    mockFocusTextbox,
                    false,
                    true,
                ),
                {wrapper},
            );

            expect(result.current.labels).toBeUndefined();
        });
    });

    // All this hook owes useCreateBurnOnReadAccess is the channel. The action, the feature
    // flag and the fail-closed default are that hook's business — see its own tests.
    describe('render permission request', () => {
        it('asks about the draft channel', () => {
            (getChannel as jest.Mock).mockReturnValue(createMockChannel('O'));

            renderHook(
                () => useBurnOnRead(
                    createMockDraft(),
                    mockHandleDraftChange,
                    mockFocusTextbox,
                    false,
                    true,
                ),
                {wrapper},
            );

            expect(useCreateBurnOnReadAccess).toHaveBeenCalledWith('channel-id');
        });
    });

    // isBurnOnReadSendable gates the send button and the Enter key. It must block only a
    // burn-on-read draft the policy has denied — blocking whenever the policy denies would stop
    // ordinary messages too, which is the plausible way to get this wrong.
    describe('send gating', () => {
        const renderSendable = (draftType?: PostType) => {
            (getChannel as jest.Mock).mockReturnValue(createMockChannel('O'));

            const {result} = renderHook(
                () => useBurnOnRead(
                    createMockDraft(draftType),
                    mockHandleDraftChange,
                    mockFocusTextbox,
                    false,
                    true,
                ),
                {wrapper},
            );

            return result.current.isBurnOnReadSendable;
        };

        it('blocks a burn-on-read draft when the policy denies', () => {
            (useCreateBurnOnReadAccess as jest.Mock).mockReturnValue(false);
            expect(renderSendable(PostTypes.BURN_ON_READ)).toBe(false);
        });

        it('allows a burn-on-read draft when the policy allows', () => {
            (useCreateBurnOnReadAccess as jest.Mock).mockReturnValue(true);
            expect(renderSendable(PostTypes.BURN_ON_READ)).toBe(true);
        });

        it('allows an ordinary draft even when the policy denies', () => {
            (useCreateBurnOnReadAccess as jest.Mock).mockReturnValue(false);
            expect(renderSendable(undefined)).toBe(true);
        });

        it('allows an ordinary draft when the policy allows', () => {
            (useCreateBurnOnReadAccess as jest.Mock).mockReturnValue(true);
            expect(renderSendable(undefined)).toBe(true);
        });

        // hasBurnOnReadSet is `isEnabled && draft.type === BURN_ON_READ`, so a burn-on-read draft
        // with the feature switched off is sendable: submitPost drops the type and it posts as an
        // ordinary message. Surprising enough to pin, so it is not "fixed" later.
        it('allows a burn-on-read draft when the feature is disabled, despite the policy', () => {
            (isBurnOnReadEnabled as jest.Mock).mockReturnValue(false);
            (useCreateBurnOnReadAccess as jest.Mock).mockReturnValue(false);
            expect(renderSendable(PostTypes.BURN_ON_READ)).toBe(true);
        });
    });

    describe('handlers', () => {
        it('should provide handleBurnOnReadApply handler', () => {
            const publicChannel = createMockChannel('O');
            (getChannel as jest.Mock).mockReturnValue(publicChannel);

            const {result} = renderHook(
                () => useBurnOnRead(
                    createMockDraft(),
                    mockHandleDraftChange,
                    mockFocusTextbox,
                    false,
                    true,
                ),
                {wrapper},
            );

            expect(result.current.handleBurnOnReadApply).toBeDefined();
            expect(typeof result.current.handleBurnOnReadApply).toBe('function');
        });

        it('should provide handleRemoveBurnOnRead handler', () => {
            const publicChannel = createMockChannel('O');
            (getChannel as jest.Mock).mockReturnValue(publicChannel);

            const {result} = renderHook(
                () => useBurnOnRead(
                    createMockDraft(),
                    mockHandleDraftChange,
                    mockFocusTextbox,
                    false,
                    true,
                ),
                {wrapper},
            );

            expect(result.current.handleRemoveBurnOnRead).toBeDefined();
            expect(typeof result.current.handleRemoveBurnOnRead).toBe('function');
        });
    });
});
