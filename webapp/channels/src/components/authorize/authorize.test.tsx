// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {shallow} from 'enzyme';

import Authorize from './authorize';

describe('components/user_settings/display/UserSettingsDisplay', () => {
    const oauthApp = {
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
        callback_urls: ['https://test.com/callback', 'https://test.com/callback2'],
    };

    const requiredProps = {
        location: {search: ''},
        actions: {
            getOAuthAppInfo: jest.fn().mockResolvedValue({data: true}),
            allowOAuth2: jest.fn().mockResolvedValue({data: true}),
        },
    };

    test('UNSAFE_componentWillMount() should have called getOAuthAppInfo', () => {
        const props = {...requiredProps, location: {search: 'client_id=1234abcd'}};

        shallow(<Authorize {...props}/>);

        expect(requiredProps.actions.getOAuthAppInfo).toHaveBeenCalled();
        expect(requiredProps.actions.getOAuthAppInfo).toHaveBeenCalledWith('1234abcd');
    });

    test('UNSAFE_componentWillMount() should have updated state.app', async () => {
        const expected = oauthApp;
        const promise = Promise.resolve({data: expected});
        const actions = {...requiredProps.actions, getOAuthAppInfo: () => promise};
        const props = {...requiredProps, actions, location: {search: 'client_id=1234abcd'}};

        const wrapper = shallow<Authorize>(<Authorize {...props}/>);

        await promise;

        expect(wrapper.state().app).toEqual(expected);
    });

    test('handleAllow() should have called allowOAuth2', () => {
        const props = {...requiredProps, location: {search: 'client_id=1234abcd'}};

        const wrapper = shallow<Authorize>(<Authorize {...props}/>);

        wrapper.instance().handleAllow();

        const expected = {
            clientId: '1234abcd',
            responseType: null,
            redirectUri: null,
            state: null,
            scope: null,
        };
        expect(requiredProps.actions.allowOAuth2).toHaveBeenCalled();
        expect(requiredProps.actions.allowOAuth2).toHaveBeenCalledWith(expected);
    });

    test('handleAllow() should have updated state.error', async () => {
        const error = new Error('error');
        const promise = Promise.resolve({error});
        const actions = {...requiredProps.actions, allowOAuth2: () => promise};
        const props = {...requiredProps, actions, location: {search: 'client_id=1234abcd'}};

        const wrapper = shallow<Authorize>(<Authorize {...props}/>);

        wrapper.instance().handleAllow();
        await promise;

        expect(wrapper.state().error).toEqual(error.message);
    });
});
