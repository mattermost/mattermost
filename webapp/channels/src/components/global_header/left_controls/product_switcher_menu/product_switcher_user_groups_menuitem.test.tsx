// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {Product, Subscription} from '@mattermost/types/cloud';
import type {DeepPartial} from '@mattermost/types/utilities';

import {renderWithContext, screen} from 'tests/react_testing_utils';
import {CloudProducts} from 'utils/constants';
import {TestHelper} from 'utils/test_helper';

import type {GlobalState} from 'types/store';

import ProductSwitcherUserGroupsMenuItem from './product_switcher_user_groups_menuitem';

jest.mock('react-redux', () => ({
    ...jest.requireActual('react-redux'),
    useDispatch: jest.fn().mockReturnValue(jest.fn()),
}));

describe('ProductSwitcherUserGroupsMenuItem', () => {
    const initialState: DeepPartial<GlobalState> = {
        entities: {
            users: {
                currentUserId: 'user_id',
                profiles: {
                    user_id: TestHelper.getUserMock({id: 'user_id'}),
                },
            },
            general: {
                license: {
                    IsLicensed: 'false',
                    IsTrial: 'false',
                },
                config: {
                    EnableCustomGroups: 'false',
                },
            },
            cloud: {
                subscription: {
                    product_id: 'prod_id',
                } as Subscription,
                products: {},
            },
            preferences: {
                myPreferences: {},
            },
        },
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('should not show when custom user groups are not enabled', () => {
        const state: DeepPartial<GlobalState> = {
            entities: {
                ...initialState.entities,
                general: {
                    license: {
                        IsLicensed: 'true',
                        IsTrial: 'false',
                    },
                    config: {
                        EnableCustomGroups: 'false',
                    },
                },
            },
        };

        renderWithContext(
            <ProductSwitcherUserGroupsMenuItem
                isUserAdmin={true}
                isCloudLicensed={false}
                isEnterpriseReady={true}
                isFreeTrialSubscription={false}
            />,
            state,
        );

        expect(screen.queryByText('User Groups')).not.toBeInTheDocument();
    });

    test('should show for starter', () => {
        const state: DeepPartial<GlobalState> = {
            entities: {
                ...initialState.entities,
                cloud: {
                    subscription: {
                        product_id: 'prod_id',
                    } as Subscription,
                    products: {
                        prod_id: {
                            id: 'prod_id',
                            sku: CloudProducts.STARTER,
                        } as Product,
                    },
                },
            },
        };

        renderWithContext(
            <ProductSwitcherUserGroupsMenuItem
                isUserAdmin={true}
                isCloudLicensed={true}
                isEnterpriseReady={true}
                isFreeTrialSubscription={false}
            />,
            state,
        );

        expect(screen.getByText('User Groups')).toBeInTheDocument();
    });

    test('should show for self-hosted starter (unlicensed)', () => {
        renderWithContext(
            <ProductSwitcherUserGroupsMenuItem
                isUserAdmin={true}
                isCloudLicensed={false}
                isEnterpriseReady={true}
                isFreeTrialSubscription={false}
            />,
            initialState,
        );

        expect(screen.getByText('User Groups')).toBeInTheDocument();
    });

    test('should disable menu item for self-hosted starter', () => {
        const {container} = renderWithContext(
            <ProductSwitcherUserGroupsMenuItem
                isUserAdmin={true}
                isCloudLicensed={false}
                isEnterpriseReady={true}
                isFreeTrialSubscription={false}
            />,
            initialState,
        );

        const menuItem = container.querySelector('[aria-disabled="true"]');
        expect(menuItem).toBeInTheDocument();
    });

    test('should show for self-hosted trial', () => {
        const state: DeepPartial<GlobalState> = {
            entities: {
                ...initialState.entities,
                general: {
                    license: {
                        IsLicensed: 'true',
                        IsTrial: 'true',
                    },
                    config: {
                        EnableCustomGroups: 'false',
                    },
                },
            },
        };

        renderWithContext(
            <ProductSwitcherUserGroupsMenuItem
                isUserAdmin={true}
                isCloudLicensed={false}
                isEnterpriseReady={true}
                isFreeTrialSubscription={false}
            />,
            state,
        );

        expect(screen.getByText('User Groups')).toBeInTheDocument();
    });
});
