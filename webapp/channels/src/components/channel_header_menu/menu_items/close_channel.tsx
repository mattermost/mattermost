// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {type JSX} from 'react';
import {FormattedMessage} from 'react-intl';

import {goToLastViewedChannel} from 'actions/views/channel';

import * as Menu from 'components/menu';

import {channelKindMessages} from 'utils/channel_kind_messages';

import type {ChannelKind} from 'types/store/plugins';

interface Props extends Menu.FirstMenuItemProps {

    /** Names it Close Board for a board. */
    kind?: ChannelKind;
}

const CloseChannel = ({kind = 'channel', ...rest}: Props): JSX.Element => {
    return (
        <Menu.Item
            onClick={goToLastViewedChannel}
            labels={<FormattedMessage {...channelKindMessages.closeChannel[kind]}/>}
            {...rest}
        />
    );
};

export default React.memo(CloseChannel);
