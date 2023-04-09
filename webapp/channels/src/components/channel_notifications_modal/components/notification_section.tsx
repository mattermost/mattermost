// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {ChangeEvent} from 'react';

import {NotificationSections, NotificationLevels} from 'utils/constants';

import CollapseView from './collapse_view';
import ExpandView from './expand_view';

type Props = {
    section: string;
    expand: boolean;
    memberNotificationLevel: string;
    memberThreadsNotificationLevel?: string;
    ignoreChannelMentions?: string;
    globalNotificationLevel?: string;
    onChange: (value: string) => void;
    onChangeThreads?: (value: string) => void | any;
    onSubmit: () => void;
    onUpdateSection: (value: string) => void;
    serverError?: string;
}
export default class NotificationSection extends React.PureComponent<Props> {
    constructor(props: Props) {
        super(props);
    }

    handleOnChange = (e: ChangeEvent<HTMLInputElement>) => {
        this.props.onChange(e.target.value);
    }

    handleOnChangeThreads = (e: ChangeEvent<HTMLInputElement>) => {
        const value = e.target.checked ? NotificationLevels.ALL : NotificationLevels.MENTION;
        if (this.props.onChangeThreads) {
            this.props.onChangeThreads(value);
        }
    }

    handleExpandSection = () => {
        this.props.onUpdateSection(this.props.section);
    }

    handleCollapseSection = () => {
        this.props.onUpdateSection(NotificationSections.NONE);
    }

    render() {
        const {
            expand,
            globalNotificationLevel,
            memberNotificationLevel,
            memberThreadsNotificationLevel,
            ignoreChannelMentions,
            onSubmit,
            section,
            serverError,
        } = this.props;

        if (expand) {
            return (
                <ExpandView
                    section={section}
                    memberNotifyLevel={memberNotificationLevel}
                    memberThreadsNotifyLevel={memberThreadsNotificationLevel}
                    globalNotifyLevel={globalNotificationLevel}
                    ignoreChannelMentions={ignoreChannelMentions}
                    onChange={this.handleOnChange}
                    onChangeThreads={this.handleOnChangeThreads}
                    onSubmit={onSubmit}
                    serverError={serverError}
                    onCollapseSection={this.handleCollapseSection}
                />
            );
        }

        return (
            <CollapseView
                section={section}
                onExpandSection={this.handleExpandSection}
                memberNotifyLevel={memberNotificationLevel}
                globalNotifyLevel={globalNotificationLevel}
                ignoreChannelMentions={ignoreChannelMentions}
            />
        );
    }
}
