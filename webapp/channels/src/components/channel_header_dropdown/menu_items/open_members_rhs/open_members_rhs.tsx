// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {Channel} from '@mattermost/types/channels';

import Menu from 'components/widgets/menu/menu';

type Action = {
    showChannelMembers: (channelId: string, editMembers: boolean) => void;
};

type OwnProps = {
    channel: Channel;
    show: boolean;
    id: string;
    editMembers?: boolean;
    text: string;
}

type Props = {
    rhsOpen: boolean;
    actions: Action;
} & OwnProps;

const ToggleChannelMembersRHS = ({
    show,
    id,
    channel,
    rhsOpen,
    text,
    editMembers = false,
    actions,
}: Props) => {
    const openRHSIfNotOpen = () => {
        if (rhsOpen) {
            return;
        }
        actions.showChannelMembers(channel.id, editMembers);
    };

    return (
        <Menu.ItemAction
            show={show}
            id={id}
            onClick={openRHSIfNotOpen}
            text={text}
        />
    );
};

export default ToggleChannelMembersRHS;
