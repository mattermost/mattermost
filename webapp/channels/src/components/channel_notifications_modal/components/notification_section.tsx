// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {ChangeEvent} from 'react';

import {NotificationSections, NotificationLevels} from 'utils/constants';

import CollapseView from './collapse_view';
import ExpandView from './expand_view';

type Props = {

    /**
     * Notification section
     */
    section: string;

    /**
     * Expand if true, else collapse the section
     */
    expand: boolean;

    /**
     * Member's desktop notification level
     */
    memberNotificationLevel: string;

    /**
     * Member's desktop_threads notification level
     */
    memberThreadsNotificationLevel?: string;

    /**
     * Ignore channel-wide mentions @channel, @here and @all
     */
    ignoreChannelMentions?: string;

    /**
     * User's global notification level
     */
    globalNotificationLevel?: string;

    /**
     * Ignore channel-wide mentions @channel, @here and @all
     */
    onChange: (value: string) => void;

    /**
     * Ignore channel-wide mentions @channel, @here and @all
     */
    onChangeThreads?: (value: string) => void | any;

    /**
     * Ignore channel-wide mentions @channel, @here and @all
     */
    onSubmit: () => void;

    /**
     * Ignore channel-wide mentions @channel, @here and @all
     */
    onUpdateSection: (value: string) => void;

    /**
     * Ignore channel-wide mentions @channel, @here and @all
     */
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
        this.props.onChangeThreads?.(value);
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
