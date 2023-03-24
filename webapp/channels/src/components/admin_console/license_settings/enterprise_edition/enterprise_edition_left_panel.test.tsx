// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {screen} from '@testing-library/react';

import {Provider} from 'react-redux';

import {mountWithIntl} from 'tests/helpers/intl-test-helper';
import {renderWithIntl} from 'tests/react_testing_utils';
import {OverActiveUserLimits} from 'utils/constants';

import {General} from 'mattermost-redux/constants';
import {DeepPartial} from '@mattermost/types/utilities';
import {GlobalState} from '@mattermost/types/store';
import mockStore from 'tests/test_store';

import EnterpriseEditionLeftPanel, {EnterpriseEditionProps} from './enterprise_edition_left_panel';

describe('components/admin_console/license_settings/enterprise_edition/enterprise_edition_left_panel', () => {
    const license = {
        IsLicensed: 'true',
        IssuedAt: '1517714643650',
        StartsAt: '1517714643650',
        ExpiresAt: '1620335443650',
        SkuShortName: 'Enterprise',
        Name: 'LicenseName',
        Company: 'Mattermost Inc.',
        Users: '1000000',
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
            },
            preferences: {
                myPreferences: {},
            },
        },
    };

    const props = {
        license,
        openEELicenseModal: jest.fn(),
        upgradedFromTE: false,
        isTrialLicense: false,
        issued: <></>,
        startsAt: <></>,
        expiresAt: <></>,
        handleRemove: jest.fn(),
        isDisabled: false,
        removing: false,
        handleChange: jest.fn(),
        fileInputRef: React.createRef(),
        statsActiveUsers: 1,
    } as EnterpriseEditionProps;

    test('should format the Users field', async () => {
        const store = await mockStore(initialState);
        const wrapper = mountWithIntl(
            <Provider store={store}>
                <EnterpriseEditionLeftPanel
                    {...props}
                />
            </Provider>,
        );

        const item = wrapper.find('.item-element').filterWhere((n) => {
            return n.children().length === 2 &&
                   n.childAt(0).type() === 'span' &&
                   !n.childAt(0).text().includes('ACTIVE') &&
                   n.childAt(0).text().includes('USERS');
        });

        expect(item.text()).toContain('1,000,000');
    });

    test('should not add any class if active users is lower than the minimal', async () => {
        const store = await mockStore(initialState);
        renderWithIntl(
            <Provider store={store}>
                <EnterpriseEditionLeftPanel
                    {...props}
                />
            </Provider>,
        );

        expect(screen.getByText(Intl.NumberFormat('en').format(props.statsActiveUsers))).toHaveClass('value');
        expect(screen.getByText(Intl.NumberFormat('en').format(props.statsActiveUsers))).not.toHaveClass('value--warning-over-seats-purchased');
        expect(screen.getByText(Intl.NumberFormat('en').format(props.statsActiveUsers))).not.toHaveClass('value--over-seats-purchased');
        expect(screen.getByText('ACTIVE USERS:')).toHaveClass('legend');
        expect(screen.getByText('ACTIVE USERS:')).not.toHaveClass('legend--warning-over-seats-purchased');
        expect(screen.getByText('ACTIVE USERS:')).not.toHaveClass('legend--over-seats-purchased');
    });

    test('should add warning class to active users', async () => {
        const minWarning = Math.ceil(parseInt(license.Users, 10) * OverActiveUserLimits.MIN) + parseInt(license.Users, 10);
        const store = await mockStore(initialState);
        props.statsActiveUsers = minWarning;

        renderWithIntl(
            <Provider store={store}>
                <EnterpriseEditionLeftPanel
                    {...props}
                />
            </Provider>,
        );

        expect(screen.getByText(Intl.NumberFormat('en').format(minWarning))).toHaveClass('value');
        expect(screen.getByText(Intl.NumberFormat('en').format(minWarning))).toHaveClass('value--warning-over-seats-purchased');
        expect(screen.getByText(Intl.NumberFormat('en').format(minWarning))).not.toHaveClass('value--over-seats-purchased');
        expect(screen.getByText('ACTIVE USERS:')).toHaveClass('legend');
        expect(screen.getByText('ACTIVE USERS:')).toHaveClass('legend--warning-over-seats-purchased');
        expect(screen.getByText('ACTIVE USERS:')).not.toHaveClass('legend--over-seats-purchased');
    });

    test('should add over-seats-purchased class to active users', async () => {
        const exceedHighLimitExtraUsersError = Math.ceil(parseInt(license.Users, 10) * OverActiveUserLimits.MAX) + parseInt(license.Users, 10);
        props.statsActiveUsers = exceedHighLimitExtraUsersError;
        const store = await mockStore(initialState);
        renderWithIntl(
            <Provider store={store}>
                <EnterpriseEditionLeftPanel
                    {...props}
                />
            </Provider>,
        );

        expect(screen.getByText(Intl.NumberFormat('en').format(exceedHighLimitExtraUsersError))).toHaveClass('value');
        expect(screen.getByText(Intl.NumberFormat('en').format(exceedHighLimitExtraUsersError))).toHaveClass('value--over-seats-purchased');
        expect(screen.getByText(Intl.NumberFormat('en').format(exceedHighLimitExtraUsersError))).not.toHaveClass('value--warning-over-seats-purchased');
        expect(screen.getByText('ACTIVE USERS:')).toHaveClass('legend');
        expect(screen.getByText('ACTIVE USERS:')).not.toHaveClass('legend--warning-over-seats-purchased');
        expect(screen.getByText('ACTIVE USERS:')).toHaveClass('legend--over-seats-purchased');
    });
});
