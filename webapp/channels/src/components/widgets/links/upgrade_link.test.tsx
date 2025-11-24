// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen, userEvent} from 'tests/react_testing_utils';

import UpgradeLink from './upgrade_link';

// Mock the useOpenSalesLink hook
jest.mock('components/common/hooks/useOpenSalesLink');

describe('components/widgets/links/UpgradeLink', () => {
    const mockOpenSalesLink = jest.fn();

    beforeEach(() => {
        jest.clearAllMocks();
        const useOpenSalesLink = require('components/common/hooks/useOpenSalesLink').default;
        useOpenSalesLink.mockReturnValue([mockOpenSalesLink]);
    });

    test('should render button with default text', () => {
        renderWithContext(<UpgradeLink/>);

        const button = screen.getByRole('button');
        expect(button).toBeInTheDocument();
        expect(button).toHaveTextContent('Upgrade now');
        expect(button).toHaveClass('upgradeLink');
    });

    test('should render button with custom text', () => {
        renderWithContext(<UpgradeLink buttonText='Custom Upgrade Text'/>);

        const button = screen.getByRole('button');
        expect(button).toHaveTextContent('Custom Upgrade Text');
    });

    test('should render with style-button class when styleButton prop is true', () => {
        renderWithContext(<UpgradeLink styleButton={true}/>);

        const button = screen.getByRole('button');
        expect(button).toHaveClass('upgradeLink');
        expect(button).toHaveClass('style-button');
    });

    test('should render with style-link class when styleLink prop is true', () => {
        renderWithContext(<UpgradeLink styleLink={true}/>);

        const button = screen.getByRole('button');
        expect(button).toHaveClass('upgradeLink');
        expect(button).toHaveClass('style-link');
    });

    test('should render with both style classes when both props are true', () => {
        renderWithContext(
            <UpgradeLink
                styleButton={true}
                styleLink={true}
            />,
        );

        const button = screen.getByRole('button');
        expect(button).toHaveClass('upgradeLink');
        expect(button).toHaveClass('style-button');
        expect(button).toHaveClass('style-link');
    });

    test('should call openSalesLink when button is clicked', async () => {
        renderWithContext(<UpgradeLink/>);

        const button = screen.getByRole('button');
        await userEvent.click(button);

        expect(mockOpenSalesLink).toHaveBeenCalledTimes(1);
    });

    test('should prevent default on button click', async () => {
        const mockPreventDefault = jest.fn();
        renderWithContext(<UpgradeLink/>);

        const button = screen.getByRole('button');

        // Create a custom click event
        const clickEvent = new MouseEvent('click', {bubbles: true, cancelable: true});
        Object.defineProperty(clickEvent, 'preventDefault', {value: mockPreventDefault});

        button.dispatchEvent(clickEvent);

        expect(mockPreventDefault).toHaveBeenCalled();
    });
});
