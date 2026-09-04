// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen, userEvent} from 'tests/react_testing_utils';

import Tag from './tag';

describe('components/widgets/tag/Tag', () => {
    test('should render tag with text and default classes', () => {
        renderWithContext(
            <Tag
                className={'test'}
                text={'Test text'}
            />,
        );

        // Get the tag container (parent element of the text)
        const tagText = screen.getByText('Test text');
        const tag = tagText.parentElement;
        expect(tag).toBeInTheDocument();
        expect(tag).toHaveClass('Tag', 'Tag--xs', 'test');
    });

    test('should render tag with icon', () => {
        const {container} = renderWithContext(
            <Tag
                className={'test'}
                text={'Test text'}
                icon={'alert-circle-outline'}
            />,
        );

        // Get the tag container (parent element of the text)
        const tagText = screen.getByText('Test text');
        const tag = tagText.parentElement;
        expect(tag).toBeInTheDocument();
        expect(tag).toHaveClass('Tag', 'Tag--xs', 'test');

        // Check that the icon is rendered (AlertCircleOutlineIcon renders an svg)
        const icon = container.querySelector('svg');
        expect(icon).toBeInTheDocument();
    });

    test('should render tag with uppercase styling', () => {
        renderWithContext(
            <Tag
                className={'test'}
                text={'Test text'}
                uppercase={true}
            />,
        );

        // Get the tag container (parent element of the text)
        const tagText = screen.getByText('Test text');
        const tag = tagText.parentElement;
        expect(tag).toBeInTheDocument();
        expect(tag).toHaveClass('Tag', 'Tag--xs', 'test');

        // uppercase prop is used internally by styled-components for CSS styling
        expect(tag).toHaveStyle({textTransform: 'uppercase'});
    });

    test('should render tag with size "sm"', () => {
        renderWithContext(
            <Tag
                className={'test'}
                text={'Test text'}
                size={'sm'}
            />,
        );

        // Get the tag container (parent element of the text)
        const tagText = screen.getByText('Test text');
        const tag = tagText.parentElement;
        expect(tag).toBeInTheDocument();
        expect(tag).toHaveClass('Tag', 'Tag--sm', 'test');
    });

    test('should render tag with "success" variant', () => {
        renderWithContext(
            <Tag
                className={'test'}
                text={'Test text'}
                variant={'success'}
            />,
        );

        // Get the tag container (parent element of the text)
        const tagText = screen.getByText('Test text');
        const tag = tagText.parentElement;
        expect(tag).toBeInTheDocument();
        expect(tag).toHaveClass('Tag', 'Tag--success', 'Tag--xs', 'test');
    });

    test('should render as button and handle click when onClick provided', async () => {
        const click = jest.fn();
        renderWithContext(
            <Tag
                className={'test'}
                text={'Test text'}
                onClick={click}
            />,
        );

        const tag = screen.getByRole('button', {name: 'Test text'});
        expect(tag).toBeInTheDocument();
        expect(tag).toHaveClass('Tag', 'Tag--xs', 'test');

        await userEvent.click(tag);
        expect(click).toHaveBeenCalledTimes(1);
    });
});
