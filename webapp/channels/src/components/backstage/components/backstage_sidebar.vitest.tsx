// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import type {ComponentProps, ReactNode} from 'react';

import {renderWithContext, screen} from 'tests/vitest_react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import BackstageSidebar from './backstage_sidebar';

// Mock the BackstageCategory component to make it testable with RTL
vi.mock('./backstage_category', () => ({
    __esModule: true,
    default: ({name, children}: {name: string; children?: ReactNode}) => (
        <div data-testid={`backstage-category-${name}`}>
            {children}
        </div>
    ),
}));

// Mock BackstageSection to make it testable
vi.mock('./backstage_section', () => ({
    __esModule: true,
    default: ({name}: {name: string}) => (
        <div data-testid={`backstage-section-${name}`}/>
    ),
}));

// Mock permission gates to render children directly
vi.mock('components/permissions_gates/system_permission_gate', () => ({
    __esModule: true,
    default: ({children}: {children: ReactNode}) => <>{children}</>,
}));

vi.mock('components/permissions_gates/team_permission_gate', () => ({
    __esModule: true,
    default: ({children}: {children: ReactNode}) => <>{children}</>,
}));

describe('components/backstage/components/BackstageSidebar', () => {
    const defaultProps: ComponentProps<typeof BackstageSidebar> = {
        team: TestHelper.getTeamMock({
            id: 'team-id',
            name: 'team_name',
        }),
        enableCustomEmoji: false,
        enableIncomingWebhooks: false,
        enableOutgoingWebhooks: false,
        enableCommands: false,
        enableOAuthServiceProvider: false,
        canCreateOrDeleteCustomEmoji: false,
        canManageIntegrations: false,
        enableOutgoingOAuthConnections: false,
    };

    const categoryExists = (name: string) => {
        return screen.queryByTestId(`backstage-category-${name}`) !== null;
    };

    const sectionExists = (name: string) => {
        return screen.queryByTestId(`backstage-section-${name}`) !== null;
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
                renderWithContext(
                    <BackstageSidebar {...props}/>,
                );

                expect(categoryExists('emoji')).toBe(testCase.expectedResult);
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
                renderWithContext(
                    <BackstageSidebar {...props}/>,
                );

                expect(sectionExists('incoming_webhooks')).toBe(testCase.expectedResult);
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
                renderWithContext(
                    <BackstageSidebar {...props}/>,
                );

                expect(sectionExists('outgoing_webhooks')).toBe(testCase.expectedResult);
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
                renderWithContext(
                    <BackstageSidebar {...props}/>,
                );

                expect(sectionExists('commands')).toBe(testCase.expectedResult);
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
                renderWithContext(
                    <BackstageSidebar {...props}/>,
                );

                expect(sectionExists('oauth2-apps')).toBe(testCase.expectedResult);
            });
        });
    });

    describe('outgoing oauth connections', () => {
        const testCases = [
            {canManageIntegrations: false, enableOutgoingOAuthConnections: false, expectedResult: false},
            {canManageIntegrations: false, enableOutgoingOAuthConnections: true, expectedResult: false},
            {canManageIntegrations: true, enableOutgoingOAuthConnections: false, expectedResult: false},
            {canManageIntegrations: true, enableOutgoingOAuthConnections: true, expectedResult: true},
        ];

        testCases.forEach((testCase) => {
            it(`when outgoing oauth connections is ${testCase.enableOutgoingOAuthConnections} and can manage integrations is ${testCase.canManageIntegrations}`, () => {
                const props = {
                    ...defaultProps,
                    enableOutgoingOAuthConnections: testCase.enableOutgoingOAuthConnections,
                    canManageIntegrations: testCase.canManageIntegrations,
                };
                renderWithContext(
                    <BackstageSidebar {...props}/>,
                );

                expect(sectionExists('outgoing-oauth2-connections')).toBe(testCase.expectedResult);
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
                renderWithContext(
                    <BackstageSidebar {...props}/>,
                );

                expect(sectionExists('bots')).toBe(testCase.expectedResult);
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
                enableOutgoingOAuthConnections: true,
            };
            renderWithContext(
                <BackstageSidebar {...props}/>,
            );

            expect(sectionExists('incoming_webhooks')).toBe(true);
            expect(sectionExists('outgoing_webhooks')).toBe(true);
            expect(sectionExists('commands')).toBe(true);
            expect(sectionExists('oauth2-apps')).toBe(true);
            expect(sectionExists('outgoing-oauth2-connections')).toBe(true);
            expect(sectionExists('bots')).toBe(true);
        });

        it('cannot manage integrations', () => {
            const props = {
                ...defaultProps,
                enableIncomingWebhooks: true,
                enableOutgoingWebhooks: true,
                enableCommands: true,
                enableOAuthServiceProvider: true,
                enableOutgoingOAuthConnections: true,
                canManageIntegrations: false,
            };
            renderWithContext(
                <BackstageSidebar {...props}/>,
            );

            expect(sectionExists('incoming_webhooks')).toBe(false);
            expect(sectionExists('outgoing_webhooks')).toBe(false);
            expect(sectionExists('commands')).toBe(false);
            expect(sectionExists('oauth2-apps')).toBe(false);
            expect(sectionExists('outgoing-oauth2-connections')).toBe(false);
            expect(sectionExists('bots')).toBe(false);
        });
    });
});
