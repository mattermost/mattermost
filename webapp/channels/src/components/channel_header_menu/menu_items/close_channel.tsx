// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {type JSX} from 'react';
import {FormattedMessage, defineMessage} from 'react-intl';

import {goToLastViewedChannel} from 'actions/views/channel';

import * as Menu from 'components/menu';

import type {KindMessages} from 'utils/channel_kind';

import type {ChannelKind} from 'types/store/plugins';

interface Props extends Menu.FirstMenuItemProps {

    /** Names it Close Board for a board. */
    kind?: ChannelKind;
}

const CloseChannel = ({kind = 'channel', ...rest}: Props): JSX.Element => {
    return (
        <Menu.Item
            onClick={goToLastViewedChannel}
            labels={<FormattedMessage {...messages.close[kind]}/>}
            {...rest}
        />
    );
};

const messages = {
    close: {
        channel: defineMessage({
            id: 'center_panel.archived.closeChannel',
            defaultMessage: 'Close Channel',
        }),
        board: defineMessage({
            id: 'center_panel.archived.closeChannel.board',
            defaultMessage: 'Close Board',
        }),
    },
} satisfies Record<string, KindMessages>;

export default React.memo(CloseChannel);
