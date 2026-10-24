// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect, useState} from 'react';
import {useDispatch, useSelector} from 'react-redux';
import {FormattedMessage, useIntl} from 'react-intl';
import styled from 'styled-components';
import {getCurrentUserId} from 'mattermost-redux/selectors/entities/users';
import Icon from '@mdi/react';
import {mdiCircleSmall} from '@mdi/js';
import InfiniteScroll from 'react-infinite-scroller';

import DotMenu, {DotMenuButton, DropdownMenu, DropdownMenuItem} from 'src/components/dot_menu';

import {fetchPlaybookRuns} from 'src/client';
import {PlaybookRunChecklistItem, PlaybookRunStatus} from 'src/types/playbook_run';
import {ChecklistItemState} from 'src/types/playbook';
import {isTaskOverdue, selectMyTasks} from 'src/selectors';
import {receivedPlaybookRuns} from 'src/actions';

import {useEnsureProfiles} from 'src/hooks';

import Task from './task';

export const TaskInboxTitle = <FormattedMessage defaultMessage={'Your tasks'}/>;

enum Filter {
    FilterChecked = 'checked',
    FilterRunOwner = 'ownrun',
}

const filterTasks = (checklistItems: PlaybookRunChecklistItem[], userId: string, filters: Filter[]) => {
    return checklistItems
        .filter((item) => {
            if (item.assignee_id !== userId && !filters.includes(Filter.FilterRunOwner)) {
                return false;
            }
            if (item.state !== ChecklistItemState.Open && !filters.includes(Filter.FilterChecked)) {
                return false;
            }
            if (item.assignee_id === '' && item.playbook_run_owner_user_id !== userId && filters.includes(Filter.FilterRunOwner)) {
                return false;
            }

            return true;
        })
        .sort((a, b) => {
            if (a.due_date !== 0 && b.due_date === 0) {
                return -1;
            }
            if (a.due_date === 0 && b.due_date !== 0) {
                return 1;
            }
            if (a.due_date !== 0 && b.due_date !== 0) {
                return -1 * (b.due_date - a.due_date);
            }
            return -1 * (b.playbook_run_create_at - a.playbook_run_create_at);
        });
};

const ITEMS_PER_PAGE = 20;

const TaskInbox = () => {
    const {formatMessage} = useIntl();
    const dispatch = useDispatch();
    const [filters, setFilters] = useState<Filter[]>([Filter.FilterRunOwner]);
    const currentUserId = useSelector(getCurrentUserId);
    const myTasks = useSelector(selectMyTasks);

    useEffect(() => {
        const options = {
            page: 0,
            per_page: 50,
            statuses: [PlaybookRunStatus.InProgress],
            participant_id: currentUserId,
        };
        fetchPlaybookRuns(options)
            .then((res) => dispatch(receivedPlaybookRuns(res.items || [])));
    }, [currentUserId]);

    const toggleFilter = (f: Filter) => {
        if (filters.includes(f)) {
            setFilters([...filters.filter((e) => e !== f)]);
        } else {
            setFilters([...filters, f]);
        }
    };

    const getZeroCaseTexts = (myTasksNum: number, filteredTasksNum: number) => {
        if (myTasksNum === 0) {
            return [
                formatMessage({defaultMessage: 'No assigned tasks'}),
                formatMessage({defaultMessage: 'You don\'t have any pending task assigned.'}),
            ];
        }
        if (myTasksNum > 0 && filteredTasksNum === 0) {
            return [
                formatMessage({defaultMessage: 'No assigned tasks'}),
                formatMessage({defaultMessage: 'There is no task explicitly assigned to you. You can expand your search using the filters.'}),
            ];
        }
        return ['', ''];
    };

    const tasks = filterTasks(myTasks, currentUserId, filters);
    const uniqueParticipantIds = [...new Set(
        tasks.reduce((cumm: string[], task) => cumm.concat(task.playbook_run_participant_user_ids), [])
    )];
    const assignedNum = tasks.filter((item) => item.assignee_id === currentUserId).length;
    const overdueNum = tasks.filter((item) => isTaskOverdue(item)).length;
    const [zerocaseTitle, zerocaseSubtitle] = getZeroCaseTexts(myTasks.length, tasks.length);
    const [currentPage, setCurrentPage] = useState(0);
    const [visibleTasks, setVisibleTasks] = useState(tasks.slice(0, ITEMS_PER_PAGE));

    useEnsureProfiles(uniqueParticipantIds);

    useEffect(() => {
        setVisibleTasks(tasks.slice(0, (currentPage * ITEMS_PER_PAGE) + ITEMS_PER_PAGE));
    }, [JSON.stringify(tasks), currentPage]);

    return (
        <Container>
            <Filters>
                <FilterAssignedText>
                    {formatMessage({defaultMessage: '{assignedNum, plural, =0 {No assigned tasks} other {# assigned}}'}, {assignedNum})}
                </FilterAssignedText>
                {overdueNum ? (
                    <Icon
                        path={mdiCircleSmall}
                        size={1}
                    />
                ) : null }
                <FilterOverdueText>
                    {formatMessage({defaultMessage: '{overdueNum, plural, =0 {} other {# overdue}}'}, {overdueNum})}
                </FilterOverdueText>
                <ExpandRight/>
                <DotMenu
                    icon={<div>{formatMessage({defaultMessage: 'Filters'})}</div>}
                    dotMenuButton={FilterButton}
                    dropdownMenu={StyledDropdownMenu}
                    placement='bottom-end'
                    title={formatMessage({defaultMessage: 'More'})}
                >
                    <StyledDropdownMenuItem
                        onClick={() => toggleFilter(Filter.FilterRunOwner)}
                        checked={filters.includes(Filter.FilterRunOwner)}
                    >
                        {formatMessage({defaultMessage: 'Show all tasks from runs I own'})}
                    </StyledDropdownMenuItem>
                    <StyledDropdownMenuItem
                        onClick={() => toggleFilter(Filter.FilterChecked)}
                        checked={filters.includes(Filter.FilterChecked)}
                    >
                        {formatMessage({defaultMessage: 'Show checked tasks'})}
                    </StyledDropdownMenuItem>
                </DotMenu>
            </Filters>
            {tasks.length === 0 ? (
                <ZeroCase>
                    <ZeroCaseIconWrapper>
                        <ZeroCaseIcon/>
                    </ZeroCaseIconWrapper>
                    <ZeroCaseTitle>{zerocaseTitle}</ZeroCaseTitle>
                    <ZeroCaseDescription>{zerocaseSubtitle}</ZeroCaseDescription>
                </ZeroCase>
            ) : (
                <InfiniteScrollContainer>
                    <InfiniteScroll
                        pageStart={0}
                        loadMore={(page: number) => setCurrentPage(page)}
                        hasMore={(currentPage * ITEMS_PER_PAGE) + ITEMS_PER_PAGE < tasks.length}
                        loader={<span key='loader'/>}
                        useWindow={false}
                    >
                        <TaskList key={'tasklist'}>
                            {visibleTasks.map((task) => (
                                <Task
                                    key={task.id}
                                    item={task}
                                    enableAnimation={!filters.includes(Filter.FilterChecked)}
                                />
                            ))}
                        </TaskList>
                    </InfiniteScroll>
                </InfiniteScrollContainer>
            )}
        </Container>
    );
};

export default TaskInbox;

const Container = styled.div`
    display: flex;
    flex: 1;
    flex-direction: column;
`;

const Filters = styled.div`
    display: flex;
    height: 56px;
    min-height: 56px;
    flex-direction: row;
    align-items: center;
    padding: 0 10px;
    border-top: 1px solid rgba(var(--center-channel-color-rgb), 0.08);
    border-bottom: 1px solid rgba(var(--center-channel-color-rgb), 0.08);
    background-color: rgba(var(--center-channel-color-rgb),0.04);
`;

const FilterAssignedText = styled.div`
    margin: 0 5px;
    font-size: 12px;
    font-weight: 600;
    line-height: 16px;
`;
const FilterOverdueText = styled(FilterAssignedText)`
    color: var(--dnd-indicator);
`;

const FilterButton = styled(DotMenuButton)`
    width: auto;
    height: 30px;
    align-items: center;
    padding: 0 10px;
    border: 0;
    color: var(--button-bg);
    cursor: pointer;
    font-size: 12px;
    font-weight: 600;

    &::before {
        margin-right: 3px;
        color: var(--button-bg);
        content: '\f0236';
        font-family: compass-icons, mattermosticons;
        font-size: 12px;
        -webkit-font-smoothing: antialiased;
        -moz-osx-font-smoothing: grayscale;
    }

    &:hover {
        background-color: rgba(var(--button-bg-rgb),0.08);
        color: var(--button-bg);
    }
`;

const TaskList = styled.div`
    display: flex;
    flex: 1;
    flex-direction: column;
    margin-bottom: 30px;
`;

export const ExpandRight = styled.div`
    margin-left: auto;
`;

export const StyledDropdownMenu = styled(DropdownMenu)`
    padding: 8px 0;
`;

export const StyledDropdownMenuItem = styled(DropdownMenuItem)<{checked: boolean}>`
    display: flex;
    padding: 8px 0;
    font-size: 14px;

    &::after {
        display: ${({checked}) => (checked ? 'block' : 'none')};
        margin-left: 10px;
        color: var(--button-bg);
        content: '\f012c';
        font-family: compass-icons, mattermosticons;
        font-size: 14px;
        -webkit-font-smoothing: antialiased;
        -moz-osx-font-smoothing: grayscale;
    }
`;

const ZeroCase = styled.div`
    display: flex;
    max-height: 350px;
    flex: 1;
    flex-direction: column;
    align-items: center;
    margin: auto;
`;

const ZeroCaseIconWrapper = styled.div`
    display: flex;
    width: 120px;
    height: 120px;
    align-items: center;
    justify-content: center;
    border-radius: 100%;
    margin: 22px;
    background-color: rgba(var(--center-channel-color-rgb), 0.08);
`;

const ZeroCaseIcon = styled.span`
    &::after {
        color: var(--button-bg);
        content: '\f0139';
        font-family: compass-icons, mattermosticons;
        font-size: 48px;
        -webkit-font-smoothing: antialiased;
        -moz-osx-font-smoothing: grayscale;
    }
`;

const ZeroCaseTitle = styled.h3`
    margin: 0;
    margin-bottom: 15px;
    color: var(--center-channel-color);
    font-size: 20px;
    font-weight: 600;
    line-height: 20px;
`;

const ZeroCaseDescription = styled.div`
    display: flex;
    align-items: center;
    padding: 0 30px;
    font-size: 14px;
    text-align: center;
    /* stylelint-disable-next-line declaration-property-value-keyword-no-deprecated */
    word-break: break-word;
`;

const InfiniteScrollContainer = styled.div`
    overflow: auto;
    height: calc(100vh - 129px);
`;
