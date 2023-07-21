// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {ReactWrapper} from 'enzyme';
import React from 'react';
import {act} from 'react-dom/test-utils';
import {Provider} from 'react-redux';

import {Client4} from 'mattermost-redux/client';

import {mountWithIntl} from 'tests/helpers/intl-test-helper';
import mockStore from 'tests/test_store';

import RenewalLink from './renewal_link';

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

describe('components/RenewalLink', () => {
    afterEach(() => {
        jest.clearAllMocks();
    });

    const props = {
        actions: {
            openModal: jest.fn,
        },
    };

    test('should show Renew now when a renewal link is successfully returned', async () => {
        const getRenewalLinkSpy = jest.spyOn(Client4, 'getRenewalLink');
        const promise = new Promise<{renewal_link: string}>((resolve) => {
            resolve({
                renewal_link: 'https://testrenewallink',
            });
        });
        getRenewalLinkSpy.mockImplementation(() => promise);
        const store = mockStore(initialState);
        const wrapper = mountWithIntl(<Provider store={store}><RenewalLink {...props}/></Provider>);

        // wait for the promise to resolve and component to update
        await actImmediate(wrapper);

        expect(wrapper.find('.btn').text().includes('Renew license now')).toBe(true);
    });

    test('should show Contact sales when a renewal link is not returned', async () => {
        const getRenewalLinkSpy = jest.spyOn(Client4, 'getRenewalLink');
        const promise = new Promise<{renewal_link: string}>((resolve, reject) => {
            reject(new Error('License cannot be renewed from portal'));
        });
        getRenewalLinkSpy.mockImplementation(() => promise);
        const store = mockStore(initialState);
        const wrapper = mountWithIntl(<Provider store={store}><RenewalLink {...props}/></Provider>);

        // wait for the promise to resolve and component to update
        await actImmediate(wrapper);

        expect(wrapper.find('.btn').text().includes('Contact sales')).toBe(true);
    });
});
