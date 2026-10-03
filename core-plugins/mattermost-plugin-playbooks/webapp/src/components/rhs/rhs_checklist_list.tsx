// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';
import styled, {css} from 'styled-components';

import {getCurrentUser} from 'mattermost-redux/selectors/entities/users';
import {getTeammateNameDisplaySetting} from 'mattermost-redux/selectors/entities/preferences';
import {displayUsername} from 'mattermost-redux/utils/user_utils';
import {DateTime} from 'luxon';
import {GlobalState} from '@mattermost/types/store';

import {PlaybookRun, PlaybookRunStatus} from 'src/types/playbook_run';
import {PlaybookRunType} from 'src/graphql/generated/graphql';
import {
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
import {HoverMenu, HoverMenuButton} from 'src/components/rhs/rhs_shared';
import {currentChecklistAllCollapsed, currentChecklistCollapsedState, currentChecklistItemsFilter} from 'src/selectors';
import MultiCheckbox, {CheckboxOption} from 'src/components/multi_checkbox';
import {DotMenuButton} from 'src/components/dot_menu';
import {SemiBoldHeading} from 'src/styles/headings';
import ChecklistList from 'src/components/checklist/checklist_list';
import {AnchorLinkTitle} from 'src/components/backstage/playbook_runs/shared';
import {ButtonsFormat as ItemButtonsFormat} from 'src/components/checklist_item/checklist_item';
import TutorialTourTip, {useMeasurePunchouts, useShowTutorialStep} from 'src/components/tutorial/tutorial_tour_tip';
import {RunDetailsTutorialSteps, TutorialTourCategories} from 'src/components/tutorial/tours';
import {useParticipateInRun} from 'src/hooks';
import {useOnRestoreRun} from 'src/components/backstage/playbook_runs/playbook_run/restore_run';
import {RunPermissionFields, useCanModifyRun, useCanRestoreRun} from 'src/hooks/run_permissions';

import RHSFooter from './rhs_checklist_list_footer';

interface Props {
    playbookRun: PlaybookRun;
    parentContainer: ChecklistParent;
    id?: string;
    readOnly: boolean;
    onReadOnlyInteract?: () => void
    autoAddTask?: boolean;
    onTaskAdded?: () => void;
    onBackClick?: () => void;
}

export enum ChecklistParent {
    RHS = 'rhs',
    RunDetails = 'run_details',
}

const RHSChecklistList = ({id, playbookRun, parentContainer, readOnly, onReadOnlyInteract, autoAddTask, onTaskAdded, onBackClick}: Props) => {
    const dispatch = useDispatch();
    const {formatMessage} = useIntl();
    const stateKey = parentContainer + '_' + playbookRun.id;
    const allCollapsed = useSelector(currentChecklistAllCollapsed(stateKey));
    const checklistsState = useSelector(currentChecklistCollapsedState(stateKey));
    const checklistItemsFilter = useSelector((state) => currentChecklistItemsFilter(state as GlobalState, stateKey));
    const myUser = useSelector(getCurrentUser);
    const teamnameNameDisplaySetting = useSelector(getTeammateNameDisplaySetting) || '';
    const preferredName = displayUsername(myUser, teamnameNameDisplaySetting);
    const [showMenu, setShowMenu] = useState(false);

    const isParticipant = playbookRun.participant_ids.includes(myUser.id);
    const {ParticipateConfirmModal, showParticipateConfirm} = useParticipateInRun(playbookRun ?? undefined);

    // Create a minimal run object with only the fields needed for permission checking
    const runForPermissions: RunPermissionFields = {
        type: playbookRun.type,
        channel_id: playbookRun.channel_id,
        team_id: playbookRun.team_id,
        owner_user_id: playbookRun.owner_user_id,
        participant_ids: playbookRun.participant_ids,
        current_status: playbookRun.current_status,
    };

    const canModify = useCanModifyRun(runForPermissions, myUser.id);
    const canRestore = useCanRestoreRun(runForPermissions, myUser.id);

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
        // Hide items with condition_action = "hidden"
        // This check must come FIRST to ensure hidden items stay hidden
        // regardless of other filter settings
        if (checklistItem.condition_action === 'hidden') {
            return false;
        }

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
    const active = playbookRun.current_status === PlaybookRunStatus.InProgress;
    const finished = playbookRun.current_status === PlaybookRunStatus.Finished;

    const handleResume = useOnRestoreRun(playbookRun, 'rhs');

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
            data-testid='pb-checklists-inner-container'
            onMouseEnter={() => setShowMenu(true)}
            onMouseLeave={() => setShowMenu(false)}
            parentContainer={parentContainer}
        >
            {playbookRun.type !== PlaybookRunType.ChannelChecklist && (
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
                                        <FilterIconWrapper title={formatMessage({defaultMessage: 'Filter items'})}>
                                            <i className='icon icon-filter-variant'/>
                                        </FilterIconWrapper>
                                    }
                                />
                            </HoverRow>
                        }
                    </MainTitle>
                </MainTitleBG>
            )}
            <ChecklistList
                playbookRun={playbookRun}
                isReadOnly={readOnly}
                checklistsCollapseState={checklistsState}
                onChecklistCollapsedStateChange={onChecklistCollapsedStateChange}
                onEveryChecklistCollapsedStateChange={onEveryChecklistCollapsedStateChange}
                showItem={showItem}
                itemButtonsFormat={itemButtonsFormat()}
                onReadOnlyInteract={onReadOnlyInteract}
                autoAddTask={autoAddTask}
                onTaskAdded={onTaskAdded}
            />
            <RHSFooter
                playbookRun={playbookRun}
                parentContainer={parentContainer}
                active={active}
                finished={finished}
                canModify={canModify}
                canRestore={canRestore}
                isParticipant={isParticipant}
                showParticipateConfirm={showParticipateConfirm}
                handleResume={handleResume}
                onBackClick={onBackClick}
            />
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
                />
            )}
            {ParticipateConfirmModal}
        </InnerContainer>
    );
};

const InnerContainer = styled.div<{parentContainer?: ChecklistParent}>`
    position: relative;
    z-index: 1;
    display: flex;
    flex-direction: column;
    flex: 1;

    ${({parentContainer}) => parentContainer !== ChecklistParent.RunDetails && css`
        /* in playbook editor */
        padding: 0 12px 24px;

    `};

    .pb-tutorial-tour-tip__pulsating-dot-ctr {
        z-index: 1000;
    }
`;

const MainTitleBG = styled.div<{numChecklists: number}>`
    position: sticky;
    z-index: ${({numChecklists}) => numChecklists + 2};
    top: 0;
    background-color: var(--center-channel-bg);
`;

const MainTitle = styled.div<{parentContainer?: ChecklistParent}>`
    ${SemiBoldHeading};

    font-size: 16px;
    line-height: 24px;
    padding: ${(props) => (props.parentContainer === ChecklistParent.RunDetails ? '12px 0' : '12px 0 12px 8px')};
`;

const HoverRow = styled(HoverMenu)`
    top: 6px;
    right: 0;
`;

const ExpandHoverButton = styled(HoverMenuButton)`
    padding: 3px 0 0 1px;
`;

const StyledDotMenuButton = styled(DotMenuButton)`
    display: inline-block;
    width: 28px;
    height: 28px;
`;

const FilterIconWrapper = styled.div`
    padding: 3px 0 0 1px;
    margin: 0;
`;

const OverdueTasksToggle = styled.div<{toggled: boolean}>`
    display: inline-block;
    align-items: center;
    padding: 2px 4px;
    border-radius: 4px;
    margin-left: 5px;
    background-color: ${(props) => (props.toggled ? 'var(--dnd-indicator)' : 'rgba(var(--dnd-indicator-rgb), 0.08)')};
    color: ${(props) => (props.toggled ? 'var(--button-color)' : 'var(--dnd-indicator)')};
    cursor: pointer;
    font-size: 12px;
    font-weight: 600;
    line-height: 16px;
    user-select: none;
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
const isLastCheckedValueInBottomCategory = (value: string, _nextState: boolean, filter: ChecklistItemsFilter) => {
    const inBottomCategory = (val: string) => val === 'me' || val === 'unassigned' || val === 'others';
    if (!inBottomCategory(value)) {
        return false;
    }
    const numChecked = ['me', 'unassigned', 'others'].reduce((accum, cur) => (
        (inBottomCategory(cur) && filter[cur]) ? accum + 1 : accum
    ), 0);
    return numChecked === 1 && filter[value];
};
