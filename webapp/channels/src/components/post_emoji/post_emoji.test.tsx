// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {render, screen} from 'tests/react_testing_utils';

import PostEmoji from './post_emoji';

describe('PostEmoji', () => {
    const baseProps = {
        imageUrl: '/api/v4/emoji/1234/image',
        name: 'emoji',
    };

    test('should render image when imageUrl is provided', () => {
        render(<PostEmoji {...baseProps}/>);

        expect(screen.getByTitle(':' + baseProps.name + ':')).toBeInTheDocument();
        expect(screen.getByTitle(':' + baseProps.name + ':')).toHaveStyle(`backgroundImage: url(${baseProps.imageUrl})}`);
    });

    test('should render shortcode text within span when imageUrl is provided', () => {
        render(<PostEmoji {...baseProps}/>);

        expect(screen.getByTitle(':' + baseProps.name + ':')).toHaveTextContent(`:${baseProps.name}:`);
    });

    test('should render original text when imageUrl is empty', () => {
        const props = {
            ...baseProps,
            imageUrl: '',
        };

        render(<PostEmoji {...props}/>);

        expect(screen.queryByTitle(':' + baseProps.name + ':')).not.toBeInTheDocument();
        expect(screen.getByText(`:${props.name}:`)).toBeInTheDocument();
    });
});
