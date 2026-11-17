// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {DropResult} from '@hello-pangea/dnd';
import React from 'react';

import type {AccessControlPolicy} from '@mattermost/types/access_control';

import type {ActionResult} from 'mattermost-redux/types/actions';

import {act, renderWithContext, screen, userEvent, within} from 'tests/react_testing_utils';
import {getHistory} from 'utils/browser_history';

import ScopedConfigurationList from './scoped_configuration';

const mockPush = jest.fn();
jest.mock('utils/browser_history', () => ({
    getHistory: jest.fn(() => ({
        push: mockPush,
    })),
}));

let mockOnDragEnd: ((result: DropResult) => Promise<void> | void) | undefined;
jest.mock('@hello-pangea/dnd', () => {
    const actual = jest.requireActual('@hello-pangea/dnd');
    const ReactActual = jest.requireActual('react');
    return {
        ...actual,
        DragDropContext: (props: {onDragEnd: (result: DropResult) => void}) => {
            mockOnDragEnd = props.onDragEnd;
            return ReactActual.createElement(actual.DragDropContext, props);
        },
    };
});

const makePolicy = (
    id: string,
    roles: string[],
    rules: Array<{actions: string[]; expression: string; value?: string}>,
): AccessControlPolicy => ({
    id,
    name: `Policy ${id}`,
    type: 'system_setting',
    roles,
    rules,
});

const bannerPolicy = (id: string, text: string) => makePolicy(id, ['system_user'], [
    {actions: ['EnableBanner'], expression: 'true', value: 'true'},
    {actions: ['BannerText'], expression: 'true', value: text},
]);

const drop = (draggableId: string, from: number, to: number): DropResult => ({
    draggableId,
    type: 'DEFAULT',
    reason: 'DROP',
    mode: 'FLUID',
    source: {droppableId: 'scoped-configuration-priority', index: from},
    destination: {droppableId: 'scoped-configuration-priority', index: to},
    combine: null,
});

describe('components/admin_console/scoped_configuration/ScopedConfigurationList', () => {
    const mockSearchPolicies = jest.fn();
    const mockDeletePolicy = jest.fn();
    const mockGetPolicyOrder = jest.fn();
    const mockUpdatePolicyOrder = jest.fn();

    const actions = {
        searchPolicies: mockSearchPolicies,
        deletePolicy: mockDeletePolicy,
        getPolicyOrder: mockGetPolicyOrder,
        updatePolicyOrder: mockUpdatePolicyOrder,
    };

    const rowNames = () => screen.getAllByTestId('dataGrid-row').map((row) => within(row).getByText(/^Policy /).textContent);

    beforeEach(() => {
        jest.clearAllMocks();
        mockOnDragEnd = undefined;
        jest.mocked(getHistory).mockReturnValue({push: mockPush} as unknown as ReturnType<typeof getHistory>);
        mockGetPolicyOrder.mockResolvedValue({data: {policy_ids: []}});
        mockUpdatePolicyOrder.mockResolvedValue({data: {policy_ids: []}});
    });

    test('renders policies with role labels and formatted configuration values', async () => {
        const policies = [
            makePolicy('fin', ['system_user'], [{
                actions: ['MobileEnableBiometrics'],
                expression: 'user.attributes.dept == "finance"',
                value: 'true',
            }]),
            makePolicy('mdm', ['system_admin'], [{
                actions: ['MobileEnableBiometrics'],
                expression: 'user.session.hardware_id == "mdm"',
                value: 'false',
            }]),
        ];
        mockSearchPolicies.mockResolvedValue({data: {policies, total: 2}} as ActionResult);

        renderWithContext(
            <ScopedConfigurationList
                order={['fin', 'mdm']}
                actions={actions}
            />,
        );

        const finCell = await screen.findByText('Policy fin');
        const finRow = finCell.closest('.DataGrid_row') as HTMLElement;
        expect(within(finRow).getByText('Members')).toBeInTheDocument();
        expect(within(finRow).getByText('Enable Biometric Authentication: True')).toBeInTheDocument();

        const mdmCell = screen.getByText('Policy mdm');
        const mdmRow = mdmCell.closest('.DataGrid_row') as HTMLElement;
        expect(within(mdmRow).getByText('System administrators')).toBeInTheDocument();
        expect(within(mdmRow).getByText('Enable Biometric Authentication: False')).toBeInTheDocument();

        await userEvent.click(within(finRow).getByTestId('scoped-policy-drag-handle-fin'));
        expect(mockPush).not.toHaveBeenCalled();

        await userEvent.click(finRow);
        expect(mockPush).toHaveBeenCalledWith('/admin_console/system_attributes/scoped_configuration/edit_policy/fin');
    });

    test('formats announcement banner configuration values', async () => {
        const expression = 'user.attributes.dept == "finance"';
        mockSearchPolicies.mockResolvedValue({
            data: {
                policies: [makePolicy('banner', ['system_user'], [
                    {actions: ['EnableBanner'], expression, value: 'true'},
                    {actions: ['BannerText'], expression, value: 'Finance close is on Friday'},
                    {actions: ['AllowBannerDismissal'], expression, value: 'false'},
                ])],
                total: 1,
            },
        } as ActionResult);

        renderWithContext(
            <ScopedConfigurationList
                order={['banner']}
                actions={actions}
            />,
        );

        const bannerCell = await screen.findByText('Policy banner');
        const bannerRow = bannerCell.closest('.DataGrid_row') as HTMLElement;
        expect(within(bannerRow).getByText(
            'Enable System-wide Notifications: True, Banner Text: Finance close is on Friday, Allow Banner Dismissal: False',
        )).toBeInTheDocument();
    });

    test('lists policies in priority order with priority numbers and the precedence explanation', async () => {
        mockSearchPolicies.mockResolvedValue({
            data: {
                policies: [bannerPolicy('everyone', 'All hands'), bannerPolicy('eng', 'Deploy freeze'), bannerPolicy('fin', 'Quarter close')],
                total: 3,
            },
        } as ActionResult);

        renderWithContext(
            <ScopedConfigurationList
                order={['fin', 'eng', 'everyone']}
                actions={actions}
            />,
        );

        await screen.findByText('Policy fin');
        expect(mockGetPolicyOrder).toHaveBeenCalledTimes(1);
        expect(rowNames()).toEqual(['Policy fin', 'Policy eng', 'Policy everyone']);
        expect(screen.getByTestId('scoped-policy-priority-fin')).toHaveTextContent('1');
        expect(screen.getByTestId('scoped-policy-priority-everyone')).toHaveTextContent('3');
        expect(screen.getByText(
            'When a user matches more than one policy for a setting, the policy highest in this list applies. Drag policies to change their priority.',
        )).toBeInTheDocument();
        expect(screen.getByTestId('scoped-policy-drag-handle-fin')).toHaveAccessibleName('Drag to change priority');
    });

    test('dropping a policy saves the new order and the list follows the stored order', async () => {
        mockSearchPolicies.mockResolvedValue({
            data: {
                policies: [bannerPolicy('fin', 'Quarter close'), bannerPolicy('eng', 'Deploy freeze'), bannerPolicy('everyone', 'All hands')],
                total: 3,
            },
        } as ActionResult);

        const {rerender} = renderWithContext(
            <ScopedConfigurationList
                order={['fin', 'eng', 'everyone']}
                actions={actions}
            />,
        );
        await screen.findByText('Policy fin');
        expect(mockOnDragEnd).toBeDefined();

        await act(async () => {
            await mockOnDragEnd!(drop('everyone', 2, 0));
        });
        expect(mockUpdatePolicyOrder).toHaveBeenCalledWith(['everyone', 'fin', 'eng']);

        rerender(
            <ScopedConfigurationList
                order={['everyone', 'fin', 'eng']}
                actions={actions}
            />,
        );
        expect(rowNames()).toEqual(['Policy everyone', 'Policy fin', 'Policy eng']);
        expect(screen.getByTestId('scoped-policy-priority-everyone')).toHaveTextContent('1');

        await act(async () => {
            await mockOnDragEnd!({...drop('eng', 2, 2)});
            await mockOnDragEnd!({...drop('eng', 2, 0), destination: null});
        });
        expect(mockUpdatePolicyOrder).toHaveBeenCalledTimes(1);
    });

    test('shows an error when the new order cannot be saved', async () => {
        mockSearchPolicies.mockResolvedValue({
            data: {policies: [bannerPolicy('fin', 'Quarter close'), bannerPolicy('eng', 'Deploy freeze')], total: 2},
        } as ActionResult);
        mockUpdatePolicyOrder.mockResolvedValue({error: {message: 'nope'}});

        renderWithContext(
            <ScopedConfigurationList
                order={['fin', 'eng']}
                actions={actions}
            />,
        );
        await screen.findByText('Policy fin');

        await act(async () => {
            await mockOnDragEnd!(drop('eng', 1, 0));
        });
        expect(screen.getByRole('alert')).toHaveTextContent('Unable to save the new priority order. Try again.');
    });

    test('filtering by name keeps priority numbers and disables reordering', async () => {
        mockSearchPolicies.mockResolvedValue({
            data: {
                policies: [bannerPolicy('fin', 'Quarter close'), bannerPolicy('eng', 'Deploy freeze'), bannerPolicy('everyone', 'All hands')],
                total: 3,
            },
        } as ActionResult);

        renderWithContext(
            <ScopedConfigurationList
                order={['fin', 'eng', 'everyone']}
                actions={actions}
            />,
        );
        await screen.findByText('Policy fin');

        await userEvent.type(screen.getByRole('textbox'), 'every');

        expect(rowNames()).toEqual(['Policy everyone']);
        expect(screen.getByTestId('scoped-policy-priority-everyone')).toHaveTextContent('3');
        expect(screen.getByText('Clear the search to change the priority of policies.')).toBeInTheDocument();
        expect(screen.getByTestId('scoped-policy-drag-handle-everyone')).toHaveClass('ScopedConfigurationPriority__handle--disabled');
    });

    test('loads every page of policies', async () => {
        const firstPage = Array.from({length: 100}, (_, i) => bannerPolicy(`p${String(i).padStart(3, '0')}`, `Banner ${i}`));
        mockSearchPolicies.
            mockResolvedValueOnce({data: {policies: firstPage, total: 101}} as ActionResult).
            mockResolvedValueOnce({data: {policies: [bannerPolicy('last', 'Last')], total: 101}} as ActionResult);

        renderWithContext(
            <ScopedConfigurationList
                order={[]}
                actions={actions}
            />,
        );

        await screen.findByText('Policy last');
        expect(mockSearchPolicies).toHaveBeenNthCalledWith(1, '', '', 100);
        expect(mockSearchPolicies).toHaveBeenNthCalledWith(2, '', 'p099', 100);
        expect(screen.getAllByTestId('dataGrid-row')).toHaveLength(101);
    });

    test('navigates to new policy editor when Add policy is clicked', async () => {
        mockSearchPolicies.mockResolvedValue({data: {policies: [], total: 0}} as ActionResult);

        renderWithContext(
            <ScopedConfigurationList
                order={[]}
                actions={actions}
            />,
        );

        await screen.findByText('No scoped configuration policies found');
        await userEvent.click(screen.getByRole('button', {name: 'Add policy'}));

        expect(mockPush).toHaveBeenCalledWith('/admin_console/system_attributes/scoped_configuration/edit_policy');
    });
});
