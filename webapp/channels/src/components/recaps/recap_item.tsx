// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState, useMemo, useCallback} from 'react';
import {useIntl, FormattedDate, FormattedMessage} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';

import type {Recap} from '@mattermost/types/recaps';

import {markRecapAsRead, deleteRecap, regenerateRecap} from 'mattermost-redux/actions/recaps';
import {readMultipleChannels} from 'mattermost-redux/actions/channels';
import {getAIAgents} from 'mattermost-redux/selectors/entities/ai';

import ConfirmModal from 'components/confirm_modal';

import RecapChannelCard from './recap_channel_card';
import RecapProcessing from './recap_processing';
import RecapMenu from './recap_menu';
import type {RecapMenuAction} from './recap_menu';

type Props = {
    recap: Recap;
    isExpanded: boolean;
    onToggle: () => void;
};

const RecapItem = ({recap, isExpanded, onToggle}: Props) => {
    const {formatMessage} = useIntl();
    const dispatch = useDispatch();
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const agents = useSelector(getAIAgents);
    console.log('agents', agents);

    const isProcessing = recap.status === 'pending' || recap.status === 'processing';
    const isFailed = recap.status === 'failed';

    // Find the agent that generated this recap
    const generatingAgent = agents.find((agent) => agent.id === recap.bot_id);
    const agentDisplayName = generatingAgent?.displayName || formatMessage({id: 'recaps.defaultAgent', defaultMessage: 'Copilot'});

    const handleMarkAllChannelsRead = useCallback(() => {
        if (recap.channels && recap.channels.length > 0) {
            const channelIds = recap.channels.map((channel) => channel.channel_id);
            dispatch(readMultipleChannels(channelIds));
        }
    }, [dispatch, recap.channels]);

    const handleRegenerateRecap = useCallback(() => {
        dispatch(regenerateRecap(recap.id));
    }, [dispatch, recap.id]);

    const menuActions: RecapMenuAction[] = useMemo(() => {
        const actions: RecapMenuAction[] = [];

        // Only show "Mark all channels as read" for successful recaps
        if (!isFailed) {
            actions.push({
                id: 'mark-all-channels-read',
                icon: <i className='icon icon-check-all'/>,
                label: formatMessage({
                    id: 'recaps.menu.markAllChannelsRead',
                    defaultMessage: 'Mark all channels as read',
                }),
                onClick: handleMarkAllChannelsRead,
            });
        }

        actions.push({
            id: 'regenerate-recap',
            icon: <i className='icon icon-refresh'/>,
            label: formatMessage({
                id: 'recaps.menu.regenerateRecap',
                defaultMessage: 'Regenerate this recap',
            }),
            onClick: handleRegenerateRecap,
        });

        return actions;
    }, [formatMessage, handleMarkAllChannelsRead, handleRegenerateRecap, isFailed]);

    const getStatusText = () => {
        switch (recap.status) {
        case 'pending':
            return formatMessage({id: 'recaps.status.pending', defaultMessage: 'Queued...'});
        case 'processing':
            return formatMessage({id: 'recaps.status.processing', defaultMessage: 'Generating...'});
        case 'failed':
            return formatMessage({id: 'recaps.status.failed', defaultMessage: 'Failed'});
        case 'completed':
        default:
            return null;
        }
    };

    const statusText = getStatusText();

    const handleDelete = () => {
        dispatch(deleteRecap(recap.id));
        setShowDeleteConfirm(false);
    };

    if (isProcessing) {
        return <RecapProcessing recap={recap}/>;
    }

    if (isFailed) {
        return (
            <div className='recap-item recap-item-failed collapsed'>
                <div className='recap-item-header'>
                    <div className='recap-item-title-section'>
                        <h3 className='recap-item-title'>{recap.title}</h3>
                        <div className='recap-item-metadata'>
                            <span className='metadata-item'>
                                <FormattedDate
                                    value={new Date(recap.create_at)}
                                    month='long'
                                    day='numeric'
                                    year='numeric'
                                />
                            </span>
                            <span className='metadata-separator'>•</span>
                            <span className='metadata-item error-text'>
                                {formatMessage({id: 'recaps.status.failed', defaultMessage: 'Failed'})}
                            </span>
                        </div>
                    </div>
                    <div className='recap-item-actions' onClick={(e) => e.stopPropagation()}>
                        <button
                            className='recap-icon-button'
                            onClick={() => setShowDeleteConfirm(true)}
                        >
                            <i className='icon icon-trash-can-outline'/>
                        </button>
                        {recap.read_at === 0 && (
                            <RecapMenu
                                actions={menuActions}
                                ariaLabel={formatMessage(
                                    {
                                        id: 'recaps.menu.ariaLabel',
                                        defaultMessage: 'Options for {title}',
                                    },
                                    {title: recap.title},
                                )}
                            />
                        )}
                    </div>
                </div>

                <ConfirmModal
                    show={showDeleteConfirm}
                    title={formatMessage({id: 'recaps.delete.confirm.title', defaultMessage: 'Delete recap?'})}
                    message={
                        <FormattedMessage
                            id='recaps.delete.confirm.message'
                            defaultMessage='Are you sure you want to delete <strong>{title}</strong>? This action cannot be undone.'
                            values={{
                                title: recap.title,
                                strong: (chunks: React.ReactNode) => <strong>{chunks}</strong>,
                            }}
                        />
                    }
                    confirmButtonText={formatMessage({id: 'recaps.delete.confirm.button', defaultMessage: 'Delete'})}
                    confirmButtonClass='btn btn-danger'
                    onConfirm={handleDelete}
                    onCancel={() => setShowDeleteConfirm(false)}
                    onExited={() => setShowDeleteConfirm(false)}
                />
            </div>
        );
    }

    return (
        <div className={`recap-item ${isExpanded ? 'expanded' : 'collapsed'}`}>
            <div className='recap-item-header' onClick={onToggle}>
                <div className='recap-item-title-section'>
                    <h3 className='recap-item-title'>{recap.title}</h3>
                    <div className='recap-item-metadata'>
                        <span className='metadata-item'>
                            <FormattedDate
                                value={new Date(recap.create_at)}
                                month='long'
                                day='numeric'
                                year='numeric'
                            />
                        </span>
                        {recap.total_message_count > 0 && (
                            <>
                                <span className='metadata-separator'>•</span>
                                <span className='metadata-item'>
                                    {formatMessage(
                                        {id: 'recaps.messageCount', defaultMessage: 'Recapped {count} {count, plural, one {message} other {messages}}'},
                                        {count: recap.total_message_count},
                                    )}
                                </span>
                            </>
                        )}
                        <span className='metadata-separator'>•</span>
                        <span className='metadata-item'>
                            {formatMessage(
                                {id: 'recaps.generatedBy', defaultMessage: 'Generated by {agentName}'},
                                {agentName: agentDisplayName},
                            )}
                        </span>
                    </div>
                </div>
                <div className='recap-item-actions' onClick={(e) => e.stopPropagation()}>
                    {recap.read_at === 0 && (
                        <button
                            className='recap-action-button'
                            onClick={() => dispatch(markRecapAsRead(recap.id))}
                        >
                            <i className='icon icon-check-circle'/>
                            {formatMessage({id: 'recaps.markRead', defaultMessage: 'Mark read'})}
                        </button>
                    )}
                    <button
                        className='recap-icon-button'
                        onClick={() => setShowDeleteConfirm(true)}
                    >
                        <i className='icon icon-trash-can-outline'/>
                    </button>
                    {recap.read_at === 0 && (
                        <RecapMenu
                            actions={menuActions}
                            ariaLabel={formatMessage(
                                {
                                    id: 'recaps.menu.ariaLabel',
                                    defaultMessage: 'Options for {title}',
                                },
                                {title: recap.title},
                            )}
                        />
                    )}
                </div>
            </div>

            {isExpanded && recap.channels && recap.channels.length > 0 && (
                <div className='recap-item-content'>
                    <div className='recap-channels-list'>
                        {recap.channels.map((channel) => (
                            <RecapChannelCard
                                key={channel.id}
                                channel={channel}
                            />
                        ))}
                    </div>
                </div>
            )}

            <ConfirmModal
                show={showDeleteConfirm}
                title={formatMessage({id: 'recaps.delete.confirm.title', defaultMessage: 'Delete recap?'})}
                message={
                    <FormattedMessage
                        id='recaps.delete.confirm.message'
                        defaultMessage='Are you sure you want to delete <strong>{title}</strong>? This action cannot be undone.'
                        values={{
                            title: recap.title,
                            strong: (chunks: React.ReactNode) => <strong>{chunks}</strong>,
                        }}
                    />
                }
                confirmButtonText={formatMessage({id: 'recaps.delete.confirm.button', defaultMessage: 'Delete'})}
                confirmButtonClass='btn btn-danger'
                onConfirm={handleDelete}
                onCancel={() => setShowDeleteConfirm(false)}
                onExited={() => setShowDeleteConfirm(false)}
            />
        </div>
    );
};

export default RecapItem;

