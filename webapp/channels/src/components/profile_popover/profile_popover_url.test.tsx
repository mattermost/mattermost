// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {screen} from '@testing-library/react';
import React from 'react';

import type {UserPropertyField} from '@mattermost/types/properties';

import {renderWithContext} from 'tests/react_testing_utils';

import ProfilePopoverUrl from './profile_popover_url';

import {TestHelper} from '../../utils/test_helper';

describe('components/ProfilePopoverUrl', () => {
    const attribute: UserPropertyField = {
        id: 'url_attribute_id',
        name: 'Website',
        type: 'text',
        group_id: 'custom_profile_attributes',
        create_at: 0,
        update_at: 0,
        delete_at: 0,
        attrs: {
            value_type: 'url',
            visibility: 'when_set',
            sort_order: 0,
        },
    };

    const baseProps = {
        attribute,
        userProfile: TestHelper.getUserMock({
            id: 'user_id',
            custom_profile_attributes: {
                url_attribute_id: 'https://example.com',
            },
        }),
    };

    test('should not render when url is missing', () => {
        const props = {
            ...baseProps,
            userProfile: TestHelper.getUserMock({
                id: 'user_id',
                custom_profile_attributes: {},
            }),
        };
        renderWithContext(<ProfilePopoverUrl {...props}/>);
        expect(screen.queryByRole('link')).not.toBeInTheDocument();
    });

    test('should not render when url is empty', () => {
        const props = {
            ...baseProps,
            userProfile: TestHelper.getUserMock({
                id: 'user_id',
                custom_profile_attributes: {
                    url_attribute_id: '',
                },
            }),
        };
        renderWithContext(<ProfilePopoverUrl {...props}/>);
        expect(screen.queryByRole('link')).not.toBeInTheDocument();
    });

    test('should render url with icon', () => {
        renderWithContext(<ProfilePopoverUrl {...baseProps}/>);

        const url = 'https://example.com';
        const link = screen.getByRole('link');
        expect(link).toHaveAttribute('href', url);
        expect(link).toHaveTextContent(url);
        expect(screen.getByTestId('url-icon')).toBeInTheDocument();
    });

    test('should render long url correctly', () => {
        const props = {
            ...baseProps,
            userProfile: TestHelper.getUserMock({
                id: 'user_id',
                custom_profile_attributes: {
                    url_attribute_id: 'https://really-long-subdomain.example.com/path/to/resource?param=value',
                },
            }),
        };
        renderWithContext(<ProfilePopoverUrl {...props}/>);

        const url = 'https://really-long-subdomain.example.com/path/to/resource?param=value';
        const container = screen.getByTitle(url);
        expect(container).toBeInTheDocument();
        expect(screen.getByRole('link')).toHaveTextContent(url);
    });

    test('should render url with ExternalLink component', () => {
        renderWithContext(<ProfilePopoverUrl {...baseProps}/>);

        const url = 'https://example.com';
        const link = screen.getByRole('link');
        expect(link).toHaveAttribute('href', url);
        expect(link).toHaveAttribute('target', '_blank');
        expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    });
});
