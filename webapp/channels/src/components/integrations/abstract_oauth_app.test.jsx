// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';

import {shallow} from 'enzyme';

import AbstractOAuthApp from 'components/integrations/abstract_oauth_app.jsx';

describe('components/integrations/AbstractOAuthApp', () => {
    const team = {name: 'test'};
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
            return new Promise((resolve) => {
                process.nextTick(() => resolve());
            });
        },
    );
    const baseProps = {
        team,
        header,
        footer,
        loading,
        renderExtra: 'renderExtra',
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
        const wrapper = shallow(
            <AbstractOAuthApp {...props}/>,
        );

        wrapper.instance().updateName({target: {value: 'new name'}});
        expect(wrapper.state('name')).toEqual('new name');

        wrapper.instance().updateName({target: {value: 'other name'}});
        expect(wrapper.state('name')).toEqual('other name');
    });

    test('should have correct state when updateTrusted is called', () => {
        const props = {...baseProps, action};
        const wrapper = shallow(
            <AbstractOAuthApp {...props}/>,
        );

        wrapper.instance().updateTrusted({target: {value: 'false'}});
        expect(wrapper.state('is_trusted')).toEqual(false);

        wrapper.instance().updateTrusted({target: {value: 'true'}});
        expect(wrapper.state('is_trusted')).toEqual(true);
    });

    test('should have correct state when updateDescription is called', () => {
        const props = {...baseProps, action};
        const wrapper = shallow(
            <AbstractOAuthApp {...props}/>,
        );

        wrapper.instance().updateDescription({target: {value: 'new description'}});
        expect(wrapper.state('description')).toEqual('new description');

        wrapper.instance().updateDescription({target: {value: 'another description'}});
        expect(wrapper.state('description')).toEqual('another description');
    });

    test('should have correct state when updateHomepage is called', () => {
        const props = {...baseProps, action};
        const wrapper = shallow(
            <AbstractOAuthApp {...props}/>,
        );

        wrapper.instance().updateHomepage({target: {value: 'new homepage'}});
        expect(wrapper.state('homepage')).toEqual('new homepage');

        wrapper.instance().updateHomepage({target: {value: 'another homepage'}});
        expect(wrapper.state('homepage')).toEqual('another homepage');
    });

    test('should have correct state when updateIconUrl is called', () => {
        const props = {...baseProps, action};
        const wrapper = shallow(
            <AbstractOAuthApp {...props}/>,
        );

        wrapper.setState({has_icon: true});
        wrapper.instance().updateIconUrl({target: {value: 'https://test.com/new_icon_url'}});
        expect(wrapper.state('icon_url')).toEqual('https://test.com/new_icon_url');
        expect(wrapper.state('has_icon')).toEqual(false);

        wrapper.setState({has_icon: true});
        wrapper.instance().updateIconUrl({target: {value: 'https://test.com/another_icon_url'}});
        expect(wrapper.state('icon_url')).toEqual('https://test.com/another_icon_url');
        expect(wrapper.state('has_icon')).toEqual(false);
    });

    test('should have correct state when handleSubmit is called', () => {
        const props = {...baseProps, action};
        const wrapper = shallow(
            <AbstractOAuthApp {...props}/>,
        );

        const newState = {saving: false, name: 'name', description: 'description', homepage: 'homepage'};
        const evt = {preventDefault: jest.fn()};
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
