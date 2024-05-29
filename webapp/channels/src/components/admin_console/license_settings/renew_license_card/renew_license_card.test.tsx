// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ReactWrapper} from 'enzyme';
import React from 'react';
import {act} from 'react-dom/test-utils';
import {Provider} from 'react-redux';

import {mountWithIntl} from 'tests/helpers/intl-test-helper';
import mockStore from 'tests/test_store';

import RenewalLicenseCard from './renew_license_card';

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
            config: {
                CWSURL: '',
            },
            license: {
                IsLicensed: 'true',
                Cloud: 'true',
            },
        },
        users: {
            currentUserId: 'current_user_id',
            profiles: {
                current_user_id: {roles: 'system_user'},
            },
        },
        preferences: {
            myPreferences: {},
        },
        cloud: {},
    },
};

const actImmediate = (wrapper: ReactWrapper) =>
    act(
        () =>
            new Promise<void>((resolve) => {
                setImmediate(() => {
                    wrapper.update();
                    resolve();
                });
            }),
    );

describe('components/RenewalLicenseCard', () => {
    afterEach(() => {
        jest.clearAllMocks();
    });

    const props = {
        license: {
            id: 'license_id',
            ExpiresAt: new Date().getMilliseconds().toString(),
            SkuShortName: 'skuShortName',
        },
        isLicenseExpired: false,
        totalUsers: 10,
        isDisabled: false,
    };

    test('should show Contact sales button', async () => {
        const store = mockStore(initialState);
        const wrapper = mountWithIntl(<Provider store={store}><RenewalLicenseCard {...props}/></Provider>);

        // wait for the promise to resolve and component to update
        await actImmediate(wrapper);

        expect(wrapper.find('button').length).toEqual(1);
        expect(wrapper.find('button').at(0).text().includes('Contact sales')).toBe(true);
    });
});
