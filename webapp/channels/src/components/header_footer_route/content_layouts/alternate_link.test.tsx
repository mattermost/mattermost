// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {render, screen} from '@testing-library/react';
import React from 'react';
import {BrowserRouter} from 'react-router-dom';

import AlternateLink from './alternate_link';

describe('components/header_footer_route/content_layouts/alternate_link', () => {
    it('should return default', () => {
        const {container} = render(
            <AlternateLink/>,
        );

        expect(container.firstChild).toBeNull();
    });

    it('should show with message', () => {
        const alternateMessage = 'alternateMessage';

        render(
            <AlternateLink alternateMessage={alternateMessage}/>,
        );

        expect(screen.getByText(alternateMessage)).toBeInTheDocument();
        expect(screen.getByText(alternateMessage)).toHaveClass('alternate-link__message');
    });

    it('should show with link', () => {
        const alternateLinkPath = 'alternateLinkPath';
        const alternateLinkLabel = 'alternateLinkLabel';

        render(
            <BrowserRouter>
                <AlternateLink
                    alternateLinkPath={alternateLinkPath}
                    alternateLinkLabel={alternateLinkLabel}
                />
            </BrowserRouter>,
        );

        const link = screen.getByText(alternateLinkLabel);
        expect(link).toBeInTheDocument();
        expect(link).toHaveClass('alternate-link__link');
        expect(link.closest('a')).toHaveAttribute('href', 'alternateLinkPath');
    });
});
