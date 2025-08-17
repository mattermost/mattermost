// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import isEmpty from 'lodash/isEmpty';
import React, {memo, useCallback, useEffect} from 'react';
import type {PropsWithChildren} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';

import {PlaylistCheckIcon} from '@mattermost/compass-icons/components';
import type {UserThread} from '@mattermost/types/threads';

import {getThreadsForCurrentTeam, markAllThreadsInTeamRead} from 'mattermost-redux/actions/threads';
import {getInt} from 'mattermost-redux/selectors/entities/preferences';
import {getThreadCountsInCurrentTeam} from 'mattermost-redux/selectors/entities/threads';

import {trackEvent} from 'actions/telemetry_actions';
import {closeModal, openModal} from 'actions/views/modals';
import {getIsMobileView} from 'selectors/views/browser';

import NoResultsIndicator from 'components/no_results_indicator';
import CRTListTutorialTip from 'components/tours/crt_tour/crt_list_tutorial_tip';
import CRTUnreadTutorialTip from 'components/tours/crt_tour/crt_unread_tutorial_tip';
import Header from 'components/widgets/header';
import WithTooltip from 'components/with_tooltip';

import {A11yClassNames, Constants, CrtTutorialSteps, ModalIdentifiers, Preferences} from 'utils/constants';
import * as Keyboard from 'utils/keyboard';
import {a11yFocus, mod} from 'utils/utils';

import type {GlobalState} from 'types/store';

import VirtualizedThreadList from './virtualized_thread_list';

import Button from '../../common/button';
import {useThreadRouting} from '../../hooks';
import MarkAllThreadsAsReadModal from '../mark_all_threads_as_read_modal';
import type {MarkAllThreadsAsReadModalProps} from '../mark_all_threads_as_read_modal';

import './thread_list.scss';

export enum ThreadFilter {
    none = '',
    unread = 'unread'
}

export const FILTER_STORAGE_KEY = 'globalThreads_filter';

type Props = {
    currentFilter: ThreadFilter;
    someUnread: boolean;
    setFilter: (filter: ThreadFilter) => void;
    selectedThreadId?: UserThread['id'];
    ids: Array<UserThread['id']>;
    unreadIds: Array<UserThread['id']>;
};

const ThreadList = ({
    currentFilter = ThreadFilter.none,
    someUnread,
    setFilter,
    selectedThreadId,
    unreadIds,
    ids,
}: PropsWithChildren<Props>) => {
    const isMobileView = useSelector(getIsMobileView);
    const unread = ThreadFilter.unread === currentFilter;
    const data = unread ? unreadIds : ids;
    const ref = React.useRef<HTMLDivElement>(null);
    const {currentTeamId, currentUserId, clear, select} = useThreadRouting();
    const tipStep = useSelector((state: GlobalState) => getInt(state, Preferences.CRT_TUTORIAL_STEP, currentUserId));
    const showListTutorialTip = tipStep === CrtTutorialSteps.LIST_POPOVER;
    const showUnreadTutorialTip = tipStep === CrtTutorialSteps.UNREAD_POPOVER;
    const {formatMessage} = useIntl();
    const dispatch = useDispatch();

    const {total = 0, total_unread_threads: totalUnread} = useSelector(getThreadCountsInCurrentTeam) ?? {};

    const [isLoading, setLoading] = React.useState<boolean>(false);
    const [hasLoaded, setHasLoaded] = React.useState<boolean>(false);

    const handleKeyDown = useCallback((e: KeyboardEvent) => {
        // Ensure that arrow keys navigation is not triggered if the textbox is focused
        const target = e.target as HTMLElement;
        const tagName = target?.tagName?.toLowerCase();
        if (tagName === 'input' || tagName === 'textarea' || tagName === 'select') {
            return;
        }
        const comboKeyPressed = e.altKey || e.metaKey || e.shiftKey || e.ctrlKey;
        if (comboKeyPressed || (!Keyboard.isKeyPressed(e, Constants.KeyCodes.DOWN) && !Keyboard.isKeyPressed(e, Constants.KeyCodes.UP))) {
            return;
        }

        // Don't switch threads if a modal or popup is open, since the focus is inside the modal/popup.
        const noModalsAreOpen = document.getElementsByClassName(A11yClassNames.MODAL).length === 0;
        const noPopupsDropdownsAreOpen = document.getElementsByClassName(A11yClassNames.POPUP).length === 0;
        if (!noModalsAreOpen || !noPopupsDropdownsAreOpen) {
            return;
        }

        let threadIdToSelect = 0;
        if (selectedThreadId) {
            const selectedThreadIndex = data.indexOf(selectedThreadId);
            if (Keyboard.isKeyPressed(e, Constants.KeyCodes.DOWN)) {
                if (selectedThreadIndex < data.length - 1) {
                    threadIdToSelect = selectedThreadIndex + 1;
                }

                if (selectedThreadIndex === data.length - 1) {
                    return;
                }
            }

            if (Keyboard.isKeyPressed(e, Constants.KeyCodes.UP)) {
                if (selectedThreadIndex > 0) {
                    threadIdToSelect = selectedThreadIndex - 1;
                } else {
                    return;
                }
            }
        }
        select(data[threadIdToSelect]);
        e.preventDefault();
    }, [selectedThreadId, data]);

    useEffect(() => {
        document.addEventListener('keydown', handleKeyDown);
        return () => {
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [handleKeyDown]);

    const handleSetFilter = useCallback((filter: ThreadFilter) => {
        if (filter === ThreadFilter.unread) {
            trackEvent('crt', 'filter_threads_by_unread');
        }

        setFilter(filter);
    }, [setFilter]);

    const handleLoadMoreItems = useCallback(async (startIndex) => {
        setLoading(true);
        let before = data[startIndex - 1];

        if (before === selectedThreadId) {
            before = data[startIndex - 2];
        }

        await dispatch(getThreadsForCurrentTeam({unread, before}));

        setLoading(false);
        setHasLoaded(true);

        return {data: true};
    }, [currentTeamId, data, unread, selectedThreadId]);

    const handleAllMarkedRead = useCallback(() => {
        trackEvent('crt', 'mark_all_threads_read');
        dispatch(markAllThreadsInTeamRead(currentUserId, currentTeamId));
        if (currentFilter === ThreadFilter.unread) {
            clear();
        }
    }, [currentTeamId, currentUserId, currentFilter]);

    const handleOpenMarkAllAsReadModal = useCallback(() => {
        const handleCloseMarkAllAsReadModal = () => {
            dispatch(closeModal(ModalIdentifiers.MARK_ALL_THREADS_AS_READ));
        };

        const handleConfirm = () => {
            handleAllMarkedRead();
            handleCloseMarkAllAsReadModal();
        };

        const modalProp: MarkAllThreadsAsReadModalProps = {
            onConfirm: handleConfirm,
            onCancel: handleCloseMarkAllAsReadModal,
        };

        dispatch(openModal({
            modalId: ModalIdentifiers.MARK_ALL_THREADS_AS_READ,
            dialogType: MarkAllThreadsAsReadModal,
            dialogProps: modalProp,
        }));
    }, [handleAllMarkedRead]);

    const {tabListProps, tabProps} = useTabs<ThreadFilter>({
        activeTab: currentFilter,
        setActiveTab: handleSetFilter,
        tabs: [
            {
                id: 'threads-list-filter-none',
                name: ThreadFilter.none,
                panelId: 'threads-list',
            },
            {
                id: 'threads-list-filter-unread',
                name: ThreadFilter.unread,
                panelId: 'threads-list',
            },
        ],
    });

    return (
        <div
            tabIndex={0}
            ref={ref}
            className={'ThreadList'}
            id={'threads-list-container'}
        >
            <Header
                id={'tutorial-threads-mobile-header'}
                heading={(
                    <div
                        className='tab-buttons-list'
                        aria-label={formatMessage({
                            id: 'threading.threadList.tabsLabel',
                            defaultMessage: 'Filter visible threads',
                        })}
                        {...tabListProps}
                    >
                        <div className={'tab-button-wrapper'}>
                            <Button
                                className={'Button___large Margined'}
                                isActive={currentFilter === ThreadFilter.none}
                                {...tabProps[0]}
                            >
                                <FormattedMessage
                                    id='globalThreads.heading'
                                    defaultMessage='Followed threads'
                                />
                            </Button>
                        </div>
                        <div
                            id={'threads-list-unread-button'}
                            className={'tab-button-wrapper'}
                        >
                            <Button
                                className={'Button___large Margined'}
                                isActive={currentFilter === ThreadFilter.unread}
                                hasDot={someUnread}
                                {...tabProps[1]}
                            >
                                <FormattedMessage
                                    id='threading.filters.unreads'
                                    defaultMessage='Unreads'
                                />
                            </Button>
                            {showUnreadTutorialTip && <CRTUnreadTutorialTip/>}
                        </div>
                    </div>
                )}
                right={(
                    <div className='right-anchor'>
                        <WithTooltip
                            title={formatMessage({
                                id: 'threading.threadList.markRead',
                                defaultMessage: 'Mark all threads as read',
                            })}
                        >
                            <Button
                                id={'threads-list__mark-all-as-read'}
                                aria-label={formatMessage({
                                    id: 'threading.threadList.markRead',
                                    defaultMessage: 'Mark all threads as read',
                                })}
                                className={'Button___large Button___icon'}
                                onClick={handleOpenMarkAllAsReadModal}
                                marginTop={true}
                            >
                                <span className='icon'>
                                    <PlaylistCheckIcon size={18}/>
                                </span>
                            </Button>
                        </WithTooltip>
                    </div>
                )}
            />
            <div
                id='threads-list'
                role='tabpanel'
                className='threads'
                data-testid={'threads_list'}
            >
                <VirtualizedThreadList
                    key={`threads_list_${currentFilter}`}
                    loadMoreItems={handleLoadMoreItems}
                    ids={data}
                    selectedThreadId={selectedThreadId}
                    total={unread ? totalUnread : total}
                    isLoading={isLoading}
                    addNoMoreResultsItem={hasLoaded && !unread}
                />
                {showListTutorialTip && !isMobileView && <CRTListTutorialTip/>}
                {unread && !someUnread && isEmpty(unreadIds) ? (
                    <NoResultsIndicator
                        expanded={true}
                        title={formatMessage({
                            id: 'globalThreads.threadList.noUnreadThreads',
                            defaultMessage: 'No unread threads',
                        })}
                        subtitle={formatMessage({
                            id: 'globalThreads.threadList.noUnreadThreads.subtitle',
                            defaultMessage: 'You\'re all caught up',
                        })}
                    />
                ) : null}
            </div>
        </div>
    );
};

function useTabs<TabName extends string>({
    activeTab,
    setActiveTab,
    tabs,
}: {
    activeTab: TabName;
    setActiveTab: (tab: TabName) => void;
    tabs: Array<{
        id: string;
        name: TabName;
        panelId: string;
    }>;
}): {
        tabListProps: React.HTMLAttributes<HTMLElement>;
        tabProps: Array<React.HTMLAttributes<HTMLElement>>;
    } {
    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        let delta = 0;
        if (Keyboard.isKeyPressed(e, Constants.KeyCodes.RIGHT)) {
            delta = 1;
        } else if (Keyboard.isKeyPressed(e, Constants.KeyCodes.LEFT)) {
            delta = -1;
        }

        if (delta === 0) {
            return;
        }

        let index = tabs.findIndex((tab) => tab.name === activeTab);
        index += delta;
        index = mod(index, tabs.length);

        setActiveTab(tabs[index].name);
        a11yFocus(document.getElementById(tabs[index].id));
    }, [activeTab, setActiveTab, tabs]);

    return {
        tabListProps: {
            role: 'tablist',
            'aria-orientation': 'horizontal',
        },
        tabProps: tabs.map((tab) => ({
            id: tab.id,
            role: 'tab',
            onClick: () => setActiveTab(tab.name),
            onKeyDown: handleKeyDown,
            tabIndex: tab.name === activeTab ? 0 : -1,
            'aria-controls': tab.panelId,
            'aria-selected': activeTab === tab.name,
        })),
    };
}

export default memo(ThreadList);
