// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React, {useCallback, useMemo} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';

import type {RemoteCluster} from '@mattermost/types/remote_clusters';

import * as Menu from 'components/menu';

export type RemoteToAdd = {remote_id: string; display_name: string};

type Props = {
    currentRemoteIds: Set<string>;
    onAdd: (remotes: RemoteToAdd) => void;

    /** When provided, this list is used instead of fetching on open. null = still loading. */
    remoteClusters?: RemoteCluster[] | null;
};

const MENU_ID = 'add_workspace_to_channel_menu';

export default function AddWorkspaceDropdown({
    currentRemoteIds,
    onAdd,
    remoteClusters = undefined,
}: Props) {
    const {formatMessage} = useIntl();

    const handleSelect = useCallback((rc: RemoteCluster) => {
        onAdd({
            remote_id: rc.remote_id,
            display_name: rc.display_name || rc.name,
        });
    }, [onAdd]);

    const loading = remoteClusters === null;
    const remotes = remoteClusters ?? [];
    const available = remotes.filter((r) => !currentRemoteIds.has(r.remote_id));

    const menuButton = useMemo(() => ({
        id: `${MENU_ID}-button`,
        class: classNames('btn', 'btn-sm', 'btn-tertiary', 'ShareChannelWithWorkspaces__addBtn'),
        children: (
            <>
                <i
                    aria-hidden='true'
                    className='icon icon-plus'
                />
                <FormattedMessage
                    id='channel_settings.share_channel_with_workspaces.add'
                    defaultMessage='Add workspace'
                />
                <i
                    aria-hidden='true'
                    className='icon icon-chevron-down'
                />
            </>
        ),
    }), []);
    const menu = useMemo(() => ({
        id: MENU_ID,
        className: 'ShareChannelWithWorkspaces__dropdown',
        'aria-label': formatMessage({
            id: 'channel_settings.share_channel_with_workspaces.add_aria',
            defaultMessage: 'Add workspace',
        }),
    }), [formatMessage]);

    return (
        <Menu.Container
            menuButton={menuButton}
            menu={menu}
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
            {!loading && available.length === 0 && (
                <Menu.Item
                    id={`${MENU_ID}-empty`}
                    labels={
                        <FormattedMessage
                            id='add_workspace_modal.empty'
                            defaultMessage='No other connected workspaces available'
                        />
                    }
                    disabled={true}
                />
            )}
            {!loading && available.map((rc) => (
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
