// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';
import {PluginComponent} from 'types/store/plugins';

import NotificationSeparator from 'components/widgets/separator/notification-separator';

type Props = {
    separatorId: string;
    wrapperRef?: React.RefObject<HTMLDivElement>;
    newMessagesSeparatorActions: PluginComponent[];
    lastViewedAt: number;
    channelId?: string;
    threadId?: string;
}

export default class NewMessageSeparator extends React.PureComponent<Props> {
    render(): JSX.Element {
        const pluginItems = this.props.newMessagesSeparatorActions?.
            map((item) => {
                if (!item.component) {
                    return null;
                }

                const Component = item.component as any;
                return (
                    <Component
                        key={item.id}
                        lastViewedAt={this.props.lastViewedAt}
                        channelId={this.props.channelId}
                        threadId={this.props.threadId}
                    />
                );
            });

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
                    {pluginItems}
                </NotificationSeparator>
            </div>
        );
    }
}
