// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {render, screen, within} from '@testing-library/react';
import React from 'react';

import BasicSeparator from './basic-separator';
import NotificationSeparator from './notification-separator';

describe('components/widgets/separator', () => {
    describe('BasicSeparator', () => {
        test('should render separator with text', () => {
            render(
                <BasicSeparator>
                    {'Some text'}
                </BasicSeparator>,
            );

            // Verify container exists
            const separator = screen.getByTestId('basicSeparator');
            expect(separator).toBeInTheDocument();
            expect(separator).toHaveClass('Separator', 'BasicSeparator');

            // Verify horizontal line renders (hr has implicit role="separator")
            const hr = within(separator).getByRole('separator');
            expect(hr).toBeInTheDocument();
            expect(hr).toHaveClass('separator__hr');

            // Verify text appears
            expect(screen.getByText('Some text')).toBeInTheDocument();
            expect(screen.getByText('Some text')).toHaveClass('separator__text');
        });

        test('should render separator without text', () => {
            render(<BasicSeparator/>);

            // Verify container exists
            const separator = screen.getByTestId('basicSeparator');
            expect(separator).toBeInTheDocument();

            // Verify horizontal line renders (hr has implicit role="separator")
            expect(within(separator).getByRole('separator')).toBeInTheDocument();

            // Verify no text element is rendered
            const textDiv = separator.querySelector('.separator__text');
            expect(textDiv).not.toBeInTheDocument();
        });
    });

    describe('NotificationSeparator', () => {
        test('should render separator without text', () => {
            render(<NotificationSeparator/>);

            // Verify container exists
            const separator = screen.getByTestId('NotificationSeparator');
            expect(separator).toBeInTheDocument();
            expect(separator).toHaveClass('Separator', 'NotificationSeparator');

            // Verify horizontal line renders (hr has implicit role="separator")
            const hr = within(separator).getByRole('separator');
            expect(hr).toBeInTheDocument();
            expect(hr).toHaveClass('separator__hr');

            // Verify no text element is rendered
            const textDiv = separator.querySelector('.separator__text');
            expect(textDiv).not.toBeInTheDocument();
        });

        test('should render separator with text', () => {
            render(
                <NotificationSeparator>
                    {'Some text'}
                </NotificationSeparator>,
            );

            // Verify container exists
            const separator = screen.getByTestId('NotificationSeparator');
            expect(separator).toBeInTheDocument();

            // Verify text appears
            expect(screen.getByText('Some text')).toBeInTheDocument();
            expect(screen.getByText('Some text')).toHaveClass('separator__text');
        });
    });
});
