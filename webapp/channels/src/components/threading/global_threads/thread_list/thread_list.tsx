// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import isEmpty from 'lodash/isEmpty';
import React, {memo, useCallback, useEffect} from 'react';
import type {PropsWithChildren} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';

import {PlaylistCheckIcon} from '@mattermost/compass-icons/components';
import type {UserThread} from '@mattermost/types/threads';

import {getThreads, markAllThreadsInTeamRead} from 'mattermost-redux/actions/threads';
import {getInt} from 'mattermost-redux/selectors/entities/preferences';
import {getThreadCountsInCurrentTeam} from 'mattermost-redux/selectors/entities/threads';

import {trackEvent} from 'actions/telemetry_actions';
import {closeModal, openModal} from 'actions/views/modals';
import {getIsMobileView} from 'selectors/views/browser';

import NoResultsIndicator from 'components/no_results_indicator';
import CRTListTutorialTip from 'components/tours/crt_tour/crt_list_tutorial_tip';
import CRTUnreadTutorialTip from 'components/tours/crt_tour/crt_unread_tutorial_tip';
import Header from 'components/widgets/header';
import SimpleTooltip from 'components/widgets/simple_tooltip';

import {A11yClassNames, Constants, CrtTutorialSteps, ModalIdentifiers, Preferences} from 'utils/constants';
import * as Keyboard from 'utils/keyboard';

import type {GlobalState} from 'types/store';

import VirtualizedThreadList from './virtualized_thread_list';

import BalloonIllustration from '../../common/balloon_illustration';
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

        // hacky way to ensure the thread item loses focus.
        ref.current?.focus();
    }, [selectedThreadId, data]);

    useEffect(() => {
        document.addEventListener('keydown', handleKeyDown);
        return () => {
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [handleKeyDown]);

    const handleRead = useCallback(() => {
        setFilter(ThreadFilter.none);
    }, [setFilter]);

    const handleUnread = useCallback(() => {
        trackEvent('crt', 'filter_threads_by_unread');
        setFilter(ThreadFilter.unread);
    }, [setFilter]);

    const handleLoadMoreItems = useCallback(async (startIndex) => {
        setLoading(true);
        let before = data[startIndex - 1];

        if (before === selectedThreadId) {
            before = data[startIndex - 2];
        }

        await dispatch(getThreads(currentUserId, currentTeamId, {unread, perPage: Constants.THREADS_PAGE_SIZE, before}));

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
                    <>
                        <div className={'tab-button-wrapper'}>
                            <Button
                                className={'Button___large Margined'}
                                isActive={currentFilter === ThreadFilter.none}
                                onClick={handleRead}
                            >
                                <FormattedMessage
                                    id='threading.filters.allThreads'
                                    defaultMessage='All your threads'
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
                                onClick={handleUnread}
                            >
                                <FormattedMessage
                                    id='threading.filters.unreads'
                                    defaultMessage='Unreads'
                                />
                            </Button>
                            {showUnreadTutorialTip && <CRTUnreadTutorialTip/>}
                        </div>
                    </>
                )}
                right={(
                    <div className='right-anchor'>
                        <SimpleTooltip
                            id='threadListMarkRead'
                            content={formatMessage({
                                id: 'threading.threadList.markRead',
                                defaultMessage: 'Mark all as read',
                            })}
                        >
                            <Button
                                id={'threads-list__mark-all-as-read'}
                                className={'Button___large Button___icon'}
                                onClick={handleOpenMarkAllAsReadModal}
                                marginTop={true}
                            >
                                <span className='icon'>
                                    <PlaylistCheckIcon size={18}/>
                                </span>
                            </Button>
                        </SimpleTooltip>
                    </div>
                )}
            />
            <div
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
                        iconGraphic={BalloonIllustration}
                        title={formatMessage({
                            id: 'globalThreads.threadList.noUnreadThreads',
                            defaultMessage: 'No unread threads',
                        })}
                    />
                ) : null}
            </div>
        </div>
    );
};
export default memo(ThreadList);
