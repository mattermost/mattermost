// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {shallow} from 'enzyme';
import React from 'react';

import ScrollToBottomToast from './scroll_to_bottom_toast';

describe('ScrollToBottomToast Component', () => {
    const mockOnDismiss = jest.fn();
    const mockOnClick = jest.fn();
    const mockOnClickEvent = {
        preventDefault: jest.fn(),
        stopPropagation: jest.fn(),
    };

    it('should render ScrollToBottomToast component', () => {
        const wrapper = shallow(
            <ScrollToBottomToast
                onDismiss={mockOnDismiss}
                onClick={mockOnClick}
            />,
        );

        // Assertions
        expect(wrapper.find('.scroll-to-bottom-toast')).toHaveLength(1);
        expect(wrapper.find('UnreadBelowIcon')).toHaveLength(1);
        expect(wrapper.text()).toContain('Jump to recents');
        expect(wrapper.find('.scroll-to-bottom-toast__dismiss')).toHaveLength(1);
        expect(wrapper.find('.close-btn')).toHaveLength(1);
    });

    it('should call onClick when clicked', () => {
        const wrapper = shallow(
            <ScrollToBottomToast
                onDismiss={mockOnDismiss}
                onClick={mockOnClick}
            />,
        );

        // Simulate click
        wrapper.simulate('click', mockOnClickEvent);

        // Expect the onClick function to be called
        expect(mockOnClick).toHaveBeenCalled();
    });

    it('should call onDismiss when close button is clicked', () => {
        const wrapper = shallow(
            <ScrollToBottomToast
                onDismiss={mockOnDismiss}
                onClick={mockOnClick}
            />,
        );

        // Simulate click on the close button
        wrapper.find('.scroll-to-bottom-toast__dismiss').simulate('click', mockOnClickEvent);

        // Expect the onDismiss function to be called
        expect(mockOnDismiss).toHaveBeenCalled();

        // Expect to stop propagation to avoid scrolling down on dismissing
        expect(mockOnClickEvent.stopPropagation).toHaveBeenCalled();
    });
});

