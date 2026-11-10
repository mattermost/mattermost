// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {MemoryRouter} from 'react-router-dom';

import AdminSidebarCategory from 'components/admin_console/admin_sidebar/admin_sidebar_category';
import AdminSidebarSection from 'components/admin_console/admin_sidebar/admin_sidebar_section';

import {renderWithContext, screen} from 'tests/react_testing_utils';

describe('components/AdminSidebarCategory', () => {
    test('renders subsection links even when the router path does not match /admin_console', () => {
        renderWithContext(
            <MemoryRouter initialEntries={['/some/unrelated/path']}>
                <AdminSidebarCategory
                    definitionKey='environment'
                    parentLink='/admin_console'
                    icon={<span data-testid='category-icon'/>}
                    title='Environment'
                >
                    <AdminSidebarSection
                        definitionKey='environment.notifications'
                        name='environment/notifications'
                        title='Notifications'
                    />
                </AdminSidebarCategory>
            </MemoryRouter>,
        );

        const notifications = screen.getByRole('link', {name: 'Notifications'});
        expect(notifications).toBeInTheDocument();
        expect(notifications).toHaveAttribute('href', '/admin_console/environment/notifications');
    });

    test('maps non-element children to null and still renders valid sections', () => {
        renderWithContext(
            <MemoryRouter initialEntries={['/']}>
                <AdminSidebarCategory
                    definitionKey='site'
                    parentLink='/admin_console'
                    icon={<span data-testid='category-icon'/>}
                    title='Site Configuration'
                >
                    {null}
                    <AdminSidebarSection
                        definitionKey='site.users_and_teams'
                        name='site_config/users_and_teams'
                        title='Users and Teams'
                    />
                </AdminSidebarCategory>
            </MemoryRouter>,
        );

        expect(screen.getByRole('link', {name: 'Users and Teams'})).toBeInTheDocument();
    });
});
