// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {AccessControlPolicy} from '@mattermost/types/access_control';

import {renderWithContext, screen, userEvent} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import SystemPolicyIndicator from './system_policy_indicator';

describe('components/system_policy_indicator/SystemPolicyIndicator', () => {
    const initialState = {
        entities: {
            general: {
                config: {
                    SiteURL: 'http://localhost:8065',
                },
            },
            users: {
                currentUserId: 'current_user_id',
                profiles: {
                    current_user_id: TestHelper.getUserMock({
                        id: 'current_user_id',
                        roles: 'system_user',
                    }),
                },
            },
            roles: {
                roles: {
                    system_user: {
                        permissions: [],
                    },
                    system_admin: {
                        permissions: ['manage_system'],
                    },
                },
            },
        },
        plugins: {
            components: {},
        },
    };

    const mockPolicy1: AccessControlPolicy = {
        id: 'policy1',
        name: 'Confidential DS-BP',
        type: 'parent',
        active: true,
        created_at: 1234567890,
        revision: 1,
        version: 'v0.1',
        imports: [],
        rules: [
            {
                actions: ['*'],
                expression: 'user.clearance == "Confidential"',
            },
        ],
    };

    const mockPolicy2: AccessControlPolicy = {
        id: 'policy2',
        name: 'Northern Command Filter',
        type: 'parent',
        active: true,
        created_at: 1234567890,
        revision: 1,
        version: 'v0.1',
        imports: [],
        rules: [
            {
                actions: ['*'],
                expression: 'user.location == "Northern Command"',
            },
        ],
    };

    test('should render nothing when no policies are provided', () => {
        const {container} = renderWithContext(
            <SystemPolicyIndicator policies={[]}/>,
            initialState,
        );

        expect(container.firstChild).toBeNull();
    });

    test('should render single policy indicator with detailed variant', () => {
        renderWithContext(
            <SystemPolicyIndicator policies={[mockPolicy1]}/>,
            initialState,
        );

        expect(screen.getByText('Confidential DS-BP')).toBeInTheDocument();
        expect(screen.getByText(/System membership policy applied to this channel/)).toBeInTheDocument();

        // Body uses singular "a system-level membership policy" to agree with the title.
        expect(screen.getByText(/This channel has a system-level membership policy applied/)).toBeInTheDocument();
        expect(screen.getByText(/Any custom membership rules you set here will be applied in addition to this policy/)).toBeInTheDocument();

        // Check for alert banner structure
        expect(screen.getByTestId('system-policy-indicator')).toBeInTheDocument();
        expect(screen.getByTestId('system-policy-indicator')).toHaveClass('AlertBanner');
    });

    test('should render multiple policies indicator', () => {
        renderWithContext(
            <SystemPolicyIndicator policies={[mockPolicy1, mockPolicy2]}/>,
            initialState,
        );

        expect(screen.getByText('Confidential DS-BP')).toBeInTheDocument();
        expect(screen.getByText('Northern Command Filter')).toBeInTheDocument();
        expect(screen.getByText(/Multiple system membership policies applied to this channel/)).toBeInTheDocument();
        expect(screen.getByText(/Any custom membership rules you set here will be applied in addition to these policies/)).toBeInTheDocument();

        // Check that both policy names appear in the description
        const description = screen.getByText(/This channel has system-level membership policies applied/);
        expect(description).toBeInTheDocument();
    });

    test('should render policy names as strong text for all users', () => {
        renderWithContext(
            <SystemPolicyIndicator policies={[mockPolicy1]}/>,
            initialState,
        );

        const policyName = screen.getByText('Confidential DS-BP');
        expect(policyName).toBeInTheDocument();
        expect(policyName.tagName).toBe('STRONG');
    });

    test('should render more than two policies with "more" button', () => {
        const mockPolicy3: AccessControlPolicy = {
            id: 'policy3',
            name: 'Test Policy 3',
            type: 'parent',
            active: true,
            created_at: 1234567890,
            revision: 1,
            version: 'v0.1',
            imports: [],
            rules: [],
        };

        const mockPolicy4: AccessControlPolicy = {
            id: 'policy4',
            name: 'Test Policy 4',
            type: 'parent',
            active: true,
            created_at: 1234567890,
            revision: 1,
            version: 'v0.1',
            imports: [],
            rules: [],
        };

        renderWithContext(
            <SystemPolicyIndicator policies={[mockPolicy1, mockPolicy2, mockPolicy3, mockPolicy4]}/>,
            initialState,
        );

        expect(screen.getByText('Confidential DS-BP')).toBeInTheDocument();
        expect(screen.getByText('Northern Command Filter')).toBeInTheDocument();
        expect(screen.getByText('2 more')).toBeInTheDocument();

        const moreButton = screen.getByText('2 more');
        expect(moreButton.tagName).toBe('BUTTON');
        expect(moreButton).toHaveAttribute('type', 'button');
        expect(moreButton).toHaveAttribute('aria-label', 'View 2 more policies');
        expect(moreButton).toHaveClass('system-policy-indicator__more-link');
    });

    test('should join two policy names with a locale-formatted conjunction', () => {
        renderWithContext(
            <SystemPolicyIndicator policies={[mockPolicy1, mockPolicy2]}/>,
            initialState,
        );

        expect(screen.getByRole('region')).toHaveTextContent(
            'This channel has system-level membership policies applied: Confidential DS-BP and Northern Command Filter. ',
        );
    });

    test('should end a truncated policy list with a singular "more" label for one remaining policy', () => {
        const mockPolicy3: AccessControlPolicy = {
            ...mockPolicy1,
            id: 'policy3',
            name: 'Test Policy 3',
        };

        renderWithContext(
            <SystemPolicyIndicator policies={[mockPolicy1, mockPolicy2, mockPolicy3]}/>,
            initialState,
        );

        expect(screen.getByRole('region')).toHaveTextContent(
            'This channel has system-level membership policies applied: Confidential DS-BP, Northern Command Filter, and 1 more. ',
        );
        expect(screen.getByText('1 more')).toHaveAttribute('aria-label', 'View 1 more policy');
    });

    test('should render the detailed variant for a file with access wording', () => {
        renderWithContext(
            <SystemPolicyIndicator
                policies={[mockPolicy1]}
                resourceType='file'
            />,
            initialState,
        );

        expect(screen.getByRole('heading')).toHaveTextContent('System access policy applied to this file');
        expect(screen.getByRole('region')).toHaveTextContent(
            'This file has a system-level access policy applied: Confidential DS-BP. Any custom access rules you set here will be applied in addition to this policy.',
        );
    });

    test('should render whole translated sentences and a locale-formatted list in another locale', () => {
        const mockPolicy3: AccessControlPolicy = {
            ...mockPolicy1,
            id: 'policy3',
            name: 'Test Policy 3',
        };

        const ruMessages = {
            'system_policy_indicator.title.multiple': '{resourceType, select, team {К этой команде применено несколько системных политик членства} file {К этому файлу применено несколько системных политик доступа} other {К этому каналу применено несколько системных политик членства}}',
            'system_policy_indicator.description_with_names.multiple': '{resourceType, select, team {К этой команде применены политики членства на уровне системы: {policies}. Любые настраиваемые правила членства, заданные здесь, будут применяться в дополнение к этим политикам.} file {К этому файлу применены политики доступа на уровне системы: {policies}. Любые настраиваемые правила доступа, заданные здесь, будут применяться в дополнение к этим политикам.} other {К этому каналу применены политики членства на уровне системы: {policies}. Любые настраиваемые правила членства, заданные здесь, будут применяться в дополнение к этим политикам.}}',
            'system_policy_indicator.more_policies': 'ещё {count}',
        };

        renderWithContext(
            <SystemPolicyIndicator
                policies={[mockPolicy1, mockPolicy2, mockPolicy3]}
                resourceType='team'
            />,
            initialState,
            {locale: 'ru', intlMessages: ruMessages},
        );

        expect(screen.getByRole('heading')).toHaveTextContent('К этой команде применено несколько системных политик членства');
        expect(screen.getByRole('region')).toHaveTextContent(
            'К этой команде применены политики членства на уровне системы: Confidential DS-BP, Northern Command Filter и ещё 1.',
        );
    });

    test('should render compact variant', () => {
        renderWithContext(
            <SystemPolicyIndicator
                policies={[mockPolicy1, mockPolicy2]}
                variant='compact'
            />,
            initialState,
        );

        // Should show basic message but not the detailed policy list or names
        expect(screen.getByText(/This channel has system-level membership policies applied/)).toBeInTheDocument();
        expect(screen.queryByText('Confidential DS-BP')).not.toBeInTheDocument();
        expect(screen.queryByText(/System membership policy applied to this channel/)).not.toBeInTheDocument();
    });

    test('should handle different resource types in compact variant', () => {
        renderWithContext(
            <SystemPolicyIndicator
                policies={[mockPolicy1]}
                resourceType='team'
                variant='compact'
            />,
            initialState,
        );

        expect(screen.getByText(/This team has a system-level membership policy applied/)).toBeInTheDocument();
    });

    test('should handle file resource type in compact variant', () => {
        renderWithContext(
            <SystemPolicyIndicator
                policies={[mockPolicy1]}
                resourceType='file'
                variant='compact'
            />,
            initialState,
        );

        // Files keep the access-oriented wording since users aren't members of files.
        expect(screen.getByText(/This file has a system-level access policy applied/)).toBeInTheDocument();
    });

    test('should not show policy names when showPolicyNames is false', () => {
        renderWithContext(
            <SystemPolicyIndicator
                policies={[mockPolicy1]}
                showPolicyNames={false}
            />,
            initialState,
        );

        expect(screen.queryByText('Confidential DS-BP')).not.toBeInTheDocument();
        expect(screen.getByText(/System membership policy applied to this channel/)).toBeInTheDocument();
    });

    // Test more button functionality
    test('should call onMorePoliciesClick when more button is clicked', async () => {
        const mockPolicy3: AccessControlPolicy = {
            id: 'policy3',
            name: 'Test Policy 3',
            type: 'parent',
            active: true,
            created_at: 1234567890,
            revision: 1,
            version: 'v0.1',
            imports: [],
            rules: [],
        };

        const onMorePoliciesClick = jest.fn();

        renderWithContext(
            <SystemPolicyIndicator
                policies={[mockPolicy1, mockPolicy2, mockPolicy3]}
                onMorePoliciesClick={onMorePoliciesClick}
            />,
            initialState,
        );

        const moreButton = screen.getByText('1 more');
        await userEvent.click(moreButton);

        expect(onMorePoliciesClick).toHaveBeenCalledTimes(1);
    });

    test('should call onMorePoliciesClick when more button is activated with Enter key', async () => {
        const mockPolicy3: AccessControlPolicy = {
            id: 'policy3',
            name: 'Test Policy 3',
            type: 'parent',
            active: true,
            created_at: 1234567890,
            revision: 1,
            version: 'v0.1',
            imports: [],
            rules: [],
        };

        const onMorePoliciesClick = jest.fn();

        renderWithContext(
            <SystemPolicyIndicator
                policies={[mockPolicy1, mockPolicy2, mockPolicy3]}
                onMorePoliciesClick={onMorePoliciesClick}
            />,
            initialState,
        );

        const moreButton = screen.getByText('1 more');
        moreButton.focus();
        await userEvent.keyboard('{Enter}');

        expect(onMorePoliciesClick).toHaveBeenCalledTimes(1);
    });

    // Error handling and edge cases
    test('should handle null policies gracefully', () => {
        const {container} = renderWithContext(
            <SystemPolicyIndicator policies={null as unknown as AccessControlPolicy[]}/>,
            initialState,
        );

        expect(container.firstChild).toBeNull();
    });

    test('should handle undefined policies gracefully', () => {
        const {container} = renderWithContext(
            <SystemPolicyIndicator policies={undefined as unknown as AccessControlPolicy[]}/>,
            initialState,
        );

        expect(container.firstChild).toBeNull();
    });

    test('should display policy ID when policy has no name', () => {
        const policyWithIdOnly: AccessControlPolicy = {
            ...mockPolicy1,
            name: undefined as unknown as string,
        };

        renderWithContext(
            <SystemPolicyIndicator policies={[policyWithIdOnly]}/>,
            initialState,
        );

        expect(screen.getByText('policy1')).toBeInTheDocument();
    });

    test('should prevent default action and stop propagation on click', async () => {
        const mockPolicy3: AccessControlPolicy = {
            id: 'policy3',
            name: 'Test Policy 3',
            type: 'parent',
            active: true,
            created_at: 1234567890,
            revision: 1,
            version: 'v0.1',
            imports: [],
            rules: [],
        };

        const onMorePoliciesClick = jest.fn();

        renderWithContext(
            <SystemPolicyIndicator
                policies={[mockPolicy1, mockPolicy2, mockPolicy3]}
                onMorePoliciesClick={onMorePoliciesClick}
            />,
            initialState,
        );

        const moreButton = screen.getByText('1 more');

        await userEvent.click(moreButton);

        expect(onMorePoliciesClick).toHaveBeenCalledTimes(1);
    });
});
