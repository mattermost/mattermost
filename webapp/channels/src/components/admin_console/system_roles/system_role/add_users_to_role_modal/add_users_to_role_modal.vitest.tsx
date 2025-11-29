// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {defaultIntl} from 'tests/helpers/intl-test-helper';
import {renderWithContext, act} from 'tests/vitest_react_testing_utils';
import {TestHelper} from 'utils/test_helper';

// Import the unwrapped component directly, not the connected version
import {AddUsersToRoleModal} from './add_users_to_role_modal';

describe('admin_console/add_users_to_role_modal', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        // Run all pending timers and animation frames before cleanup
        act(() => {
            vi.runAllTimers();
        });
        vi.useRealTimers();
    });

    const baseUser = TestHelper.getUserMock({id: 'user_id_1', username: 'user1'});
    const role = TestHelper.getRoleMock({name: 'test_role', display_name: 'Test Role'});

    const baseProps = {
        role,
        users: [baseUser],
        excludeUsers: {},
        includeUsers: {},
        onAddCallback: vi.fn(),
        onExited: vi.fn(),
        intl: defaultIntl,
        actions: {
            getProfiles: vi.fn(),
            searchProfiles: vi.fn(),
        },
    };

    test('should have single passed value', async () => {
        let baseElement: HTMLElement;
        await act(async () => {
            const result = renderWithContext(
                <AddUsersToRoleModal
                    {...baseProps}
                />,
            );
            baseElement = result.baseElement;
            vi.runAllTimers();
        });

        // Modal renders to portal, so use baseElement to capture full DOM
        expect(baseElement!).toMatchSnapshot();
    });

    test('should exclude user', async () => {
        const excludedUser = TestHelper.getUserMock({id: 'excluded_user_id', username: 'excluded_user'});
        const props = {...baseProps, excludeUsers: {excluded_user_id: excludedUser}};
        let baseElement: HTMLElement;
        await act(async () => {
            const result = renderWithContext(
                <AddUsersToRoleModal
                    {...props}
                />,
            );
            baseElement = result.baseElement;
            vi.runAllTimers();
        });

        // Modal renders to portal, so use baseElement to capture full DOM
        expect(baseElement!).toMatchSnapshot();
    });

    test('should include additional user', async () => {
        const additionalUser = TestHelper.getUserMock({id: 'additional_user_id', username: 'additional_user'});
        const props = {...baseProps, includeUsers: {additional_user_id: additionalUser}};
        let baseElement: HTMLElement;
        await act(async () => {
            const result = renderWithContext(
                <AddUsersToRoleModal
                    {...props}
                />,
            );
            baseElement = result.baseElement;
            vi.runAllTimers();
        });

        // Modal renders to portal, so use baseElement to capture full DOM
        expect(baseElement!).toMatchSnapshot();
    });

    test('should include additional user', async () => {
        const additionalUser = TestHelper.getUserMock({id: 'additional_user_id2', username: 'additional_user2'});
        const props = {...baseProps, includeUsers: {additional_user_id2: additionalUser}};
        let baseElement: HTMLElement;
        await act(async () => {
            const result = renderWithContext(
                <AddUsersToRoleModal
                    {...props}
                />,
            );
            baseElement = result.baseElement;
            vi.runAllTimers();
        });

        // Modal renders to portal, so use baseElement to capture full DOM
        expect(baseElement!).toMatchSnapshot();
    });

    test('should not include bot user', async () => {
        const regularUser = TestHelper.getUserMock({id: 'regular_user_id', username: 'regular_user'});
        const botUser = TestHelper.getUserMock({id: 'bot_user_id', username: 'bot_user', is_bot: true});
        const props = {
            ...baseProps,
            actions: {
                getProfiles: vi.fn().mockResolvedValue({data: [regularUser, botUser]}),
                searchProfiles: vi.fn(),
            },
        };
        let baseElement: HTMLElement;
        await act(async () => {
            const result = renderWithContext(
                <AddUsersToRoleModal
                    {...props}
                />,
            );
            baseElement = result.baseElement;
            vi.runAllTimers();
        });

        // Modal renders to portal, so use baseElement to capture full DOM
        expect(baseElement!).toMatchSnapshot();
    });

    test('search should not include bot user', async () => {
        const regularUser = TestHelper.getUserMock({id: 'search_regular_id', username: 'search_regular'});
        const botUser = TestHelper.getUserMock({id: 'search_bot_id', username: 'search_bot', is_bot: true});
        const props = {
            ...baseProps,
            actions: {
                searchProfiles: vi.fn().mockResolvedValue({data: [regularUser, botUser]}),
                getProfiles: vi.fn(),
            },
        };
        let baseElement: HTMLElement;
        await act(async () => {
            const result = renderWithContext(
                <AddUsersToRoleModal
                    {...props}
                />,
            );
            baseElement = result.baseElement;
            vi.runAllTimers();
        });

        // Modal renders to portal, so use baseElement to capture full DOM
        expect(baseElement!).toMatchSnapshot();
    });
});
