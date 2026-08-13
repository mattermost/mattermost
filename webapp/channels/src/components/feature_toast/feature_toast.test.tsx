// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

import {renderWithContext} from 'tests/react_testing_utils';

import FeatureToast from './feature_toast';

describe('components/FeatureToast', () => {
    const baseProps = {
        show: true,
        title: 'New Feature',
        message: 'Check out this new feature!',
        onDismiss: jest.fn(),
    };

    test('should render when show is true', () => {
        renderWithContext(<FeatureToast {...baseProps}/>);

        expect(screen.getByRole('status')).toBeInTheDocument();
        expect(screen.getByText('New Feature')).toBeInTheDocument();
        expect(screen.getByText('Check out this new feature!')).toBeInTheDocument();
    });

    test('should not render when show is false', () => {
        renderWithContext(
            <FeatureToast
                {...baseProps}
                show={false}
            />,
        );

        expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });

    test('should render with JSX element as message', () => {
        const jsxMessage = <span>{'JSX Message with '}<mark>{'marked text'}</mark></span>;
        renderWithContext(
            <FeatureToast
                {...baseProps}
                message={jsxMessage}
            />,
        );

        expect(screen.getByText('JSX Message with')).toBeInTheDocument();
        expect(screen.getByText('marked text')).toBeInTheDocument();
    });

    test('should have correct ARIA attributes', () => {
        renderWithContext(<FeatureToast {...baseProps}/>);

        const toast = screen.getByRole('status');
        expect(toast).toHaveAttribute('aria-live', 'polite');
        expect(toast).toHaveAttribute('aria-atomic', 'true');
    });

    test('should have accessible close button', () => {
        renderWithContext(<FeatureToast {...baseProps}/>);

        const closeButton = screen.getByRole('button', {name: /close/i});
        expect(closeButton).toBeInTheDocument();
        expect(closeButton).toHaveAttribute('aria-label', 'Close');
    });

    test('should call onDismiss when close button is clicked', async () => {
        const onDismiss = jest.fn();
        renderWithContext(
            <FeatureToast
                {...baseProps}
                onDismiss={onDismiss}
            />,
        );

        const closeButton = screen.getByRole('button', {name: /close/i});
        await userEvent.click(closeButton);

        expect(onDismiss).toHaveBeenCalledTimes(1);
    });

    test('should render action button when showButton is true', () => {
        renderWithContext(
            <FeatureToast
                {...baseProps}
                showButton={true}
                buttonText='Learn More'
            />,
        );

        expect(screen.getByRole('button', {name: 'Learn More'})).toBeInTheDocument();
    });

    test('should not render action button when showButton is false', () => {
        renderWithContext(
            <FeatureToast
                {...baseProps}
                showButton={false}
                buttonText='Learn More'
            />,
        );

        expect(screen.queryByRole('button', {name: 'Learn More'})).not.toBeInTheDocument();
    });

    test('should not render action button when showButton is undefined', () => {
        renderWithContext(<FeatureToast {...baseProps}/>);

        // Should only have the close button
        const buttons = screen.getAllByRole('button');
        expect(buttons).toHaveLength(1);
        expect(buttons[0]).toHaveAttribute('aria-label', 'Close');
    });

    test('should call onDismiss when action button is clicked', async () => {
        const onDismiss = jest.fn();
        renderWithContext(
            <FeatureToast
                {...baseProps}
                onDismiss={onDismiss}
                showButton={true}
                buttonText='Got it'
            />,
        );

        const actionButton = screen.getByRole('button', {name: 'Got it'});
        await userEvent.click(actionButton);

        expect(onDismiss).toHaveBeenCalledTimes(1);
    });
});
