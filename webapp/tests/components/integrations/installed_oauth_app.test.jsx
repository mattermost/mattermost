// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import React from 'react';
import {shallow} from 'enzyme';

import InstalledOAuthApp from 'components/integrations/components/installed_oauth_app.jsx';

describe('components/integrations/InstalledOAuthApp', () => {
    const emptyFunction = jest.fn();
    const app = {
        id: 'facxd9wpzpbpfp8pad78xj75pr',
        name: 'testApp',
        client_secret: '88cxd9wpzpbpfp8pad78xj75pr',
        create_at: 1501365458934,
        creator_id: '88oybd1dwfdoxpkpw1h5kpbyco',
        description: 'testing',
        homepage: 'https://test.com',
        icon_url: 'https://test.com/icon',
        is_trusted: true,
        update_at: 1501365458934,
        callback_urls: ['https://test.com/callback', 'https://test.com/callback2']
    };

    test('should match snapshot', () => {
        const wrapper = shallow(
            <InstalledOAuthApp
                oauthApp={app}
                onRegenerateSecret={emptyFunction}
                onDelete={emptyFunction}
                filter={''}
            />
        );
        expect(wrapper).toMatchSnapshot();
    });

    test('should call onRegenerateSecret function', () => {
        const onRegenerateSecret = jest.genMockFunction().mockImplementation(
            () => {
                return new Promise((resolve) => {
                    process.nextTick(() => resolve());
                });
            }
        );

        const wrapper = shallow(
            <InstalledOAuthApp
                oauthApp={app}
                onRegenerateSecret={onRegenerateSecret}
                onDelete={emptyFunction}
                filter={''}
            />
        );
        wrapper.find('div.item-actions a').at(1).simulate('click', {preventDefault() {
            return jest.fn();
        }});
        expect(onRegenerateSecret).toBeCalled();
    });

    test('should filter out OAuthApp', () => {
        const wrapper = shallow(
            <InstalledOAuthApp
                oauthApp={app}
                onRegenerateSecret={emptyFunction}
                onDelete={emptyFunction}
                filter={'filter'}
            />
        );
        expect(wrapper).toMatchSnapshot();
    });
});