// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {MemoryRouter} from 'react-router-dom';

import {render, screen} from 'tests/vitest_react_testing_utils';

import AlternateLink from './alternate_link';

describe('components/header_footer_route/content_layouts/alternate_link', () => {
    test('should return default', () => {
        const {container} = render(
            <AlternateLink/>,
        );

        expect(container.firstChild).toBeNull();
    });

    test('should show with message', () => {
        const alternateMessage = 'alternateMessage';

        render(
            <AlternateLink alternateMessage={alternateMessage}/>,
        );

        expect(screen.getByText(alternateMessage)).toBeInTheDocument();
    });

    test('should show with link', () => {
        const alternateLinkPath = '/alternateLinkPath';
        const alternateLinkLabel = 'alternateLinkLabel';

        render(
            <MemoryRouter>
                <AlternateLink
                    alternateLinkPath={alternateLinkPath}
                    alternateLinkLabel={alternateLinkLabel}
                />
            </MemoryRouter>,
        );

        const link = screen.getByRole('link', {name: alternateLinkLabel});
        expect(link).toBeInTheDocument();
        expect(link).toHaveAttribute('href', alternateLinkPath);
    });
});
