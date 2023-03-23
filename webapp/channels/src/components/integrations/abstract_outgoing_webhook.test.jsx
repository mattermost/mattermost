// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {shallow} from 'enzyme';

import AbstractOutgoingWebhook from 'components/integrations/abstract_outgoing_webhook';

describe('components/integrations/AbstractOutgoingWebhook', () => {
    const emptyFunction = jest.fn();
    const props = {
        team: {
            id: 'test-team-id',
            name: 'test',
        },
        action: emptyFunction,
        enablePostUsernameOverride: false,
        enablePostIconOverride: false,
        header: {id: 'add', defaultMessage: 'add'},
        footer: {id: 'save', defaultMessage: 'save'},
        loading: {id: 'loading', defaultMessage: 'loading'},
        renderExtra: '',
        serverError: '',
    };

    test('should match snapshot', () => {
        const wrapper = shallow(<AbstractOutgoingWebhook {...props}/>);
        expect(wrapper).toMatchSnapshot();
    });

    test('should render username in case of enablePostUsernameOverride is true ', () => {
        const usernameTrueProps = {...props, enablePostUsernameOverride: true};
        const wrapper = shallow(<AbstractOutgoingWebhook {...usernameTrueProps}/>);
        expect(wrapper.find('#username')).toHaveLength(1);
    });

    test('should render username in case of enablePostUsernameOverride is true ', () => {
        const iconUrlTrueProps = {...props, enablePostIconOverride: true};
        const wrapper = shallow(<AbstractOutgoingWebhook {...iconUrlTrueProps}/>);
        expect(wrapper.find('#iconURL')).toHaveLength(1);
    });
});
