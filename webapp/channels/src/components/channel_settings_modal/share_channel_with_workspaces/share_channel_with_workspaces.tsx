// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useMemo, useState} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';

import type {RemoteClusterInfo} from '@mattermost/types/shared_channels';

import useDidUpdate from 'components/common/hooks/useDidUpdate';
import Toggle from 'components/toggle';

import AddWorkspaceDropdown, {type RemoteToAdd} from './add_workspace_dropdown';
import type {WorkspaceWithStatus} from './types';
import WorkspaceList from './workspace_list';

export type {WorkspaceWithStatus} from './types';

import './share_channel_with_workspaces.scss';

type Props = {
    remotes: RemoteClusterInfo[];
    initialRemotes?: RemoteClusterInfo[];
    onRemotesChange: (remotes: WorkspaceWithStatus[]) => void;
};

const emptyRemotes: RemoteClusterInfo[] = [];

export default function ShareChannelWithWorkspaces({
    remotes,
    initialRemotes = emptyRemotes,
    onRemotesChange,
}: Props) {
    const {formatMessage} = useIntl();

    const [enabled, setEnabled] = useState(remotes.length > 0);
    const [workspaces, setWorkspaces] = useState<WorkspaceWithStatus[]>(() =>
        remotes.map((r) => ({...r})),
    );
    const currentRemoteIds = useMemo(() => new Set(workspaces.map((w) => w.remote_id || w.name)), [workspaces]);

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

    const heading = formatMessage({
        id: 'channel_settings.share_channel_with_workspaces.title',
        defaultMessage: 'Share with connected workspaces',
    });
    const subheading = formatMessage({
        id: 'channel_settings.share_channel_with_workspaces.description',
        defaultMessage: 'Collaborate with trusted organizations in this channel. Connections must first be defined by a system administrator.',
    });

    return (
        <>
            <div className='channel_shared_with_workspaces_header'>
                <div className='channel_shared_with_workspaces_header__text'>
                    <label
                        className='Input_legend'
                        aria-label={heading}
                    >
                        {heading}
                    </label>
                    <label
                        className='Input_subheading'
                        aria-label={subheading}
                    >
                        {subheading}
                    </label>
                </div>
                <div className='channel_shared_with_workspaces_header__toggle'>
                    <Toggle
                        id='shareChannelWithWorkspacesToggle'
                        ariaLabel={heading}
                        size='btn-md'
                        onToggle={handleToggle}
                        toggled={enabled}
                        tabIndex={0}
                        toggleClassName='btn-toggle-primary'
                    />
                </div>
            </div>

            {enabled && (
                <div className='channel_shared_with_workspaces_section_body'>
                    <span className='ShareChannelWithWorkspaces__listHeader'>
                        {workspaces.length > 0 ? (
                            <FormattedMessage
                                id='channel_settings.share_channel_with_workspaces.workspaces_label'
                                defaultMessage='Workspaces sharing this channel'
                            />
                        ) : (
                            <FormattedMessage
                                id='channel_settings.share_channel_with_workspaces.workspaces_label_empty'
                                defaultMessage='No workspaces sharing this channel yet.'
                            />
                        )}
                    </span>

                    <WorkspaceList
                        workspaces={workspaces}
                        onRemove={handleRemove}
                    />

                    <AddWorkspaceDropdown
                        currentRemoteIds={currentRemoteIds}
                        onAdd={handleAdd}
                    />
                </div>
            )}
        </>
    );
}
