// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import ManageTokensModal from './manage_tokens_modal';

describe('components/admin_console/manage_tokens_modal/manage_tokens_modal.tsx', () => {
    const baseProps = {
        actions: {
            getUserAccessTokensForUser: jest.fn(),
        },
        user: TestHelper.getUserMock({
            id: 'defaultuser',
        }),
        onHide: jest.fn(),
        onExited: jest.fn(),
    };

    test('initial call should match snapshot', () => {
        const {baseElement} = renderWithContext(
            <ManageTokensModal {...baseProps}/>,
        );
        expect(baseProps.actions.getUserAccessTokensForUser).toHaveBeenCalledTimes(1);
        expect(screen.getByText('Manage Personal Access Tokens')).toBeInTheDocument();
        expect(baseElement.querySelector('.manage-teams__teams')).toBeInTheDocument();
        expect(baseElement).toMatchSnapshot();
    });

    test('should replace loading screen on update', () => {
        const {baseElement, rerender} = renderWithContext(
            <ManageTokensModal {...baseProps}/>,
        );

        expect(screen.queryByText('No personal access tokens.')).not.toBeInTheDocument();
        expect(baseElement.querySelector('.loading-screen')).toBeInTheDocument();
        expect(baseElement.querySelector('.manage-row__empty')).not.toBeInTheDocument();

        rerender(
            <ManageTokensModal
                {...baseProps}
                userAccessTokens={{}}
            />,
        );

        expect(baseElement.querySelector('.manage-teams__teams')).toBeInTheDocument();
        expect(baseElement.querySelector('.loading-screen')).not.toBeInTheDocument();
        expect(baseElement.querySelector('.manage-row__empty')).toBeInTheDocument();
        expect(screen.getByText('No personal access tokens.')).toBeInTheDocument();
        expect(baseElement).toMatchSnapshot();
    });

    test('should display list of tokens', () => {
        const userAccessTokens = {
            id1: {
                id: 'id1',
                description: 'first token',
                user_id: 'defaultuser',
                is_active: true,
            },
            id2: {
                id: 'id2',
                description: 'second token',
                user_id: 'defaultuser',
                is_active: true,
            },
        };

        const {baseElement} = renderWithContext(
            <ManageTokensModal
                {...baseProps}
                userAccessTokens={userAccessTokens}
            />,
        );

        expect(baseElement.querySelector('.manage-teams__teams')).toBeInTheDocument();
        expect(baseElement.querySelectorAll('.manage-teams__team')).toHaveLength(2);
        expect(screen.getByText(/first token/)).toBeInTheDocument();
        expect(screen.getByText(/second token/)).toBeInTheDocument();
        expect(screen.getByText(/id1/)).toBeInTheDocument();
        expect(screen.getByText(/id2/)).toBeInTheDocument();
        expect(baseElement).toMatchSnapshot();
    });
});
