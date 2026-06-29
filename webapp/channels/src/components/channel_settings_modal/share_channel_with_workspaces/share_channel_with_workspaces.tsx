// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';

import {WithTooltip} from '@mattermost/shared/components/tooltip';
import type {RemoteCluster} from '@mattermost/types/remote_clusters';
import type {RemoteClusterInfo} from '@mattermost/types/shared_channels';

import {Client4} from 'mattermost-redux/client';

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
    onRemotesChange: React.Dispatch<React.SetStateAction<WorkspaceWithStatus[]>>;
    enabled: boolean;
    onToggle?: (enabled: boolean) => void;
};

const emptyRemotes: RemoteClusterInfo[] = [];

export default function ShareChannelWithWorkspaces({
    remotes,
    initialRemotes = emptyRemotes,
    onRemotesChange,
    enabled,
    onToggle,
}: Props) {
    const {formatMessage} = useIntl();

    const [availableRemoteClusters, setAvailableRemoteClusters] = useState<RemoteCluster[] | null>(null);

    useEffect(() => {
        let cancelled = false;
        Client4.getRemoteClusters({
            excludePlugins: true,
            onlyConfirmed: true,
        }).then((data) => {
            if (!cancelled) {
                setAvailableRemoteClusters(data || []);
            }
        }).catch(() => {
            if (!cancelled) {
                setAvailableRemoteClusters([]);
            }
        });
        return () => {
            cancelled = true;
        };
    }, []);

    const hasAvailableWorkspaces = availableRemoteClusters !== null && availableRemoteClusters.length > 0;

    const currentRemoteIds = useMemo(() => new Set(remotes.map((w) => w.remote_id || w.name)), [remotes]);

    useDidUpdate(() => {
        onRemotesChange(remotes);
    }, [remotes, onRemotesChange]);

    const handleToggle = useCallback(() => {
        const next = !enabled;
        onToggle?.(next);
        if (!next) {
            onRemotesChange([]);
        }
    }, [enabled, onRemotesChange, onToggle]);

    const handleAdd = useCallback((toAdd: RemoteToAdd) => {
        const initialById = new Map((initialRemotes || []).map((r) => [r.remote_id || r.name, r]));
        onRemotesChange((prev) => {
            const existing = initialById.get(toAdd.remote_id);
            if (existing) {
                return [...prev, {...existing}];
            }
            return [...prev, {
                remote_id: toAdd.remote_id,
                name: toAdd.remote_id,
                display_name: toAdd.display_name || toAdd.remote_id,
                create_at: 0,
                delete_at: 0,
                last_ping_at: 0,
                pendingSave: true,
            }];
        });
    }, [initialRemotes, onRemotesChange]);

    const handleRemove = useCallback((remoteId: string) => {
        onRemotesChange((prev) => {
            const next = prev.filter((w) => (w.remote_id || w.name) !== remoteId);
            if (next.length === 0) {
                onToggle?.(false);
            }
            return next;
        });
    }, [onRemotesChange, onToggle]);

    const heading = formatMessage({
        id: 'channel_settings.share_channel_with_workspaces.title',
        defaultMessage: 'Share with connected workspaces',
    });
    const subheading = formatMessage({
        id: 'channel_settings.share_channel_with_workspaces.description',
        defaultMessage: 'Collaborate with trusted organizations in this channel.',
    });

    return (
        <div className='channel_shared_with_workspaces_container'>
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
                <WithTooltip
                    title={formatMessage({
                        id: 'channel_settings.share_channel_with_workspaces.disable_toggle_tooltip',
                        defaultMessage: 'No connected workspaces are available',
                    })}
                    hint={formatMessage({
                        id: 'channel_settings.share_channel_with_workspaces.disable_toggle_tooltip_hint',
                        defaultMessage: 'Contact your system admin to add one.',
                    })}
                    disabled={hasAvailableWorkspaces}
                >
                    <div className='channel_shared_with_workspaces_header__toggle'>

                        <Toggle
                            id='shareChannelWithWorkspacesToggle'
                            ariaLabel={heading}
                            size='btn-md'
                            onToggle={handleToggle}
                            toggled={enabled && hasAvailableWorkspaces}
                            disabled={!hasAvailableWorkspaces}
                            tabIndex={hasAvailableWorkspaces ? 0 : -1}
                            toggleClassName='btn-toggle-primary'
                        />
                    </div>
                </WithTooltip>
            </div>

            {!hasAvailableWorkspaces && (
                <div className='channel_shared_with_workspaces_section_body'>
                    <span className='ShareChannelWithWorkspaces__noWorkspacesMessage'>
                        <i className='icon icon-information-outline'/>
                        <FormattedMessage
                            id='channel_settings.share_channel_with_workspaces.no_workspaces_available'
                            defaultMessage='No connected workspaces are available. Contact your system admin to add one.'
                        />
                    </span>
                </div>
            )}

            {hasAvailableWorkspaces && enabled && (
                <div className='channel_shared_with_workspaces_section_body'>
                    <span className='ShareChannelWithWorkspaces__listHeader'>
                        {remotes.length > 0 ? (
                            <FormattedMessage
                                id='channel_settings.share_channel_with_workspaces.workspaces_label'
                                defaultMessage='Workspaces this channel is shared with'
                            />
                        ) : (
                            <FormattedMessage
                                id='channel_settings.share_channel_with_workspaces.workspaces_label_empty'
                                defaultMessage='This channel is not shared with any connected workspaces yet.'
                            />
                        )}
                    </span>

                    <WorkspaceList
                        workspaces={remotes}
                        onRemove={handleRemove}
                    />

                    <AddWorkspaceDropdown
                        currentRemoteIds={currentRemoteIds}
                        onAdd={handleAdd}
                        remoteClusters={availableRemoteClusters}
                    />
                </div>
            )}
        </div>
    );
}
