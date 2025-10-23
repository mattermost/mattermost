// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {render, screen} from '@testing-library/react';

import Spinner from './spinner';

describe('Spinner', () => {
    it('should render with default props', () => {
        render(<Spinner />);
        const spinner = screen.getByRole('status');
        expect(spinner).toBeInTheDocument();
        expect(spinner).toHaveClass('Spinner', 'Spinner--md');
        expect(spinner).toHaveAttribute('aria-label', 'Loading');
    });

    it('should render with xs size', () => {
        render(<Spinner size="xs" />);
        const spinner = screen.getByRole('status');
        expect(spinner).toHaveClass('Spinner--xs');
    });

    it('should render with sm size', () => {
        render(<Spinner size="sm" />);
        const spinner = screen.getByRole('status');
        expect(spinner).toHaveClass('Spinner--sm');
    });

    it('should render with md size', () => {
        render(<Spinner size="md" />);
        const spinner = screen.getByRole('status');
        expect(spinner).toHaveClass('Spinner--md');
    });

    it('should render with lg size', () => {
        render(<Spinner size="lg" />);
        const spinner = screen.getByRole('status');
        expect(spinner).toHaveClass('Spinner--lg');
    });

    it('should render with inverted style', () => {
        render(<Spinner inverted />);
        const spinner = screen.getByRole('status');
        expect(spinner).toHaveClass('Spinner--inverted');
    });

    it('should use icon button sizing for IconButton contexts', () => {
        render(<Spinner size="sm" forIconButton />);
        const spinner = screen.getByRole('status');
        expect(spinner).toHaveClass('Spinner--sm-icon');
    });

    it('should use icon button sizing for medium size in IconButton contexts', () => {
        render(<Spinner size="md" forIconButton />);
        const spinner = screen.getByRole('status');
        expect(spinner).toHaveClass('Spinner--md-icon');
    });

    it('should use icon button sizing for large size in IconButton contexts', () => {
        render(<Spinner size="lg" forIconButton />);
        const spinner = screen.getByRole('status');
        expect(spinner).toHaveClass('Spinner--lg-icon');
    });

    it('should not use icon button sizing for xs size', () => {
        render(<Spinner size="xs" forIconButton />);
        const spinner = screen.getByRole('status');
        expect(spinner).toHaveClass('Spinner--xs');
        expect(spinner).not.toHaveClass('Spinner--xs-icon');
    });

    it('should accept custom aria-label', () => {
        render(<Spinner aria-label="Custom loading message" />);
        const spinner = screen.getByRole('status');
        expect(spinner).toHaveAttribute('aria-label', 'Custom loading message');
    });

    it('should accept custom className', () => {
        render(<Spinner className="custom-class" />);
        const spinner = screen.getByRole('status');
        expect(spinner).toHaveClass('custom-class');
    });

    it('should pass through additional HTML attributes', () => {
        render(<Spinner data-testid="spinner-test" />);
        const spinner = screen.getByTestId('spinner-test');
        expect(spinner).toBeInTheDocument();
    });
});
