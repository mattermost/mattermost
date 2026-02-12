// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {UserProfile} from '@mattermost/types/users';
import type {DeepPartial} from '@mattermost/types/utilities';

import {renderWithContext, screen, userEvent} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import type {GlobalState} from 'types/store';

import ProductMenuList from './product_menu_list';
import type {Props as ProductMenuListProps} from './product_menu_list';

jest.mock('components/widgets/menu/menu_items/menu_cloud_trial', () => () => null);
jest.mock('components/widgets/menu/menu_items/menu_item_cloud_limit', () => () => null);
jest.mock('components/permissions_gates/system_permission_gate', () => ({children}: {children: React.ReactNode}) => <>{children}</>);
jest.mock('components/permissions_gates/team_permission_gate', () => ({children}: {children: React.ReactNode}) => <>{children}</>);
jest.mock('components/onboarding_tasks', () => ({
    VisitSystemConsoleTour: () => null,
}));
jest.mock('components/widgets/menu/menu_items/restricted_indicator', () => () => <div data-testid='RestrictedIndicator'/>);

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
        onClick: () => jest.fn,
        handleVisitConsoleClick: () => jest.fn,
        enableCustomUserGroups: false,
        actions: {
            openModal: jest.fn(),
            getPrevTrialLicense: jest.fn(),
        },
    };

    const adminState: DeepPartial<GlobalState> = {
        entities: {
            users: {
                currentUserId: 'test-user-id',
                profiles: {
                    'test-user-id': {
                        id: 'test-user-id',
                        username: 'username',
                        roles: 'system_admin system_user',
                    } as UserProfile,
                },
            },
        },
    };

    const nonAdminState: DeepPartial<GlobalState> = {
        entities: {
            users: {
                currentUserId: 'test-user-id',
                profiles: {
                    'test-user-id': {
                        id: 'test-user-id',
                        username: 'username',
                        roles: 'system_user',
                    } as UserProfile,
                },
            },
        },
    };

    test('should match snapshot with id', () => {
        const props = {...defaultProps, id: 'product-switcher-menu-test'};
        const {container} = renderWithContext(<ProductMenuList {...props}/>, adminState);
        expect(container).toMatchSnapshot();
    });

    test('should not render if the user is not logged in', () => {
        const props = {
            ...defaultProps,
            currentUser: undefined as unknown as UserProfile,
        };
        const {container} = renderWithContext(<ProductMenuList {...props}/>, adminState);
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
        const {container} = renderWithContext(<ProductMenuList {...props}/>, adminState);
        expect(container).toMatchSnapshot();
    });

    test('should match userGroups snapshot with cloud free', () => {
        const props = {
            ...defaultProps,
            enableCustomUserGroups: false,
            isStarterFree: true,
            isFreeTrial: false,
        };
        const {container} = renderWithContext(<ProductMenuList {...props}/>, adminState);
        expect(container.querySelector('#userGroups')).toMatchSnapshot();
    });

    test('should match userGroups snapshot with cloud free trial', () => {
        const props = {
            ...defaultProps,
            enableCustomUserGroups: false,
            isStarterFree: false,
            isFreeTrial: true,
        };
        const {container} = renderWithContext(<ProductMenuList {...props}/>, adminState);
        expect(container.querySelector('#userGroups')).toMatchSnapshot();
    });

    test('should match userGroups snapshot with EnableCustomGroups config', () => {
        const props = {
            ...defaultProps,
            enableCustomUserGroups: true,
            isStarterFree: false,
            isFreeTrial: false,
        };
        const {container} = renderWithContext(<ProductMenuList {...props}/>, adminState);
        expect(container.querySelector('#userGroups')).toMatchSnapshot();
    });

    test('user groups button is disabled for free', () => {
        const props = {
            ...defaultProps,
            enableCustomUserGroups: true,
            isStarterFree: true,
            isFreeTrial: false,
        };
        const {container} = renderWithContext(<ProductMenuList {...props}/>, adminState);
        expect(container.querySelector('#userGroups button')).toBeDisabled();
    });

    test('should hide RestrictedIndicator if user is not admin', () => {
        const props = {
            ...defaultProps,
            isStarterFree: true,
        };

        const {container} = renderWithContext(<ProductMenuList {...props}/>, nonAdminState);

        expect(container.querySelector('[data-testid="RestrictedIndicator"]')).toBeNull();
    });

    describe('should show integrations', () => {
        it('when incoming webhooks enabled', () => {
            const props = {
                ...defaultProps,
                enableIncomingWebhooks: true,
            };
            const {container} = renderWithContext(<ProductMenuList {...props}/>, adminState);
            expect(container.querySelector('#integrations')).not.toBeNull();
        });

        it('when outgoing webhooks enabled', () => {
            const props = {
                ...defaultProps,
                enableOutgoingWebhooks: true,
            };
            const {container} = renderWithContext(<ProductMenuList {...props}/>, adminState);
            expect(container.querySelector('#integrations')).not.toBeNull();
        });

        it('when slash commands enabled', () => {
            const props = {
                ...defaultProps,
                enableCommands: true,
            };
            const {container} = renderWithContext(<ProductMenuList {...props}/>, adminState);
            expect(container.querySelector('#integrations')).not.toBeNull();
        });

        it('when oauth providers enabled', () => {
            const props = {
                ...defaultProps,
                enableOAuthServiceProvider: true,
            };
            const {container} = renderWithContext(<ProductMenuList {...props}/>, adminState);
            expect(container.querySelector('#integrations')).not.toBeNull();
        });

        it('when can manage system bots', () => {
            const props = {
                ...defaultProps,
                canManageSystemBots: true,
            };
            const {container} = renderWithContext(<ProductMenuList {...props}/>, adminState);
            expect(container.querySelector('#integrations')).not.toBeNull();
        });

        it('unless cannot manage integrations', () => {
            const props = {
                ...defaultProps,
                canManageIntegrations: false,
                enableCommands: true,
            };
            const {container} = renderWithContext(<ProductMenuList {...props}/>, adminState);
            expect(container.querySelector('#integrations')).toBeNull();
        });

        it('should show integrations modal', async () => {
            const props = {
                ...defaultProps,
                enableIncomingWebhooks: true,
                teamName: 'test-team',
            };
            const {container} = renderWithContext(<ProductMenuList {...props}/>, adminState);
            await userEvent.click(screen.getByText('Integrations'));
            expect(container).toMatchSnapshot();
        });
    });
});
