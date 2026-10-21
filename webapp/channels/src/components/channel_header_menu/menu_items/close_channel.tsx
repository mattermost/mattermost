// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {type JSX} from 'react';
import {FormattedMessage} from 'react-intl';

import {goToLastViewedChannel} from 'actions/views/channel';

import * as Menu from 'components/menu';

interface Props extends Menu.FirstMenuItemProps {

    /** Names it Close Board for a board. */
    isBoard?: boolean;
}

const CloseChannel = ({isBoard = false, ...rest}: Props): JSX.Element => {
    return (
        <Menu.Item
            onClick={goToLastViewedChannel}
            labels={isBoard ? (
                <FormattedMessage
                    id='center_panel.archived.closeChannel.board'
                    defaultMessage='Close Board'
                />
            ) : (
                <FormattedMessage
                    id='center_panel.archived.closeChannel'
                    defaultMessage='Close Channel'
                />
            )}
            {...rest}
        />
    );
};
export default React.memo(CloseChannel);
