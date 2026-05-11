// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {render, screen, userEvent} from 'tests/react_testing_utils';

import Tag from './tag';

describe('components/widgets/tag/Tag', () => {
    test('should render tag with text and default classes', () => {
        render(
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
        const {container} = render(
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
        render(
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
        render(
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
        render(
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
        render(
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

    test('should not apply inline background style when color is not provided', () => {
        render(
            <Tag
                className={'test'}
                text={'Test text'}
            />,
        );

        const tagText = screen.getByText('Test text');
        const tag = tagText.parentElement as HTMLElement;
        expect(tag).toBeInTheDocument();
        expect(tag.style.background).toBe('');
        expect(tag.style.backgroundColor).toBe('');
        expect(tag.style.color).toBe('');
    });

    test('should apply the provided color as background when color is set', () => {
        render(
            <Tag
                className={'test'}
                text={'Test text'}
                color={'#ff5733'}
            />,
        );

        const tagText = screen.getByText('Test text');
        const tag = tagText.parentElement as HTMLElement;
        expect(tag).toBeInTheDocument();
        expect(tag).toHaveStyle({backgroundColor: '#ff5733'});
    });

    test('should let color override variant for background', () => {
        render(
            <Tag
                className={'test'}
                text={'Test text'}
                variant={'success'}
                color={'#ff5733'}
            />,
        );

        const tagText = screen.getByText('Test text');
        const tag = tagText.parentElement as HTMLElement;
        expect(tag).toBeInTheDocument();
        expect(tag).toHaveStyle({backgroundColor: '#ff5733'});
    });

    test('should use white text on a dark color background', () => {
        render(
            <Tag
                text={'Test text'}
                color={'#000000'}
            />,
        );

        const tagText = screen.getByText('Test text');
        const tag = tagText.parentElement as HTMLElement;
        expect(tag).toBeInTheDocument();
        expect(tag).toHaveStyle({backgroundColor: '#000000', color: '#ffffff'});
    });

    test('should use dark text on a light color background', () => {
        render(
            <Tag
                text={'Test text'}
                color={'#ffffff'}
            />,
        );

        const tagText = screen.getByText('Test text');
        const tag = tagText.parentElement as HTMLElement;
        expect(tag).toBeInTheDocument();
        expect(tag).toHaveStyle({backgroundColor: '#ffffff'});
        const colorStyle = tag.style.color.toLowerCase();
        expect(colorStyle === '#000000' || colorStyle === 'rgb(0, 0, 0)' || colorStyle === '#000').toBe(true);
    });
});
