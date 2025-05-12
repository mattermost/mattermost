// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {screen, render} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

import GenericTag from './generic_tag';

describe('components/widgets/tag/GenericTag', () => {
    test('should match snapshot', () => {
        const {container} = render(
            <GenericTag
                text='Tag Text'
            />,
        );

        expect(container).toMatchSnapshot();
    });

    test('should render the text correctly', () => {
        render(
            <GenericTag
                text='Tag Text'
            />,
        );

        expect(screen.getByText('Tag Text')).toBeInTheDocument();
    });

    test('should apply custom className', () => {
        const {container} = render(
            <GenericTag
                text='Tag Text'
                className='custom-class'
            />,
        );

        expect(container.querySelector('.custom-class')).not.toBeNull();
    });

    test('should apply variant class', () => {
        const {container} = render(
            <GenericTag
                text='Tag Text'
                variant='primary'
            />,
        );

        expect(container.querySelector('.GenericTag--primary')).not.toBeNull();
    });

    test('should apply size class', () => {
        const {container} = render(
            <GenericTag
                text='Tag Text'
                size='small'
            />,
        );

        expect(container.querySelector('.GenericTag--small')).not.toBeNull();
    });

    test('should apply clickable class when onClick is provided', () => {
        const onClick = jest.fn();
        const {container} = render(
            <GenericTag
                text='Tag Text'
                onClick={onClick}
            />,
        );

        expect(container.querySelector('.GenericTag--clickable')).not.toBeNull();
    });

    test('should call onClick when clicked', async () => {
        const onClick = jest.fn();
        render(
            <GenericTag
                text='Tag Text'
                onClick={onClick}
            />,
        );

        await userEvent.click(screen.getByText('Tag Text'));
        expect(onClick).toHaveBeenCalledTimes(1);
    });

    test('should render with tooltip when tooltipTitle is provided', () => {
        // Note: We can't fully test the tooltip functionality here as it requires
        // hovering which is more complex.
        // This test just ensures the WithTooltip component is used.
        const {container} = render(
            <GenericTag
                text='Tag Text'
                tooltipTitle='Tooltip Text'
            />,
        );

        // The tag should still be rendered
        expect(screen.getByText('Tag Text')).toBeInTheDocument();

        // The structure should be different when tooltip is used
        // (WithTooltip wraps the tag element)
        const tagElement = screen.getByText('Tag Text');
        expect(tagElement.parentElement?.parentElement).not.toBe(container);
    });
});
