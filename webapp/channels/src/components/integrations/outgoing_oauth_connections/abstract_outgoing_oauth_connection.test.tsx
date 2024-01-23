// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {shallow} from 'enzyme';
import React from 'react';

import type {OutgoingOAuthConnection} from '@mattermost/types/integrations';

import AbstractOutgoingOAuthConnection from 'components/integrations/outgoing_oauth_connections/abstract_outgoing_oauth_connection';

import {TestHelper} from 'utils/test_helper';

describe('components/integrations/AbstractOutgoingOAuthConnection', () => {
    const header = {id: 'Header', defaultMessage: 'Header'};
    const footer = {id: 'Footer', defaultMessage: 'Footer'};
    const loading = {id: 'Loading', defaultMessage: 'Loading'};
    const initialConnection: OutgoingOAuthConnection = {
        id: 'facxd9wpzpbpfp8pad78xj75pr',
        name: 'testConnection',
        client_secret: '',
        client_id: 'clientid',
        create_at: 1501365458934,
        creator_id: '88oybd1dwfdoxpkpw1h5kpbyco',
        update_at: 1501365458934,
        grant_type: 'client_credentials',
        oauth_token_url: 'https://token.com',
        audiences: ['https://aud.com'],
    };

    const action = jest.fn().mockImplementation(
        () => {
            return new Promise<void>((resolve) => {
                process.nextTick(() => resolve());
            });
        },
    );

    const team = TestHelper.getTeamMock({name: 'test', id: initialConnection.id});

    const baseProps: React.ComponentProps<typeof AbstractOutgoingOAuthConnection> = {
        team,
        header,
        footer,
        loading,
        renderExtra: <div>{'renderExtra'}</div>,
        serverError: '',
        initialConnection,
        action: jest.fn(),
    };

    test('should match snapshot', () => {
        const wrapper = shallow(
            <AbstractOutgoingOAuthConnection {...baseProps}/>,
        );
        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot, displays client error', () => {
        const newServerError = 'serverError';
        const props = {...baseProps, serverError: newServerError};
        const wrapper = shallow(
            <AbstractOutgoingOAuthConnection {...props}/>,
        );

        wrapper.find('#audienceUrls').simulate('change', {target: {value: ''}});
        wrapper.find('.btn-primary').simulate('click', {preventDefault() {
            return jest.fn();
        }});

        expect(action).not.toBeCalled();
        expect(wrapper).toMatchSnapshot();
        expect(wrapper.find('FormError').exists()).toBe(true);
    });

    test('should call action function', () => {
        const props = {...baseProps, action};
        const wrapper = shallow(
            <AbstractOutgoingOAuthConnection {...props}/>,
        );

        wrapper.find('#name').simulate('change', {target: {value: 'name'}});
        wrapper.find('.btn-primary').simulate('click', {preventDefault() {
            return jest.fn();
        }});

        expect(action).toBeCalled();
    });
});
