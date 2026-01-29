// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext} from 'tests/react_testing_utils';
import {Locations} from 'utils/constants';
import {TestHelper} from 'utils/test_helper';

import PostOptions from './post_options';

// Mock PostRecentReactions to capture the size prop
jest.mock('components/post_view/post_recent_reactions', () => {
    return jest.fn((props: {size: number}) => (
        <div
            data-testid='post-recent-reactions'
            data-size={props.size}
        />
    ));
});

describe('PostOptions - Emoji count based on container width', () => {
    const baseProps = {
        post: TestHelper.getPostMock({type: '', state: undefined}),
        teamId: 'team-id',
        isFlagged: false,
        removePost: jest.fn(),
        enableEmojiPicker: true,
        isReadOnly: false,
        channelIsArchived: false,
        handleDropdownOpened: jest.fn(),
        collapsedThreadsEnabled: false,
        shouldShowActionsMenu: false,
        oneClickReactionsEnabled: false,
        recentEmojis: [],
        hover: true,
        isMobileView: false,
        location: Locations.CENTER,
        pluginActions: [],
        isPostBeingEdited: false,
        actions: {
            emitShortcutReactToLastPostFrom: jest.fn(),
        },
    };

    const propsWithReactions = {
        ...baseProps,
        oneClickReactionsEnabled: true,
        recentEmojis: [
            TestHelper.getSystemEmojiMock({name: 'thumbsup', short_name: 'thumbsup'}),
            TestHelper.getSystemEmojiMock({name: 'fire', short_name: 'fire'}),
            TestHelper.getSystemEmojiMock({name: 'heart', short_name: 'heart'}),
        ],
    };

    test('should show 3 emojis when container width > SIDEBAR_MINIMUM_WIDTH (640px)', () => {
        const mockGetBoundingClientRect = jest.fn(() => ({
            width: 800,
            height: 0,
            top: 0,
            left: 0,
            bottom: 0,
            right: 0,
            x: 0,
            y: 0,
            toJSON: () => ({}),
        }));

        const WrapperComponent = () => {
            const postRef = React.useRef<HTMLDivElement>(null);

            React.useEffect(() => {
                if (postRef.current) {
                    postRef.current.getBoundingClientRect = mockGetBoundingClientRect;
                }
            }, []);

            return (
                <div
                    ref={postRef}
                    className='post'
                >
                    <PostOptions {...propsWithReactions}/>
                </div>
            );
        };

        const {container, rerender} = renderWithContext(<WrapperComponent/>);
        rerender(<WrapperComponent/>);

        const reactionsComponent = container.querySelector('[data-testid="post-recent-reactions"]');
        expect(reactionsComponent).toBeInTheDocument();
        expect(reactionsComponent?.getAttribute('data-size')).toBe('3');
    });

    test('should show 1 emoji when container width <= SIDEBAR_MINIMUM_WIDTH (640px)', () => {
        const mockGetBoundingClientRect = jest.fn(() => ({
            width: 500,
            height: 0,
            top: 0,
            left: 0,
            bottom: 0,
            right: 0,
            x: 0,
            y: 0,
            toJSON: () => ({}),
        }));

        const WrapperComponent = () => {
            const postRef = React.useRef<HTMLDivElement>(null);

            React.useEffect(() => {
                if (postRef.current) {
                    postRef.current.getBoundingClientRect = mockGetBoundingClientRect;
                }
            }, []);

            return (
                <div
                    ref={postRef}
                    className='post'
                >
                    <PostOptions {...propsWithReactions}/>
                </div>
            );
        };

        const {container, rerender} = renderWithContext(<WrapperComponent/>);
        rerender(<WrapperComponent/>);

        const reactionsComponent = container.querySelector('[data-testid="post-recent-reactions"]');
        expect(reactionsComponent).toBeInTheDocument();
        expect(reactionsComponent?.getAttribute('data-size')).toBe('1');
    });

    test('should show 1 emoji when no .post parent is found (default case)', () => {
        const {container} = renderWithContext(<PostOptions {...propsWithReactions}/>);
        const reactionsComponent = container.querySelector('[data-testid="post-recent-reactions"]');
        expect(reactionsComponent).toBeInTheDocument();
        expect(reactionsComponent?.getAttribute('data-size')).toBe('1');
    });
});
