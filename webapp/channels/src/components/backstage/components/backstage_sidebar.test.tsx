// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {shallow} from 'enzyme';
import React from 'react';

import {TestHelper} from 'utils/test_helper';

import BackstageCategory from './backstage_category';
import BackstageSidebar from './backstage_sidebar';

import type {ComponentProps} from 'react';

describe('components/backstage/components/BackstageSidebar', () => {
    const defaultProps: ComponentProps<typeof BackstageSidebar> = {
        team: TestHelper.getTeamMock({
            id: 'team-id',
            name: 'team_name',
        }),
        user: TestHelper.getUserMock({}),
        enableCustomEmoji: false,
        enableIncomingWebhooks: false,
        enableOutgoingWebhooks: false,
        enableCommands: false,
        enableOAuthServiceProvider: false,
        canCreateOrDeleteCustomEmoji: false,
        canManageIntegrations: false,
    };

    describe('custom emoji', () => {
        const testCases = [
            {enableCustomEmoji: false, canCreateOrDeleteCustomEmoji: false, expectedResult: false},
            {enableCustomEmoji: false, canCreateOrDeleteCustomEmoji: true, expectedResult: false},
            {enableCustomEmoji: true, canCreateOrDeleteCustomEmoji: false, expectedResult: false},
            {enableCustomEmoji: true, canCreateOrDeleteCustomEmoji: true, expectedResult: true},
        ];

        testCases.forEach((testCase) => {
            it(`when custom emoji is ${testCase.enableCustomEmoji} and can create/delete is ${testCase.canCreateOrDeleteCustomEmoji}`, () => {
                const props = {
                    ...defaultProps,
                    enableCustomEmoji: testCase.enableCustomEmoji,
                    canCreateOrDeleteCustomEmoji: testCase.canCreateOrDeleteCustomEmoji,
                };
                const wrapper = shallow(
                    <BackstageSidebar {...props}/>,
                );

                expect(wrapper.find(BackstageCategory).find({name: 'emoji'}).exists()).toBe(testCase.expectedResult);
            });
        });
    });

    describe('incoming webhooks', () => {
        const testCases = [
            {canManageIntegrations: false, enableIncomingWebhooks: false, expectedResult: false},
            {canManageIntegrations: false, enableIncomingWebhooks: true, expectedResult: false},
            {canManageIntegrations: true, enableIncomingWebhooks: false, expectedResult: false},
            {canManageIntegrations: true, enableIncomingWebhooks: true, expectedResult: true},
        ];

        testCases.forEach((testCase) => {
            it(`when incoming webhooks is ${testCase.enableIncomingWebhooks} and can manage integrations is ${testCase.canManageIntegrations}`, () => {
                const props = {
                    ...defaultProps,
                    enableIncomingWebhooks: testCase.enableIncomingWebhooks,
                    canManageIntegrations: testCase.canManageIntegrations,
                };
                const wrapper = shallow(
                    <BackstageSidebar {...props}/>,
                );

                expect(wrapper.find(BackstageCategory).find({name: 'incoming_webhooks'}).exists()).toBe(testCase.expectedResult);
            });
        });
    });

    describe('outgoing webhooks', () => {
        const testCases = [
            {canManageIntegrations: false, enableOutgoingWebhooks: false, expectedResult: false},
            {canManageIntegrations: false, enableOutgoingWebhooks: true, expectedResult: false},
            {canManageIntegrations: true, enableOutgoingWebhooks: false, expectedResult: false},
            {canManageIntegrations: true, enableOutgoingWebhooks: true, expectedResult: true},
        ];

        testCases.forEach((testCase) => {
            it(`when outgoing webhooks is ${testCase.enableOutgoingWebhooks} and can manage integrations is ${testCase.canManageIntegrations}`, () => {
                const props = {
                    ...defaultProps,
                    enableOutgoingWebhooks: testCase.enableOutgoingWebhooks,
                    canManageIntegrations: testCase.canManageIntegrations,
                };
                const wrapper = shallow(
                    <BackstageSidebar {...props}/>,
                );

                expect(wrapper.find(BackstageCategory).find({name: 'outgoing_webhooks'}).exists()).toBe(testCase.expectedResult);
            });
        });
    });

    describe('commands', () => {
        const testCases = [
            {canManageIntegrations: false, enableCommands: false, expectedResult: false},
            {canManageIntegrations: false, enableCommands: true, expectedResult: false},
            {canManageIntegrations: true, enableCommands: false, expectedResult: false},
            {canManageIntegrations: true, enableCommands: true, expectedResult: true},
        ];

        testCases.forEach((testCase) => {
            it(`when commands is ${testCase.enableCommands} and can manage integrations is ${testCase.canManageIntegrations}`, () => {
                const props = {
                    ...defaultProps,
                    enableCommands: testCase.enableCommands,
                    canManageIntegrations: testCase.canManageIntegrations,
                };
                const wrapper = shallow(
                    <BackstageSidebar {...props}/>,
                );

                expect(wrapper.find(BackstageCategory).find({name: 'commands'}).exists()).toBe(testCase.expectedResult);
            });
        });
    });

    describe('oauth2 apps', () => {
        const testCases = [
            {canManageIntegrations: false, enableOAuthServiceProvider: false, expectedResult: false},
            {canManageIntegrations: false, enableOAuthServiceProvider: true, expectedResult: false},
            {canManageIntegrations: true, enableOAuthServiceProvider: false, expectedResult: false},
            {canManageIntegrations: true, enableOAuthServiceProvider: true, expectedResult: true},
        ];

        testCases.forEach((testCase) => {
            it(`when oauth2 apps is ${testCase.enableOAuthServiceProvider} and can manage integrations is ${testCase.canManageIntegrations}`, () => {
                const props = {
                    ...defaultProps,
                    enableOAuthServiceProvider: testCase.enableOAuthServiceProvider,
                    canManageIntegrations: testCase.canManageIntegrations,
                };
                const wrapper = shallow(
                    <BackstageSidebar {...props}/>,
                );

                expect(wrapper.find(BackstageCategory).find({name: 'oauth2-apps'}).exists()).toBe(testCase.expectedResult);
            });
        });
    });

    describe('bots', () => {
        const testCases = [
            {canManageIntegrations: false, expectedResult: false},
            {canManageIntegrations: true, expectedResult: true},
        ];

        testCases.forEach((testCase) => {
            it(`when can manage integrations is ${testCase.canManageIntegrations}`, () => {
                const props = {
                    ...defaultProps,
                    canManageIntegrations: testCase.canManageIntegrations,
                };
                const wrapper = shallow(
                    <BackstageSidebar {...props}/>,
                );

                expect(wrapper.find(BackstageCategory).find({name: 'bots'}).exists()).toBe(testCase.expectedResult);
            });
        });
    });

    describe('all integrations', () => {
        it('can manage integrations', () => {
            const props = {
                ...defaultProps,
                enableIncomingWebhooks: true,
                enableOutgoingWebhooks: true,
                enableCommands: true,
                enableOAuthServiceProvider: true,
                canManageIntegrations: true,
            };
            const wrapper = shallow(
                <BackstageSidebar {...props}/>,
            );

            expect(wrapper.find(BackstageCategory).find({name: 'incoming_webhooks'}).exists()).toBe(true);
            expect(wrapper.find(BackstageCategory).find({name: 'outgoing_webhooks'}).exists()).toBe(true);
            expect(wrapper.find(BackstageCategory).find({name: 'commands'}).exists()).toBe(true);
            expect(wrapper.find(BackstageCategory).find({name: 'oauth2-apps'}).exists()).toBe(true);
            expect(wrapper.find(BackstageCategory).find({name: 'bots'}).exists()).toBe(true);
        });

        it('cannot manage integrations', () => {
            const props = {
                ...defaultProps,
                enableIncomingWebhooks: true,
                enableOutgoingWebhooks: true,
                enableCommands: true,
                enableOAuthServiceProvider: true,
                canManageIntegrations: false,
            };
            const wrapper = shallow(
                <BackstageSidebar {...props}/>,
            );

            expect(wrapper.find(BackstageCategory).find({name: 'incoming_webhooks'}).exists()).toBe(false);
            expect(wrapper.find(BackstageCategory).find({name: 'outgoing_webhooks'}).exists()).toBe(false);
            expect(wrapper.find(BackstageCategory).find({name: 'commands'}).exists()).toBe(false);
            expect(wrapper.find(BackstageCategory).find({name: 'oauth2-apps'}).exists()).toBe(false);
            expect(wrapper.find(BackstageCategory).find({name: 'bots'}).exists()).toBe(false);
        });
    });
});
