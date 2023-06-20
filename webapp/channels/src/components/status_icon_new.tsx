// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

type Props = {
    className: string;
    status: string;
}

export default class StatusIconNew extends React.PureComponent<Props> {
    static defaultProps: Props = {
        className: '',
        status: '',
    };

    render() {
        const {status, className} = this.props;

        if (!status) {
            return null;
        }

        let iconName = 'icon-circle-outline';
        if (status === 'online') {
            iconName = 'icon-check-circle';
        } else if (status === 'away') {
            iconName = 'icon-clock';
        } else if (status === 'dnd') {
            iconName = 'icon-minus-circle';
        }

        return <i className={`${iconName} ${className}`}/>;
    }
}
