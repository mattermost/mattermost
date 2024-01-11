// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {shallow} from 'enzyme';
import React from 'react';
import * as reactRedux from 'react-redux';

import mockStore from 'tests/test_store';
import {CloudProducts} from 'utils/constants';
import {FileSizes} from 'utils/file_utils';
import {TestHelper} from 'utils/test_helper';

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
            usage: {
                integrations: {
                    enabled: 0,
                    enabledLoaded: true,
                },
                messages: {
                    history: 0,
                    historyLoaded: true,
                },
                files: {
                    totalStorage: 0,
                    totalStorageLoaded: true,
                },
                teams: {
                    active: 0,
                    teamsLoaded: true,
                },
                boards: {
                    cards: 0,
                    cardsLoaded: true,
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
                limits: {
                    limitsLoaded: true,
                    limits: {
                        integrations: {
                            enabled: 10,
                        },
                        messages: {
                            history: 10000,
                        },
                        files: {
                            total_storage: FileSizes.Gigabyte,
                        },
                        teams: {
                            active: 1,
                        },
                        boards: {
                            cards: 500,
                            views: 5,
                        },
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
