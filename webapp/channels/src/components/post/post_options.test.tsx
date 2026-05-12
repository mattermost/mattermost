// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen} from 'tests/react_testing_utils';
import {Locations} from 'utils/constants';
import {TestHelper} from 'utils/test_helper';

import PostOptions from './post_options';

// Mock connected/complex child components so the test doesn't need a full Redux setup
jest.mock('components/post_view/post_recent_reactions', () => {
    return {
        __esModule: true,
        default: ({size}: {size: number}) => (
            <div data-testid='post-recent-reactions' data-size={size}/>
        ),
    };
});

jest.mock('components/dot_menu', () => {
    return {
        __esModule: true,
        default: () => <div data-testid='dot-menu'/>,
    };
});

jest.mock('components/actions_menu', () => {
    return {
        __esModule: true,
        default: () => <div data-testid='actions-menu'/>,
    };
});

jest.mock('components/post_view/post_reaction', () => {
    return {
        __esModule: true,
        default: () => <div data-testid='post-reaction'/>,
    };
});

jest.mock('components/post_view/post_flag_icon', () => {
    return {
        __esModule: true,
        default: () => <div data-testid='post-flag-icon'/>,
    };
});

jest.mock('components/common/comment_icon', () => {
    return {
        __esModule: true,
        default: () => <div data-testid='comment-icon'/>,
    };
});

jest.mock('components/common/hooks/usePluginVisibilityInSharedChannel', () => ({
    usePluginVisibilityInSharedChannel: () => true,
}));

describe('PostOptions - quick reaction count (MM-68681)', () => {
    // Use type: '' for a regular (non-system) post so reactions are enabled
    const post = TestHelper.getPostMock({type: ''});

    const baseProps = {
        post,
        teamId: 'team1',
        isFlagged: false,
        removePost: jest.fn(),
        enableEmojiPicker: true,
        isReadOnly: false,
        channelIsArchived: false,
        handleDropdownOpened: jest.fn(),
        oneClickReactionsEnabled: true,
        // Provide 3 emojis so that the slice(0, size) logic has enough to return
        recentEmojis: [
            {name: 'thumbsup', category: 'people'} as any,
            {name: 'grinning', category: 'people'} as any,
            {name: 'white_check_mark', category: 'symbols'} as any,
        ],
        hover: true, // simulate hover so hoverLocal is true
        isMobileView: false,
        location: Locations.RHS_ROOT as keyof typeof Locations,
        pluginActions: [],
        isChannelAutotranslated: false,
        actions: {
            emitShortcutReactToLastPostFrom: jest.fn(),
        },
    };

    test('shows 3 quick reaction emojis in CENTER location', () => {
        renderWithContext(
            <PostOptions
                {...baseProps}
                location={Locations.CENTER}
                isExpanded={false}
            />,
        );

        const recentReactions = screen.getByTestId('post-recent-reactions');
        expect(recentReactions).toHaveAttribute('data-size', '3');
    });

    test('shows 1 quick reaction emoji in RHS_ROOT when isExpanded is false (narrow RHS)', () => {
        renderWithContext(
            <PostOptions
                {...baseProps}
                location={Locations.RHS_ROOT}
                isExpanded={false}
            />,
        );

        const recentReactions = screen.getByTestId('post-recent-reactions');
        expect(recentReactions).toHaveAttribute('data-size', '1');
    });

    test('shows 3 quick reaction emojis in RHS_ROOT when isExpanded is true (expanded RHS or Global Threads view)', () => {
        renderWithContext(
            <PostOptions
                {...baseProps}
                location={Locations.RHS_ROOT}
                isExpanded={true}
            />,
        );

        const recentReactions = screen.getByTestId('post-recent-reactions');
        expect(recentReactions).toHaveAttribute('data-size', '3');
    });

    test('shows 3 quick reaction emojis in RHS_COMMENT when isExpanded is true', () => {
        renderWithContext(
            <PostOptions
                {...baseProps}
                location={Locations.RHS_COMMENT}
                isExpanded={true}
            />,
        );

        const recentReactions = screen.getByTestId('post-recent-reactions');
        expect(recentReactions).toHaveAttribute('data-size', '3');
    });
});
