// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, userEvent, screen} from 'tests/react_testing_utils';

import BurnOnReadLabel from './burn_on_read_label';

describe('BurnOnReadLabel', () => {
    const defaultProps = {
        canRemove: true,
        onRemove: jest.fn(),
        durationMinutes: 10,
    };

    it('should render correctly with duration', () => {
        renderWithContext(
            <BurnOnReadLabel {...defaultProps}/>,
        );

        expect(screen.getByText(/BURN ON READ \(10m\)/i)).toBeInTheDocument();
    });

    it('should display custom duration', () => {
        renderWithContext(
            <BurnOnReadLabel
                {...defaultProps}
                durationMinutes={15}
            />,
        );

        expect(screen.getByText(/BURN ON READ \(15m\)/i)).toBeInTheDocument();
    });

    it('should render close button when canRemove is true', () => {
        renderWithContext(
            <BurnOnReadLabel
                {...defaultProps}
                canRemove={true}
            />,
        );

        const closeButton = screen.getByRole('button');
        expect(closeButton).toBeInTheDocument();
        expect(closeButton).toHaveAttribute('aria-label', 'Remove burn-on-read');
    });

    it('should not render close button when canRemove is false', () => {
        renderWithContext(
            <BurnOnReadLabel
                {...defaultProps}
                canRemove={false}
            />,
        );

        const closeButton = screen.queryByRole('button');
        expect(closeButton).not.toBeInTheDocument();
    });

    it('should call onRemove when close button is clicked', async () => {
        const onRemove = jest.fn();
        renderWithContext(
            <BurnOnReadLabel
                {...defaultProps}
                onRemove={onRemove}
            />,
        );

        const closeButton = screen.getByRole('button');
        await userEvent.click(closeButton);

        expect(onRemove).toHaveBeenCalledTimes(1);
    });

    it('should have correct CSS classes', () => {
        const {container} = renderWithContext(
            <BurnOnReadLabel {...defaultProps}/>,
        );

        expect(container.querySelector('.BurnOnReadLabel')).toBeInTheDocument();
        expect(container.querySelector('.BurnOnReadLabel__badge')).toBeInTheDocument();
        expect(container.querySelector('.BurnOnReadLabel__icon')).toBeInTheDocument();
        expect(container.querySelector('.BurnOnReadLabel__text')).toBeInTheDocument();
    });
});
