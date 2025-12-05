// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {DeepPartial} from '@mattermost/types/utilities';

import {renderWithContext, act} from 'tests/vitest_react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import type {GlobalState} from 'types/store';

import SystemRole from './system_role';

describe('admin_console/system_role', () => {
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

    const role = TestHelper.getRoleMock({
        id: 'role_id',
        name: 'test_role',
        display_name: 'Test Role',
        permissions: ['sysconsole_read_environment'],
    });

    const props = {
        role,
        isDisabled: false,
        isLicensedForCloud: false,
        actions: {
            editRole: vi.fn(),
            updateUserRoles: vi.fn(),
            setNavigationBlocked: vi.fn(),
        },
    };

    const initialState: DeepPartial<GlobalState> = {
        entities: {
            roles: {
                roles: {
                    [role.name]: role,
                },
            },
            users: {
                profiles: {},
                statuses: {},
            },
            general: {
                config: {},
            },
        },
        views: {
            search: {
                userGridSearch: {
                    term: '',
                    filters: {roles: []},
                },
            },
        },
    };

    test('should match snapshot', async () => {
        let container: HTMLElement;
        await act(async () => {
            const result = renderWithContext(
                <SystemRole
                    {...props}
                />,
                initialState,
            );
            container = result.container;
            vi.runAllTimers();
        });

        expect(container!).toMatchSnapshot();
    });

    test('should match snapshot with isLicensedForCloud = true', async () => {
        let container: HTMLElement;
        await act(async () => {
            const result = renderWithContext(
                <SystemRole
                    {...props}
                    isLicensedForCloud={true}
                />,
                initialState,
            );
            container = result.container;
            vi.runAllTimers();
        });

        expect(container!).toMatchSnapshot();
    });
});
