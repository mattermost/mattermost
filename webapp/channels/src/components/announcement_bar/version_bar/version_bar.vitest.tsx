// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import VersionBar from 'components/announcement_bar/version_bar/version_bar';

import {renderWithContext, screen} from 'tests/vitest_react_testing_utils';

describe('components/VersionBar', () => {
    test('should match snapshot - bar rendered after build hash change', () => {
        const {rerender, container} = renderWithContext(
            <VersionBar buildHash='844f70a08ead47f06232ecb6fcad63d2'/>,
        );
        expect(container).toMatchSnapshot();

        // The announcement bar should not be rendered initially
        expect(screen.queryByText(/A new version of Mattermost is available/)).not.toBeInTheDocument();

        // Change the build hash to trigger showing the announcement bar
        rerender(<VersionBar buildHash='83ea110da12da84442f92b4634a1e0e2'/>);

        expect(container).toMatchSnapshot();

        // The announcement bar should now be rendered
        expect(screen.getByText(/A new version of Mattermost is available/)).toBeInTheDocument();
    });
});
