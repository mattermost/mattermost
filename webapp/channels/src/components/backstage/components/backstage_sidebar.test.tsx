// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import type {ComponentProps} from 'react';
import {MemoryRouter} from 'react-router-dom';

import {renderWithContext, screen} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import BackstageSidebar from './backstage_sidebar';

// Mock permission gates to render their children
jest.mock('components/permissions_gates/team_permission_gate', () => ({children}: {children: React.ReactNode}) => <>{children}</>);
jest.mock('components/permissions_gates/system_permission_gate', () => ({children}: {children: React.ReactNode}) => <>{children}</>);

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

    // Helper to render with router at integrations path to show children
    const renderAtIntegrationsPath = (props: ComponentProps<typeof BackstageSidebar>) => {
        return renderWithContext(
            <MemoryRouter initialEntries={['/team_name/integrations']}>
                <BackstageSidebar {...props}/>
            </MemoryRouter>,
        );
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
                renderAtIntegrationsPath(props);

                if (testCase.expectedResult) {
                    expect(screen.getByText('Custom Emoji')).toBeInTheDocument();
                } else {
                    expect(screen.queryByText('Custom Emoji')).not.toBeInTheDocument();
                }
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
                renderAtIntegrationsPath(props);

                if (testCase.expectedResult) {
                    expect(screen.getByText('Incoming Webhooks')).toBeInTheDocument();
                } else {
                    expect(screen.queryByText('Incoming Webhooks')).not.toBeInTheDocument();
                }
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
                renderAtIntegrationsPath(props);

                if (testCase.expectedResult) {
                    expect(screen.getByText('Outgoing Webhooks')).toBeInTheDocument();
                } else {
                    expect(screen.queryByText('Outgoing Webhooks')).not.toBeInTheDocument();
                }
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
                renderAtIntegrationsPath(props);

                if (testCase.expectedResult) {
                    expect(screen.getByText('Slash Commands')).toBeInTheDocument();
                } else {
                    expect(screen.queryByText('Slash Commands')).not.toBeInTheDocument();
                }
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
                renderAtIntegrationsPath(props);

                if (testCase.expectedResult) {
                    expect(screen.getByText('OAuth 2.0 Applications')).toBeInTheDocument();
                } else {
                    expect(screen.queryByText('OAuth 2.0 Applications')).not.toBeInTheDocument();
                }
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
                renderAtIntegrationsPath(props);

                if (testCase.expectedResult) {
                    expect(screen.getByText('Outgoing OAuth 2.0 Connections')).toBeInTheDocument();
                } else {
                    expect(screen.queryByText('Outgoing OAuth 2.0 Connections')).not.toBeInTheDocument();
                }
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
                renderAtIntegrationsPath(props);

                if (testCase.expectedResult) {
                    expect(screen.getByText('Bot Accounts')).toBeInTheDocument();
                } else {
                    expect(screen.queryByText('Bot Accounts')).not.toBeInTheDocument();
                }
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
            renderAtIntegrationsPath(props);

            expect(screen.getByText('Incoming Webhooks')).toBeInTheDocument();
            expect(screen.getByText('Outgoing Webhooks')).toBeInTheDocument();
            expect(screen.getByText('Slash Commands')).toBeInTheDocument();
            expect(screen.getByText('OAuth 2.0 Applications')).toBeInTheDocument();
            expect(screen.getByText('Outgoing OAuth 2.0 Connections')).toBeInTheDocument();
            expect(screen.getByText('Bot Accounts')).toBeInTheDocument();
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
            renderAtIntegrationsPath(props);

            expect(screen.queryByText('Incoming Webhooks')).not.toBeInTheDocument();
            expect(screen.queryByText('Outgoing Webhooks')).not.toBeInTheDocument();
            expect(screen.queryByText('Slash Commands')).not.toBeInTheDocument();
            expect(screen.queryByText('OAuth 2.0 Applications')).not.toBeInTheDocument();
            expect(screen.queryByText('Outgoing OAuth 2.0 Connections')).not.toBeInTheDocument();
            expect(screen.queryByText('Bot Accounts')).not.toBeInTheDocument();
        });
    });
});
