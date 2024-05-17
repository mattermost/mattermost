// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import PostEmoji from './post_emoji';

describe('PostEmoji', () => {
    const baseProps = {
        name: 'apple',
    };

    test('should render image for system emoji', () => {
        renderWithContext(<PostEmoji {...baseProps}/>);

        expect(screen.getByText(':' + baseProps.name + ':')).toBeInTheDocument();
        expect(screen.getByText(':' + baseProps.name + ':')).toHaveStyle('backgroundImage: url(/static/emoji/1f34e.png)}');
    });

    test('should render shortcode text within span for system emoji', () => {
        renderWithContext(<PostEmoji {...baseProps}/>);

        expect(screen.getByText(':' + baseProps.name + ':')).toBeInTheDocument();
    });

    test('should render image for loaded custom emoji', () => {
        const props = {
            ...baseProps,
            name: 'custom-emoji',
        };
        const emoji = TestHelper.getCustomEmojiMock({name: props.name});

        renderWithContext(
            <PostEmoji {...props}/>,
            {
                entities: {
                    emojis: {
                        customEmoji: {
                            [emoji.id]: emoji,
                        },
                    },
                    general: {
                        config: {
                            EnableCustomEmoji: 'true',
                        },
                    },
                },
            },
        );

        expect(screen.getByText(':' + props.name + ':')).toBeInTheDocument();
        expect(screen.getByText(':' + props.name + ':')).toHaveStyle(`backgroundImage: url(/api/v4/emoji/${emoji.id}/image)}`);
    });

    test('should render original text when the emoji is not loaded or does not exist', () => {
        const props = {
            ...baseProps,
            name: 'custom-emoji',
        };

        renderWithContext(<PostEmoji {...props}/>);

        expect(screen.queryByTestId('postEmoji.:' + baseProps.name + ':')).not.toBeInTheDocument();
        expect(screen.getByText(`:${props.name}:`)).toBeInTheDocument();
    });
});
