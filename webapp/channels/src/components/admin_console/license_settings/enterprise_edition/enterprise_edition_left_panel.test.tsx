// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import moment from 'moment-timezone';
import React from 'react';
import {Provider} from 'react-redux';

import type {GlobalState} from '@mattermost/types/store';
import type {DeepPartial} from '@mattermost/types/utilities';

import {General} from 'mattermost-redux/constants';

import mergeObjects from 'packages/mattermost-redux/test/merge_objects';
import {mountWithIntl} from 'tests/helpers/intl-test-helper';
import {renderWithContext, screen} from 'tests/react_testing_utils';
import mockStore from 'tests/test_store';
import {OverActiveUserLimits, SelfHostedProducts} from 'utils/constants';
import {TestHelper} from 'utils/test_helper';

import EnterpriseEditionLeftPanel from './enterprise_edition_left_panel';
import type {EnterpriseEditionProps} from './enterprise_edition_left_panel';

jest.mock('react-router-dom', () => ({
    ...jest.requireActual('react-router-dom') as typeof import('react-router-dom'),
    useLocation: () => {
        return {
            pathname: '',
        };
    },
}));

describe('components/admin_console/license_settings/enterprise_edition/enterprise_edition_left_panel', () => {
    const license = {
        IsLicensed: 'true',
        IssuedAt: '1517714643650',
        StartsAt: '1517714643650',
        ExpiresAt: '1620335443650',
        SkuShortName: 'Enterprise',
        Name: 'LicenseName',
        Company: 'Mattermost Inc.',
        Users: '1000',
    };

    const initialState: DeepPartial<GlobalState> = {
        entities: {
            users: {
                currentUserId: 'current_user',
                profiles: {
                    current_user: {
                        roles: General.SYSTEM_ADMIN_ROLE,
                        id: 'currentUser',
                    },
                },
                filteredStats: {
                    total_users_count: 0,
                },
            },
            general: {
                license,
                config: {
                    BuildEnterpriseReady: 'true',
                },
            },
            preferences: {
                myPreferences: {},
            },
            admin: {
                config: {
                    ServiceSettings: {
                        SelfHostedPurchase: true,
                    },
                },
            },
            cloud: {
                subscription: undefined,
            },
            hostedCustomer: {
                products: {
                    products: {
                        prod_professional: TestHelper.getProductMock({
                            id: 'prod_professional',
                            name: 'Professional',
                            sku: SelfHostedProducts.PROFESSIONAL,
                            price_per_seat: 7.5,
                        }),
                    },
                    productsLoaded: true,
                },
            },
        },
    };

    const baseProps: EnterpriseEditionProps = {
        license,
        openEELicenseModal: jest.fn(),
        upgradedFromTE: false,
        isTrialLicense: false,
        handleRemove: jest.fn(),
        isDisabled: false,
        removing: false,
        handleChange: jest.fn(),
        fileInputRef: React.createRef(),
        statsActiveUsers: 1,
    };

    test('should format the Users field', () => {
        const store = mockStore(initialState);
        const wrapper = mountWithIntl(
            <Provider store={store}>
                <EnterpriseEditionLeftPanel
                    {...baseProps}
                />
            </Provider>,
        );

        const item = wrapper.find('.item-element').filterWhere((n) => {
            return n.children().length === 2 &&
                n.childAt(0).type() === 'span' &&
                !n.childAt(0).text().includes('ACTIVE') &&
                n.childAt(0).text().includes('LICENSED SEATS');
        });

        expect(item.text()).toContain('1,000');
    });

    test('should not add any class if active users is lower than the minimal', () => {
        renderWithContext(
            <EnterpriseEditionLeftPanel
                {...baseProps}
            />,
            initialState,
        );

        expect(screen.getByText(Intl.NumberFormat('en').format(baseProps.statsActiveUsers))).toHaveClass('value');
        expect(screen.getByText(Intl.NumberFormat('en').format(baseProps.statsActiveUsers))).not.toHaveClass('value--warning-over-seats-purchased');
        expect(screen.getByText(Intl.NumberFormat('en').format(baseProps.statsActiveUsers))).not.toHaveClass('value--over-seats-purchased');
        expect(screen.getByText('ACTIVE USERS:')).toHaveClass('legend');
        expect(screen.getByText('ACTIVE USERS:')).not.toHaveClass('legend--warning-over-seats-purchased');
        expect(screen.getByText('ACTIVE USERS:')).not.toHaveClass('legend--over-seats-purchased');
    });

    test('should add warning class to active users', () => {
        const minWarning = Math.ceil(parseInt(license.Users, 10) * OverActiveUserLimits.MIN) + parseInt(license.Users, 10);
        const props = {
            ...baseProps,
            statsActiveUsers: minWarning,
        };

        renderWithContext(
            <EnterpriseEditionLeftPanel
                {...props}
            />,
            initialState,
        );

        expect(screen.getByText(Intl.NumberFormat('en').format(minWarning))).toHaveClass('value');
        expect(screen.getByText(Intl.NumberFormat('en').format(minWarning))).toHaveClass('value--warning-over-seats-purchased');
        expect(screen.getByText(Intl.NumberFormat('en').format(minWarning))).not.toHaveClass('value--over-seats-purchased');
        expect(screen.getByText('ACTIVE USERS:')).toHaveClass('legend');
        expect(screen.getByText('ACTIVE USERS:')).toHaveClass('legend--warning-over-seats-purchased');
        expect(screen.getByText('ACTIVE USERS:')).not.toHaveClass('legend--over-seats-purchased');
    });

    test('should add over-seats-purchased class to active users', () => {
        const exceedHighLimitExtraUsersError = Math.ceil(parseInt(license.Users, 10) * OverActiveUserLimits.MAX) + parseInt(license.Users, 10);
        const props = {
            ...baseProps,
            statsActiveUsers: exceedHighLimitExtraUsersError,
        };

        renderWithContext(
            <EnterpriseEditionLeftPanel
                {...props}
            />,
            initialState,
        );

        expect(screen.getByText(Intl.NumberFormat('en').format(exceedHighLimitExtraUsersError))).toHaveClass('value');
        expect(screen.getByText(Intl.NumberFormat('en').format(exceedHighLimitExtraUsersError))).toHaveClass('value--over-seats-purchased');
        expect(screen.getByText(Intl.NumberFormat('en').format(exceedHighLimitExtraUsersError))).not.toHaveClass('value--warning-over-seats-purchased');
        expect(screen.getByText('ACTIVE USERS:')).toHaveClass('legend');
        expect(screen.getByText('ACTIVE USERS:')).not.toHaveClass('legend--warning-over-seats-purchased');
        expect(screen.getByText('ACTIVE USERS:')).toHaveClass('legend--over-seats-purchased');
    });

    test('should add warning class to days expired indicator when there are more than 5 days until expiry', () => {
        const testLicense = {
            ...license,
            ExpiresAt: moment().add(6, 'days').valueOf().toString(),
        };

        const testState = mergeObjects(initialState, {
            entities: {
                general: {
                    license: testLicense,
                },
            },
        });
        const props = {
            ...baseProps,
            license: testLicense,
        };

        renderWithContext(
            <EnterpriseEditionLeftPanel
                {...props}
            />,
            testState,
        );

        expect(screen.getByText('Expires in 6 days')).toHaveClass('expiration-days-warning');
    });

    test('should add danger class to days expired indicator when there are at least 5 days until expiry', () => {
        const testLicense = {
            ...license,
            ExpiresAt: moment().add(5, 'days').valueOf().toString(),
        };

        const testState = mergeObjects(initialState, {
            entities: {
                general: {
                    license: testLicense,
                },
            },
        });
        const props = {
            ...baseProps,
            license: testLicense,
        };

        renderWithContext(
            <EnterpriseEditionLeftPanel
                {...props}
            />,
            testState,
        );

        expect(screen.getByText('Expires in 5 days')).toHaveClass('expiration-days-danger');
    });
});
