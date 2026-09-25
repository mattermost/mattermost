// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {DeepPartial} from '@mattermost/types/utilities';

import {Permissions} from 'mattermost-redux/constants';

import {OnboardingTaskCategory, OnboardingTasksName, TaskNameMapToSteps} from 'components/onboarding_tasks';

import {renderWithContext, screen} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import type {GlobalState} from 'types/store';

import ProductSwitcherSystemConsoleMenuItem from './switch_product_system_console_menuitem';

function getState(systemPermissions: string[], visitConsoleStep?: number): DeepPartial<GlobalState> {
    return {
        entities: {
            users: {
                currentUserId: 'user_id',
                profiles: {
                    user_id: TestHelper.getUserMock({id: 'user_id', roles: 'system_user'}),
                },
            },
            roles: {
                roles: {
                    system_user: {permissions: systemPermissions},
                },
            },
            preferences: {
                myPreferences: visitConsoleStep === undefined ? {} : {
                    [`${OnboardingTaskCategory}--${OnboardingTasksName.VISIT_SYSTEM_CONSOLE}`]: {
                        category: OnboardingTaskCategory,
                        name: OnboardingTasksName.VISIT_SYSTEM_CONSOLE,
                        value: String(visitConsoleStep),
                    },
                },
            },
        },
    };
}

describe('ProductSwitcherSystemConsoleMenuItem', () => {
    test('should not show without any system console read permission', () => {
        renderWithContext(<ProductSwitcherSystemConsoleMenuItem/>, getState([]));

        expect(screen.queryByText('System Console')).not.toBeInTheDocument();
    });

    test('should show with a system console read permission', () => {
        renderWithContext(
            <ProductSwitcherSystemConsoleMenuItem/>,
            getState([Permissions.SYSCONSOLE_READ_ABOUT_EDITION_AND_LICENSE]),
        );

        expect(screen.getByText('System Console')).toBeInTheDocument();
    });

    test('should show the visit system console tour when that onboarding task has started', () => {
        const startedStep = TaskNameMapToSteps[OnboardingTasksName.VISIT_SYSTEM_CONSOLE].STARTED;

        const {container} = renderWithContext(
            <ProductSwitcherSystemConsoleMenuItem/>,
            getState([Permissions.SYSCONSOLE_READ_ABOUT_EDITION_AND_LICENSE], startedStep),
        );

        expect(container.querySelector('.trailing-elements')).toBeInTheDocument();
    });

    test('should not show the visit system console tour when that onboarding task has not started', () => {
        const finishedStep = TaskNameMapToSteps[OnboardingTasksName.VISIT_SYSTEM_CONSOLE].FINISHED;

        const {container} = renderWithContext(
            <ProductSwitcherSystemConsoleMenuItem/>,
            getState([Permissions.SYSCONSOLE_READ_ABOUT_EDITION_AND_LICENSE], finishedStep),
        );

        expect(container.querySelector('.trailing-elements')).not.toBeInTheDocument();
    });
});
