// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {BasicUnreadMeta} from 'mattermost-redux/selectors/entities/channels';
type Props = BasicUnreadMeta;

export default class NotifyCounts extends React.PureComponent<Props> {
    render() {
        if (this.props.unreadMentionCount) {
            return <span className='badge badge-notify'>{this.props.unreadMentionCount}</span>;
        } else if (this.props.isUnread) {
            return <span className='badge badge-notify'>{'•'}</span>;
        }
        return null;
    }
}
