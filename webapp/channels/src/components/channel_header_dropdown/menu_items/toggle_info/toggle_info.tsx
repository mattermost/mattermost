// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import Menu from 'components/widgets/menu/menu';

import {localizeMessage} from 'utils/utils';

import type {Channel} from '@mattermost/types/channels';

type Action = {
    closeRightHandSide: () => void;
    showChannelInfo: (channelId: string) => void;
};

type Props = {
    show: boolean;
    channel: Channel;
    rhsOpen: boolean;
    actions: Action;
};

const ToggleInfo = ({show, channel, rhsOpen, actions}: Props) => {
    const toggleRHS = () => {
        if (rhsOpen) {
            actions.closeRightHandSide();
            return;
        }
        actions.showChannelInfo(channel.id);
    };

    const text = rhsOpen ? localizeMessage('channelHeader.hideInfo', 'Close Info') : localizeMessage('channelHeader.viewInfo', 'View Info');

    return (
        <Menu.ItemAction
            show={show}
            onClick={toggleRHS}
            text={text}
        />
    );
};

export default ToggleInfo;
