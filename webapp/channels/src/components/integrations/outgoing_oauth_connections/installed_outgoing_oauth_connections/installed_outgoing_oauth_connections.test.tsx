// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {shallow} from 'enzyme';
import React from 'react';

import BackstageList from 'components/backstage/components/backstage_list';
import InstalledOutgoingOAuthConnections from 'components/integrations/installed_outgoing_oauth_connections/installed_outgoing_oauth_connections';

describe('components/integrations/InstalledOutgoingOAuthConnections', () => {
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
        team: {
            name: 'test',
        },
        oauthApps,
        canManageOauth: true,
        actions: {
            loadOAuthAppsAndProfiles: jest.fn(),
            regenOAuthAppSecret: jest.fn(),
            deleteOAuthApp: jest.fn(),
        },
        enableOAuthServiceProvider: true,
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
        const wrapper = shallow<InstalledOutgoingOAuthConnections>(<InstalledOutgoingOAuthConnections {...props}/>);

        expect(wrapper).toMatchSnapshot();
        expect(shallow(<div>{wrapper.instance().oauthApps('first')}</div>)).toMatchSnapshot(); // successful filter
        expect(shallow(<div>{wrapper.instance().oauthApps('ZZZ')}</div>)).toMatchSnapshot(); // unsuccessful filter
        expect(shallow(<div>{wrapper.instance().oauthApps()}</div>).find('Connect(InstalledOutgoingOAuthConnection)').length).toBe(2); // no filter, should return all
        expect(wrapper.find(BackstageList).props().addLink).toEqual('/test/integrations/outgoing-oauth2-connections/add');
        expect(wrapper.find(BackstageList).props().addText).toEqual('Add OAuth 2.0 Application');

        wrapper.setProps({canManageOauth: false});
        expect(wrapper.find(BackstageList).props().addLink).toBeFalsy();
        expect(wrapper.find(BackstageList).props().addText).toBeFalsy();
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
        const wrapper = shallow<InstalledOutgoingOAuthConnections>(<InstalledOutgoingOAuthConnections {...props}/>);
        expect(shallow(<div>{wrapper.instance().oauthApps('second')}</div>)).toMatchSnapshot(); // successful filter
    });

    test('should props.deleteOAuthApp on deleteOAuthApp', () => {
        const newDeleteOAuthApp = jest.fn();
        const props = {...baseProps};
        props.actions.deleteOAuthApp = newDeleteOAuthApp;
        const wrapper = shallow<InstalledOutgoingOAuthConnections>(
            <InstalledOutgoingOAuthConnections {...props}/>,
        );

        wrapper.instance().deleteOAuthApp(oauthApps.facxd9wpzpbpfp8pad78xj75pr);
        expect(newDeleteOAuthApp).toHaveBeenCalled();
        expect(newDeleteOAuthApp).toHaveBeenCalledWith(oauthApps.facxd9wpzpbpfp8pad78xj75pr.id);
    });
});
