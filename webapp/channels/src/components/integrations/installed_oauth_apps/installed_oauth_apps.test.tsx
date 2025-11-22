// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {shallow} from 'enzyme';
import React from 'react';

import InstalledOAuthApps from 'components/integrations/installed_oauth_apps/installed_oauth_apps';
import OAuthAppsList from 'components/integrations/installed_oauth_apps/oauth_apps_list';

import {TestHelper} from 'utils/test_helper';

describe('components/integrations/InstalledOAuthApps', () => {
    const oauthApps = {
        facxd9wpzpbpfp8pad78xj75pr: {
            id: 'facxd9wpzpbpfp8pad78xj75pr',
            name: 'firstApp',
            client_secret: '88cxd9wpzpbpfp8pad78xj75pr',
            create_at: 1501365458934,
            creator_id: '88oybd1dwfdoxpkpw1h5kpbyco',
            description: 'testing',
            homepage: 'https://test.com',
            icon_url: 'https://test.com/icon',
            is_trusted: false,
            update_at: 1501365458934,
            callback_urls: ['https://test.com/callback'],
        },
        fzcxd9wpzpbpfp8pad78xj75pr: {
            id: 'fzcxd9wpzpbpfp8pad78xj75pr',
            name: 'secondApp',
            client_secret: 'decxd9wpzpbpfp8pad78xj75pr',
            create_at: 1501365459984,
            creator_id: '88oybd2dwfdoxpkpw1h5kpbyco',
            description: 'testing2',
            homepage: 'https://test2.com',
            icon_url: 'https://test2.com/icon',
            is_trusted: true,
            update_at: 1501365479988,
            callback_urls: ['https://test2.com/callback', 'https://test2.com/callback2'],
        },
    };

    const baseProps = {
        team: TestHelper.getTeamMock({
            name: 'test',
        }),
        oauthApps,
        users: {
            '88oybd1dwfdoxpkpw1h5kpbyco': TestHelper.getUserMock({
                id: '88oybd1dwfdoxpkpw1h5kpbyco',
                username: 'user1',
            }),
            '88oybd2dwfdoxpkpw1h5kpbyco': TestHelper.getUserMock({
                id: '88oybd2dwfdoxpkpw1h5kpbyco',
                username: 'user2',
            }),
        },
        canManageOauth: true,
        actions: {
            loadOAuthAppsAndProfiles: jest.fn(),
            regenOAuthAppSecret: jest.fn(),
            deleteOAuthApp: jest.fn(),
        },
        loading: false,
        appsOAuthAppIDs: [],
    };

    test('should match snapshot', () => {
        const newGetOAuthApps = jest.fn().mockImplementation(
            () => {
                return new Promise((resolve) => {
                    process.nextTick(() => resolve({}));
                });
            },
        );

        const props = {...baseProps};
        props.actions.loadOAuthAppsAndProfiles = newGetOAuthApps;
        const wrapper = shallow<InstalledOAuthApps>(<InstalledOAuthApps {...props}/>);

        expect(wrapper).toMatchSnapshot();
        expect(wrapper.find(OAuthAppsList)).toHaveLength(1);
        expect(wrapper.find(OAuthAppsList).prop('oauthApps')).toHaveLength(2);
    });

    test('should match snapshot for Apps', () => {
        const newGetOAuthApps = jest.fn().mockImplementation(
            () => {
                return new Promise((resolve) => {
                    process.nextTick(() => resolve({}));
                });
            },
        );

        const props = {
            ...baseProps,
            appsOAuthAppIDs: ['fzcxd9wpzpbpfp8pad78xj75pr'],
        };

        props.actions.loadOAuthAppsAndProfiles = newGetOAuthApps;
        const wrapper = shallow<InstalledOAuthApps>(<InstalledOAuthApps {...props}/>);
        expect(wrapper).toMatchSnapshot();
        expect(wrapper.find(OAuthAppsList).prop('appsOAuthAppIDs')).toContain('fzcxd9wpzpbpfp8pad78xj75pr');
    });

    test('should props.deleteOAuthApp on deleteOAuthApp', () => {
        const newDeleteOAuthApp = jest.fn();
        const props = {...baseProps};
        props.actions.deleteOAuthApp = newDeleteOAuthApp;
        const wrapper = shallow<InstalledOAuthApps>(
            <InstalledOAuthApps {...props}/>,
        );

        wrapper.instance().deleteOAuthApp(oauthApps.facxd9wpzpbpfp8pad78xj75pr);
        expect(newDeleteOAuthApp).toHaveBeenCalled();
        expect(newDeleteOAuthApp).toHaveBeenCalledWith(oauthApps.facxd9wpzpbpfp8pad78xj75pr.id);
    });
});
