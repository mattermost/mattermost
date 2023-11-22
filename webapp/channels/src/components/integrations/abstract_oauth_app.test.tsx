// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {shallow} from 'enzyme';
import React, {type ChangeEvent} from 'react';
import {FormattedMessage} from 'react-intl';

import AbstractOAuthApp from 'components/integrations/abstract_oauth_app';

import {TestHelper} from 'utils/test_helper';

describe('components/integrations/AbstractOAuthApp', () => {
    const header = {id: 'Header', defaultMessage: 'Header'};
    const footer = {id: 'Footer', defaultMessage: 'Footer'};
    const loading = {id: 'Loading', defaultMessage: 'Loading'};
    const initialApp = {
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

    const action = jest.fn().mockImplementation(
        () => {
            return new Promise<void>((resolve) => {
                process.nextTick(() => resolve());
            });
        },
    );

    const team = TestHelper.getTeamMock({name: 'test', id: initialApp.id});

    const baseProps = {
        team,
        header,
        footer,
        loading,
        renderExtra: <div>{'renderExtra'}</div>,
        serverError: '',
        initialApp,
        action: jest.fn(),
    };

    test('should match snapshot', () => {
        const wrapper = shallow(
            <AbstractOAuthApp {...baseProps}/>,
        );
        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot, displays client error', () => {
        const newServerError = 'serverError';
        const props = {...baseProps, serverError: newServerError};
        const wrapper = shallow(
            <AbstractOAuthApp {...props}/>,
        );

        wrapper.find('#callbackUrls').simulate('change', {target: {value: ''}});
        wrapper.find('.btn-primary').simulate('click', {preventDefault() {
            return jest.fn();
        }});

        expect(action).not.toBeCalled();
        expect(wrapper).toMatchSnapshot();
    });

    test('should call action function', () => {
        const props = {...baseProps, action};
        const wrapper = shallow(
            <AbstractOAuthApp {...props}/>,
        );

        wrapper.find('#name').simulate('change', {target: {value: 'name'}});
        wrapper.find('.btn-primary').simulate('click', {preventDefault() {
            return jest.fn();
        }});

        expect(action).toBeCalled();
    });

    test('should have correct state when updateName is called', () => {
        const props = {...baseProps, action};
        const wrapper = shallow<AbstractOAuthApp>(
            <AbstractOAuthApp {...props}/>,
        );
        const evt = {preventDefault: jest.fn(), target: {value: 'new name'}} as unknown as ChangeEvent<HTMLInputElement>;
        wrapper.instance().updateName(evt);
        expect(wrapper.state('name')).toEqual('new name');
        const evt2 = {preventDefault: jest.fn(), target: {value: 'another name'}} as unknown as ChangeEvent<HTMLInputElement>;
        wrapper.instance().updateName(evt2);
        expect(wrapper.state('name')).toEqual('another name');
    });

    test('should have correct state when updateTrusted is called', () => {
        const props = {...baseProps, action};
        const wrapper = shallow<AbstractOAuthApp>(
            <AbstractOAuthApp {...props}/>,
        );

        const evt = {preventDefault: jest.fn(), target: {value: 'false'}} as unknown as ChangeEvent<HTMLInputElement>;
        wrapper.instance().updateTrusted(evt);
        expect(wrapper.state('is_trusted')).toEqual(false);

        const evt2 = {preventDefault: jest.fn(), target: {value: 'true'}} as unknown as ChangeEvent<HTMLInputElement>;
        wrapper.instance().updateTrusted(evt2);
        expect(wrapper.state('is_trusted')).toEqual(true);
    });

    test('should have correct state when updateDescription is called', () => {
        const props = {...baseProps, action};
        const wrapper = shallow<AbstractOAuthApp>(
            <AbstractOAuthApp {...props}/>,
        );

        const evt = {preventDefault: jest.fn(), target: {value: 'new description'}} as unknown as ChangeEvent<HTMLInputElement>;
        wrapper.instance().updateDescription(evt);
        expect(wrapper.state('description')).toEqual('new description');

        const evt2 = {preventDefault: jest.fn(), target: {value: 'another description'}} as unknown as ChangeEvent<HTMLInputElement>;
        wrapper.instance().updateDescription(evt2);
        expect(wrapper.state('description')).toEqual('another description');
    });

    test('should have correct state when updateHomepage is called', () => {
        const props = {...baseProps, action};
        const wrapper = shallow<AbstractOAuthApp>(
            <AbstractOAuthApp {...props}/>,
        );

        const evt = {preventDefault: jest.fn(), target: {value: 'new homepage'}} as unknown as ChangeEvent<HTMLInputElement>;
        wrapper.instance().updateHomepage(evt);
        expect(wrapper.state('homepage')).toEqual('new homepage');

        const evt2 = {preventDefault: jest.fn(), target: {value: 'another homepage'}} as unknown as ChangeEvent<HTMLInputElement>;
        wrapper.instance().updateHomepage(evt2);
        expect(wrapper.state('homepage')).toEqual('another homepage');
    });

    test('should have correct state when updateIconUrl is called', () => {
        const props = {...baseProps, action};
        const wrapper = shallow<AbstractOAuthApp>(
            <AbstractOAuthApp {...props}/>,
        );

        wrapper.setState({has_icon: true});
        const evt = {preventDefault: jest.fn(), target: {value: 'https://test.com/new_icon_url'}} as unknown as ChangeEvent<HTMLInputElement>;
        wrapper.instance().updateIconUrl(evt);
        expect(wrapper.state('icon_url')).toEqual('https://test.com/new_icon_url');
        expect(wrapper.state('has_icon')).toEqual(false);

        wrapper.setState({has_icon: true});
        const evt2 = {preventDefault: jest.fn(), target: {value: 'https://test.com/another_icon_url'}} as unknown as ChangeEvent<HTMLInputElement>;
        wrapper.instance().updateIconUrl(evt2);
        expect(wrapper.state('icon_url')).toEqual('https://test.com/another_icon_url');
        expect(wrapper.state('has_icon')).toEqual(false);
    });

    test('should have correct state when handleSubmit is called', () => {
        const props = {...baseProps, action};
        const wrapper = shallow<AbstractOAuthApp>(
            <AbstractOAuthApp {...props}/>,
        );

        const newState = {saving: false, name: 'name', description: 'description', homepage: 'homepage'};
        const evt = {preventDefault: jest.fn()} as any;
        wrapper.setState({saving: true});
        wrapper.instance().handleSubmit(evt);
        expect(evt.preventDefault).toHaveBeenCalled();

        wrapper.setState(newState);
        wrapper.instance().handleSubmit(evt);
        expect(wrapper.state('saving')).toEqual(true);
        expect(wrapper.state('clientError')).toEqual('');

        wrapper.setState({...newState, name: ''});
        wrapper.instance().handleSubmit(evt);
        expect(wrapper.state('saving')).toEqual(false);
        expect(wrapper.state('clientError')).toEqual(
            <FormattedMessage
                defaultMessage='Name for the OAuth 2.0 application is required.'
                id='add_oauth_app.nameRequired'
            />,
        );

        wrapper.setState({...newState, description: ''});
        wrapper.instance().handleSubmit(evt);
        expect(wrapper.state('saving')).toEqual(false);
        expect(wrapper.state('clientError')).toEqual(
            <FormattedMessage
                defaultMessage='Description for the OAuth 2.0 application is required.'
                id='add_oauth_app.descriptionRequired'
            />,
        );

        wrapper.setState({...newState, homepage: ''});
        wrapper.instance().handleSubmit(evt);
        expect(wrapper.state('saving')).toEqual(false);
        expect(wrapper.state('clientError')).toEqual(
            <FormattedMessage
                defaultMessage='Homepage for the OAuth 2.0 application is required.'
                id='add_oauth_app.homepageRequired'
            />,
        );
    });
});
