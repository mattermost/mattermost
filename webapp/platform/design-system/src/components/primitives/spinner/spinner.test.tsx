// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {render, screen} from '@testing-library/react';
import React from 'react';

import Spinner from './spinner';

describe('Spinner', () => {
    it('should render with default props', () => {
        render(<Spinner />);
        const spinner = screen.getByRole('status');
        expect(spinner).toBeInTheDocument();
        expect(spinner).toHaveClass('Spinner');
        expect(spinner).toHaveAttribute('aria-label', 'Loading');
        expect(spinner).toHaveStyle({
            width: '16px',
            height: '16px',
        });
    });

    it('should render with 10px size', () => {
        render(<Spinner size={10} />);
        const spinner = screen.getByRole('status');
        expect(spinner).toHaveStyle({
            width: '10px',
            height: '10px',
        });
    });

    it('should render with 12px size', () => {
        render(<Spinner size={12} />);
        const spinner = screen.getByRole('status');
        expect(spinner).toHaveStyle({
            width: '12px',
            height: '12px',
        });
    });

    it('should render with 20px size', () => {
        render(<Spinner size={20} />);
        const spinner = screen.getByRole('status');
        expect(spinner).toHaveStyle({
            width: '20px',
            height: '20px',
        });
    });

    it('should render with 24px size', () => {
        render(<Spinner size={24} />);
        const spinner = screen.getByRole('status');
        expect(spinner).toHaveStyle({
            width: '24px',
            height: '24px',
        });
    });

    it('should render with 32px size', () => {
        render(<Spinner size={32} />);
        const spinner = screen.getByRole('status');
        expect(spinner).toHaveStyle({
            width: '32px',
            height: '32px',
        });
    });

    it('should render with inverted style', () => {
        render(<Spinner inverted />);
        const spinner = screen.getByRole('status');
        expect(spinner).toHaveClass('Spinner--inverted');
    });

    it('should calculate stroke width based on size', () => {
        const {rerender} = render(<Spinner size={10} />);
        let spinner = screen.getByRole('status');
        expect(spinner.style.getPropertyValue('--spinner-stroke-width')).toBe('1px');

        rerender(<Spinner size={20} />);
        spinner = screen.getByRole('status');
        expect(spinner.style.getPropertyValue('--spinner-stroke-width')).toBe('2px');

        rerender(<Spinner size={32} />);
        spinner = screen.getByRole('status');
        expect(spinner.style.getPropertyValue('--spinner-stroke-width')).toBe('3px');
    });

    it('should accept custom aria-label', () => {
        render(<Spinner aria-label='Custom loading message' />);
        const spinner = screen.getByRole('status');
        expect(spinner).toHaveAttribute('aria-label', 'Custom loading message');
    });

    it('should accept custom className', () => {
        render(<Spinner className='custom-class' />);
        const spinner = screen.getByRole('status');
        expect(spinner).toHaveClass('custom-class');
    });

    it('should pass through additional HTML attributes', () => {
        render(<Spinner data-testid='spinner-test' />);
        const spinner = screen.getByTestId('spinner-test');
        expect(spinner).toBeInTheDocument();
    });

    it('should accept custom style and merge with size styles', () => {
        render(<Spinner size={20} style={{color: 'red', margin: '10px'}} />);
        const spinner = screen.getByRole('status');
        expect(spinner).toHaveStyle({
            width: '20px',
            height: '20px',
            color: 'red',
            margin: '10px',
        });
    });

    it('should handle all valid spinner sizes', () => {
        const validSizes = [10, 12, 16, 20, 24, 28, 32];

        validSizes.forEach((size) => {
            const {unmount} = render(<Spinner size={size} data-testid={`spinner-${size}`} />);
            const spinner = screen.getByTestId(`spinner-${size}`);
            expect(spinner).toHaveStyle({
                width: `${size}px`,
                height: `${size}px`,
            });
            unmount();
        });
    });

    it('should have correct accessibility attributes', () => {
        render(<Spinner />);
        const spinner = screen.getByRole('status');
        expect(spinner).toHaveAttribute('role', 'status');
        expect(spinner).toHaveAttribute('aria-label', 'Loading');
    });
});
