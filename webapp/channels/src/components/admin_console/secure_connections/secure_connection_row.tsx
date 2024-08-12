// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import {Link, useHistory} from 'react-router-dom';
import styled, {css} from 'styled-components';

import {DotsHorizontalIcon, CodeTagsIcon, PencilOutlineIcon, TrashCanOutlineIcon} from '@mattermost/compass-icons/components';
import type {RemoteCluster} from '@mattermost/types/remote_clusters';

import * as Menu from 'components/menu';

import {isConnected, getEditLocation, useRemoteClusterDelete, useRemoteClusterCreateInvite} from './utils';

type Props = {
    remoteCluster: RemoteCluster;
    onDeleteSuccess: () => void;
};

export default function SecureConnectionRow(props: Props) {
    const {remoteCluster: rc} = props;
    return (
        <RowLink to={getEditLocation(rc)}>
            <Title>{rc.display_name}</Title>
            <Detail>
                {/* <FormattedMessage
                    tagName={NumChannels}
                    id='admin.secure_connections.row.num_shared_channels'
                    defaultMessage='{num, plural, one {# shared channel} other {# shared channels}}'
                    values={{num: 2}}
                /> */}
                {isConnected(rc) ? (
                    <FormattedMessage
                        tagName={ConnectedLabel}
                        id='...connected'
                        defaultMessage='Connected'
                    />
                ) : (
                    <FormattedMessage
                        tagName={PendingConnectionLabel}
                        id='...pending'
                        defaultMessage='Connection Pending'
                    />
                )}
                <RowMenu {...props}/>
            </Detail>
        </RowLink>
    );
}

const menuId = 'secure_connection_row_menu';

const RowMenu = ({remoteCluster: rc, onDeleteSuccess}: Props) => {
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

    const disabled = false;

    return (
        <Menu.Container
            menuButton={{
                id: `${menuId}-button`,
                class: classNames('btn btn-tertiary btn-sm', {disabled}),
                disabled,
                children: !disabled && <DotsHorizontalIcon size={16}/>,
            }}
            menu={{
                id: menuId,
                'aria-label': formatMessage({id: 'admin.secure_connection_row.menu.aria_label', defaultMessage: 'secure connection row menu'}),
            }}
        >
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

    #${menuId}-button {
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

const NumChannels = styled.span`

`;

const labelStyle = css`
    font-size: 12px;
    color: white;
    border-radius: 4px;
    padding: 2px 4px;
`;

const ConnectedLabel = styled.strong`
    ${labelStyle};
    background-color: #3DB887;
`;

const PendingConnectionLabel = styled.strong`
    ${labelStyle};
    background-color: #F5AB00;
`;
