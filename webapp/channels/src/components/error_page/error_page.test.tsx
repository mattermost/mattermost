// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {GlobalState} from '@mattermost/types/store';

import {renderWithContext, screen} from 'tests/react_testing_utils';
import {ErrorPageTypes} from 'utils/constants';
import {TestHelper} from 'utils/test_helper';

import ErrorPage from './error_page';

describe('ErrorPage', () => {
    it('displays cloud archived page correctly', () => {
        renderWithContext(
            (
                <ErrorPage
                    location={{
                        search: `?type=${ErrorPageTypes.CLOUD_ARCHIVED}`,
                    }}
                />
            ),
            {
                entities: {
                    cloud: {
                        subscription: TestHelper.getSubscriptionMock({
                            product_id: 'prod_a',

                        }),
                        products: {
                            prod_a: TestHelper.getProductMock({
                                id: 'prod_a',
                                name: 'cloud plan',
                            }),
                        },
                    },
                },
            } as unknown as GlobalState,
        );

        screen.getByText('Message Archived');
        screen.getByText('archived because of cloud plan limits', {exact: false});
    });
});
