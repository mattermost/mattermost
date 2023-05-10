// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {render, screen} from '@testing-library/react';

import {FooterPagination} from './';
import {wrapIntl} from '../../testUtils'

describe('components/GenericModal/FooterPagination', () => {
    const baseProps = {
        page: 0,
        total: 0,
        itemsPerPage: 0,
        onNextPage: jest.fn(),
        onPreviousPage: jest.fn(),
    };

    test('should render default', () => {
        const wrapper = render(wrapIntl(<FooterPagination {...baseProps}/>));

        expect(wrapper).toMatchSnapshot();
    });

    test('should render pagination legend', () => {
        const props = {
            ...baseProps,
            page: 0,
            total: 17,
            itemsPerPage: 10,
        }

        render(wrapIntl(<FooterPagination {...props}/>));

        screen.getByText('Showing 1-10 of 17');
    });
});
