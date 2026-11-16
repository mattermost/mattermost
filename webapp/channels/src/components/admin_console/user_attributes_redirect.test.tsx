// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {createMemoryHistory} from 'history';
import React from 'react';
import {Route} from 'react-router-dom';

import {renderWithContext} from 'tests/react_testing_utils';

import UserAttributesRedirect from './user_attributes_redirect';

describe('UserAttributesRedirect', () => {
    test('redirects to the sibling manage_attributes URL', () => {
        const history = createMemoryHistory({
            initialEntries: ['/admin_console/system_attributes/user_attributes'],
        });

        renderWithContext(
            <Route
                path='/admin_console/system_attributes/user_attributes'
                component={UserAttributesRedirect}
            />,
            {},
            {history},
        );

        expect(history.location.pathname).toBe('/admin_console/system_attributes/manage_attributes');
    });

    test('redirects even with a trailing slash on the legacy URL', () => {
        const history = createMemoryHistory({
            initialEntries: ['/admin_console/system_attributes/user_attributes/'],
        });

        renderWithContext(
            <Route
                path='/admin_console/system_attributes/user_attributes'
                component={UserAttributesRedirect}
            />,
            {},
            {history},
        );

        expect(history.location.pathname).toBe('/admin_console/system_attributes/manage_attributes');
    });
});
