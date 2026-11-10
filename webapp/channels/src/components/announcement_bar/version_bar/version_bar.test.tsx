// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import VersionBar from 'components/announcement_bar/version_bar/version_bar';

import {renderWithContext, screen} from 'tests/react_testing_utils';

describe('components/VersionBar', () => {
    test('should match snapshot - bar rendered after build hash change', () => {
        const {container, rerender} = renderWithContext(
            <VersionBar buildHash='844f70a08ead47f06232ecb6fcad63d2'/>,
        );
        expect(container).toMatchSnapshot();
        expect(screen.queryByText('A new version of Mattermost is available.', {exact: false})).not.toBeInTheDocument();

        rerender(
            <VersionBar buildHash='83ea110da12da84442f92b4634a1e0e2'/>,
        );
        expect(container).toMatchSnapshot();
        expect(screen.getByText('A new version of Mattermost is available.', {exact: false})).toBeInTheDocument();
    });
});
