// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {DeepPartial} from '@mattermost/types/utilities';

import {savePreferences} from 'mattermost-redux/actions/preferences';
import {General} from 'mattermost-redux/constants';

import {trackEvent} from 'actions/telemetry_actions';

import {fireEvent, renderWithContext, screen} from 'tests/react_testing_utils';
import {OverActiveUserLimits, Preferences, SelfHostedProducts, StatTypes} from 'utils/constants';
import {TestHelper} from 'utils/test_helper';
import {generateId} from 'utils/utils';

import type {GlobalState} from 'types/store';

import OverageUsersBanner from './index';

jest.mock('react-redux', () => ({
    ...jest.requireActual('react-redux'),
    useDispatch: jest.fn().mockReturnValue(() => {}),
}));

jest.mock('mattermost-redux/actions/preferences', () => ({
    savePreferences: jest.fn(),
}));

jest.mock('mattermost-redux/actions/cloud', () => ({
    getLicenseSelfServeStatus: jest.fn(),
}));

jest.mock('actions/telemetry_actions', () => ({
    trackEvent: jest.fn(),
}));

const seatsPurchased = 40;
const email = 'test@mattermost.com';

const seatsMinimumFor5PercentageState = (Math.ceil(seatsPurchased * OverActiveUserLimits.MIN)) + seatsPurchased;

const seatsMinimumFor10PercentageState = (Math.ceil(seatsPurchased * OverActiveUserLimits.MAX)) + seatsPurchased;

const text5PercentageState = `(Only visible to admins) Your workspace user count has exceeded your paid license seat count by ${seatsMinimumFor5PercentageState - seatsPurchased} seats. Purchase additional seats to remain compliant.`;
const text10PercentageState = `(Only visible to admins) Your workspace user count has exceeded your paid license seat count by ${seatsMinimumFor10PercentageState - seatsPurchased} seats. Purchase additional seats to remain compliant.`;

const contactSalesTextLink = 'Contact Sales';

const licenseId = generateId();

describe('components/overage_users_banner', () => {
    const initialState: DeepPartial<GlobalState> = {
        views: {
            announcementBar: {
                announcementBarState: {
                    announcementBarCount: 1,
                },
            },
        },
        entities: {
            users: {
                currentUserId: 'current_user',
                profiles: {
                    current_user: {
                        roles: General.SYSTEM_ADMIN_ROLE,
                        id: 'currentUser',
                        email,
                    },
                },
            },
            admin: {
                analytics: {
                    [StatTypes.TOTAL_USERS]: 1,
                },
            },
            general: {
                config: {
                    CWSURL: 'http://testing',
                },
                license: {
                    IsLicensed: 'true',
                    IssuedAt: '1517714643650',
                    StartsAt: '1517714643650',
                    ExpiresAt: '1620335443650',
                    SkuShortName: 'Enterprise',
                    Name: 'LicenseName',
                    Company: 'Mattermost Inc.',
                    Users: String(seatsPurchased),
                    Email: 'test@mattermost.com',
                    Id: licenseId,
                },
            },
            preferences: {
                myPreferences: {},
            },
            cloud: {
            },
            hostedCustomer: {
                products: {
                    productsLoaded: true,
                    products: {
                        prod_professional: TestHelper.getProductMock({
                            id: 'prod_professional',
                            name: 'Professional',
                            sku: SelfHostedProducts.PROFESSIONAL,
                            price_per_seat: 7.5,
                        }),
                    },
                },
            },
        },
    };

    let windowSpy: jest.SpyInstance;

    beforeAll(() => {
        windowSpy = jest.spyOn(window, 'open');
        windowSpy.mockImplementation(() => {});
    });

    afterAll(() => {
        windowSpy.mockRestore();
    });

    it('should not render the banner because we are not on overage state', () => {
        renderWithContext(<OverageUsersBanner/>);

        expect(screen.queryByText('(Only visible to admins) Your workspace user count has exceeded your paid license seat count by', {exact: false})).not.toBeInTheDocument();
    });

    it('should not render the banner because we are not admins', () => {
        const store = JSON.parse(JSON.stringify(initialState));

        store.entities.users = {
            ...store.entities.users,
            profiles: {
                ...store.entities.users.profiles,
                current_user: {
                    ...store.entities.users.profiles.current_user,
                    roles: General.SYSTEM_USER_ROLE,
                },
            },
        };

        renderWithContext(<OverageUsersBanner/>, store);

        expect(screen.queryByText('Your workspace user count has exceeded your paid license seat count by', {exact: false})).not.toBeInTheDocument();
    });

    it('should not render the banner because it\'s cloud licenese', () => {
        const store = JSON.parse(JSON.stringify(initialState));

        store.entities.general.license = {
            ...store.entities.general.license,
            Cloud: 'true',
        };

        renderWithContext(<OverageUsersBanner/>, store);

        expect(screen.queryByText('Your workspace user count has exceeded your paid license seat count by', {exact: false})).not.toBeInTheDocument();
    });

    it('should not render the 5% banner because we have dissmised it', () => {
        const store = JSON.parse(JSON.stringify(initialState));

        store.entities.preferences.myPreferences = TestHelper.getPreferencesMock(
            [
                {
                    category: Preferences.OVERAGE_USERS_BANNER,
                    value: 'Overage users banner watched',
                    name: `warn_overage_seats_${licenseId.substring(0, 8)}`,
                },
            ],
        );

        store.entities.admin = {
            ...store.entities.admin,
            analytics: {
                [StatTypes.TOTAL_USERS]: seatsMinimumFor5PercentageState,
            },
        };

        renderWithContext(<OverageUsersBanner/>, store);

        expect(screen.queryByText(text5PercentageState)).not.toBeInTheDocument();
    });

    it('should render the banner because we are over 5% and we don\'t have any preferences', () => {
        const store = JSON.parse(JSON.stringify(initialState));

        store.entities.cloud = {
            ...store.entities.cloud,
        };

        store.entities.admin = {
            ...store.entities.admin,
            analytics: {
                [StatTypes.TOTAL_USERS]: seatsMinimumFor5PercentageState,
            },
        };

        renderWithContext(<OverageUsersBanner/>, store);

        expect(screen.getByText(text5PercentageState)).toBeInTheDocument();
        expect(screen.getByText(contactSalesTextLink)).toBeInTheDocument();
    });

    it('should track if the admin click Contact Sales CTA in a 10% overage state', () => {
        const store = JSON.parse(JSON.stringify(initialState));

        store.entities.cloud = {
            ...store.entities.cloud,
        };

        store.entities.admin = {
            ...store.entities.admin,
            analytics: {
                [StatTypes.TOTAL_USERS]: seatsMinimumFor5PercentageState,
            },
        };

        renderWithContext(<OverageUsersBanner/>, store);

        fireEvent.click(screen.getByText(contactSalesTextLink));
        expect(windowSpy).toBeCalledTimes(1);

        // only the email is encoded and other params are empty. See logic for useOpenSalesLink hook
        const salesLinkWithEncodedParams = 'https://mattermost.com/contact-sales/?qk=&qp=&qw=&qx=dGVzdEBtYXR0ZXJtb3N0LmNvbQ==&utm_source=mattermost&utm_medium=in-product';
        expect(windowSpy).toBeCalledWith(salesLinkWithEncodedParams, '_blank');
        expect(trackEvent).toBeCalledTimes(1);
        expect(trackEvent).toBeCalledWith('insights', 'click_true_up_warning', {
            cta: 'Contact Sales',
            banner: 'global banner',
        });
    });

    it('should render the banner because we are over 5% and we have preferences from one old banner', () => {
        const store = JSON.parse(JSON.stringify(initialState));

        store.entities.cloud = {
            ...store.entities.cloud,
        };

        store.entities.preferences.myPreferences = TestHelper.getPreferencesMock(
            [
                {
                    category: Preferences.OVERAGE_USERS_BANNER,
                    value: 'Overage users banner watched',
                    name: `warn_overage_seats_${10}`,
                },
            ],
        );

        store.entities.admin = {
            ...store.entities.admin,
            analytics: {
                [StatTypes.TOTAL_USERS]: seatsMinimumFor5PercentageState,
            },
        };

        renderWithContext(<OverageUsersBanner/>, store);

        expect(screen.getByText(text5PercentageState)).toBeInTheDocument();
        expect(screen.getByText(contactSalesTextLink)).toBeInTheDocument();
    });

    it('should save the preferences for 5% banner if admin click on close', () => {
        const store = JSON.parse(JSON.stringify(initialState));

        store.entities.admin = {
            ...store.entities.admin,
            analytics: {
                [StatTypes.TOTAL_USERS]: seatsMinimumFor5PercentageState,
            },
        };

        renderWithContext(<OverageUsersBanner/>, store);

        fireEvent.click(screen.getByRole('link'));

        expect(savePreferences).toBeCalledTimes(1);
        expect(savePreferences).toBeCalledWith(store.entities.users.profiles.current_user.id, [{
            category: Preferences.OVERAGE_USERS_BANNER,
            name: `warn_overage_seats_${licenseId.substring(0, 8)}`,
            user_id: store.entities.users.profiles.current_user.id,
            value: 'Overage users banner watched',
        }]);
    });

    it('should render the banner because we are over 10%', () => {
        const store = JSON.parse(JSON.stringify(initialState));

        store.entities.cloud = {
            ...store.entities.cloud,
        };

        store.entities.admin = {
            ...store.entities.admin,
            analytics: {
                [StatTypes.TOTAL_USERS]: seatsMinimumFor10PercentageState,
            },
        };

        renderWithContext(<OverageUsersBanner/>, store);

        expect(screen.getByText(text10PercentageState)).toBeInTheDocument();
        expect(screen.getByText(contactSalesTextLink)).toBeInTheDocument();
    });

    it('should track if the admin click Contact Sales CTA in a 10% overage state', () => {
        const store = JSON.parse(JSON.stringify(initialState));

        store.entities.cloud = {
            ...store.entities.cloud,
        };

        store.entities.admin = {
            ...store.entities.admin,
            analytics: {
                [StatTypes.TOTAL_USERS]: seatsMinimumFor10PercentageState,
            },
        };

        renderWithContext(<OverageUsersBanner/>, store);

        fireEvent.click(screen.getByText(contactSalesTextLink));
        expect(windowSpy).toBeCalledTimes(1);

        // only the email is encoded and other params are empty. See logic for useOpenSalesLink hook
        const salesLinkWithEncodedParams = 'https://mattermost.com/contact-sales/?qk=&qp=&qw=&qx=dGVzdEBtYXR0ZXJtb3N0LmNvbQ==&utm_source=mattermost&utm_medium=in-product';
        expect(windowSpy).toBeCalledWith(salesLinkWithEncodedParams, '_blank');
        expect(trackEvent).toBeCalledTimes(1);
        expect(trackEvent).toBeCalledWith('insights', 'click_true_up_error', {
            cta: 'Contact Sales',
            banner: 'global banner',
        });
    });
});
