// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {DeepPartial} from '@mattermost/types/utilities';

import {savePreferences} from 'mattermost-redux/actions/preferences';
import {General} from 'mattermost-redux/constants';

import {trackEvent} from 'actions/telemetry_actions';

import {
    act,
    fireEvent,
    renderWithIntlAndStore,
    screen,
} from 'tests/react_testing_utils';
import {LicenseLinks, OverActiveUserLimits, Preferences, SelfHostedProducts, StatTypes} from 'utils/constants';
import {TestHelper} from 'utils/test_helper';
import {generateId} from 'utils/utils';

import type {GlobalState} from 'types/store';

import OverageUsersBannerNotice from './index';

type RenderComponentArgs = {
    store?: any;
}

jest.mock('react-redux', () => ({
    ...jest.requireActual('react-redux'),
    useDispatch: jest.fn().mockReturnValue(() => {}),
}));

jest.mock('mattermost-redux/actions/preferences', () => ({
    savePreferences: jest.fn(),
}));

jest.mock('actions/telemetry_actions', () => ({
    trackEvent: jest.fn(),

    // Disable any additional query parameteres from being added in the event of a link-out
    isTelemetryEnabled: jest.fn().mockReturnValue(false),
}));

const seatsPurchased = 40;

const seatsMinimumFor5PercentageState = (Math.ceil(seatsPurchased * OverActiveUserLimits.MIN)) + seatsPurchased;

const seatsMinimumFor10PercentageState = (Math.ceil(seatsPurchased * OverActiveUserLimits.MAX)) + seatsPurchased;

const text5PercentageState = `Your workspace user count has exceeded your paid license seat count by ${seatsMinimumFor5PercentageState - seatsPurchased} seats`;
const text10PercentageState = `Your workspace user count has exceeded your paid license seat count by ${seatsMinimumFor10PercentageState - seatsPurchased} seats`;
const notifyText = 'Notify your Customer Success Manager on your next true-up check';

const contactSalesTextLink = 'Contact Sales';
const expandSeatsTextLink = 'Purchase additional seats';

const licenseId = generateId();

describe('components/invitation_modal/overage_users_banner_notice', () => {
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
                    Id: licenseId,
                },
            },
            preferences: {
                myPreferences: {},
            },
            cloud: {
                subscriptionStats: {
                    is_expandable: false,
                    getRequestState: 'IDLE',
                },
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

    const renderComponent = ({store}: RenderComponentArgs = {store: initialState}) => {
        return renderWithIntlAndStore(
            <OverageUsersBannerNotice/>, store);
    };

    it('should not render the banner because we are not on overage state', () => {
        renderComponent();

        expect(screen.queryByText(notifyText, {exact: false})).not.toBeInTheDocument();
    });

    it('should not render the banner because we are not admins', () => {
        const store: GlobalState = JSON.parse(JSON.stringify(initialState));

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

        renderComponent({
            store,
        });

        expect(screen.queryByText(notifyText, {exact: false})).not.toBeInTheDocument();
    });

    it('should not render the banner because it\'s cloud licenese', () => {
        const store: GlobalState = JSON.parse(JSON.stringify(initialState));

        store.entities.general.license = {
            ...store.entities.general.license,
            Cloud: 'true',
        };

        renderComponent({
            store,
        });

        expect(screen.queryByText(notifyText, {exact: false})).not.toBeInTheDocument();
    });

    it('should not render the 5% banner because we have dissmised it', () => {
        const store: GlobalState = JSON.parse(JSON.stringify(initialState));

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

        renderComponent({
            store,
        });

        expect(screen.queryByText(text5PercentageState)).not.toBeInTheDocument();
    });

    it('should render the banner because we are over 5% and we don\'t have any preferences', () => {
        const store: GlobalState = JSON.parse(JSON.stringify(initialState));

        store.entities.admin = {
            ...store.entities.admin,
            analytics: {
                [StatTypes.TOTAL_USERS]: seatsMinimumFor5PercentageState,
            },
        };

        renderComponent({
            store,
        });

        expect(screen.getByText(text5PercentageState)).toBeInTheDocument();
        expect(screen.getByText(notifyText, {exact: false})).toBeInTheDocument();
    });

    it('should track if the admin click Contact Sales CTA in a 5% overage state', () => {
        const store: GlobalState = JSON.parse(JSON.stringify(initialState));

        store.entities.admin = {
            ...store.entities.admin,
            analytics: {
                [StatTypes.TOTAL_USERS]: seatsMinimumFor5PercentageState,
            },
        };

        store.entities.cloud = {
            ...store.entities.cloud,
            subscriptionStats: {
                is_expandable: false,
                getRequestState: 'OK',
            },
        };

        renderComponent({
            store,
        });

        fireEvent.click(screen.getByText(contactSalesTextLink));
        expect(screen.getByRole('link')).toHaveAttribute(
            'href',
            LicenseLinks.CONTACT_SALES +
                '?utm_source=mattermost&utm_medium=in-product&utm_content=&uid=current_user&sid=',
        );
        expect(trackEvent).toBeCalledTimes(2);
        expect(trackEvent).toBeCalledWith('insights', 'click_true_up_warning', {
            cta: 'Contact Sales',
            banner: 'invite modal',
        });
    });

    it('should render the banner because we are over 5% and we have preferences from one old banner', () => {
        const store: GlobalState = JSON.parse(JSON.stringify(initialState));

        store.entities.preferences.myPreferences = TestHelper.getPreferencesMock(
            [
                {
                    category: Preferences.OVERAGE_USERS_BANNER,
                    value: 'Overage users banner watched',
                    name: `warn_overage_seats_${generateId().substring(0, 8)}`,
                },
            ],
        );

        store.entities.admin = {
            ...store.entities.admin,
            analytics: {
                [StatTypes.TOTAL_USERS]: seatsMinimumFor5PercentageState,
            },
        };

        renderComponent({
            store,
        });

        expect(screen.getByText(text5PercentageState)).toBeInTheDocument();
        expect(screen.getByText(notifyText, {exact: false})).toBeInTheDocument();
    });

    it('should save the preferences for 5% banner if admin click on close', () => {
        const store: GlobalState = JSON.parse(JSON.stringify(initialState));

        store.entities.admin = {
            ...store.entities.admin,
            analytics: {
                [StatTypes.TOTAL_USERS]: seatsMinimumFor5PercentageState,
            },
        };

        renderComponent({
            store,
        });

        fireEvent.click(screen.getByRole('button'));

        expect(savePreferences).toBeCalledTimes(1);
        expect(savePreferences).toBeCalledWith(store.entities.users.profiles.current_user.id, [{
            category: Preferences.OVERAGE_USERS_BANNER,
            name: `warn_overage_seats_${licenseId.substring(0, 8)}`,
            user_id: store.entities.users.profiles.current_user.id,
            value: 'Overage users banner watched',
        }]);
    });

    it('should render the banner because we are over 10% and we don\'t have preferences', () => {
        const store: GlobalState = JSON.parse(JSON.stringify(initialState));

        store.entities.admin = {
            ...store.entities.admin,
            analytics: {
                [StatTypes.TOTAL_USERS]: seatsMinimumFor10PercentageState,
            },
        };

        renderComponent({
            store,
        });

        expect(screen.getByText(text10PercentageState)).toBeInTheDocument();
        expect(screen.getByText(notifyText, {exact: false})).toBeInTheDocument();
    });

    it('should track if the admin click Contact Sales CTA in a 10% overage state', () => {
        const store: GlobalState = JSON.parse(JSON.stringify(initialState));

        store.entities.admin = {
            ...store.entities.admin,
            analytics: {
                [StatTypes.TOTAL_USERS]: seatsMinimumFor10PercentageState,
            },
        };

        store.entities.cloud = {
            ...store.entities.cloud,
            subscriptionStats: {
                is_expandable: false,
                getRequestState: 'OK',
            },
        };

        renderComponent({
            store,
        });

        fireEvent.click(screen.getByText(contactSalesTextLink));
        expect(screen.getByRole('link')).toHaveAttribute(
            'href',
            LicenseLinks.CONTACT_SALES +
                '?utm_source=mattermost&utm_medium=in-product&utm_content=&uid=current_user&sid=',
        );
        expect(trackEvent).toBeCalledTimes(2);
        expect(trackEvent).toBeCalledWith('insights', 'click_true_up_error', {
            cta: 'Contact Sales',
            banner: 'invite modal',
        });
    });

    it('should render the banner because we are over 10%, and we have preference only for the warning state', () => {
        const store: GlobalState = JSON.parse(JSON.stringify(initialState));

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
                [StatTypes.TOTAL_USERS]: seatsMinimumFor10PercentageState,
            },
        };

        renderComponent({
            store,
        });

        expect(screen.getByText(text10PercentageState)).toBeInTheDocument();
        expect(screen.getByText(notifyText, {exact: false})).toBeInTheDocument();
    });

    it('should not render the banner because we are over 10% and we have preferences', () => {
        const store: GlobalState = JSON.parse(JSON.stringify(initialState));

        store.entities.preferences.myPreferences = TestHelper.getPreferencesMock(
            [
                {
                    category: Preferences.OVERAGE_USERS_BANNER,
                    value: 'Overage users banner watched',
                    name: `error_overage_seats_${licenseId.substring(0, 8)}`,
                },
            ],
        );

        store.entities.admin = {
            ...store.entities.admin,
            analytics: {
                [StatTypes.TOTAL_USERS]: seatsMinimumFor10PercentageState,
            },
        };

        renderComponent({
            store,
        });

        expect(screen.queryByText(text10PercentageState)).not.toBeInTheDocument();
        expect(screen.queryByText(notifyText, {exact: false})).not.toBeInTheDocument();
    });

    it('should save preferences for the banner because we are over 10% and we don\'t have preferences', () => {
        const store: GlobalState = JSON.parse(JSON.stringify(initialState));

        store.entities.admin = {
            ...store.entities.admin,
            analytics: {
                [StatTypes.TOTAL_USERS]: seatsMinimumFor10PercentageState,
            },
        };

        renderComponent({
            store,
        });

        fireEvent.click(screen.getByRole('button'));

        expect(savePreferences).toBeCalledTimes(1);
        expect(savePreferences).toBeCalledWith(store.entities.users.profiles.current_user.id, [{
            category: Preferences.OVERAGE_USERS_BANNER,
            name: `error_overage_seats_${licenseId.substring(0, 8)}`,
            user_id: store.entities.users.profiles.current_user.id,
            value: 'Overage users banner watched',
        }]);
    });

    it('should track if the admin click expansion seats CTA in a 5% overage state', () => {
        const store: GlobalState = JSON.parse(JSON.stringify(initialState));

        store.entities.admin = {
            ...store.entities.admin,
            analytics: {
                [StatTypes.TOTAL_USERS]: seatsMinimumFor5PercentageState,
            },
        };

        store.entities.cloud = {
            ...store.entities.cloud,
            subscriptionStats: {
                is_expandable: true,
                getRequestState: 'OK',
            },
        };

        renderComponent({
            store,
        });

        fireEvent.click(screen.getByText(expandSeatsTextLink));
        expect(screen.getByRole('link')).toHaveAttribute('href', `http://testing/subscribe/expand?licenseId=${licenseId}`);
        expect(trackEvent).toBeCalledTimes(2);
        expect(trackEvent).toBeCalledWith('insights', 'click_true_up_warning', {
            cta: 'Self Serve',
            banner: 'invite modal',
        });
    });

    it('should track if the admin click expansion seats CTA in a 10% overage state', () => {
        const store: GlobalState = JSON.parse(JSON.stringify(initialState));

        store.entities.admin = {
            ...store.entities.admin,
            analytics: {
                [StatTypes.TOTAL_USERS]: seatsMinimumFor10PercentageState,
            },
        };

        store.entities.cloud = {
            ...store.entities.cloud,
            subscriptionStats: {
                is_expandable: true,
                getRequestState: 'OK',
            },
        };

        renderComponent({
            store,
        });

        fireEvent.click(screen.getByText(expandSeatsTextLink));
        expect(screen.getByRole('link')).toHaveAttribute('href', `http://testing/subscribe/expand?licenseId=${licenseId}`);
        expect(trackEvent).toBeCalledTimes(2);
        expect(trackEvent).toBeCalledWith('insights', 'click_true_up_error', {
            cta: 'Self Serve',
            banner: 'invite modal',
        });
    });

    it('gov sku sees overage notice but not a call to do true up', async () => {
        const store: GlobalState = JSON.parse(JSON.stringify(initialState));

        store.entities.admin = {
            ...store.entities.admin,
            analytics: {
                [StatTypes.TOTAL_USERS]: seatsMinimumFor10PercentageState,
            },
        };

        store.entities.cloud = {
            ...store.entities.cloud,
            subscriptionStats: {
                is_expandable: false,
                getRequestState: 'OK',
            },
        };
        store.entities.general.license.IsGovSku = 'true';

        await act(async () => {
            renderComponent({
                store,
            });
        });

        screen.getByText(text10PercentageState);
        expect(screen.queryByText(notifyText)).not.toBeInTheDocument();
    });
});
