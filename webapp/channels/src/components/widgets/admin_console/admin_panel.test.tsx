// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen, userEvent} from 'tests/react_testing_utils';

import AdminPanel from './admin_panel';

describe('components/widgets/admin_console/AdminPanel', () => {
    const defaultProps = {
        className: 'test-class-name',
        id: 'test-id',
        title: {id: 'test-title-id', defaultMessage: 'test-title-default'},
        subtitle: {id: 'test-subtitle-id', defaultMessage: 'test-subtitle-default'},
        subtitleValues: {foo: 'bar'},
    };

    test('should render with title, subtitle, and children', () => {
        renderWithContext(
            <AdminPanel {...defaultProps}>{'Test'}</AdminPanel>,
        );

        // Verify panel is rendered by checking its heading
        const heading = screen.getByRole('heading', {level: 2});
        expect(heading).toHaveTextContent('test-title-default');

        // Verify panel has correct classes via its container
        const panel = document.getElementById('test-id');
        expect(panel).toHaveClass('AdminPanel', 'clearfix', 'test-class-name');
        expect(panel).toHaveAttribute('id', 'test-id');

        // section.AdminPanel is required for admin_panel.scss overflow:visible to
        // beat Compass CSS-module overflow:hidden (equal single-class specificity).
        expect(panel?.tagName).toBe('SECTION');

        // Verify content is rendered
        expect(screen.getByText('test-subtitle-default')).toBeInTheDocument();
        expect(screen.getByText('Test')).toBeInTheDocument();

        // Verify button is not present
        expect(screen.queryByText(/Button/i)).not.toBeInTheDocument();
    });

    test('should render with button when provided', () => {
        renderWithContext(
            <AdminPanel
                {...defaultProps}
                button={<span>{'TestButton'}</span>}
            >
                {'Test'}
            </AdminPanel>,
        );

        // Verify button is rendered
        expect(screen.getByText('TestButton')).toBeInTheDocument();

        // Verify other content is rendered
        expect(screen.getByText('test-title-default')).toBeInTheDocument();
        expect(screen.getByText('Test')).toBeInTheDocument();
    });

    test('should call header action handler when header action is clicked', async () => {
        const onActionClick = jest.fn();
        renderWithContext(
            <AdminPanel
                {...defaultProps}
                button={
                    <button
                        type='button'
                        onClick={onActionClick}
                    >
                        {'Header action'}
                    </button>
                }
            >
                {'Test'}
            </AdminPanel>,
        );

        await userEvent.click(screen.getByRole('button', {name: 'Header action'}));

        expect(onActionClick).toHaveBeenCalledTimes(1);
    });

    test('should render body-only Compass AdminPanel when title, subtitle, and actions are omitted', () => {
        renderWithContext(
            <AdminPanel
                id='headerless-id'
                className='test-class-name'
            >
                {'Body only'}
            </AdminPanel>,
        );

        const panel = document.getElementById('headerless-id');
        expect(panel).toHaveClass('AdminPanel', 'clearfix', 'test-class-name');
        expect(panel).not.toHaveClass('AdminPanel--headerless');
        expect(panel?.tagName).toBe('SECTION');
        expect(screen.queryByRole('heading', {level: 2})).not.toBeInTheDocument();
        expect(screen.getByText('Body only')).toBeInTheDocument();
        expect(panel?.querySelector('[class*="admin-panel__body"]')).toBeInTheDocument();
    });

    test('should omit body chrome for header-only panels', () => {
        renderWithContext(
            <AdminPanel
                {...defaultProps}
                id='bodyless-id'
            />,
        );

        const panel = document.getElementById('bodyless-id');
        expect(panel).toHaveClass('AdminPanel');
        expect(screen.getByRole('heading', {level: 2})).toHaveTextContent('test-title-default');
        expect(panel?.querySelector('[class*="admin-panel__body"]')).not.toBeInTheDocument();
    });

    test('should render plain string title and subtitle without MessageDescriptor', () => {
        renderWithContext(
            <AdminPanel
                id='string-title-id'
                title='Server updates'
                subtitle='Your workspace is completely up to date!'
            >
                {'Body'}
            </AdminPanel>,
        );

        expect(screen.getByRole('heading', {level: 2})).toHaveTextContent('Server updates');
        expect(screen.getByText('Your workspace is completely up to date!')).toBeInTheDocument();
        expect(screen.getByText('Body')).toBeInTheDocument();
    });

    test('should support expandable collapse via Compass AdminPanel props', async () => {
        renderWithContext(
            <AdminPanel
                {...defaultProps}
                id='expandable-id'
                expandable={true}
                defaultExpandedState='collapsed'
                expandLabel='Expand section'
                collapseLabel='Collapse section'
            >
                {'Hidden until expanded'}
            </AdminPanel>,
        );

        const panel = document.getElementById('expandable-id');
        const collapse = panel?.querySelector('[class*="admin-panel__collapse"]');
        expect(collapse).toHaveAttribute('aria-hidden', 'true');
        expect(screen.getByText('Hidden until expanded')).toBeInTheDocument();

        // Expandable panels opt into AdminPanel--expandable so SCSS restores
        // Compass root overflow:hidden (menu escape uses overflow:visible only
        // on non-expandable panels).
        expect(panel).toHaveClass('AdminPanel--expandable');

        await userEvent.click(screen.getByRole('button', {name: 'Expand section'}));
        expect(collapse).toHaveAttribute('aria-hidden', 'false');
        expect(screen.getByRole('button', {name: 'Collapse section'})).toBeInTheDocument();

        // Even while expanded, webapp SCSS must not force overflow:visible on
        // collapse-inner (Compass keeps it hidden for the grid animation).
        const collapseInner = panel?.querySelector('[class*="admin-panel__collapse-inner"]') as HTMLElement;
        expect(collapseInner).not.toBeNull();
        expect(collapseInner.style.overflow).not.toBe('visible');
        expect(window.getComputedStyle(collapseInner).overflow).not.toBe('visible');
    });
});
