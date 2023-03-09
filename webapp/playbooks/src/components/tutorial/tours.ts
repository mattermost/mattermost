// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

//TODO replace with playbooks tutorials here

export const FINISHED = 999;
export const SKIPPED = -999;

export const AutoTourStatus = {
    ENABLED: 0,
    DISABLED: 1,
};

const AutoStatusSuffix = '_at_status';

export const TutorialTourCategories: Record<string, string> = {
    PB_TOUR_EX: 'tutorial_pb_tour_ex',
    PLAYBOOK_EDIT: 'playbook_edit',
    RUN_DETAILS: 'tutorial_pb_run_details',
    PLAYBOOK_PREVIEW: 'playbook_preview',
};

export const PB_TOUR_EX = {
    START: 0,
    FINISHED,
};

export const PlaybookEditTutorialSteps = {
    Checklists: 0,
    Actions: 1,
    StatusUpdates: 2,
    Retrospective: 3,
    FINISHED,
};
export const RunDetailsTutorialSteps = {
    SidePanel: 0,
    PostUpdate: 1,
    Checklists: 2,
    FINISHED,
};
export const PlaybookPreviewTutorialSteps = {
    EditButton: 0,
    Navbar: 1,
    RunButton: 2,
    FINISHED,
};

export const TTCategoriesMapToSteps: Record<string, Record<string, number>> = {
    [TutorialTourCategories.PB_TOUR_EX]: PB_TOUR_EX,
    [TutorialTourCategories.PLAYBOOK_EDIT]: PlaybookEditTutorialSteps,
    [TutorialTourCategories.PLAYBOOK_PREVIEW]: PlaybookPreviewTutorialSteps,
    [TutorialTourCategories.RUN_DETAILS]: RunDetailsTutorialSteps,
};

export const TTCategoriesMapToAutoTourStatusKey = Object.values(TutorialTourCategories).reduce((result, category) => {
    result[category] = category + AutoStatusSuffix;
    return result;
}, {} as Record<string, string>);
