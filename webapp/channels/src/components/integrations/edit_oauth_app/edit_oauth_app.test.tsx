// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {shallow} from 'enzyme';

import {OAuthApp} from '@mattermost/types/integrations';

import {Team} from '@mattermost/types/teams';

import {getHistory} from 'utils/browser_history';

import EditOAuthApp from 'components/integrations/edit_oauth_app/edit_oauth_app';

describe('components/integrations/EditOAuthApp', () => {
    const oauthApp: OAuthApp = {
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
    const team: Team = {
        id: 'dbcxd9wpzpbpfp8pad78xj12pr',
        name: 'test',
    } as Team;
    const editOAuthAppRequest = {
        status: 'not_started',
        error: null,
    };

    const baseProps = {
        team,
        oauthAppId: oauthApp.id,
        editOAuthAppRequest,
        actions: {
            getOAuthApp: jest.fn(),
            editOAuthApp: jest.fn(),
        },
        enableOAuthServiceProvider: true,
    };

    test('should match snapshot, loading', () => {
        const props = {...baseProps, oauthApp};
        const wrapper = shallow(
            <EditOAuthApp {...props}/>,
        );

        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot', () => {
        const props = {...baseProps, oauthApp};
        const wrapper = shallow(
            <EditOAuthApp {...props}/>,
        );

        expect(wrapper).toMatchSnapshot();
        expect(props.actions.getOAuthApp).toHaveBeenCalledWith(oauthApp.id);
    });

    test('should match snapshot when EnableOAuthServiceProvider is false', () => {
        const props = {...baseProps, oauthApp, enableOAuthServiceProvider: false};
        const wrapper = shallow(
            <EditOAuthApp {...props}/>,
        );

        expect(wrapper).toMatchSnapshot();
        expect(props.actions.getOAuthApp).not.toHaveBeenCalledWith();
    });

    test('should have match state when handleConfirmModal is called', () => {
        const props = {...baseProps, oauthApp};
        const wrapper = shallow<EditOAuthApp>(
            <EditOAuthApp {...props}/>,
        );

        wrapper.setState({showConfirmModal: false});
        wrapper.instance().handleConfirmModal();
        expect(wrapper.state('showConfirmModal')).toEqual(true);
    });

    test('should have match state when confirmModalDismissed is called', () => {
        const props = {...baseProps, oauthApp};
        const wrapper = shallow<EditOAuthApp>(
            <EditOAuthApp {...props}/>,
        );

        wrapper.setState({showConfirmModal: true});
        wrapper.instance().confirmModalDismissed();
        expect(wrapper.state('showConfirmModal')).toEqual(false);
    });

    test('should have match renderExtra', () => {
        const props = {...baseProps, oauthApp};
        const wrapper = shallow<EditOAuthApp>(
            <EditOAuthApp {...props}/>,
        );

        expect(wrapper.instance().renderExtra()).toMatchSnapshot();
    });

    test('should have match when editOAuthApp is called', () => {
        const props = {...baseProps, oauthApp};
        const wrapper = shallow<EditOAuthApp>(
            <EditOAuthApp {...props}/>,
        );

        const instance = wrapper.instance();
        instance.handleConfirmModal = jest.fn();
        instance.submitOAuthApp = jest.fn();
        instance.editOAuthApp(oauthApp);

        expect(instance.handleConfirmModal).not.toBeCalled();
        expect(instance.submitOAuthApp).toBeCalled();
    });

    test('should have match when submitOAuthApp is called on success', async () => {
        baseProps.actions.editOAuthApp = jest.fn().mockImplementation(
            () => {
                return new Promise((resolve) => {
                    process.nextTick(() => resolve({
                        data: 'data',
                        error: null,
                    }));
                });
            },
        );

        const props = {...baseProps, oauthApp};
        const wrapper = shallow<EditOAuthApp>(
            <EditOAuthApp {...props}/>,
        );

        const instance = wrapper.instance();
        wrapper.setState({showConfirmModal: true});
        await instance.submitOAuthApp();

        expect(wrapper.state('serverError')).toEqual('');
        expect(getHistory().push).toHaveBeenCalledWith(`/${team.name}/integrations/oauth2-apps`);
    });

    test('should have match when submitOAuthApp is called on error', async () => {
        baseProps.actions.editOAuthApp = jest.fn().mockImplementation(
            () => {
                return new Promise((resolve) => {
                    process.nextTick(() => resolve({
                        data: null,
                        error: {message: 'error message'},
                    }));
                });
            },
        );
        const props = {...baseProps, oauthApp};
        const wrapper = shallow<EditOAuthApp>(
            <EditOAuthApp {...props}/>,
        );

        const instance = wrapper.instance();
        wrapper.setState({showConfirmModal: true});
        await instance.submitOAuthApp();

        expect(wrapper.state('showConfirmModal')).toEqual(false);
        expect(wrapper.state('serverError')).toEqual('error message');
    });
});
