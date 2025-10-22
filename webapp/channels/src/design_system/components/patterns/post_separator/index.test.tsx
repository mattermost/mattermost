// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen} from 'tests/react_testing_utils';

import PostSeparator from './index';

describe('components/widgets/post_separator', () => {
    test('should render separator', () => {
        renderWithContext(
            <PostSeparator
                rootClassName='custom-class'
                rootTestId='test-separator'
            >
                {'Test content'}
            </PostSeparator>,
        );

        const separator = screen.getByTestId('test-separator');
        expect(separator).toBeInTheDocument();
        expect(separator).toHaveClass('Separator');
        expect(separator).toHaveClass('custom-class');

        const text = screen.getByText('Test content');
        expect(text).toBeInTheDocument();
        expect(text).toHaveClass('separator__text');
    });

    test('should render separator without props', () => {
        const {container} = renderWithContext(<PostSeparator/>);

        const separator = container.querySelector('.Separator');
        expect(separator).toBeInTheDocument();
        expect(separator).toHaveClass('Separator');

        const hr = container.querySelector('.separator__hr');
        expect(hr).toBeInTheDocument();
        expect(hr?.tagName).toBe('HR');
    });
});

