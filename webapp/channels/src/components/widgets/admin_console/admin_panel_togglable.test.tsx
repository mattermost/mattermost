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

    test('when expanded, collapse-inner is under the expanded modifier for menu overflow', () => {
        renderWithContext(
            <AdminPanelTogglable {...defaultProps}>
                {'Test'}
            </AdminPanelTogglable>,
        );

        const panel = document.getElementById('test-id');
        expect(panel?.tagName).toBe('SECTION');
        expect(panel).toHaveClass('AdminPanel');

        // admin_panel.scss lifts overflow on this structure when expanded so menus
        // are not clipped; collapsed panels keep Compass collapse-inner clipping.
        const expanded = panel?.querySelector('[class*="admin-panel__collapse--expanded"]');
        expect(expanded).not.toBeNull();
        expect(expanded?.querySelector('[class*="admin-panel__collapse-inner"]')).not.toBeNull();
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
        expect(panel?.querySelector('[class*="admin-panel__collapse-inner"]')).not.toBeNull();
    });
});
