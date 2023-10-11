// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import Menu from 'components/widgets/menu/menu';

import {localizeMessage} from 'utils/utils';

type Props = {
    isArchived: boolean;
    actions: {
        goToLastViewedChannel: () => void;
    };
}

export default class CloseChannel extends React.PureComponent<Props> {
    private handleClose = () => {
        this.props.actions.goToLastViewedChannel();
    };

    render() {
        return (
            <Menu.ItemAction
                show={this.props.isArchived}
                onClick={this.handleClose}
                text={localizeMessage('center_panel.archived.closeChannel', 'Close Channel')}
            />
        );
    }
}
