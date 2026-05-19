// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {Post, PostType} from '@mattermost/types/posts';

import {Posts} from 'mattermost-redux/constants';
import type {Theme} from 'mattermost-redux/selectors/entities/preferences';

import PostMessageView from 'components/post_view/post_message_view/post_message_view';

import {act, renderWithContext, screen, userEvent, waitFor} from 'tests/react_testing_utils';

jest.mock('components/properties_card_view/propertyValueRenderer/post_preview_property_renderer/post_preview_property_renderer', () => {
    return jest.fn(() => <div data-testid='post-preview-property-renderer-mock'>{'PostPreviewPropertyRenderer Mock'}</div>);
});

jest.mock('components/post_markdown', () => {
    return jest.fn((props: any) => <div data-testid='post-markdown'>{props.message}</div>);
});

jest.mock('plugins/pluggable', () => {
    return jest.fn(() => <div data-testid='pluggable-mock'/>);
});

/** ShowMore uses scrollHeight > maxHeight; jsdom reports scrollHeight as 0, so overflow never triggers without this. */
function stubShowMoreOverflowLayout(run: () => void) {
    const scrollSpy = jest.spyOn(Element.prototype, 'scrollHeight', 'get').mockReturnValue(100);
    const raf = window.requestAnimationFrame;
    window.requestAnimationFrame = (cb: FrameRequestCallback) => {
        cb(0);
        return 0;
    };
    try {
        run();
    } finally {
        window.requestAnimationFrame = raf;
        scrollSpy.mockRestore();
    }
}

describe('components/post_view/PostAttachment', () => {
    const post = {
        id: 'post_id',
        message: 'post message',
    } as Post;

    const baseProps = {
        post,
        enableFormatting: true,
        options: {},
        compactDisplay: false,
        isRHS: false,
        isRHSOpen: false,
        isRHSExpanded: false,
        theme: {} as Theme,
        pluginPostTypes: {},
        currentRelativeTeamUrl: 'dummy_team_url',
        isChannelAutotranslated: false,
        userLanguage: 'en',
    };

    test('should match snapshot', () => {
        const {container} = renderWithContext(<PostMessageView {...baseProps}/>);
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot, on Show More', async () => {
        // ShowMore sets isOverflow when textContainer.scrollHeight > maxHeight.
        // Default max height (600px) is never exceeded by the mocked short message; use a tiny maxHeight.
        let container: HTMLElement | undefined;
        stubShowMoreOverflowLayout(() => {
            container = renderWithContext(
                <PostMessageView
                    {...baseProps}
                    maxHeight={1}
                />,
            ).container;
        });

        await waitFor(() => {
            expect(screen.getByRole('button', {name: /show more/i})).toBeInTheDocument();
        });
        expect(container).toBeDefined();
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot, on Show Less', async () => {
        let container: HTMLElement | undefined;
        stubShowMoreOverflowLayout(() => {
            container = renderWithContext(
                <PostMessageView
                    {...baseProps}
                    maxHeight={1}
                />,
            ).container;
        });

        await waitFor(() => {
            expect(screen.getByRole('button', {name: /show more/i})).toBeInTheDocument();
        });
        await userEvent.click(screen.getByRole('button', {name: /show more/i}));

        await waitFor(() => {
            expect(screen.getByRole('button', {name: /show less/i})).toBeInTheDocument();
        });
        expect(container).toBeDefined();
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot, on deleted post', () => {
        const props = {...baseProps, post: {...post, state: Posts.POST_DELETED as 'DELETED'}};
        const {container} = renderWithContext(<PostMessageView {...props}/>);

        expect(container).toMatchSnapshot();

        // Verify the deleted post message is rendered
        expect(screen.getByText('(message deleted)')).toBeInTheDocument();
    });

    test('should match snapshot, on edited post', () => {
        const props = {...baseProps, post: {...post, edit_at: 1}};
        const {container} = renderWithContext(<PostMessageView {...props}/>);

        expect(container).toMatchSnapshot();
    });

    test('should match snapshot, on ephemeral post', () => {
        const props = {...baseProps, post: {...post, type: Posts.POST_TYPES.EPHEMERAL as PostType}};
        const {container} = renderWithContext(<PostMessageView {...props}/>);

        expect(container).toMatchSnapshot();
    });

    test('should match checkOverflow state on handleHeightReceived change', () => {
        // PostMarkdown is mocked, so we get imageProps from the mock calls.
        // Import the mocked PostMarkdown to access its calls.
        const PostMarkdown = jest.requireMock('components/post_markdown');

        PostMarkdown.mockClear();
        renderWithContext(<PostMessageView {...baseProps}/>);

        // PostMarkdown should have been called with imageProps
        const postMarkdownCalls = PostMarkdown.mock.calls;
        expect(postMarkdownCalls.length).toBeGreaterThan(0);

        const imageProps = postMarkdownCalls[0][0].imageProps;
        expect(imageProps).toBeDefined();
        expect(imageProps.onImageLoaded).toBeDefined();

        // Call onImageLoaded with height > 0 (should trigger checkPostOverflow)
        const initialCallCount = postMarkdownCalls.length;
        act(() => {
            imageProps.onImageLoaded(1);
        });

        // Component should re-render (PostMarkdown called again with updated checkOverflow)
        expect(PostMarkdown.mock.calls.length).toBeGreaterThan(initialCallCount);

        // Call with height 0 (should NOT trigger checkPostOverflow)
        const callCountAfterFirst = PostMarkdown.mock.calls.length;
        act(() => {
            imageProps.onImageLoaded(0);
        });

        // Should not cause additional re-render since height is 0
        expect(PostMarkdown.mock.calls.length).toEqual(callCountAfterFirst);
    });
});
