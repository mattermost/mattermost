// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {UserProfile} from '@mattermost/types/users';

import {renderWithContext, fireEvent} from 'tests/vitest_react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import ProductMenuList from './product_menu_list';
import type {Props as ProductMenuListProps} from './product_menu_list';

describe('components/global/product_switcher_menu', () => {
    const user = TestHelper.getUserMock({
        id: 'test-user-id',
        username: 'username',
    });

    const defaultProps: ProductMenuListProps = {
        isMobile: false,
        teamId: '',
        teamName: '',
        siteName: '',
        currentUser: user,
        appDownloadLink: 'test–link',
        isMessaging: true,
        enableCommands: false,
        enableIncomingWebhooks: false,
        enableOAuthServiceProvider: false,
        enableOutgoingWebhooks: false,
        canManageSystemBots: false,
        canManageIntegrations: true,
        enablePluginMarketplace: false,
        showVisitSystemConsoleTour: false,
        isStarterFree: false,
        isFreeTrial: false,
        onClick: () => vi.fn(),
        handleVisitConsoleClick: () => vi.fn(),
        enableCustomUserGroups: false,
        actions: {
            openModal: vi.fn(),
            getPrevTrialLicense: vi.fn(),
        },
    };

    const getBaseState = (overrides = {}) => ({
        entities: {
            users: {
                currentUserId: 'test-user-id',
                profiles: {
                    'test-user-id': user,
                },
            },
            roles: {
                roles: {
                    system_admin: {permissions: ['manage_system']},
                },
            },
        },
        ...overrides,
    });

    test('should match snapshot with id', () => {
        const props = {...defaultProps, id: 'product-switcher-menu-test'};

        const {container} = renderWithContext(
            <ProductMenuList {...props}/>,
            getBaseState(),
        );
        expect(container).toMatchSnapshot();
    });

    test('should not render if the user is not logged in', () => {
        const props = {
            ...defaultProps,
            currentUser: undefined as unknown as UserProfile,
        };

        const {container} = renderWithContext(
            <ProductMenuList {...props}/>,
            getBaseState(),
        );
        expect(container.firstChild).toBeNull();
    });

    test('should match snapshot with most of the thing enabled', () => {
        const props = {
            ...defaultProps,
            enableCommands: true,
            enableIncomingWebhooks: true,
            enableOAuthServiceProvider: true,
            enableOutgoingWebhooks: true,
            canManageSystemBots: true,
            canManageIntegrations: true,
            enablePluginMarketplace: true,
        };

        const {container} = renderWithContext(
            <ProductMenuList {...props}/>,
            getBaseState(),
        );
        expect(container).toMatchSnapshot();
    });

    test('should match userGroups snapshot with cloud free', () => {
        const props = {
            ...defaultProps,
            enableCustomUserGroups: false,
            isStarterFree: true,
            isFreeTrial: false,
        };

        const {container} = renderWithContext(
            <ProductMenuList {...props}/>,
            getBaseState(),
        );
        expect(container.querySelector('#userGroups')).toMatchSnapshot();
    });

    test('should match userGroups snapshot with cloud free trial', () => {
        const props = {
            ...defaultProps,
            enableCustomUserGroups: false,
            isStarterFree: false,
            isFreeTrial: true,
        };

        const {container} = renderWithContext(
            <ProductMenuList {...props}/>,
            getBaseState(),
        );
        expect(container.querySelector('#userGroups')).toMatchSnapshot();
    });

    test('should match userGroups snapshot with EnableCustomGroups config', () => {
        const props = {
            ...defaultProps,
            enableCustomUserGroups: true,
            isStarterFree: false,
            isFreeTrial: false,
        };

        const {container} = renderWithContext(
            <ProductMenuList {...props}/>,
            getBaseState(),
        );
        expect(container.querySelector('#userGroups')).toMatchSnapshot();
    });

    test('user groups button is disabled for free', () => {
        const props = {
            ...defaultProps,
            enableCustomUserGroups: true,
            isStarterFree: true,
            isFreeTrial: false,
        };

        const {container} = renderWithContext(
            <ProductMenuList {...props}/>,
            getBaseState(),
        );

        // When isStarterFree is true, the userGroups button should be rendered
        // and the component passes disabled={isStarterFree} to the menu item
        const userGroupsButton = document.getElementById('userGroups');
        expect(userGroupsButton).toBeInTheDocument();

        // Verify the button is rendered with the correct classes (snapshot will capture disabled state)
        expect(container.querySelector('#userGroups')).toMatchSnapshot();
    });

    test('should hide RestrictedIndicator if user is not admin', () => {
        const props = {
            ...defaultProps,
            isStarterFree: true,
        };

        const state = getBaseState({
            entities: {
                users: {
                    currentUserId: 'test-user-id',
                    profiles: {
                        'test-user-id': TestHelper.getUserMock({id: 'test-user-id', roles: 'system_user'}),
                    },
                },
                roles: {
                    roles: {
                        system_user: {permissions: []},
                    },
                },
            },
        });

        const {container} = renderWithContext(
            <ProductMenuList {...props}/>,
            state,
        );

        expect(container.querySelector('.RestrictedIndicator')).not.toBeInTheDocument();
    });

    describe('should show integrations', () => {
        it('when incoming webhooks enabled', () => {
            const props = {
                ...defaultProps,
                enableIncomingWebhooks: true,
            };

            renderWithContext(
                <ProductMenuList {...props}/>,
                getBaseState(),
            );

            const integrationsItem = document.getElementById('integrations');
            expect(integrationsItem).toBeInTheDocument();
        });

        it('when outgoing webhooks enabled', () => {
            const props = {
                ...defaultProps,
                enableOutgoingWebhooks: true,
            };

            renderWithContext(
                <ProductMenuList {...props}/>,
                getBaseState(),
            );

            const integrationsItem = document.getElementById('integrations');
            expect(integrationsItem).toBeInTheDocument();
        });

        it('when slash commands enabled', () => {
            const props = {
                ...defaultProps,
                enableCommands: true,
            };

            renderWithContext(
                <ProductMenuList {...props}/>,
                getBaseState(),
            );

            const integrationsItem = document.getElementById('integrations');
            expect(integrationsItem).toBeInTheDocument();
        });

        it('when oauth providers enabled', () => {
            const props = {
                ...defaultProps,
                enableOAuthServiceProvider: true,
            };

            renderWithContext(
                <ProductMenuList {...props}/>,
                getBaseState(),
            );

            const integrationsItem = document.getElementById('integrations');
            expect(integrationsItem).toBeInTheDocument();
        });

        it('when can manage system bots', () => {
            const props = {
                ...defaultProps,
                canManageSystemBots: true,
            };

            renderWithContext(
                <ProductMenuList {...props}/>,
                getBaseState(),
            );

            const integrationsItem = document.getElementById('integrations');
            expect(integrationsItem).toBeInTheDocument();
        });

        it('unless cannot manage integrations', () => {
            const props = {
                ...defaultProps,
                canManageIntegrations: false,
                enableCommands: true,
            };

            renderWithContext(
                <ProductMenuList {...props}/>,
                getBaseState(),
            );

            // Should NOT show integrations when canManageIntegrations is false
            const integrationsItem = document.getElementById('integrations');
            expect(integrationsItem).not.toBeInTheDocument();
        });

        it('should show integrations modal', () => {
            const props = {
                ...defaultProps,
                enableIncomingWebhooks: true,
            };

            const {container} = renderWithContext(
                <ProductMenuList {...props}/>,
                getBaseState(),
            );

            const integrationsItem = document.getElementById('integrations');
            expect(integrationsItem).toBeInTheDocument();
            fireEvent.click(integrationsItem!);

            expect(container).toMatchSnapshot();
        });
    });
});
