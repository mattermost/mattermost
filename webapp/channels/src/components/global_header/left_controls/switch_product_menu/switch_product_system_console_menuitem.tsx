// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect} from 'react';
import {FormattedMessage} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';
import {useHistory} from 'react-router-dom';

import {ApplicationCogIcon} from '@mattermost/compass-icons/components';

import {fetchDelegatedPermissions} from 'mattermost-redux/actions/render_permissions';
import {Permissions} from 'mattermost-redux/constants';
import {isPermissionPoliciesEnabled} from 'mattermost-redux/selectors/entities/general';
import {getInt} from 'mattermost-redux/selectors/entities/preferences';
import {hasAnyDelegatedPermission, isDelegatedPermissionsLoaded} from 'mattermost-redux/selectors/entities/render_permissions';

import * as Menu from 'components/menu';
import {OnboardingTaskCategory, OnboardingTasksName, TaskNameMapToSteps, useHandleOnBoardingTaskData, VisitSystemConsoleTour} from 'components/onboarding_tasks';
import SystemPermissionGate from 'components/permissions_gates/system_permission_gate';

import type {GlobalState} from 'types/store';

export default function ProductSwitcherSystemConsoleMenuItem() {
    const history = useHistory();

    const step = useSelector((state: GlobalState) => getInt(state, OnboardingTaskCategory, OnboardingTasksName.VISIT_SYSTEM_CONSOLE, 0));
    const showTour = step === TaskNameMapToSteps[OnboardingTasksName.VISIT_SYSTEM_CONSOLE].STARTED;

    const handleOnBoardingTaskData = useHandleOnBoardingTaskData();

    const dispatch = useDispatch();
    const hasDelegatedPermission = useSelector(hasAnyDelegatedPermission);
    const delegatedPermissionsLoaded = useSelector(isDelegatedPermissionsLoaded);
    const permissionPoliciesEnabled = useSelector(isPermissionPoliciesEnabled);

    // Loaded at app load; this refetches a set a websocket event left stale.
    useEffect(() => {
        if (permissionPoliciesEnabled && !delegatedPermissionsLoaded) {
            dispatch(fetchDelegatedPermissions());
        }
    }, [dispatch, permissionPoliciesEnabled, delegatedPermissionsLoaded]);

    function handleClick() {
        history.push('/admin_console');

        if (showTour) {
            const steps = TaskNameMapToSteps[OnboardingTasksName.VISIT_SYSTEM_CONSOLE];
            handleOnBoardingTaskData(OnboardingTasksName.VISIT_SYSTEM_CONSOLE, steps.FINISHED);
            localStorage.setItem(OnboardingTaskCategory, 'true');
        }
    }

    const menuItem = (
        <Menu.Item
            leadingElement={<ApplicationCogIcon size={18}/>}
            labels={
                <FormattedMessage
                    id='globalHeader.productSwitcherMenu.systemConsoleMenuItem.label'
                    defaultMessage='System Console'
                />
            }
            trailingElements={showTour && (<VisitSystemConsoleTour/>)}
            onClick={handleClick}
        />
    );

    if (hasDelegatedPermission) {
        return menuItem;
    }

    return (
        <SystemPermissionGate permissions={Permissions.SYSCONSOLE_READ_PERMISSIONS}>
            {menuItem}
        </SystemPermissionGate>
    );
}
