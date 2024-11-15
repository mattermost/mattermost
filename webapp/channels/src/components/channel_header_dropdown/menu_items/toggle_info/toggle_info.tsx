// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useIntl} from 'react-intl';

import type {Channel} from '@mattermost/types/channels';

import Menu from 'components/widgets/menu/menu';
import { InformationOutlineIcon } from '@mattermost/compass-icons/components';

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
    const intl = useIntl();

    const toggleRHS = () => {
        if (rhsOpen) {
            actions.closeRightHandSide();
            return;
        }
        actions.showChannelInfo(channel.id);
    };

    let text;
    if (rhsOpen) {
        text = intl.formatMessage({id: 'channelHeader.hideInfo', defaultMessage: 'Close Info'});
    } else {
        text = intl.formatMessage({id: 'channelHeader.viewInfo', defaultMessage: 'View Info'});
    }

    return (
        <Menu.ItemAction
            show={show}
            onClick={toggleRHS}
            text={text}
            icon={<InformationOutlineIcon color='#808080' />}
        />
    );
};

export default ToggleInfo;
