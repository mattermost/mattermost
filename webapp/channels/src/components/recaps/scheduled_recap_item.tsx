// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState, useCallback} from 'react';
import {useIntl, FormattedMessage} from 'react-intl';
import {useDispatch} from 'react-redux';

import {DotsHorizontalIcon, PencilOutlineIcon, TrashCanOutlineIcon} from '@mattermost/compass-icons/components';
import type {ScheduledRecap} from '@mattermost/types/recaps';

import {pauseScheduledRecap, resumeScheduledRecap, deleteScheduledRecap} from 'mattermost-redux/actions/recaps';

import ConfirmModal from 'components/confirm_modal';
import * as Menu from 'components/menu';
import Toggle from 'components/toggle';

import {useScheduleDisplay} from './schedule_display';

import './scheduled_recap_item.scss';

type Props = {
    scheduledRecap: ScheduledRecap;
    onEdit: (id: string) => void;
};

const ScheduledRecapItem = ({scheduledRecap, onEdit}: Props) => {
    const {formatMessage} = useIntl();
    const dispatch = useDispatch();
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [isHovered, setIsHovered] = useState(false);
    const [isToggling, setIsToggling] = useState(false);

    const {formatSchedule, formatNextRun, formatLastRun, formatRunCount} = useScheduleDisplay();

    const scheduleText = formatSchedule(scheduledRecap.days_of_week, scheduledRecap.time_of_day);
    const nextRunText = formatNextRun(scheduledRecap.next_run_at, scheduledRecap.enabled);
    const lastRunText = formatLastRun(scheduledRecap.last_run_at);
    const runCountText = formatRunCount(scheduledRecap.run_count);

    const handleToggle = useCallback(async () => {
        if (isToggling) {
            return;
        }
        setIsToggling(true);

        try {
            if (scheduledRecap.enabled) {
                await dispatch(pauseScheduledRecap(scheduledRecap.id));

                // TODO: Show toast "Schedule paused"
            } else {
                await dispatch(resumeScheduledRecap(scheduledRecap.id));

                // TODO: Show toast "Schedule resumed"
            }
        } finally {
            setIsToggling(false);
        }
    }, [dispatch, scheduledRecap.id, scheduledRecap.enabled, isToggling]);

    const handleDelete = useCallback(async () => {
        await dispatch(deleteScheduledRecap(scheduledRecap.id));
        setShowDeleteConfirm(false);

        // TODO: Show toast "Schedule deleted"
    }, [dispatch, scheduledRecap.id]);

    const handleEdit = useCallback(() => {
        onEdit(scheduledRecap.id);
    }, [onEdit, scheduledRecap.id]);

    const menuId = `scheduled-recap-menu-${scheduledRecap.id}`;
    const buttonId = `${menuId}-button`;

    return (
        <div
            className='scheduled-recap-item'
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            <div className='scheduled-recap-item-content'>
                <div className='scheduled-recap-item-main'>
                    <h3 className='scheduled-recap-item-title'>{scheduledRecap.title}</h3>
                    <div className='scheduled-recap-item-subtitle'>
                        <span className='schedule-pattern'>{scheduleText}</span>
                        {nextRunText && (
                            <>
                                <span className='metadata-separator'>{'·'}</span>
                                <span className='next-run'>{nextRunText}</span>
                            </>
                        )}
                    </div>
                </div>

                <div className='scheduled-recap-item-actions'>
                    {/* Run stats - visible on hover */}
                    <div className={`scheduled-recap-run-stats ${isHovered ? 'visible' : ''}`}>
                        <span className='run-stat'>{lastRunText}</span>
                        <span className='metadata-separator'>{'·'}</span>
                        <span className='run-stat'>{runCountText}</span>
                    </div>

                    {/* Active/Paused toggle */}
                    <div className='scheduled-recap-toggle'>
                        <Toggle
                            id={`toggle-${scheduledRecap.id}`}
                            toggled={scheduledRecap.enabled}
                            onToggle={handleToggle}
                            disabled={isToggling}
                            size='btn-sm'
                            toggleClassName='btn-toggle-primary'
                            ariaLabel={scheduledRecap.enabled
                                ? formatMessage({id: 'recaps.scheduled.toggle.active', defaultMessage: 'Active - click to pause'})
                                : formatMessage({id: 'recaps.scheduled.toggle.paused', defaultMessage: 'Paused - click to resume'})
                            }
                        />
                    </div>

                    {/* Kebab menu */}
                    <Menu.Container
                        menuButton={{
                            id: buttonId,
                            class: 'scheduled-recap-menu-button',
                            'aria-label': formatMessage({id: 'recaps.menu.ariaLabel', defaultMessage: 'Options for {title}'}, {title: scheduledRecap.title}),
                            children: <DotsHorizontalIcon size={16}/>,
                        }}
                        menu={{
                            id: menuId,
                            'aria-label': formatMessage({id: 'recaps.menu.ariaLabel', defaultMessage: 'Options for {title}'}, {title: scheduledRecap.title}),
                        }}
                        anchorOrigin={{
                            vertical: 'bottom',
                            horizontal: 'right',
                        }}
                        transformOrigin={{
                            vertical: 'top',
                            horizontal: 'right',
                        }}
                    >
                        <Menu.Item
                            leadingElement={<PencilOutlineIcon size={18}/>}
                            labels={<span>{formatMessage({id: 'recaps.scheduled.menu.edit', defaultMessage: 'Edit'})}</span>}
                            onClick={handleEdit}
                        />
                        <Menu.Item
                            leadingElement={<TrashCanOutlineIcon size={18}/>}
                            labels={<span>{formatMessage({id: 'recaps.scheduled.menu.delete', defaultMessage: 'Delete'})}</span>}
                            onClick={() => setShowDeleteConfirm(true)}
                            isDestructive={true}
                        />
                    </Menu.Container>
                </div>
            </div>

            {/* Delete confirmation modal */}
            <ConfirmModal
                show={showDeleteConfirm}
                title={formatMessage({id: 'recaps.scheduled.delete.title', defaultMessage: 'Delete scheduled recap?'})}
                message={
                    <FormattedMessage
                        id='recaps.scheduled.delete.message'
                        defaultMessage='Are you sure you want to delete <strong>{title}</strong>? This scheduled recap will stop running.'
                        values={{
                            title: scheduledRecap.title,
                            strong: (chunks: React.ReactNode) => <strong>{chunks}</strong>,
                        }}
                    />
                }
                confirmButtonText={formatMessage({id: 'recaps.scheduled.delete.button', defaultMessage: 'Delete'})}
                confirmButtonClass='btn btn-danger'
                onConfirm={handleDelete}
                onCancel={() => setShowDeleteConfirm(false)}
                onExited={() => setShowDeleteConfirm(false)}
            />
        </div>
    );
};

export default ScheduledRecapItem;
