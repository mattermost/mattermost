// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {render, screen, fireEvent} from '@testing-library/react';
import React from 'react';
import {IntlProvider} from 'react-intl';

import Tag from './tag';

// Test wrapper with IntlProvider
const renderWithIntl = (ui: React.ReactElement) => {
    return render(
        <IntlProvider locale='en' messages={{}}>
            {ui}
        </IntlProvider>,
    );
};

describe('Tag', () => {
    // Basic rendering tests
    it('should render with text', () => {
        renderWithIntl(<Tag text='Test Tag'/>);
        expect(screen.getByText('Test Tag')).toBeInTheDocument();
    });

    it('should render as div by default (backward compat)', () => {
        const {container} = renderWithIntl(<Tag text='Test'/>);
        expect(container.querySelector('div')).toBeInTheDocument();
    });

    it('should render as button when onClick is provided', () => {
        const handleClick = jest.fn();
        const {container} = renderWithIntl(<Tag text='Test' onClick={handleClick}/>);
        expect(container.querySelector('button')).toBeInTheDocument();
    });

    // Size variants
    it.each(['xs', 'sm', 'md', 'lg'] as const)(
        'should apply correct size class for size="%s"',
        (size) => {
            const {container} = renderWithIntl(<Tag text='Test' size={size}/>);
            const tag = container.firstChild as HTMLElement;
            expect(tag).toHaveClass(`Tag--${size}`);
        },
    );

    // Size mapping removed - all consumers migrated to new size names

    // Variant tests
    it.each(['default', 'info', 'success', 'warning', 'danger', 'dangerDim', 'primary', 'secondary'] as const)(
        'should apply correct variant class for variant="%s"',
        (variant) => {
            const {container} = renderWithIntl(<Tag text='Test' variant={variant}/>);
            const tag = container.firstChild as HTMLElement;
            expect(tag).toHaveClass(`Tag--${variant}`);
        },
    );

    // Uppercase tests
    it('should apply uppercase class when uppercase is true', () => {
        const {container} = renderWithIntl(<Tag text='test' uppercase={true}/>);
        const tag = container.firstChild as HTMLElement;
        expect(tag).toHaveClass('Tag--uppercase');
    });

    it('should not apply uppercase class when uppercase is false', () => {
        const {container} = renderWithIntl(<Tag text='test' uppercase={false}/>);
        const tag = container.firstChild as HTMLElement;
        expect(tag).not.toHaveClass('Tag--uppercase');
    });

    // Icon tests
    it('should render with icon', () => {
        const icon = <svg data-testid='test-icon'/>;
        renderWithIntl(<Tag text='Test' icon={icon}/>);
        expect(screen.getByTestId('test-icon')).toBeInTheDocument();
    });

    it('should render icon with explicit size', () => {
        const MockIcon = ({size}: {size?: number}) => <svg data-testid='icon' width={size} height={size}/>;
        renderWithIntl(<Tag text='Test' icon={<MockIcon size={20}/>} size='lg'/>);
        const icon = screen.getByTestId('icon');
        expect(icon).toHaveAttribute('width', '20');
        expect(icon).toHaveAttribute('height', '20');
    });

    // Click handler tests
    it('should call onClick when clicked', () => {
        const handleClick = jest.fn();
        renderWithIntl(<Tag text='Clickable' onClick={handleClick}/>);
        fireEvent.click(screen.getByText('Clickable'));
        expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it('should have cursor pointer style when onClick is provided', () => {
        const handleClick = jest.fn();
        const {container} = renderWithIntl(<Tag text='Test' onClick={handleClick}/>);
        const button = container.querySelector('button');
        expect(button).toBeInTheDocument();
    });

    // Full width tests
    it('should apply full-width class when fullWidth is true', () => {
        const {container} = renderWithIntl(<Tag text='Full Width' fullWidth={true}/>);
        const tag = container.firstChild as HTMLElement;
        expect(tag).toHaveClass('Tag--full-width');
    });

    // Custom className tests
    it('should apply custom className', () => {
        const {container} = renderWithIntl(<Tag text='Test' className='custom-class'/>);
        const tag = container.firstChild as HTMLElement;
        expect(tag).toHaveClass('custom-class');
    });

    // Test ID tests
    it('should apply testId attribute', () => {
        renderWithIntl(<Tag text='Test' testId='my-tag'/>);
        expect(screen.getByTestId('my-tag')).toBeInTheDocument();
    });

    // Accessibility tests
    it('should have aria-label when text is string', () => {
        const {container} = renderWithIntl(<Tag text='Test Tag'/>);
        const tag = container.firstChild as HTMLElement;
        expect(tag).toHaveAttribute('aria-label', 'Test Tag');
    });

    it('should have type="button" when rendered as button', () => {
        const handleClick = jest.fn();
        const {container} = renderWithIntl(<Tag text='Test' onClick={handleClick}/>);
        const button = container.querySelector('button');
        expect(button).toHaveAttribute('type', 'button');
    });

    // Default props tests
    it('should use default size (xs) when not specified', () => {
        const {container} = renderWithIntl(<Tag text='Test'/>);
        const tag = container.firstChild as HTMLElement;
        expect(tag).toHaveClass('Tag--xs');
    });

    it('should use default variant (default) when not specified', () => {
        const {container} = renderWithIntl(<Tag text='Test'/>);
        const tag = container.firstChild as HTMLElement;
        expect(tag).toHaveClass('Tag--default');
    });

    // Edge cases
    it('should handle React node as text', () => {
        renderWithIntl(<Tag text={<span data-testid='custom-content'>Custom Content</span>}/>);
        expect(screen.getByTestId('custom-content')).toBeInTheDocument();
    });
});

