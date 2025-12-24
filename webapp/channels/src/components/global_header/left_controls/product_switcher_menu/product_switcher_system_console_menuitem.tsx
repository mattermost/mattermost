// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';
import {useSelector} from 'react-redux';
import {useHistory} from 'react-router-dom';

import {ApplicationCogIcon} from '@mattermost/compass-icons/components';

import {Permissions} from 'mattermost-redux/constants';
import {getInt} from 'mattermost-redux/selectors/entities/preferences';

import * as Menu from 'components/menu';
import {OnboardingTaskCategory, OnboardingTasksName, TaskNameMapToSteps, useHandleOnBoardingTaskData, VisitSystemConsoleTour} from 'components/onboarding_tasks';
import SystemPermissionGate from 'components/permissions_gates/system_permission_gate';

import type {GlobalState} from 'types/store';

export default function ProductSwitcherSystemConsoleMenuItem() {
    const history = useHistory();

    const step = useSelector((state: GlobalState) => getInt(state, OnboardingTaskCategory, OnboardingTasksName.VISIT_SYSTEM_CONSOLE, 0));
    const showTour = step === TaskNameMapToSteps[OnboardingTasksName.VISIT_SYSTEM_CONSOLE].STARTED;

    const handleOnBoardingTaskData = useHandleOnBoardingTaskData();

    function handleClick() {
        history.push('/admin_console');

        if (showTour) {
            const steps = TaskNameMapToSteps[OnboardingTasksName.VISIT_SYSTEM_CONSOLE];
            handleOnBoardingTaskData(OnboardingTasksName.VISIT_SYSTEM_CONSOLE, steps.FINISHED);
            localStorage.setItem(OnboardingTaskCategory, 'true');
        }
    }

    return (
        <SystemPermissionGate permissions={Permissions.SYSCONSOLE_READ_PERMISSIONS}>
            <Menu.Item
                leadingElement={<ApplicationCogIcon size={18}/>}
                labels={
                    <FormattedMessage
                        id='productSwitcherMenu.systemConsole.label'
                        defaultMessage='System console'
                    />
                }
                trailingElements={showTour && (<VisitSystemConsoleTour/>)}
                onClick={handleClick}
            />
        </SystemPermissionGate>
    );
}
