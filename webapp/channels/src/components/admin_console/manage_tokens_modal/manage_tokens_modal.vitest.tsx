// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, waitFor} from 'tests/vitest_react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import ManageTokensModal from './manage_tokens_modal';

describe('components/admin_console/manage_tokens_modal/manage_tokens_modal.tsx', () => {
    const baseProps = {
        actions: {
            getUserAccessTokensForUser: vi.fn().mockResolvedValue({data: []}),
        },
        user: TestHelper.getUserMock({
            id: 'defaultuser',
        }),
        onHide: vi.fn(),
        onExited: vi.fn(),
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    test('initial call should match snapshot', async () => {
        const {baseElement} = renderWithContext(
            <ManageTokensModal {...baseProps}/>,
        );

        await waitFor(() => {
            expect(baseProps.actions.getUserAccessTokensForUser).toHaveBeenCalledTimes(1);
        });

        expect(document.querySelector('.manage-teams__teams')).toBeInTheDocument();
        expect(document.querySelector('.loading-screen')).toBeInTheDocument();
        expect(baseElement).toMatchSnapshot();
    });

    test('should replace loading screen on update', async () => {
        const props = {
            ...baseProps,
            userAccessTokens: {},
        };

        const {baseElement} = renderWithContext(
            <ManageTokensModal {...props}/>,
        );

        await waitFor(() => {
            expect(baseProps.actions.getUserAccessTokensForUser).toHaveBeenCalled();
        });

        expect(document.querySelector('.manage-teams__teams')).toBeInTheDocument();
        expect(document.querySelector('.manage-row__empty')).toBeInTheDocument();
        expect(baseElement).toMatchSnapshot();
    });

    test('should display list of tokens', async () => {
        const props = {
            ...baseProps,
            userAccessTokens: {
                id1: {
                    id: 'id1',
                    description: 'description',
                    user_id: 'defaultuser',
                    token: '',
                    is_active: true,
                },
                id2: {
                    id: 'id2',
                    description: 'description',
                    user_id: 'defaultuser',
                    token: '',
                    is_active: true,
                },
            },
        };

        const {baseElement} = renderWithContext(
            <ManageTokensModal {...props}/>,
        );

        await waitFor(() => {
            expect(baseProps.actions.getUserAccessTokensForUser).toHaveBeenCalled();
        });

        expect(document.querySelector('.manage-teams__teams')).toBeInTheDocument();
        expect(document.querySelectorAll('.manage-teams__team')).toHaveLength(2);
        expect(baseElement).toMatchSnapshot();
    });
});
