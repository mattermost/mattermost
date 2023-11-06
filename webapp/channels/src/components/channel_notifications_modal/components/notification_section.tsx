// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import type {ValueType} from 'react-select';

import type {ChannelNotifyProps} from '@mattermost/types/channels';

import {NotificationSections, NotificationLevels} from 'utils/constants';

import CollapseView from './collapse_view';
import ExpandView, {type SelectedOption} from './expand_view';

export type Props = {

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

    memberDesktopSound?: string;

    memberDesktopNotificationSound?: string;

    /**
     * Member's desktop_threads notification level
     */
    memberThreadsNotificationLevel?: string;

    /**
     * Ignore channel-wide mentions @channel, @here and @all
     */
    ignoreChannelMentions?: string;

    /**
     * Auto-follow all new threads in this channel
     */
    channelAutoFollowThreads?: string;

    /**
     * User's global notification level
     */
    globalNotificationLevel?: string;

    /**
     * User's global notification sound
     */
    globalNotificationSound?: ChannelNotifyProps['desktop_notification_sound'];

    /**
     * onChange handles update of desktop notification level
     */
    onChange: (value?: string) => void;

    /**
     * onChangeThreads handles update of desktop_threads notification level
     */
    onChangeThreads?: (value?: string) => void;

    onChangeDesktopSound?: (value?: string) => void;

    onChangeNotificationSound?: (value?: string) => void;

    onReset?: () => void;

    isNotificationsSettingSameAsGlobal?: boolean;

    /**
     * Submit function to save notification level
     */
    onSubmit: (setting?: string) => void;

    /**
     * Update function to to expand or collapse a section
     */
    onUpdateSection: (s: string) => void;

    /**
     * Error string from the server
     */
    serverError?: string;

    /**
     * Whether the preferences are those of a GM
     */
    isGM?: boolean;
};

export default class NotificationSection extends React.PureComponent<Props> {
    handleOnChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        this.props.onChange(e.target.value);
    };

    handleOnChangeThreads = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.checked ? NotificationLevels.ALL : NotificationLevels.MENTION;

        this.props.onChangeThreads?.(value);
    };

    handleOnChangeDesktopSound = (e: React.ChangeEvent<HTMLInputElement>) => {
        this.props.onChangeDesktopSound?.(e.target.value);
    };

    handleOnChangeNotificationSound = (selectedOption: ValueType<SelectedOption>) => {
        if (selectedOption && 'value' in selectedOption) {
            this.props.onChangeNotificationSound?.(selectedOption.value);
        }
    };

    handleExpandSection = () => {
        this.props.onUpdateSection(this.props.section);
    };

    handleCollapseSection = () => {
        this.props.onUpdateSection(NotificationSections.NONE);
    };

    render() {
        const {
            expand,
            globalNotificationLevel,
            globalNotificationSound,
            memberNotificationLevel,
            memberThreadsNotificationLevel,
            memberDesktopSound,
            memberDesktopNotificationSound,
            ignoreChannelMentions,
            isNotificationsSettingSameAsGlobal,
            channelAutoFollowThreads,
            onSubmit,
            onReset,
            section,
            serverError,
            isGM,
        } = this.props;

        if (expand) {
            return (
                <ExpandView
                    section={section}
                    memberNotifyLevel={memberNotificationLevel}
                    memberThreadsNotifyLevel={memberThreadsNotificationLevel}
                    memberDesktopSound={memberDesktopSound}
                    memberDesktopNotificationSound={memberDesktopNotificationSound}
                    globalNotifyLevel={globalNotificationLevel}
                    globalNotificationSound={globalNotificationSound}
                    ignoreChannelMentions={ignoreChannelMentions}
                    isNotificationsSettingSameAsGlobal={isNotificationsSettingSameAsGlobal}
                    channelAutoFollowThreads={channelAutoFollowThreads}
                    onChange={this.handleOnChange}
                    onReset={onReset ?? (() => {})}
                    onChangeThreads={this.handleOnChangeThreads}
                    onChangeDesktopSound={this.handleOnChangeDesktopSound}
                    onChangeNotificationSound={this.handleOnChangeNotificationSound}
                    onSubmit={onSubmit}
                    serverError={serverError}
                    onCollapseSection={this.handleCollapseSection}
                    isGM={isGM ?? false}
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
                channelAutoFollowThreads={channelAutoFollowThreads}
            />
        );
    }
}
