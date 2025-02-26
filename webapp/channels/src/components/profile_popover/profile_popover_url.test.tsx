// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {screen} from '@testing-library/react';
import React from 'react';

import {renderWithContext} from 'tests/react_testing_utils';

import ProfilePopoverUrl from './profile_popover_url';

describe('components/ProfilePopoverUrl', () => {
    test('should not render when url is undefined', () => {
        renderWithContext(<ProfilePopoverUrl/>);
        expect(screen.queryByRole('link')).not.toBeInTheDocument();
    });

    test('should not render when url is empty', () => {
        renderWithContext(<ProfilePopoverUrl url=''/>);
        expect(screen.queryByRole('link')).not.toBeInTheDocument();
    });

    test('should render url with icon', () => {
        const url = 'https://example.com';
        renderWithContext(<ProfilePopoverUrl url={url}/>);

        const link = screen.getByRole('link');
        expect(link).toHaveAttribute('href', url);
        expect(link).toHaveTextContent(url);
        expect(screen.getByTestId('url-icon')).toBeInTheDocument();
    });

    test('should render long url correctly', () => {
        const url = 'https://really-long-subdomain.example.com/path/to/resource?param=value';
        renderWithContext(<ProfilePopoverUrl url={url}/>);

        const container = screen.getByTitle(url);
        expect(container).toBeInTheDocument();
        expect(screen.getByRole('link')).toHaveTextContent(url);
    });
});
