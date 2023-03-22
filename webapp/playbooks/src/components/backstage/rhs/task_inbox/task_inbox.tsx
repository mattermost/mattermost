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
import {GeneralViewTarget} from 'src/types/telemetry';
import {useViewTelemetry} from 'src/hooks/telemetry';

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

    useViewTelemetry(GeneralViewTarget.TaskInbox, currentUserId, {});

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
                    icon={<FilterWrapper>{formatMessage({defaultMessage: 'Filters'})}</FilterWrapper>}
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
                        loader={<span/>}
                        useWindow={false}
                    >
                        <TaskList>
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
    height: 56px;
    min-height: 56px;
    display: flex;
    flex-direction: row;
    align-items: center;
    padding: 0 10px;
    background-color: rgba(var(--center-channel-color-rgb),0.04);
    border-top: 1px solid rgba(var(--center-channel-color-rgb), 0.08);
    border-bottom: 1px solid rgba(var(--center-channel-color-rgb), 0.08);
`;

const FilterAssignedText = styled.div`
    font-size: 12px;
    font-weight: 600;
    line-height: 16px;
    margin: 0 5px;
`;
const FilterOverdueText = styled(FilterAssignedText)`
    color: var(--dnd-indicator);
`;

const FilterWrapper = styled.div``;

const FilterButton = styled(DotMenuButton)`
    color: var(--button-bg);
    height: 20px;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    padding: 0 10px;
    border: 0;
    height: 30px;
    width: auto;
    align-items: center;

    &:before {
        color: var(--button-bg);
        content: '\f0236';
        font-size: 12px;
        font-family: 'compass-icons', mattermosticons;
        -webkit-font-smoothing: antialiased;
        -moz-osx-font-smoothing: grayscale;
        margin-right: 3px;
    }

    :hover {
        color: var(--button-bg);
        background-color: rgba(var(--button-bg-rgb),0.08);
    }
`;

const TaskList = styled.div`
    display: flex;
    flex-direction: column;
    flex: 1;
    margin-bottom: 30px;
`;

export const ExpandRight = styled.div`
    margin-left: auto;
`;

export const StyledDropdownMenu = styled(DropdownMenu)`
    padding: 8px 0;
`;

export const StyledDropdownMenuItem = styled(DropdownMenuItem)<{checked: boolean}>`
    padding: 8px 0;
    font-size: 14px;
    display: flex;

    &:after {
        display: ${({checked}) => (checked ? 'block' : 'none')};
        color: var(--button-bg);
        content: '\f012c';
        font-size: 14px;
        font-family: 'compass-icons', mattermosticons;
        -webkit-font-smoothing: antialiased;
        -moz-osx-font-smoothing: grayscale;
        margin-left: 10px;
    }
`;

const ZeroCase = styled.div`
    display: flex;
    flex-direction: column;
    flex: 1;
    max-height: 350px;
    align-items: center;
    margin: auto;
`;

const ZeroCaseIconWrapper = styled.div`
    background-color: rgba(var(--center-channel-color-rgb), 0.08);
    border-radius: 100%;
    width: 120px;
    height: 120px;
    margin: 22px;
    display: flex;
    align-items: center;
    justify-content: center;
`;

const ZeroCaseIcon = styled.span`
    &:after {
        color: var(--button-bg);
        content: '\f0139';
        font-size: 48px;
        font-family: 'compass-icons', mattermosticons;
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
    text-align: center;
    word-break: break-word;
    font-size: 14px;
`;

const InfiniteScrollContainer = styled.div`
    height: calc(100vh - 129px);
    overflow: auto;
`;
