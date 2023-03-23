// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {ReactWrapper} from 'enzyme';
import {act} from 'react-dom/test-utils';

import {Client4} from 'mattermost-redux/client';
import {mountWithIntl} from 'tests/helpers/intl-test-helper';

import RenewalLink from './renewal_link';

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
        const wrapper = mountWithIntl(<RenewalLink {...props}/>);

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
        const wrapper = mountWithIntl(<RenewalLink {...props}/>);

        // wait for the promise to resolve and component to update
        await actImmediate(wrapper);

        expect(wrapper.find('.btn').text().includes('Contact sales')).toBe(true);
    });
});
