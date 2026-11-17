// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {receivedClientConfigOverrides} from 'mattermost-redux/actions/general';

import AnnouncementBarController from 'components/announcement_bar';

import {act, renderWithContext, screen} from 'tests/react_testing_utils';

import 'tests/helpers/localstorage';

jest.mock('components/announcement_bar/cloud_preview_announcement_bar', () => () => null);
jest.mock('components/announcement_bar/cloud_trial_announcement_bar', () => () => null);
jest.mock('components/announcement_bar/configuration_bar', () => () => null);
jest.mock('components/announcement_bar/non_production_license_bar', () => () => null);
jest.mock('components/announcement_bar/notification_permission_bar', () => () => null);
jest.mock('components/announcement_bar/overage_users_banner', () => () => null);
jest.mock('components/announcement_bar/post_history_limit_banner', () => () => null);
jest.mock('components/announcement_bar/show_start_trial_modal/show_start_trial_modal', () => () => null);
jest.mock('components/announcement_bar/show_tree_days_left_trial_modal/show_three_days_left_trial_modal', () => () => null);
jest.mock('components/announcement_bar/single_channel_guest_limit_banner', () => () => null);
jest.mock('components/announcement_bar/users_limits_announcement_bar', () => () => null);
jest.mock('components/announcement_bar/version_bar', () => () => null);

describe('components/announcement_bar/AnnouncementBarController', () => {
    const initialState = {
        entities: {
            general: {
                config: {
                    EnableBanner: 'false',
                    BannerText: 'Company banner',
                    BannerColor: '#f2a93b',
                    BannerTextColor: '#333333',
                    AllowBannerDismissal: 'true',
                },
                license: {IsLicensed: 'true', Cloud: 'false'},
            },
        },
    };

    test('applies announcement banner overrides that arrive after render', () => {
        const {container, store} = renderWithContext(<AnnouncementBarController/>, initialState);

        expect(screen.queryByText('Company banner')).not.toBeInTheDocument();

        act(() => {
            store.dispatch(receivedClientConfigOverrides({
                EnableBanner: 'true',
                BannerText: 'Finance close is on Friday',
                AllowBannerDismissal: 'false',
            }));
        });

        expect(screen.getByText('Finance close is on Friday')).toBeInTheDocument();
        expect(container.querySelector('.admin-announcement .announcement-bar__close')).not.toBeInTheDocument();

        act(() => {
            store.dispatch(receivedClientConfigOverrides({AllowBannerDismissal: 'true'}));
        });

        expect(screen.queryByText('Finance close is on Friday')).not.toBeInTheDocument();
        expect(screen.queryByText('Company banner')).not.toBeInTheDocument();

        act(() => {
            store.dispatch(receivedClientConfigOverrides({EnableBanner: 'true'}));
        });

        expect(screen.getByText('Company banner')).toBeInTheDocument();
        expect(container.querySelector('.admin-announcement .announcement-bar__close')).toBeInTheDocument();
    });
});
