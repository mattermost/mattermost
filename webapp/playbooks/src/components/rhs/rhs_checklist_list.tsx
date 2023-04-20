// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';
import styled from 'styled-components';

import {getCurrentChannelId} from 'mattermost-redux/selectors/entities/channels';
import {getCurrentUser} from 'mattermost-redux/selectors/entities/users';
import {getTeammateNameDisplaySetting} from 'mattermost-redux/selectors/entities/preferences';
import {displayUsername} from 'mattermost-redux/utils/user_utils';
import {DateTime} from 'luxon';
import {GlobalState} from '@mattermost/types/store';

import {PlaybookRun, PlaybookRunStatus} from 'src/types/playbook_run';
import {
    finishRun,
    setAllChecklistsCollapsedState,
    setChecklistCollapsedState,
    setChecklistItemsFilter,
    setEveryChecklistCollapsedStateChange,
} from 'src/actions';
import {
    Checklist,
    ChecklistItem,
    ChecklistItemState,
    ChecklistItemsFilter,
} from 'src/types/playbook';
import {telemetryEventForPlaybookRun} from 'src/client';
import {HoverMenu, HoverMenuButton} from 'src/components/rhs/rhs_shared';
import {currentChecklistAllCollapsed, currentChecklistCollapsedState, currentChecklistItemsFilter} from 'src/selectors';
import MultiCheckbox, {CheckboxOption} from 'src/components/multi_checkbox';
import {DotMenuButton} from 'src/components/dot_menu';
import {SemiBoldHeading} from 'src/styles/headings';
import ChecklistList from 'src/components/checklist/checklist_list';

import {AnchorLinkTitle} from 'src/components/backstage/playbook_runs/shared';

import {ButtonsFormat as ItemButtonsFormat} from 'src/components/checklist_item/checklist_item';
import {PrimaryButton, TertiaryButton} from 'src/components/assets/buttons';
import TutorialTourTip, {useMeasurePunchouts, useShowTutorialStep} from 'src/components/tutorial/tutorial_tour_tip';
import {RunDetailsTutorialSteps, TutorialTourCategories} from 'src/components/tutorial/tours';
import GiveFeedbackButton from 'src/components/give_feedback_button';

interface Props {
    playbookRun: PlaybookRun;
    parentContainer: ChecklistParent;
    id?: string;
    readOnly: boolean;
    onReadOnlyInteract?: () => void
}

export enum ChecklistParent {
    RHS = 'rhs',
    RunDetails = 'run_details',
}

const StyledTertiaryButton = styled(TertiaryButton)`
    display: inline-block;
    margin: 12px 0;
`;

const StyledPrimaryButton = styled(PrimaryButton)`
    display: inline-block;
    margin: 12px 0;
`;

const RHSGiveFeedbackButton = styled(GiveFeedbackButton)`
    && {
        color: var(--center-channel-color-64);
    }

    &&:hover:not([disabled]) {
        color: var(--center-channel-color-72);
        background-color: var(--center-channel-color-08);
    }
`;

const allComplete = (checklists: Checklist[]) => {
    return notFinishedTasks(checklists) === 0;
};

const notFinishedTasks = (checklists: Checklist[]) => {
    let count = 0;
    for (const list of checklists) {
        for (const item of list.items) {
            if (item.state === ChecklistItemState.Open || item.state === ChecklistItemState.InProgress) {
                count++;
            }
        }
    }
    return count;
};

const RHSChecklistList = ({id, playbookRun, parentContainer, readOnly, onReadOnlyInteract}: Props) => {
    const dispatch = useDispatch();
    const {formatMessage} = useIntl();
    const channelId = useSelector(getCurrentChannelId);
    const stateKey = parentContainer + '_' + (parentContainer === ChecklistParent.RHS ? channelId : playbookRun.id);
    const allCollapsed = useSelector(currentChecklistAllCollapsed(stateKey));
    const checklistsState = useSelector(currentChecklistCollapsedState(stateKey));
    const checklistItemsFilter = useSelector((state) => currentChecklistItemsFilter(state as GlobalState, stateKey));
    const myUser = useSelector(getCurrentUser);
    const teamnameNameDisplaySetting = useSelector(getTeammateNameDisplaySetting) || '';
    const preferredName = displayUsername(myUser, teamnameNameDisplaySetting);
    const [showMenu, setShowMenu] = useState(false);

    const checklists = playbookRun.checklists || [];
    const filterOptions = makeFilterOptions(checklistItemsFilter, preferredName);
    const overdueTasksNum = overdueTasks(checklists);

    const onChecklistCollapsedStateChange = (checklistIndex: number, state: boolean) => {
        dispatch(setChecklistCollapsedState(stateKey, checklistIndex, state));
    };
    const onEveryChecklistCollapsedStateChange = (state: Record<number, boolean>) => {
        dispatch(setEveryChecklistCollapsedStateChange(stateKey, state));
    };

    const showItem = (checklistItem: ChecklistItem, myId: string) => {
        if (checklistItemsFilter.all) {
            return true;
        }

        // "Show checked tasks" is not checked, so if item is checked (closed), don't show it.
        if (!checklistItemsFilter.checked && checklistItem.state === ChecklistItemState.Closed) {
            return false;
        }

        // "Show skipped tasks" is not checked, so if item is skipped, don't show it.
        if (!checklistItemsFilter.skipped && checklistItem.state === ChecklistItemState.Skip) {
            return false;
        }

        // "Me" is not checked, so if assignee_id is me, don't show it.
        if (!checklistItemsFilter.me && checklistItem.assignee_id === myId) {
            return false;
        }

        // "Unassigned" is not checked, so if assignee_id is blank (unassigned), don't show it.
        if (!checklistItemsFilter.unassigned && checklistItem.assignee_id === '') {
            return false;
        }

        // "Others" is not checked, so if item has someone else as the assignee, don't show it.
        if (!checklistItemsFilter.others && checklistItem.assignee_id !== '' && checklistItem.assignee_id !== myId) {
            return false;
        }

        // "Overdue" is checked
        if (checklistItemsFilter.overdueOnly) {
            // if an item doesn't have a due date or is due in the future, don't show it.
            if (checklistItem.due_date === 0 || DateTime.fromMillis(checklistItem.due_date) > DateTime.now()) {
                return false;
            }

            // if an item is skipped or closed, don't show it.
            if (checklistItem.state === ChecklistItemState.Closed || checklistItem.state === ChecklistItemState.Skip) {
                return false;
            }
        }

        // We should show it!
        return true;
    };

    // Cancel overdueOnly filter if there are no overdue tasks anymore
    if (overdueTasksNum === 0 && checklistItemsFilter.overdueOnly) {
        dispatch(setChecklistItemsFilter(stateKey, {
            ...checklistItemsFilter,
            overdueOnly: false,
        }));
    }

    const selectOption = (value: string, checked: boolean) => {
        telemetryEventForPlaybookRun(playbookRun.id, 'checklists_filter_selected');

        if (checklistItemsFilter.all && value !== 'all') {
            return;
        }
        if (isLastCheckedValueInBottomCategory(value, checked, checklistItemsFilter)) {
            return;
        }

        dispatch(setChecklistItemsFilter(stateKey, {
            ...checklistItemsFilter,
            [value]: checked,
        }));
    };

    const title = parentContainer === ChecklistParent.RunDetails ? (
        <AnchorLinkTitle
            title={formatMessage({defaultMessage: 'Tasks'})}
            id={id || ''}
        />
    ) : <>{formatMessage({defaultMessage: 'Tasks'})}</>;

    const itemButtonsFormat = () => {
        if (parentContainer === ChecklistParent.RHS) {
            return ItemButtonsFormat.Short;
        }

        if (readOnly) {
            return ItemButtonsFormat.Mixed;
        }

        return ItemButtonsFormat.Long;
    };
    const FinishButton = allComplete(checklists) ? StyledPrimaryButton : StyledTertiaryButton;
    const active = (playbookRun !== undefined) && (playbookRun.current_status === PlaybookRunStatus.InProgress);

    const checklistsPunchout = useMeasurePunchouts(
        ['pb-checklists-inner-container'],
        [],
        {y: -5, height: 10, x: -5, width: 10},
    );
    const showRunDetailsChecklistsStep = useShowTutorialStep(
        RunDetailsTutorialSteps.Checklists,
        TutorialTourCategories.RUN_DETAILS
    );

    return (
        <InnerContainer
            id='pb-checklists-inner-container'
            onMouseEnter={() => setShowMenu(true)}
            onMouseLeave={() => setShowMenu(false)}
            parentContainer={parentContainer}
        >
            <MainTitleBG numChecklists={checklists.length}>
                <MainTitle parentContainer={parentContainer}>
                    {title}
                    {
                        overdueTasksNum > 0 &&
                        <OverdueTasksToggle
                            data-testid='overdue-tasks-filter'
                            toggled={checklistItemsFilter.overdueOnly}
                            onClick={() => selectOption('overdueOnly', !checklistItemsFilter.overdueOnly)}
                        >
                            {formatMessage({defaultMessage: '{num} {num, plural, =1 {task} other {tasks}} overdue'}, {num: overdueTasksNum})}
                        </OverdueTasksToggle>
                    }
                    {
                        showMenu &&
                        <HoverRow>
                            <ExpandHoverButton
                                title={allCollapsed ? formatMessage({defaultMessage: 'Expand'}) : formatMessage({defaultMessage: 'Collapse'})}
                                className={(allCollapsed ? 'icon-arrow-expand' : 'icon-arrow-collapse') + ' icon-16 btn-icon'}
                                onClick={() => dispatch(setAllChecklistsCollapsedState(stateKey, !allCollapsed, checklists.length))}
                            />
                            <MultiCheckbox
                                options={filterOptions}
                                onselect={selectOption}
                                placement='bottom-end'
                                dotMenuButton={StyledDotMenuButton}
                                icon={
                                    <IconWrapper title={formatMessage({defaultMessage: 'Filter items'})}>
                                        <i className='icon icon-filter-variant'/>
                                    </IconWrapper>
                                }
                            />
                        </HoverRow>
                    }
                </MainTitle>
            </MainTitleBG>
            <ChecklistList
                playbookRun={playbookRun}
                isReadOnly={readOnly}
                checklistsCollapseState={checklistsState}
                onChecklistCollapsedStateChange={onChecklistCollapsedStateChange}
                onEveryChecklistCollapsedStateChange={onEveryChecklistCollapsedStateChange}
                showItem={showItem}
                itemButtonsFormat={itemButtonsFormat()}
                onReadOnlyInteract={onReadOnlyInteract}
            />
            {
                active && parentContainer === ChecklistParent.RHS && playbookRun &&
                <FinishButton
                    onClick={() => {
                        if (readOnly && onReadOnlyInteract) {
                            onReadOnlyInteract();
                        } else {
                            dispatch(finishRun(playbookRun?.team_id || '', playbookRun?.id));
                        }
                    }}
                >
                    {formatMessage({defaultMessage: 'Finish run'})}
                </FinishButton>
            }
            <RHSGiveFeedbackButton/>
            {showRunDetailsChecklistsStep && (
                <TutorialTourTip
                    title={<FormattedMessage defaultMessage='Track progress and ownership'/>}
                    screen={<FormattedMessage defaultMessage='Assign, check off, or skip tasks to ensure the team is clear on how to move toward the finish line together.'/>}
                    tutorialCategory={TutorialTourCategories.RUN_DETAILS}
                    step={RunDetailsTutorialSteps.Checklists}
                    showOptOut={false}
                    placement='left'
                    pulsatingDotPlacement='top-start'
                    pulsatingDotTranslate={{x: 0, y: 0}}
                    width={352}
                    autoTour={true}
                    punchOut={checklistsPunchout}
                    telemetryTag={`tutorial_tip_Playbook_Run_Details_${RunDetailsTutorialSteps.Checklists}_Checklists`}
                />
            )}
        </InnerContainer>
    );
};

const InnerContainer = styled.div<{parentContainer?: ChecklistParent}>`
    position: relative;
    z-index: 1;

    display: flex;
    flex-direction: column;

    ${({parentContainer}) => parentContainer !== ChecklistParent.RunDetails && `
        padding: 0 12px 24px 12px;

        &:hover {
            background-color: rgba(var(--center-channel-color-rgb), 0.04);
        }
    `}

    .pb-tutorial-tour-tip__pulsating-dot-ctr {
        z-index: 1000;
    }
`;

const MainTitleBG = styled.div<{numChecklists: number}>`
    background-color: var(--center-channel-bg);
    z-index: ${({numChecklists}) => numChecklists + 2};
    position: sticky;
    top: 0;
`;

const MainTitle = styled.div<{parentContainer?: ChecklistParent}>`
    ${SemiBoldHeading} {
    }

    font-size: 16px;
    line-height: 24px;
    padding: ${(props) => (props.parentContainer === ChecklistParent.RunDetails ? '12px 0' : '12px 0 12px 8px')};
`;

const HoverRow = styled(HoverMenu)`
    top: 6px;
    right: 0px;
`;

const ExpandHoverButton = styled(HoverMenuButton)`
    padding: 3px 0 0 1px;
`;

const StyledDotMenuButton = styled(DotMenuButton)`
    display: inline-block;
    width: 28px;
    height: 28px;
`;

const IconWrapper = styled.div`
    padding: 3px 0 0 1px;
    margin: 0;
`;

const OverdueTasksToggle = styled.div<{toggled: boolean}>`
    font-weight: 600;
    font-size: 12px;
    line-height: 16px;
    display: inline-block;
    margin-left: 5px;
    padding: 2px 4px;
    align-items: center;
    border-radius: 4px;
    user-select: none;
    cursor: pointer;
    background-color: ${(props) => (props.toggled ? 'var(--dnd-indicator)' : 'rgba(var(--dnd-indicator-rgb), 0.08)')};
    color: ${(props) => (props.toggled ? 'var(--button-color)' : 'var(--dnd-indicator)')};
`;

export default RHSChecklistList;

const overdueTasks = (checklists: Checklist[]) => {
    let count = 0;
    const now = DateTime.now();
    for (const list of checklists) {
        for (const item of list.items) {
            if ((item.state === ChecklistItemState.Open || item.state === ChecklistItemState.InProgress) &&
                item.due_date > 0 && DateTime.fromMillis(item.due_date) <= now) {
                count++;
            }
        }
    }
    return count;
};

const makeFilterOptions = (filter: ChecklistItemsFilter, name: string): CheckboxOption[] => {
    return [
        {
            display: 'All tasks',
            value: 'all',
            selected: filter.all,
            disabled: false,
        },
        {
            value: 'divider',
            display: '',
        },
        {
            value: 'title',
            display: 'TASK STATE',
        },
        {
            display: 'Show checked tasks',
            value: 'checked',
            selected: filter.checked,
            disabled: filter.all,
        },
        {
            display: 'Show skipped tasks',
            value: 'skipped',
            selected: filter.skipped,
            disabled: filter.all,
        },
        {
            value: 'divider',
            display: '',
        },
        {
            value: 'title',
            display: 'ASSIGNEE',
        },
        {
            display: `Me (${name})`,
            value: 'me',
            selected: filter.me,
            disabled: filter.all,
        },
        {
            display: 'Unassigned',
            value: 'unassigned',
            selected: filter.unassigned,
            disabled: filter.all,
        },
        {
            display: 'Others',
            value: 'others',
            selected: filter.others,
            disabled: filter.all,
        },
    ];
};

// isLastCheckedValueInBottomCategory returns true only if this value is in the bottom category and
// it is the last checked value. We don't want to allow the user to deselect all the options in
// the bottom category.
const isLastCheckedValueInBottomCategory = (value: string, nextState: boolean, filter: ChecklistItemsFilter) => {
    const inBottomCategory = (val: string) => val === 'me' || val === 'unassigned' || val === 'others';
    if (!inBottomCategory(value)) {
        return false;
    }
    const numChecked = ['me', 'unassigned', 'others'].reduce((accum, cur) => (
        (inBottomCategory(cur) && filter[cur]) ? accum + 1 : accum
    ), 0);
    return numChecked === 1 && filter[value];
};
