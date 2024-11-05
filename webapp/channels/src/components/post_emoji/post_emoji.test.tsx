// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen} from 'tests/react_testing_utils';

import PostEmoji from './post_emoji';

describe('PostEmoji', () => {
    const baseProps = {
        children: ':emoji:',
        imageUrl: '/api/v4/emoji/1234/image',
        name: 'emoji',
    };

    test('should render image when imageUrl is provided', () => {
        renderWithContext(<PostEmoji {...baseProps}/>);

        expect(screen.queryByTestId('postEmoji.:' + baseProps.name + ':')).toBeInTheDocument();
        expect(screen.queryByTestId('postEmoji.:' + baseProps.name + ':')).toHaveStyle(`backgroundImage: url(${baseProps.imageUrl})}`);
    });

    test('should render shortcode text within span when imageUrl is provided', () => {
        renderWithContext(<PostEmoji {...baseProps}/>);

        expect(screen.queryByTestId('postEmoji.:' + baseProps.name + ':')).toHaveTextContent(`:${baseProps.name}:`);
    });

    test('should render children as fallback when imageUrl is empty', () => {
        const props = {
            ...baseProps,
            imageUrl: '',
        };

        renderWithContext(<PostEmoji {...props}/>);

        expect(screen.queryByTestId('postEmoji.:' + baseProps.name + ':')).not.toBeInTheDocument();
        expect(screen.getByText(`:${props.name}:`)).toBeInTheDocument();
    });
});
