// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import React from 'react';
import {shallow} from 'enzyme';

import InstalledOAuthApps from 'components/integrations/components/installed_oauth_apps/installed_oauth_apps.jsx';

describe('components/integrations/InstalledOAuthApps', () => {
    test('should match snapshot', () => {
        const emptyFunction = jest.fn();
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
                callback_urls: ['https://test.com/callback']
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
                callback_urls: ['https://test2.com/callback', 'https://test2.com/callback2']
            }
        };
        global.window.mm_config = {EnableOAuthServiceProvider: 'true'};

        const wrapper = shallow(
            <InstalledOAuthApps
                team={{name: 'test'}}
                oauthApps={oauthApps}
                isSystemAdmin={true}
                actions={{
                    getOAuthApps: emptyFunction,
                    regenOAuthAppSecret: emptyFunction,
                    deleteOAuthApp: emptyFunction
                }}
            />
        );
        expect(wrapper.find('InstalledOAuthApp').length).toBe(2);
        expect(wrapper).toMatchSnapshot();
    });
});