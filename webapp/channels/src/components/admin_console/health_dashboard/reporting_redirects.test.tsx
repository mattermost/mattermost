// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {createMemoryHistory} from 'history';
import React from 'react';
import {Route} from 'react-router-dom';

import {renderWithContext} from 'tests/react_testing_utils';

import {RedirectToSiteHealth, RedirectToWorkspaceOptimization} from './reporting_redirects';

describe('Reporting redirects', () => {
    test('Workspace Optimization redirects to Site health', () => {
        const history = createMemoryHistory({initialEntries: ['/admin_console/reporting/workspace_optimization']});

        renderWithContext(
            <Route
                path='/admin_console/reporting/workspace_optimization'
                component={RedirectToSiteHealth}
            />,
            {},
            {history},
        );

        expect(history.location.pathname).toBe('/admin_console/reporting/site_health');
    });

    test('Site health redirects to Workspace Optimization', () => {
        const history = createMemoryHistory({initialEntries: ['/admin_console/reporting/site_health']});

        renderWithContext(
            <Route
                path='/admin_console/reporting/site_health'
                component={RedirectToWorkspaceOptimization}
            />,
            {},
            {history},
        );

        expect(history.location.pathname).toBe('/admin_console/reporting/workspace_optimization');
    });
});
