// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {shallow} from 'enzyme';
import React from 'react';
import {FormattedMessage} from 'react-intl';

import BackstageList from './backstage_list';

describe('components/backstage/components/BackstageList', () => {
    test('Should have the browsing hint', () => {
        const wrapper = shallow(
            <BackstageList
                header={
                    <FormattedMessage
                        id='installed_incoming_webhooks.header'
                        defaultMessage='Installed Incoming Webhooks'
                    />
                }
                hintText={
                    <FormattedMessage
                        id='installed_incoming_webhooks.hint'
                        defaultMessage='Search by title of the webhook or by associated channel. Examples: "My Webhook Title", "town-square", or "Town Square".'
                    />
                }
                loading={false}
            >
                {() => {
                    return [[], false];
                }}
            </BackstageList>,
        );
        expect(wrapper.find(FormattedMessage).length === 2).toBe(true);
    });

    test("Shouldn't have the browsing hint", () => {
        const wrapper = shallow(
            <BackstageList
                header={
                    <FormattedMessage
                        id='installed_incoming_webhooks.header'
                        defaultMessage='Installed Incoming Webhooks'
                    />
                }
                loading={false}
            >
                {() => {
                    return [[], false];
                }}
            </BackstageList>,
        );
        expect(wrapper.find(FormattedMessage).length === 1).toBe(true);
    });

    test('Should match snapshot with browsing hint', () => {
        const wrapper = shallow(
            <BackstageList
                header={
                    <FormattedMessage
                        id='installed_incoming_webhooks.header'
                        defaultMessage='Installed Incoming Webhooks'
                    />
                }
                hintText={
                    <FormattedMessage
                        id='installed_incoming_webhooks.hint'
                        defaultMessage='Search by title of the webhook or by associated channel. Examples: "My Webhook Title", "town-square", or "Town Square".'
                    />
                }
                loading={false}
            >
                {() => {
                    return [[], false];
                }}
            </BackstageList>,
        );
        expect(wrapper).toMatchSnapshot();
    });

    test('Should match snapshot without browsing hint', () => {
        const wrapper = shallow(
            <BackstageList
                header={
                    <FormattedMessage
                        id='installed_incoming_webhooks.header'
                        defaultMessage='Installed Incoming Webhooks'
                    />
                }
                loading={false}
            >
                {() => {
                    return [[], false];
                }}
            </BackstageList>,
        );
        expect(wrapper).toMatchSnapshot();
    });
});
