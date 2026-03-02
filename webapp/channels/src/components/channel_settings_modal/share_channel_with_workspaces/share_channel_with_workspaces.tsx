// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useState} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';

import type {Channel} from '@mattermost/types/channels';
import type {RemoteClusterInfo} from '@mattermost/types/shared_channels';

import useDidUpdate from 'components/common/hooks/useDidUpdate';
import Toggle from 'components/toggle';

import AddWorkspaceDropdown, {type RemoteToAdd} from './add_workspace_dropdown';
import type {WorkspaceWithStatus} from './types';
import WorkspaceList from './workspace_list';

export type {WorkspaceWithStatus} from './types';

import './share_channel_with_workspaces.scss';

type Props = {
    channel: Channel;
    remotes: RemoteClusterInfo[];
    initialRemotes?: RemoteClusterInfo[];
    onRemotesChange: (remotes: WorkspaceWithStatus[]) => void;
    disabled?: boolean;
};

const emptyRemotes: RemoteClusterInfo[] = [];

export default function ShareChannelWithWorkspaces({
    channel,
    remotes,
    initialRemotes = emptyRemotes,
    onRemotesChange,
    disabled = false,
}: Props) {
    const {formatMessage} = useIntl();

    const [enabled, setEnabled] = useState(remotes.length > 0);
    const [workspaces, setWorkspaces] = useState<WorkspaceWithStatus[]>(() =>
        remotes.map((r) => ({...r})),
    );

    useDidUpdate(() => {
        onRemotesChange(workspaces);
    }, [workspaces, onRemotesChange]);

    const handleToggle = useCallback(() => {
        const next = !enabled;
        setEnabled(next);
        if (!next) {
            setWorkspaces([]);
        }
    }, [enabled]);

    const handleAdd = useCallback((toAdd: RemoteToAdd[]) => {
        if (toAdd.length === 0) {
            return;
        }
        const initialById = new Map((initialRemotes || []).map((r) => [r.remote_id || r.name, r]));
        setEnabled(true);
        setWorkspaces((prev) => {
            const prevIds = new Set(prev.map((w) => w.remote_id || w.name));
            const added: WorkspaceWithStatus[] = toAdd.filter((r) => !prevIds.has(r.remote_id)).map((r) => {
                const existing = initialById.get(r.remote_id);
                if (existing) {
                    return {...existing};
                }
                return {
                    remote_id: r.remote_id,
                    name: r.remote_id,
                    display_name: r.display_name || r.remote_id,
                    create_at: 0,
                    delete_at: 0,
                    last_ping_at: 0,
                    pendingSave: true,
                };
            });
            return [...prev, ...added];
        });
    }, [initialRemotes]);

    const handleRemove = useCallback((remoteId: string) => {
        setWorkspaces((prev) => {
            const next = prev.filter((w) => (w.remote_id || w.name) !== remoteId);
            if (next.length === 0) {
                setEnabled(false);
            }
            return next;
        });
    }, []);

    return (
        <div className='ShareChannelWithWorkspaces'>
            <div className='ShareChannelWithWorkspaces__header'>
                <div className='ShareChannelWithWorkspaces__headerText'>
                    <label
                        className='Input_legend'
                        htmlFor='shareChannelWithWorkspacesToggle'
                    >
                        <FormattedMessage
                            id='channel_settings.share_channel_with_workspaces.title'
                            defaultMessage='Share channel with connected workspaces'
                        />
                    </label>
                    <label
                        className='Input_subheading'
                        htmlFor='shareChannelWithWorkspacesToggle'
                    >
                        <FormattedMessage
                            id='channel_settings.share_channel_with_workspaces.description'
                            defaultMessage='Choose the connected workspace(s) that this channel is shared with. Connected workspaces must first be configured by the system admin.'
                        />
                    </label>
                </div>
                <div className='ShareChannelWithWorkspaces__toggle'>
                    <Toggle
                        id='shareChannelWithWorkspacesToggle'
                        ariaLabel={formatMessage({
                            id: 'channel_settings.share_channel_with_workspaces.aria',
                            defaultMessage: 'Share channel with connected workspaces',
                        })}
                        size='btn-md'
                        disabled={disabled}
                        onToggle={handleToggle}
                        toggled={enabled}
                        tabIndex={0}
                        toggleClassName='btn-toggle-primary'
                    />
                </div>
            </div>

            {enabled && (
                <div className='ShareChannelWithWorkspaces__body'>
                    <span className='ShareChannelWithWorkspaces__subheading'>
                        <FormattedMessage
                            id='channel_settings.share_channel_with_workspaces.workspaces_label'
                            defaultMessage='Workspaces to share with'
                        />
                    </span>

                    <WorkspaceList
                        workspaces={workspaces}
                        onRemove={handleRemove}
                        disabled={disabled}
                    />

                    <AddWorkspaceDropdown
                        channelId={channel.id}
                        currentRemoteIds={new Set(workspaces.map((w) => w.remote_id || w.name))}
                        onAdd={handleAdd}
                        disabled={disabled}
                    />
                </div>
            )}
        </div>
    );
}
