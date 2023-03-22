// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {localizeMessage} from 'utils/utils';

import Menu from 'components/widgets/menu/menu';

type Props = {
    isArchived: boolean;
    actions: {
        goToLastViewedChannel: () => void;
    };
}

export default class CloseChannel extends React.PureComponent<Props> {
    private handleClose = () => {
        this.props.actions.goToLastViewedChannel();
    }

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
