// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import * as reactRedux from 'react-redux';

import {savePreferences} from 'mattermost-redux/actions/preferences';
import {Client4} from 'mattermost-redux/client';

import {trackEvent} from 'actions/telemetry_actions';

import configureStore from 'store';
import {
    fireEvent,
    renderWithIntl,
    screen,
    waitFor,
} from 'tests/react_testing_utils';
import {CloudProducts, Preferences, TELEMETRY_CATEGORIES} from 'utils/constants';
import {TestHelper} from 'utils/test_helper';

import NotifyAdminDowngradeDeliquencyBar, {BannerPreferenceName} from './index';

import type {ComponentProps} from 'react';

type RenderComponentArgs = {
    props?: Partial<ComponentProps<typeof NotifyAdminDowngradeDeliquencyBar>>;
    store?: any;
}

jest.mock('actions/telemetry_actions', () => ({
    trackEvent: jest.fn(),
}));

jest.mock('react-redux', () => ({
    ...jest.requireActual('react-redux'),
    useDispatch: jest.fn().mockReturnValue(() => {}),
}));

jest.mock('mattermost-redux/actions/preferences', () => ({
    savePreferences: jest.fn(),
}));

describe('components/announcement_bar/notify_admin_downgrade_delinquency_bar', () => {
    const initialState = {
        views: {
            announcementBar: {
                announcementBarState: {
                    announcementBarCount: 1,
                },
            },
        },
        entities: {
            general: {
                license: {
                    IsLicensed: 'true',
                    Cloud: 'true',
                },
            },
            preferences: {
                myPreferences: {},
            },
            users: {
                currentUserId: 'current_user_id',
                profiles: {
                    current_user_id: {id: 'id', roles: 'system_user'},
                },
            },
            cloud: {
                subscription: {
                    product_id: 'test_prod_1',
                    trial_end_at: 1652807380,
                    is_free_trial: 'false',
                    delinquent_since: 1652807380, // may 17 2022
                },
                products: {
                    test_prod_1: {
                        id: 'test_prod_1',
                        sku: CloudProducts.STARTER,
                        price_per_seat: 0,
                    },
                    test_prod_2: {
                        id: 'test_prod_2',
                        sku: CloudProducts.ENTERPRISE,
                        price_per_seat: 0,
                    },
                    test_prod_3: {
                        id: 'test_prod_3',
                        sku: CloudProducts.PROFESSIONAL,
                        price_per_seat: 0,
                    },
                },
            },
        },
    };

    const renderComponent = ({store = initialState}: RenderComponentArgs) => {
        return renderWithIntl(
            <reactRedux.Provider store={configureStore(store)}>
                <NotifyAdminDowngradeDeliquencyBar/>
            </reactRedux.Provider>,
        );
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('Should not show banner when there isn\'t delinquency', () => {
        const state = JSON.parse(JSON.stringify(initialState));
        state.entities.cloud.subscription = {
            product_id: 'test_prod_1',
            trial_end_at: 1652807380,
            is_free_trial: 'false',
        };

        renderComponent({store: state});

        expect(screen.queryByText('Your workspace has been downgraded. Notify your admin to fix billing issues')).not.toBeInTheDocument();
    });

    it('Should not show banner when deliquency is less than 90 days', () => {
        jest.useFakeTimers().setSystemTime(new Date('2022-06-20'));

        renderComponent({});

        expect(screen.queryByText('Your workspace has been downgraded. Notify your admin to fix billing issues')).not.toBeInTheDocument();
    });

    it('Should not show banner when the user has notify their admin', () => {
        const state = JSON.parse(JSON.stringify(initialState));
        state.entities.preferences.myPreferences = TestHelper.getPreferencesMock(
            [
                {
                    category: Preferences.NOTIFY_ADMIN_REVOKE_DOWNGRADED_WORKSPACE,
                    name: BannerPreferenceName,
                    value: 'adminNotified',
                },
            ],
        );

        renderComponent({store: state});

        expect(screen.queryByText('Your workspace has been downgraded. Notify your admin to fix billing issues')).not.toBeInTheDocument();
    });

    it('Should not show banner when the user closed the banner', () => {
        const state = JSON.parse(JSON.stringify(initialState));
        state.entities.preferences.myPreferences = TestHelper.getPreferencesMock(
            [
                {
                    category: Preferences.NOTIFY_ADMIN_REVOKE_DOWNGRADED_WORKSPACE,
                    name: BannerPreferenceName,
                    value: 'dismissBanner',
                },
            ],
        );

        renderComponent({store: state});

        expect(screen.queryByText('Your workspace has been downgraded. Notify your admin to fix billing issues')).not.toBeInTheDocument();
    });

    it('Should not show banner when the user is an admin', () => {
        jest.useFakeTimers().setSystemTime(new Date('2022-08-17'));
        const state = JSON.parse(JSON.stringify(initialState));
        state.entities.users.profiles.current_user_id = {roles: 'system_admin'};

        renderComponent({store: state});

        expect(screen.queryByText('Your workspace has been downgraded. Notify your admin to fix billing issues')).not.toBeInTheDocument();
    });

    it('Should not save the preferences if the user can\'t notify', () => {
        jest.useFakeTimers().setSystemTime(new Date('2022-08-17'));
        Client4.notifyAdmin = jest.fn();

        renderComponent({});

        expect(savePreferences).not.toBeCalled();
    });

    it('Should show banner when deliquency is higher than 90 days', () => {
        jest.useFakeTimers().setSystemTime(new Date('2022-08-17'));

        renderComponent({});

        expect(screen.getByText('Your workspace has been downgraded. Notify your admin to fix billing issues')).toBeInTheDocument();
    });

    it('Should save the preferences if the user close the banner', async () => {
        jest.useFakeTimers().setSystemTime(new Date('2022-08-17'));

        renderComponent({});

        fireEvent.click(screen.getByRole('link'));

        expect(savePreferences).toBeCalledTimes(1);
        expect(savePreferences).toBeCalledWith(initialState.entities.users.profiles.current_user_id.id, [{
            category: Preferences.NOTIFY_ADMIN_REVOKE_DOWNGRADED_WORKSPACE,
            name: BannerPreferenceName,
            user_id: initialState.entities.users.profiles.current_user_id.id,
            value: 'dismissBanner',
        }]);
    });

    it('Should save the preferences and track event after notify their admin', async () => {
        jest.useFakeTimers().setSystemTime(new Date('2022-08-17'));
        Client4.notifyAdmin = jest.fn();

        renderComponent({});

        fireEvent.click(screen.getByText('Notify admin'));

        await waitFor(() => {
            expect(savePreferences).toBeCalledTimes(1);
            expect(savePreferences).toBeCalledWith(initialState.entities.users.profiles.current_user_id.id, [{
                category: Preferences.NOTIFY_ADMIN_REVOKE_DOWNGRADED_WORKSPACE,
                name: BannerPreferenceName,
                user_id: initialState.entities.users.profiles.current_user_id.id,
                value: 'adminNotified',
            }]);

            expect(trackEvent).toBeCalledTimes(2);
            expect(trackEvent).toHaveBeenNthCalledWith(1, TELEMETRY_CATEGORIES.CLOUD_DELINQUENCY, 'click_notify_admin_upgrade_workspace_banner');
            expect(trackEvent).toHaveBeenNthCalledWith(2, TELEMETRY_CATEGORIES.CLOUD_DELINQUENCY, 'notify_admin_downgrade_delinquency_bar', undefined);
        });
    });
});
