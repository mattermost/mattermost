// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext} from 'tests/react_testing_utils';

import AdminPanelTogglable from './admin_panel_togglable';

describe('components/widgets/admin_console/AdminPanelTogglable', () => {
    const defaultProps = {
        className: 'test-class-name',
        id: 'test-id',
        title: {id: 'test-title-id', defaultMessage: 'test-title-default'},
        subtitle: {
            id: 'test-subtitle-id',
            defaultMessage: 'test-subtitle-default',
        },
        open: true,
        onToggle: jest.fn(),
    };

    test('should match snapshot', () => {
        const {container} = renderWithContext(
            <AdminPanelTogglable {...defaultProps}>
                {'Test'}
            </AdminPanelTogglable>,
        );

        expect(container).toMatchSnapshot();
    });

    test('should match snapshot closed', () => {
        const {container} = renderWithContext(
            <AdminPanelTogglable
                {...defaultProps}
                open={false}
            >
                {'Test'}
            </AdminPanelTogglable>,
        );

        expect(container).toMatchSnapshot();
    });

    test('when expanded, collapse uses expanded modifier and keeps collapse-inner for clipping', () => {
        renderWithContext(
            <AdminPanelTogglable {...defaultProps}>
                {'Test'}
            </AdminPanelTogglable>,
        );

        const panel = document.getElementById('test-id');
        expect(panel?.tagName).toBe('SECTION');
        expect(panel).toHaveClass('AdminPanel');

        // Compass adds --expanded at expand start; collapse-inner must stay
        // overflow:hidden (Compass default) so mid-open content does not spill.
        const expanded = panel?.querySelector('[class*="admin-panel__collapse--expanded"]');
        expect(expanded).not.toBeNull();
        const collapseInner = expanded?.querySelector('[class*="admin-panel__collapse-inner"]') as HTMLElement;
        expect(collapseInner).not.toBeNull();

        // Webapp SCSS must not force overflow:visible here (that spilled mid-animation).
        // Compass CSS-module overflow:hidden may not resolve in jsdom; reject visible.
        expect(collapseInner.style.overflow).not.toBe('visible');
        expect(window.getComputedStyle(collapseInner).overflow).not.toBe('visible');
    });

    test('when collapsed, expanded modifier is absent so collapse clipping remains', () => {
        renderWithContext(
            <AdminPanelTogglable
                {...defaultProps}
                open={false}
            >
                {'Test'}
            </AdminPanelTogglable>,
        );

        const panel = document.getElementById('test-id');
        expect(panel?.querySelector('[class*="admin-panel__collapse--expanded"]')).toBeNull();
        const collapseInner = panel?.querySelector('[class*="admin-panel__collapse-inner"]') as HTMLElement;
        expect(collapseInner).not.toBeNull();
        expect(collapseInner.style.overflow).not.toBe('visible');
        expect(window.getComputedStyle(collapseInner).overflow).not.toBe('visible');
    });
});
