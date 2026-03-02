// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React, {useCallback, useRef, useState} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';

import type {RemoteCluster} from '@mattermost/types/remote_clusters';

import {Client4} from 'mattermost-redux/client';

import * as Menu from 'components/menu';

export type RemoteToAdd = {remote_id: string; display_name: string};

type Props = {
    channelId: string;
    currentRemoteIds: Set<string>;
    onAdd: (remotes: RemoteToAdd[]) => void;
    disabled?: boolean;
};

const MENU_ID = 'add_workspace_to_channel_menu';

export default function AddWorkspaceDropdown({
    channelId,
    currentRemoteIds,
    onAdd,
    disabled = false,
}: Props) {
    const {formatMessage} = useIntl();
    const [remotes, setRemotes] = useState<RemoteCluster[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const isFetchingRef = useRef(false);

    const loadRemotes = useCallback(async () => {
        if (isFetchingRef.current) {
            return;
        }
        isFetchingRef.current = true;
        setLoading(true);
        setError(null);
        try {
            const data = await Client4.getRemoteClusters({
                excludePlugins: true,
                notInChannel: channelId,
                onlyConfirmed: true,
            });
            setRemotes(data || []);
        } catch (err: unknown) {
            setError((err as Error)?.message || formatMessage({
                id: 'add_workspace_modal.error',
                defaultMessage: 'Failed to load workspaces',
            }));
        } finally {
            setLoading(false);
            isFetchingRef.current = false;
        }
    }, [channelId, formatMessage]);

    const handleToggle = useCallback((isOpen: boolean) => {
        if (isOpen) {
            loadRemotes();
        }
    }, [loadRemotes]);

    const handleSelect = useCallback((rc: RemoteCluster) => {
        onAdd([{
            remote_id: rc.remote_id,
            display_name: rc.display_name || rc.name,
        }]);
    }, [onAdd]);

    const available = remotes.filter((r) => !currentRemoteIds.has(r.remote_id));

    return (
        <Menu.Container
            menuButton={{
                id: `${MENU_ID}-button`,
                class: classNames('btn', 'btn-tertiary', 'ShareChannelWithWorkspaces__addBtn', {disabled}),
                disabled,
                children: (
                    <>
                        <FormattedMessage
                            id='channel_settings.share_channel_with_workspaces.add'
                            defaultMessage='+ Add workspace'
                        />
                        {!disabled && (
                            <i
                                aria-hidden='true'
                                className='icon icon-chevron-down'
                            />
                        )}
                    </>
                ),
            }}
            menu={{
                id: MENU_ID,
                'aria-label': formatMessage({
                    id: 'channel_settings.share_channel_with_workspaces.add_aria',
                    defaultMessage: 'Add workspace',
                }),
                onToggle: handleToggle,
            }}
        >
            {loading && (
                <Menu.Item
                    id={`${MENU_ID}-loading`}
                    labels={
                        <FormattedMessage
                            id='add_workspace_modal.loading'
                            defaultMessage='Loading workspaces...'
                        />
                    }
                    disabled={true}
                />
            )}
            {!loading && error && (
                <Menu.Item
                    id={`${MENU_ID}-error`}
                    labels={<span>{error}</span>}
                    disabled={true}
                />
            )}
            {!loading && !error && available.length === 0 && (
                <Menu.Item
                    id={`${MENU_ID}-empty`}
                    labels={
                        <FormattedMessage
                            id='add_workspace_modal.empty'
                            defaultMessage='All connected workspaces are already sharing this channel.'
                        />
                    }
                    disabled={true}
                />
            )}
            {!loading && !error && available.map((rc) => (
                <Menu.Item
                    key={rc.remote_id}
                    id={`${MENU_ID}-item-${rc.remote_id}`}
                    labels={<span>{rc.display_name || rc.name}</span>}
                    onClick={() => handleSelect(rc)}
                />
            ))}
        </Menu.Container>
    );
}
