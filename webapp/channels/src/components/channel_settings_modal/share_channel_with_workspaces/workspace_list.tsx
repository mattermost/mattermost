// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage, useIntl} from 'react-intl';

import {CheckCircleOutlineIcon, TrashCanOutlineIcon} from '@mattermost/compass-icons/components';

import {getRemoteClusterConnectionStatus} from 'utils/remote_cluster_connection';

import type {WorkspaceWithStatus} from './types';

function getConnectionStatus(w: WorkspaceWithStatus): 'pending_save' | 'connection_pending' | 'connected' | 'offline' {
    if (w.pendingSave) {
        return 'pending_save';
    }
    return getRemoteClusterConnectionStatus(w);
}

type Props = {
    workspaces: WorkspaceWithStatus[];
    onRemove: (remoteId: string) => void;
};

function getRemoteId(w: WorkspaceWithStatus) {
    return w.remote_id || w.name;
}

function WorkspaceStatus({workspace}: {workspace: WorkspaceWithStatus}) {
    const status = getConnectionStatus(workspace);

    if (status === 'pending_save') {
        return (
            <span className='ShareChannelWithWorkspaces__statusPending'>
                <FormattedMessage
                    id='channel_settings.share_channel_with_workspaces.pending_save'
                    defaultMessage='Pending save'
                />
            </span>
        );
    }
    if (status === 'connection_pending') {
        return (
            <span className='ShareChannelWithWorkspaces__statusConnectionPending'>
                <FormattedMessage
                    id='admin.secure_connections.status_pending'
                    defaultMessage='Connection Pending'
                />
            </span>
        );
    }
    if (status === 'connected') {
        return (
            <span className='ShareChannelWithWorkspaces__statusOnline'>
                <CheckCircleOutlineIcon size={16}/>
                <FormattedMessage
                    id='admin.secure_connections.status_connected'
                    defaultMessage='Connected'
                />
            </span>
        );
    }
    return (
        <span className='ShareChannelWithWorkspaces__statusOffline'>
            <FormattedMessage
                id='admin.secure_connections.status_offline'
                defaultMessage='Offline'
            />
        </span>
    );
}

export default function WorkspaceList({workspaces, onRemove}: Props) {
    const {formatMessage} = useIntl();

    if (workspaces.length === 0) {
        return null;
    }

    return (
        <ul className='ShareChannelWithWorkspaces__list'>
            {workspaces.map((w) => (
                <li
                    key={getRemoteId(w)}
                    className='ShareChannelWithWorkspaces__item'
                >
                    <span className='ShareChannelWithWorkspaces__itemName'>
                        {w.display_name || w.name}
                    </span>
                    <span className='ShareChannelWithWorkspaces__itemStatus'>
                        <WorkspaceStatus workspace={w}/>
                    </span>
                    <button
                        type='button'
                        className='btn btn-sm btn-icon btn-compact ShareChannelWithWorkspaces__remove'
                        onClick={() => onRemove(getRemoteId(w))}
                        aria-label={formatMessage(
                            {id: 'channel_settings.share_channel_with_workspaces.remove_aria', defaultMessage: 'Remove {name}'},
                            {name: w.display_name || w.name},
                        )}
                    >
                        <TrashCanOutlineIcon size={18}/>
                    </button>
                </li>
            ))}
        </ul>
    );
}
