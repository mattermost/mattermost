// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import * as reactRedux from 'react-redux';
import {shallow} from 'enzyme';

import {TestHelper} from 'utils/test_helper';
import mockStore from 'tests/test_store';

import {CloudProducts} from 'utils/constants';

import {TeamProfile} from './team_profile';

describe('admin_console/team_channel_settings/team/TeamProfile', () => {
    const baseProps = {
        team: TestHelper.getTeamMock(),
        onToggleArchive: jest.fn(),
        isArchived: false,
    };
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
                    Cloud: 'false',
                },
            },
            users: {
                currentUserId: 'current_user_id',
                profiles: {
                    current_user_id: {roles: 'system_admin'},
                },
            },
            cloud: {
                subscription: {
                    product_id: 'test_prod_1',
                    trial_end_at: 1652807380,
                    is_free_trial: 'false',
                },
                products: {
                    test_prod_1: {
                        id: 'test_prod_1',
                        sku: CloudProducts.STARTER,
                        price_per_seat: 0,
                    },
                },
            },
        },
    };
    const state = JSON.parse(JSON.stringify(initialState));
    const store = mockStore(state);
    test('should match snapshot (not cloud, freemium disabled', () => {
        const wrapper = shallow(
            <reactRedux.Provider store={store}>
                <TeamProfile {...baseProps}/>
            </reactRedux.Provider>,
        );
        expect(wrapper).toMatchSnapshot();
        expect(wrapper.find('OverlayTrigger').exists()).toEqual(false);
    });

    test('should match snapshot with isArchived true', () => {
        const props = {
            ...baseProps,
            isArchived: true,
        };
        const wrapper = shallow(
            <reactRedux.Provider store={store}>
                <TeamProfile {...props}/>
            </reactRedux.Provider>,
        );
        expect(wrapper).toMatchSnapshot();
        expect(wrapper.find('OverlayTrigger').exists()).toEqual(false);
    });
});
