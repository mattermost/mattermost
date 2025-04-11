// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

import CtaButtons from 'components/admin_console/workspace-optimization/cta_buttons';

import {renderWithContext} from 'tests/react_testing_utils';

describe('components/admin_console/workspace-optimization/cta_buttons', () => {
    const baseProps = {
        learnMoreLink: '/learn_more',
        learnMoreText: 'Learn More',
        actionLink: '/action_link',
        actionText: 'Action Text',
    };

    test('should render all buttons correctly', () => {
        renderWithContext(<CtaButtons {...baseProps}/>);

        // Verify action button
        const actionButton = screen.getByText('Action Text');
        expect(actionButton).toBeInTheDocument();
        expect(actionButton).toHaveClass('actionButton', 'annnouncementBar__purchaseNow');

        // Verify learn more button
        const learnMoreButton = screen.getByText('Learn More');
        expect(learnMoreButton).toBeInTheDocument();
        expect(learnMoreButton).toHaveClass('learnMoreButton', 'light-blue-btn');
    });

    test('should render correct number of buttons', () => {
        renderWithContext(<CtaButtons {...baseProps}/>);

        const buttons = screen.getAllByRole('button');
        expect(buttons).toHaveLength(2);
    });

    test('should navigate on button click', async () => {
        // Create a mock history for testing
        const mockHistory = {
            push: jest.fn(),
        };

        // Mock the useHistory hook to return our mock history
        jest.spyOn(require('react-router-dom'), 'useHistory').mockReturnValue(mockHistory);

        renderWithContext(<CtaButtons {...baseProps}/>);

        // Click on action button
        await userEvent.click(screen.getByText('Action Text'));
        expect(mockHistory.push).toHaveBeenCalledWith('/action_link');

        // Click on learn more button
        await userEvent.click(screen.getByText('Learn More'));
        expect(mockHistory.push).toHaveBeenCalledWith('/learn_more');
    });

    test('should call callback when provided', async () => {
        const actionButtonCallback = jest.fn();

        renderWithContext(
            <CtaButtons
                actionText='Action Text'
                actionButtonCallback={actionButtonCallback}
            />,
        );

        await userEvent.click(screen.getByText('Action Text'));
        expect(actionButtonCallback).toHaveBeenCalledTimes(1);
    });
});
