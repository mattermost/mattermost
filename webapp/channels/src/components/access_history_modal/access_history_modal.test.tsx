// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import AccessHistoryModal from 'components/access_history_modal/access_history_modal';

import {renderWithContext, screen, userEvent, waitFor} from 'tests/react_testing_utils';

jest.mock('components/audit_table', () => {
    return jest.fn().mockImplementation(() => {
        return <div data-testid='audit-table'/>;
    });
});

jest.mock('components/loading_screen', () => {
    return jest.fn().mockImplementation(() => {
        return <div data-testid='loading-screen'/>;
    });
});

describe('components/AccessHistoryModal', () => {
    const baseProps = {
        onHide: jest.fn(),
        actions: {
            getUserAudits: jest.fn(),
        },
        userAudits: [],
        currentUserId: '',
    };

    test('should show loading screen when no audits exist', () => {
        renderWithContext(<AccessHistoryModal {...baseProps}/>);

        expect(screen.getByTestId('loading-screen')).toBeInTheDocument();
        expect(screen.queryByTestId('audit-table')).not.toBeInTheDocument();
    });

    test('should show audit table when audits exist', () => {
        renderWithContext(
            <AccessHistoryModal
                {...baseProps}
                userAudits={['audit1', 'audit2'] as any}
            />,
        );

        expect(screen.queryByTestId('loading-screen')).not.toBeInTheDocument();
        expect(screen.getByTestId('audit-table')).toBeInTheDocument();
    });

    test('should call getUserAudits on mount', () => {
        const actions = {
            getUserAudits: jest.fn(),
        };
        const props = {...baseProps, actions};

        renderWithContext(<AccessHistoryModal {...props}/>);
        expect(actions.getUserAudits).toHaveBeenCalledTimes(1);
        expect(actions.getUserAudits).toHaveBeenCalledWith('', 0, 200);
    });

    test('should call getUserAudits again when currentUserId changes', () => {
        const actions = {
            getUserAudits: jest.fn(),
        };
        const props = {...baseProps, actions};

        const {rerender} = renderWithContext(<AccessHistoryModal {...props}/>);
        expect(actions.getUserAudits).toHaveBeenCalledTimes(1);

        const newProps = {...props, currentUserId: 'foo'};
        rerender(<AccessHistoryModal {...newProps}/>);
        expect(actions.getUserAudits).toHaveBeenCalledTimes(2);
        expect(actions.getUserAudits).toHaveBeenCalledWith('foo', 0, 200);
    });

    test('should call onHide when modal is closed', async () => {
        const onHide = jest.fn();
        renderWithContext(
            <AccessHistoryModal
                {...baseProps}
                onHide={onHide}
            />,
        );

        await waitFor(() => screen.getByText('Access History'));
        await userEvent.click(screen.getByLabelText('Close'));

        expect(onHide).toHaveBeenCalledTimes(1);
    });
});
