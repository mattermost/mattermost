// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import { useIntl } from "react-intl";

import Menu from "components/widgets/menu/menu";

import { localizeMessage } from "utils/utils";

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
    const intl = useIntl();
    const handleClose = () => {
        actions.goToLastViewedChannel();
    };

    return (
        <Menu.ItemAction
            show={isArchived}
            onClick={handleClose}
            text={intl.formatMessage({
                id: "center_panel.archived.closeChannel",
                defaultMessage: "Close Channel",
            })}
        />
    );
};

export default React.memo(CloseChannel);