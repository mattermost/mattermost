// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import Menu from 'components/widgets/menu/menu';

import {localizeMessage} from 'utils/utils';

interface CloseChannelProps {
    isArchived: boolean;
    actions: {
        goToLastViewedChannel: () => void;
    };
}

const CloseChannel = ({
    isArchived,
    actions,
}: CloseChannelProps): JSX.Element => {
    const handleClose = () => {
        actions.goToLastViewedChannel();
    };

    return (
        <Menu.ItemAction
            show={isArchived}
            onClick={handleClose}
            text={localizeMessage(
                "center_panel.archived.closeChannel",
                "Close Channel"
            )}
        />
    );
};

export default React.memo(CloseChannel);