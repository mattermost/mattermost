// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';

import NotificationSeparator from 'components/widgets/separator/notification-separator';

type Props = {
    separatorId: string;
    wrapperRef?: React.RefObject<HTMLDivElement>;
}

export default class NewMessageSeparator extends React.PureComponent<Props> {
    render(): JSX.Element {
        return (
            <div
                ref={this.props.wrapperRef}
                className='new-separator'
            >
                <NotificationSeparator id={this.props.separatorId}>
                    <FormattedMessage
                        id='posts_view.newMsg'
                        defaultMessage='New Messages'
                    />

                </NotificationSeparator>
            </div>
        );
    }
}
