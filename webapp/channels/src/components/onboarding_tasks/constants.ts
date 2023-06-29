// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

const FINISHED = 999;

export const OnboardingTaskCategory = 'onboarding_task_list';

// Whole task list is based on these
export const OnboardingTasksName = {
    CHANNELS_TOUR: 'channels_tour',
    BOARDS_TOUR: 'boards_tour',
    PLAYBOOKS_TOUR: 'playbooks_tour',
    INVITE_PEOPLE: 'invite_people',
    DOWNLOAD_APP: 'download_app',
    COMPLETE_YOUR_PROFILE: 'complete_your_profile',
    EXPLORE_OTHER_TOOLS: 'explore_other_tools',
    VISIT_SYSTEM_CONSOLE: 'visit_system_console',
    START_TRIAL: 'start_trial',
};

export const OnboardingTaskList = {
    ONBOARDING_TASK_LIST_OPEN: 'onboarding_task_list_open',
    ONBOARDING_TASK_LIST_SHOW: 'onboarding_task_list_show',
    ONBOARDING_TASK_LIST_CLOSE: 'onboarding_task_list_close',
    ONBOARDING_VIDEO_MODAL: 'onboarding_video_modal',
    DECLINED_ONBOARDING_TASK_LIST: 'declined_onboarding_task_list',
};

export const GenericTaskSteps = {
    START: 0,
    STARTED: 1,
    FINISHED,
};

export const TaskNameMapToSteps = {
    [OnboardingTasksName.CHANNELS_TOUR]: GenericTaskSteps,
    [OnboardingTasksName.BOARDS_TOUR]: GenericTaskSteps,
    [OnboardingTasksName.PLAYBOOKS_TOUR]: GenericTaskSteps,
    [OnboardingTasksName.COMPLETE_YOUR_PROFILE]: GenericTaskSteps,
    [OnboardingTasksName.EXPLORE_OTHER_TOOLS]: GenericTaskSteps,
    [OnboardingTasksName.DOWNLOAD_APP]: GenericTaskSteps,
    [OnboardingTasksName.VISIT_SYSTEM_CONSOLE]: GenericTaskSteps,
    [OnboardingTasksName.INVITE_PEOPLE]: GenericTaskSteps,
    [OnboardingTasksName.START_TRIAL]: GenericTaskSteps,
};

