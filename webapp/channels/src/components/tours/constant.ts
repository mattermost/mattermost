// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

export const FINISHED = 999;
export const SKIPPED = 999;

export const ChannelsTourTelemetryPrefix = 'channels-tour';
const AutoStatusSuffix = '_auto_tour_status';

export const AutoTourStatus = {
    ENABLED: 1,
    DISABLED: 0,
};

// this should be used as for the tours related to channels
export const ChannelsTour = 'channels_tour';

export const OtherToolsTour = 'other_tools_tour';

export const WorkTemplatesTour = 'work_templates_tour';

export const TutorialTourName = {
    ONBOARDING_TUTORIAL_STEP: 'tutorial_step',
    ONBOARDING_TUTORIAL_STEP_FOR_GUESTS: 'tutorial_step_for_guest',
    CRT_TUTORIAL_STEP: 'crt_tutorial_step',
    CRT_THREAD_PANE_STEP: 'crt_thread_pane_step',
    AUTO_TOUR_STATUS: 'auto_tour_status',
    EXPLORE_OTHER_TOOLS: 'explore_tools',
    WORK_TEMPLATE_TUTORIAL: 'work_template',
};

export const OnboardingTourSteps = {
    CHANNELS_AND_DIRECT_MESSAGES: 0,
    CREATE_AND_JOIN_CHANNELS: 1,
    INVITE_PEOPLE: 2,
    SEND_MESSAGE: 3,
    CUSTOMIZE_EXPERIENCE: 4,
    FINISHED,
};

export const OnboardingTourStepsForGuestUsers = {
    SEND_MESSAGE: 0,
    CUSTOMIZE_EXPERIENCE: 1,
    FINISHED,
};

export const ExploreOtherToolsTourSteps = {
    BOARDS_TOUR: 0,
    PLAYBOOKS_TOUR: 1,
    FINISHED,
};

export const CrtTutorialSteps = {
    WELCOME_POPOVER: 0,
    LIST_POPOVER: 1,
    UNREAD_POPOVER: 2,
    FINISHED,
};

export const WorkTemplateTourSteps = {
    PLAYBOOKS_TOUR_TIP: 0,
    BOARDS_TOUR_TIP: 1,
    FINISHED,
};

export const CrtTutorialTriggerSteps = {
    START: 0,
    STARTED: 1,
    FINISHED,
};

export const TTNameMapToATStatusKey = {
    [TutorialTourName.ONBOARDING_TUTORIAL_STEP]: TutorialTourName.ONBOARDING_TUTORIAL_STEP + AutoStatusSuffix,
    [TutorialTourName.CRT_TUTORIAL_STEP]: 'crt_tutorial_auto_tour_status',
    [TutorialTourName.CRT_THREAD_PANE_STEP]: TutorialTourName.CRT_THREAD_PANE_STEP + AutoStatusSuffix,
    [TutorialTourName.EXPLORE_OTHER_TOOLS]: TutorialTourName.EXPLORE_OTHER_TOOLS + AutoStatusSuffix,
    [TutorialTourName.WORK_TEMPLATE_TUTORIAL]: TutorialTourName.WORK_TEMPLATE_TUTORIAL + AutoStatusSuffix,
};

export const TTNameMapToTourSteps = {
    [TutorialTourName.ONBOARDING_TUTORIAL_STEP]: OnboardingTourSteps,
    [TutorialTourName.ONBOARDING_TUTORIAL_STEP_FOR_GUESTS]: OnboardingTourStepsForGuestUsers,
    [TutorialTourName.CRT_TUTORIAL_STEP]: CrtTutorialSteps,
    [TutorialTourName.EXPLORE_OTHER_TOOLS]: ExploreOtherToolsTourSteps,
    [TutorialTourName.WORK_TEMPLATE_TUTORIAL]: WorkTemplateTourSteps,
};
