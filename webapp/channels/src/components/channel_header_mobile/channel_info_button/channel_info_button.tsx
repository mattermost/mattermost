// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import InfoIcon from 'components/widgets/icons/info_icon';

import {localizeMessage} from 'utils/utils';

import type {Channel} from '@mattermost/types/channels';

type Props = {
    channel: Channel;
    actions: {
        showChannelInfo: (channelId: string) => void;
    };
};

const NavbarInfoButton: React.FunctionComponent<Props> = ({channel, actions}: Props): JSX.Element => (
    <button
        className='navbar-toggle navbar-right__icon navbar-info-button pull-right'
        aria-label={localizeMessage('accessibility.button.Info', 'Info')}
        onClick={() => actions.showChannelInfo(channel.id)}
    >
        <InfoIcon
            className='icon icon__info'
            aria-hidden='true'
        />
    </button>
);

export default NavbarInfoButton;
