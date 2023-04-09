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
     * onChange handles update of desktop notification level
     */
    onChange: (value: string) => void;

    /**
     * onChangeThreads handles update of desktop_threads notification level
     */
    onChangeThreads?: (value: string) => void | any;

    /**
     * Submit function to save notification level
     */
    onSubmit: () => void;

    /**
     * Update function to expand or collapse a section
     */
    onUpdateSection: (value: string) => void;

    /**
     * Error string from the server
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
