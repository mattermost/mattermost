// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {render, screen} from 'tests/react_testing_utils';

import LoadingWrapper from './loading_wrapper';

describe('components/widgets/loading/LoadingWrapper', () => {
    test('should show spinner with text when loading', () => {
        render(
            <LoadingWrapper
                loading={true}
                text='test'
                testId='fixture.loading'
            >
                {'children'}
            </LoadingWrapper>,
        );

        expect(screen.getByText('test')).toBeInTheDocument();
        expect(screen.getByTestId('fixture.loading')).toBeInTheDocument();
        expect(screen.queryByText('children')).not.toBeInTheDocument();
    });

    test('should show spinner without text when loading', () => {
        render(
            <LoadingWrapper
                loading={true}
                testId='fixture.loading'
            >
                {'text'}
            </LoadingWrapper>,
        );

        expect(screen.getByTestId('fixture.loading')).toBeInTheDocument();
        expect(screen.queryByText('text')).not.toBeInTheDocument();
    });

    test('should show content with children when not loading', () => {
        render(
            <LoadingWrapper
                loading={false}
                testId='fixture.loading'
            >
                {'text'}
            </LoadingWrapper>,
        );

        expect(screen.queryByTestId('fixture.loading')).not.toBeInTheDocument();
        expect(screen.getByText('text')).toBeInTheDocument();
    });

    test('should show nothing when not loading and no children', () => {
        const {container} = render(
            <LoadingWrapper
                loading={false}
                testId='fixture.loading'
            />,
        );

        expect(screen.queryByTestId('fixture.loading')).not.toBeInTheDocument();
        expect(container).toBeEmptyDOMElement();
    });
});
