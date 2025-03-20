// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import {Link, useHistory} from 'react-router-dom';
import styled from 'styled-components';

import {DotsHorizontalIcon, CodeTagsIcon, PencilOutlineIcon, TrashCanOutlineIcon} from '@mattermost/compass-icons/components';
import type {RemoteCluster} from '@mattermost/types/remote_clusters';

import * as Menu from 'components/menu';

import {ConnectionStatusLabel} from './controls';
import {useRemoteClusterCreateInvite, useRemoteClusterDelete} from './modals/modal_utils';
import {getEditLocation, isConfirmed} from './utils';

type Props = {
    remoteCluster: RemoteCluster;
    onDeleteSuccess: () => void;
    disabled: boolean;
};

export default function SecureConnectionRow(props: Props) {
    const {remoteCluster: rc} = props;

    const titleId = `${rc.remote_id}-title`;

    return (
        <RowLink
            to={getEditLocation(rc)}
            aria-labelledby={titleId}
        >
            <Title id={titleId}>{rc.display_name}</Title>
            <Detail>
                <ConnectionStatusLabel rc={rc}/>
                <RowMenu {...props}/>
            </Detail>
        </RowLink>
    );
}

const menuId = 'secure_connection_row_menu';

const RowMenu = ({remoteCluster: rc, onDeleteSuccess, disabled}: Props) => {
    const {formatMessage} = useIntl();
    const history = useHistory<RemoteCluster>();
    const {promptDelete} = useRemoteClusterDelete(rc);
    const {promptCreateInvite} = useRemoteClusterCreateInvite(rc);

    const handleCreateInvite = () => {
        promptCreateInvite();
    };

    const handleEdit = () => {
        history.push(getEditLocation(rc));
    };

    const handleDelete = () => {
        promptDelete().then(onDeleteSuccess);
    };

    return (
        <Menu.Container
            menuButton={{
                id: `${menuId}-button-${rc.remote_id}`,
                class: classNames('btn btn-tertiary btn-sm connection-row-menu-button', {disabled}),
                disabled,
                children: !disabled && <DotsHorizontalIcon size={16}/>,
                'aria-label': formatMessage({id: 'admin.secure_connection_row.menu-button.aria_label', defaultMessage: 'Connection options for {connection}'}, {connection: rc.display_name}),
            }}
            menu={{
                id: menuId,
                'aria-label': formatMessage({id: 'admin.secure_connection_row.menu.aria_label', defaultMessage: 'secure connection row menu'}),
            }}
        >
            {!isConfirmed(rc) && (
                <Menu.Item
                    id={`${menuId}-generate_invite`}
                    leadingElement={<CodeTagsIcon size={18}/>}
                    labels={(
                        <FormattedMessage
                            id='admin.secure_connection_row.menu.share'
                            defaultMessage='Generate invitation code'
                        />
                    )}
                    onClick={handleCreateInvite}
                />
            )}
            <Menu.Item
                id={`${menuId}-edit`}
                leadingElement={<PencilOutlineIcon size={18}/>}
                labels={(
                    <FormattedMessage
                        id='admin.secure_connection_row.menu.edit'
                        defaultMessage='Edit'
                    />
                )}
                onClick={handleEdit}
            />
            <Menu.Item
                id={`${menuId}-delete`}
                isDestructive={true}
                leadingElement={<TrashCanOutlineIcon size={18}/>}
                labels={(
                    <FormattedMessage
                        id='admin.secure_connection_row.menu.delete'
                        defaultMessage='Delete'
                    />
                )}
                onClick={handleDelete}
            />
        </Menu.Container>
    );
};

const RowLink = styled(Link<RemoteCluster>).attrs({className: 'secure-connection'})`
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 20px 35px;
    border-bottom: 1px solid var(--center-channel-color-12, rgba(63, 67, 80, 0.12));
    color: var(--center-channel-color);

    &:hover {
        text-decoration: none;
        color: var(--center-channel-color);
    }

    &:last-child {
        border-bottom: 0;
    }

    .connection-row-menu-button {
        padding: 0px 8px;
    }
`;

const Title = styled.strong`
    font-size: 14px;
`;

const Detail = styled.div`
    display: flex;
    gap: 20px;
    align-items: center;
`;
