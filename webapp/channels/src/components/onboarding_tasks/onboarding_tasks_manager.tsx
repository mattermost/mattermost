// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useMemo} from 'react';
import {useIntl} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';
import {matchPath, useHistory, useLocation} from 'react-router-dom';

import {trackEvent as trackEventAction} from 'actions/telemetry_actions';
import {setProductMenuSwitcherOpen} from 'actions/views/product_menu';
import {setStatusDropdown} from 'actions/views/status_dropdown';
import {openModal} from 'actions/views/modals';
import {
    AutoTourStatus,
    FINISHED,
    OnboardingTourSteps,
    OnboardingTourStepsForGuestUsers,
    TTNameMapToATStatusKey,
    TutorialTourName,
} from 'components/tours';
import LearnMoreTrialModal from 'components/learn_more_trial_modal/learn_more_trial_modal';
import {savePreferences} from 'mattermost-redux/actions/preferences';
import {getCurrentUserId} from 'mattermost-redux/selectors/entities/common';

import {
    isReduceOnBoardingTaskList,
    makeGetCategory,
} from 'mattermost-redux/selectors/entities/preferences';
import {getLicense} from 'mattermost-redux/selectors/entities/general';
import {isCurrentUserGuestUser, isCurrentUserSystemAdmin, isFirstAdmin} from 'mattermost-redux/selectors/entities/users';

import {GlobalState} from 'types/store';
import {
    openInvitationsModal,
    openWorkTemplateModal,
    setShowOnboardingCompleteProfileTour,
    setShowOnboardingVisitConsoleTour,
    switchToChannels,
} from 'actions/views/onboarding_tasks';

import {ModalIdentifiers, TELEMETRY_CATEGORIES, ExploreOtherToolsTourSteps} from 'utils/constants';

import BullsEye from 'components/common/svg_images_components/bulls_eye_svg';
import Channels from 'components/common/svg_images_components/channels_svg';
import Clipboard from 'components/common/svg_images_components/clipboard_svg';
import Newspaper from 'components/common/svg_images_components/newspaper_svg';
import Gears from 'components/common/svg_images_components/gears_svg';
import Handshake from 'components/common/svg_images_components/handshake_svg';
import Phone from 'components/common/svg_images_components/phone_svg';
import Security from 'components/common/svg_images_components/security_svg';
import Sunglasses from 'components/common/svg_images_components/sunglasses_svg';
import Wrench from 'components/common/svg_images_components/wrench_svg';
import {areWorkTemplatesEnabled} from 'selectors/work_template';

import {OnboardingTaskCategory, OnboardingTaskList, OnboardingTasksName, TaskNameMapToSteps} from './constants';
import {generateTelemetryTag} from './utils';

const getCategory = makeGetCategory();

const useGetTaskDetails = () => {
    const {formatMessage} = useIntl();
    return {
        [OnboardingTasksName.CREATE_FROM_WORK_TEMPLATE]: {
            id: 'task_create_from_work_template',
            svg: Newspaper,
            message: formatMessage({
                id: 'onboardingTask.checklist.task_create_from_work_template',
                defaultMessage: 'Create from a template - set up a channel with linked boards and playbooks.',
            }),
        },
        [OnboardingTasksName.CHANNELS_TOUR]: {
            id: 'task_learn_more_about_messaging',
            svg: Channels,
            message: formatMessage({
                id: 'onboardingTask.checklist.task_learn_more_about_messaging',
                defaultMessage: 'Take a tour of Channels.',
            }),
        },
        [OnboardingTasksName.BOARDS_TOUR]: {
            id: 'task_plan_sprint_with_kanban_style_boards',
            svg: BullsEye,
            message: formatMessage({
                id: 'onboardingTask.checklist.task_plan_sprint_with_kanban_style_boards',
                defaultMessage: 'Manage tasks with your first board.',
            }),
        },
        [OnboardingTasksName.PLAYBOOKS_TOUR]: {
            id: 'task_resolve_incidents_faster_with_playbooks',
            svg: Clipboard,
            message: formatMessage({
                id: 'onboardingTask.checklist.task_resolve_incidents_faster_with_playbooks',
                defaultMessage: 'Explore workflows with your first playbook.',
            }),
        },
        [OnboardingTasksName.INVITE_PEOPLE]: {
            id: 'task_invite_team_members',
            svg: Handshake,
            message: formatMessage({
                id: 'onboardingTask.checklist.task_invite_team_members',
                defaultMessage: 'Invite team members to the workspace.',
            }),
        },
        [OnboardingTasksName.COMPLETE_YOUR_PROFILE]: {
            id: 'task_complete_your_profile',
            svg: Sunglasses,
            message: formatMessage({
                id: 'onboardingTask.checklist.task_complete_your_profile',
                defaultMessage: 'Complete your profile.',
            }),
        },

        [OnboardingTasksName.EXPLORE_OTHER_TOOLS]: {
            id: 'task_explore_other_tools_in_platform',
            svg: Wrench,
            message: formatMessage({
                id: 'onboardingTask.checklist.task_explore_other_tools_in_platform',
                defaultMessage: 'Explore other tools in the platform.',
            }),
        },

        [OnboardingTasksName.DOWNLOAD_APP]: {
            id: 'task_download_mm_apps',
            svg: Phone,
            message: formatMessage({
                id: 'onboardingTask.checklist.task_download_mm_apps',
                defaultMessage: 'Download the Desktop and Mobile Apps.',
            }),
        },

        [OnboardingTasksName.VISIT_SYSTEM_CONSOLE]: {
            id: 'task_visit_system_console',
            svg: Gears,
            message: formatMessage({
                id: 'onboardingTask.checklist.task_visit_system_console',
                defaultMessage: 'Visit the System Console to configure your workspace.',
            }),
        },
        [OnboardingTasksName.START_TRIAL]: {
            id: 'task_start_enterprise_trial',
            svg: Security,
            message: formatMessage({
                id: 'onboardingTask.checklist.task_start_enterprise_trial',
                defaultMessage: 'Learn more about Enterprise-level high-security features.',
            }),
        },
    };
};

export const useTasksList = () => {
    const pluginsList = useSelector((state: GlobalState) => state.plugins.plugins);
    const prevTrialLicense = useSelector((state: GlobalState) => state.entities.admin.prevTrialLicense);
    const license = useSelector(getLicense);
    const isPrevLicensed = prevTrialLicense?.IsLicensed;
    const isCurrentLicensed = license?.IsLicensed;
    const isUserAdmin = useSelector((state: GlobalState) => isCurrentUserSystemAdmin(state));
    const isGuestUser = useSelector((state: GlobalState) => isCurrentUserGuestUser(state));
    const isUserFirstAdmin = useSelector(isFirstAdmin);
    const isThinOnBoardingTaskList = useSelector((state: GlobalState) => {
        return isReduceOnBoardingTaskList(state);
    });
    const workTemplateEnabled = useSelector(areWorkTemplatesEnabled);

    // Cloud conditions
    const subscription = useSelector((state: GlobalState) => state.entities.cloud.subscription);
    const isCloud = license?.Cloud === 'true';
    const isFreeTrial = subscription?.is_free_trial === 'true';
    const hadPrevCloudTrial = subscription?.is_free_trial === 'false' && subscription?.trial_end_at > 0;

    // Show this CTA if the instance is currently not licensed and has never had a trial license loaded before
    // if Cloud, show if not in trial and had never been on trial
    const selfHostedTrialCondition = isCurrentLicensed === 'false' && isPrevLicensed === 'false';
    const cloudTrialCondition = isCloud && !isFreeTrial && !hadPrevCloudTrial;

    const showStartTrialTask = selfHostedTrialCondition || cloudTrialCondition;

    const list: Record<string, string> = {...OnboardingTasksName};
    if (!pluginsList.focalboard || !isUserFirstAdmin) {
        delete list.BOARDS_TOUR;
    }
    if (!pluginsList.playbooks || !isUserFirstAdmin) {
        delete list.PLAYBOOKS_TOUR;
    }
    if (!showStartTrialTask) {
        delete list.START_TRIAL;
    }

    if (!isUserFirstAdmin && !isUserAdmin) {
        delete list.VISIT_SYSTEM_CONSOLE;
        delete list.START_TRIAL;
    }

    // explore other tools tour is only shown to subsequent admins and end users
    if (isUserFirstAdmin || (!pluginsList.playbooks && !pluginsList.focalboard)) {
        delete list.EXPLORE_OTHER_TOOLS;
    }

    // invite other users is hidden for guest users
    if (isGuestUser) {
        delete list.INVITE_PEOPLE;
    }

    if (isThinOnBoardingTaskList) {
        delete list.DOWNLOAD_APP;
        delete list.COMPLETE_YOUR_PROFILE;
        delete list.VISIT_SYSTEM_CONSOLE;
    }

    if (!workTemplateEnabled) {
        delete list.CREATE_FROM_WORK_TEMPLATE;
    }

    return Object.values(list);
};

export const useTasksListWithStatus = () => {
    const dataInDb = useSelector((state: GlobalState) => getCategory(state, OnboardingTaskCategory));
    const tasksList = useTasksList();
    const getTaskDetails = useGetTaskDetails();
    return useMemo(() =>
        tasksList.map((task) => {
            const status = dataInDb.find((pref) => pref.name === task)?.value;
            return {
                name: task,
                status: status === FINISHED.toString(),
                label: () => {
                    const {id, svg, message} = getTaskDetails[task];
                    return (
                        <div key={id}>
                            <picture>
                                {React.createElement(svg, {width: 24, height: 24})}
                            </picture>
                            <span>{message}</span>
                        </div>
                    );
                },
            };
        }), [dataInDb, tasksList]);
};

export const useHandleOnBoardingTaskData = () => {
    const dispatch = useDispatch();
    const currentUserId = useSelector(getCurrentUserId);
    const storeSavePreferences = useCallback(
        (taskCategory: string, taskName, step: number) => {
            const preferences = [
                {
                    user_id: currentUserId,
                    category: taskCategory,
                    name: taskName,
                    value: step.toString(),
                },
            ];
            dispatch(savePreferences(currentUserId, preferences));
        },
        [currentUserId],
    );

    return useCallback((
        taskName: string,
        step: number,
        trackEvent = true,
        trackEventSuffix?: string,
        taskCategory = OnboardingTaskCategory,
    ) => {
        storeSavePreferences(taskCategory, taskName, step);
        if (trackEvent) {
            const eventSuffix = trackEventSuffix ? `${step}--${trackEventSuffix}` : step.toString();
            const telemetryTag = generateTelemetryTag(OnboardingTaskCategory, taskName, eventSuffix);
            trackEventAction(OnboardingTaskCategory, telemetryTag);
        }
    }, [storeSavePreferences]);
};

export const useHandleOnBoardingTaskTrigger = () => {
    const dispatch = useDispatch();
    const history = useHistory();
    const {pathname} = useLocation();

    const handleSaveData = useHandleOnBoardingTaskData();
    const currentUserId = useSelector(getCurrentUserId);
    const isGuestUser = useSelector((state: GlobalState) => isCurrentUserGuestUser(state));
    const inAdminConsole = matchPath(pathname, {path: '/admin_console'}) != null;
    const inChannels = matchPath(pathname, {path: '/:team/channels/:chanelId'}) != null;
    const pluginsList = useSelector((state: GlobalState) => state.plugins.plugins);
    const boards = pluginsList.focalboard;

    return (taskName: string) => {
        switch (taskName) {
        case OnboardingTasksName.CREATE_FROM_WORK_TEMPLATE: {
            localStorage.setItem(OnboardingTaskCategory, 'true');
            dispatch(openWorkTemplateModal(inAdminConsole));
            handleSaveData(taskName, TaskNameMapToSteps[taskName].FINISHED, true);
            break;
        }
        case OnboardingTasksName.CHANNELS_TOUR: {
            handleSaveData(taskName, TaskNameMapToSteps[taskName].STARTED, true);
            const tourCategory = TutorialTourName.ONBOARDING_TUTORIAL_STEP;
            const preferences = [
                {
                    user_id: currentUserId,
                    category: tourCategory,
                    name: currentUserId,

                    // use SEND_MESSAGE when user is guest (channel creation and invitation are restricted), so only message box and the configure tips are shown
                    value: isGuestUser ? OnboardingTourStepsForGuestUsers.SEND_MESSAGE.toString() : OnboardingTourSteps.CHANNELS_AND_DIRECT_MESSAGES.toString(),
                },
                {
                    user_id: currentUserId,
                    category: tourCategory,
                    name: TTNameMapToATStatusKey[tourCategory],
                    value: AutoTourStatus.ENABLED.toString(),
                },
            ];
            dispatch(savePreferences(currentUserId, preferences));
            if (!inChannels) {
                dispatch(switchToChannels());
            }
            break;
        }
        case OnboardingTasksName.BOARDS_TOUR: {
            history.push('/boards');
            localStorage.setItem(OnboardingTaskCategory, 'true');
            handleSaveData(taskName, TaskNameMapToSteps[taskName].FINISHED, true);
            break;
        }
        case OnboardingTasksName.PLAYBOOKS_TOUR: {
            history.push('/playbooks/start');
            localStorage.setItem(OnboardingTaskCategory, 'true');
            handleSaveData(taskName, TaskNameMapToSteps[taskName].FINISHED, true);
            break;
        }
        case OnboardingTasksName.COMPLETE_YOUR_PROFILE: {
            dispatch(setStatusDropdown(true));
            dispatch(setShowOnboardingCompleteProfileTour(true));
            handleSaveData(taskName, TaskNameMapToSteps[taskName].STARTED, true);
            if (inAdminConsole) {
                dispatch(switchToChannels());
            }
            break;
        }
        case OnboardingTasksName.EXPLORE_OTHER_TOOLS: {
            dispatch(setProductMenuSwitcherOpen(true));
            handleSaveData(taskName, TaskNameMapToSteps[taskName].STARTED, true);
            const tourCategory = TutorialTourName.EXPLORE_OTHER_TOOLS;
            const preferences = [
                {
                    user_id: currentUserId,
                    category: tourCategory,
                    name: currentUserId,
                    value: boards ? ExploreOtherToolsTourSteps.BOARDS_TOUR.toString() : ExploreOtherToolsTourSteps.PLAYBOOKS_TOUR.toString(),
                },
                {
                    user_id: currentUserId,
                    category: tourCategory,
                    name: TTNameMapToATStatusKey[tourCategory],
                    value: AutoTourStatus.ENABLED.toString(),
                },
            ];
            dispatch(savePreferences(currentUserId, preferences));
            if (!inChannels) {
                dispatch(switchToChannels());
            }
            break;
        }
        case OnboardingTasksName.VISIT_SYSTEM_CONSOLE: {
            dispatch(setProductMenuSwitcherOpen(true));
            dispatch(setShowOnboardingVisitConsoleTour(true));
            handleSaveData(taskName, TaskNameMapToSteps[taskName].STARTED, true);
            break;
        }
        case OnboardingTasksName.INVITE_PEOPLE: {
            localStorage.setItem(OnboardingTaskCategory, 'true');

            if (inAdminConsole) {
                dispatch(openInvitationsModal(1000));
            } else {
                dispatch(openInvitationsModal());
            }
            handleSaveData(taskName, TaskNameMapToSteps[taskName].FINISHED, true);
            break;
        }
        case OnboardingTasksName.DOWNLOAD_APP: {
            handleSaveData(taskName, TaskNameMapToSteps[taskName].FINISHED, true);
            const preferences = [{
                user_id: currentUserId,
                category: OnboardingTaskCategory,
                name: OnboardingTaskList.ONBOARDING_TASK_LIST_OPEN,
                value: 'true',
            }];
            dispatch(savePreferences(currentUserId, preferences));
            window.open('https://mattermost.com/download/', '_blank', 'noopener,noreferrer');
            break;
        }
        case OnboardingTasksName.START_TRIAL: {
            trackEventAction(
                TELEMETRY_CATEGORIES.SELF_HOSTED_START_TRIAL_TASK_LIST,
                'open_start_trial_modal',
            );
            dispatch(openModal({
                modalId: ModalIdentifiers.LEARN_MORE_TRIAL_MODAL,
                dialogType: LearnMoreTrialModal,
                dialogProps: {
                    launchedBy: 'onboarding',
                },
            }));

            handleSaveData(taskName, TaskNameMapToSteps[taskName].FINISHED, true);
            break;
        }
        default:
        }
    };
};

