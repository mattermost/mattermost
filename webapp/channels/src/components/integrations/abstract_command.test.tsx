// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {FormEvent} from 'react';
import {shallow} from 'enzyme';
import {FormattedMessage} from 'react-intl';

import AbstractCommand from 'components/integrations/abstract_command';
import {TestHelper} from 'utils/test_helper';

describe('components/integrations/AbstractCommand', () => {
    const header = {id: 'Header', defaultMessage: 'Header'};
    const footer = {id: 'Footer', defaultMessage: 'Footer'};
    const loading = {id: 'Loading', defaultMessage: 'Loading'};
    const method: 'G' | 'P' | '' = 'G';
    const command = {
        id: 'r5tpgt4iepf45jt768jz84djic',
        display_name: 'display_name',
        description: 'description',
        trigger: 'trigger',
        auto_complete: true,
        auto_complete_hint: 'auto_complete_hint',
        auto_complete_desc: 'auto_complete_desc',
        token: 'jb6oyqh95irpbx8fo9zmndkp1r',
        create_at: 1499722850203,
        creator_id: '88oybd1dwfdoxpkpw1h5kpbyco',
        delete_at: 0,
        icon_url: 'https://google.com/icon',
        method,
        team_id: 'm5gix3oye3du8ghk4ko6h9cq7y',
        update_at: 1504468859001,
        url: 'https://google.com/command',
        username: 'username',
    };
    const team = TestHelper.getTeamMock({name: 'test', id: command.team_id});

    const action = jest.fn().mockImplementation(
        () => {
            return new Promise<void>((resolve) => {
                process.nextTick(() => resolve());
            });
        },
    );

    const baseProps = {
        team,
        header,
        footer,
        loading,
        renderExtra: <div>{'renderExtra'}</div>,
        serverError: '',
        initialCommand: command,
        action,
    };

    test('should match snapshot', () => {
        const wrapper = shallow<AbstractCommand>(
            <AbstractCommand {...baseProps}/>,
        );
        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot when header/footer/loading is a string', () => {
        const wrapper = shallow<AbstractCommand>(
            <AbstractCommand
                {...baseProps}
                header='Header as string'
                loading={'Loading as string'}
                footer={'Footer as string'}
            />,
        );
        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot, displays client error', () => {
        const newSeverError = 'server error';
        const props = {...baseProps, serverError: newSeverError};
        const wrapper = shallow<AbstractCommand>(
            <AbstractCommand {...props}/>,
        );

        wrapper.find('#trigger').simulate('change', {target: {value: ''}});
        wrapper.find('.btn-primary').simulate('click', {preventDefault: jest.fn()});

        expect(wrapper).toMatchSnapshot();
        expect(action).not.toBeCalled();
    });

    test('should call action function', () => {
        const wrapper = shallow<AbstractCommand>(
            <AbstractCommand {...baseProps}/>,
        );

        wrapper.find('#displayName').simulate('change', {target: {value: 'name'}});
        wrapper.find('.btn-primary').simulate('click', {preventDefault: jest.fn()});

        expect(action).toBeCalled();
    });

    test('should match object returned by getStateFromCommand', () => {
        const wrapper = shallow<AbstractCommand>(
            <AbstractCommand {...baseProps}/>,
        );

        const expectedOutput = {
            autocomplete: true,
            autocompleteDescription: 'auto_complete_desc',
            autocompleteHint: 'auto_complete_hint',
            clientError: null,
            description: 'description',
            displayName: 'display_name',
            iconUrl: 'https://google.com/icon',
            method: 'G',
            saving: false,
            trigger: 'trigger',
            url: 'https://google.com/command',
            username: 'username',
        };

        expect(wrapper.instance().getStateFromCommand(command)).toEqual(expectedOutput);
    });

    test('should match state when method is called', () => {
        const wrapper = shallow<AbstractCommand>(
            <AbstractCommand {...baseProps}/>,
        );
        const displayName = 'new display_name';
        const displayNameEvent = {preventDefault: jest.fn(), target: {value: displayName}} as any;
        wrapper.instance().updateDisplayName(displayNameEvent);
        expect(wrapper.state('displayName')).toEqual(displayName);

        const description = 'new description';
        const descriptionEvent = {preventDefault: jest.fn(), target: {value: description}} as any;
        wrapper.instance().updateDescription(descriptionEvent);
        expect(wrapper.state('description')).toEqual(description);

        const trigger = 'new trigger';
        const triggerEvent = {preventDefault: jest.fn(), target: {value: trigger}} as any;
        wrapper.instance().updateTrigger(triggerEvent);
        expect(wrapper.state('trigger')).toEqual(trigger);

        const url = 'new url';
        const urlEvent = {preventDefault: jest.fn(), target: {value: url}} as any;
        wrapper.instance().updateUrl(urlEvent);
        expect(wrapper.state('url')).toEqual(url);

        const method = 'P';
        const methodEvent = {preventDefault: jest.fn(), target: {value: method}} as any;
        wrapper.instance().updateMethod(methodEvent);
        expect(wrapper.state('method')).toEqual(method);

        const username = 'new username';
        const usernameEvent = {preventDefault: jest.fn(), target: {value: username}} as any;
        wrapper.instance().updateUsername(usernameEvent);
        expect(wrapper.state('username')).toEqual(username);

        const iconUrl = 'new iconUrl';
        const iconUrlEvent = {preventDefault: jest.fn(), target: {value: iconUrl}} as any;
        wrapper.instance().updateIconUrl(iconUrlEvent);
        expect(wrapper.state('iconUrl')).toEqual(iconUrl);

        const trueUpdateAutocompleteEvent = {target: {checked: true}} as any;
        const falseeUpdateAutocompleteEvent = {target: {checked: false}} as any;
        wrapper.instance().updateAutocomplete(trueUpdateAutocompleteEvent);
        expect(wrapper.state('autocomplete')).toEqual(true);
        wrapper.instance().updateAutocomplete(falseeUpdateAutocompleteEvent);
        expect(wrapper.state('autocomplete')).toEqual(false);

        const autocompleteHint = 'new autocompleteHint';
        const autocompleteHintEvent = {preventDefault: jest.fn(), target: {value: autocompleteHint}} as any;
        wrapper.instance().updateAutocompleteHint(autocompleteHintEvent);
        expect(wrapper.state('autocompleteHint')).toEqual(autocompleteHint);

        const autocompleteDescription = 'new autocompleteDescription';
        const autocompleteDescriptionEvent = {preventDefault: jest.fn(), target: {value: autocompleteDescription}} as any;
        wrapper.instance().updateAutocompleteDescription(autocompleteDescriptionEvent);
        expect(wrapper.state('autocompleteDescription')).toEqual(autocompleteDescription);
    });

    test('should match state when handleSubmit is called', () => {
        const newAction = jest.fn().mockImplementation(
            () => {
                return new Promise<void>((resolve) => {
                    process.nextTick(() => resolve());
                });
            },
        );
        const props = {...baseProps, action: newAction};
        const wrapper = shallow<AbstractCommand>(
            <AbstractCommand {...props}/>,
        );
        expect(newAction).toHaveBeenCalledTimes(0);

        const evt = {preventDefault: jest.fn()} as unknown as FormEvent<Element>;
        const handleSubmit = wrapper.instance().handleSubmit;
        handleSubmit(evt);
        expect(wrapper.state('saving')).toEqual(true);
        expect(wrapper.state('clientError')).toEqual('');
        expect(newAction).toHaveBeenCalledTimes(1);

        // saving is true
        wrapper.setState({saving: true});
        handleSubmit(evt);
        expect(wrapper.state('clientError')).toEqual('');
        expect(newAction).toHaveBeenCalledTimes(1);

        // empty trigger
        wrapper.setState({saving: false, trigger: ''});
        handleSubmit(evt);
        expect(wrapper.state('clientError')).toEqual(
            <FormattedMessage
                defaultMessage='A trigger word is required'
                id='add_command.triggerRequired'
            />,
        );
        expect(newAction).toHaveBeenCalledTimes(1);

        // trigger that starts with a slash '/'
        wrapper.setState({saving: false, trigger: '//startwithslash'});
        handleSubmit(evt);
        expect(wrapper.state('clientError')).toEqual(
            <FormattedMessage
                defaultMessage='A trigger word cannot begin with a /'
                id='add_command.triggerInvalidSlash'
            />,
        );
        expect(newAction).toHaveBeenCalledTimes(1);

        // trigger with space
        wrapper.setState({saving: false, trigger: '/trigger with space'});
        handleSubmit(evt);
        expect(wrapper.state('clientError')).toEqual(
            <FormattedMessage
                defaultMessage='A trigger word must not contain spaces'
                id='add_command.triggerInvalidSpace'
            />,
        );
        expect(newAction).toHaveBeenCalledTimes(1);

        // trigger above maximum length
        wrapper.setState({saving: false, trigger: '123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789'});
        handleSubmit(evt);
        expect(wrapper.state('clientError')).toEqual(
            <FormattedMessage
                defaultMessage='A trigger word must contain between {min} and {max} characters'
                id='add_command.triggerInvalidLength'
                values={{max: 128, min: 1}}
            />,
        );
        expect(newAction).toHaveBeenCalledTimes(1);

        // good triggers
        wrapper.setState({saving: false, trigger: '12345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678'});
        handleSubmit(evt);
        expect(wrapper.state('clientError')).toEqual('');
        expect(newAction).toHaveBeenCalledTimes(2);

        wrapper.setState({saving: false, trigger: '/trigger'});
        handleSubmit(evt);
        expect(wrapper.state('clientError')).toEqual('');
        expect(newAction).toHaveBeenCalledTimes(3);

        wrapper.setState({saving: false, trigger: 'trigger'});
        handleSubmit(evt);
        expect(wrapper.state('clientError')).toEqual('');
        expect(newAction).toHaveBeenCalledTimes(4);

        // empty url
        wrapper.setState({saving: false, trigger: 'trigger', url: ''});
        handleSubmit(evt);
        expect(wrapper.state('clientError')).toEqual(
            <FormattedMessage
                defaultMessage='A request URL is required'
                id='add_command.urlRequired'
            />,
        );
        expect(newAction).toHaveBeenCalledTimes(4);
    });
});
