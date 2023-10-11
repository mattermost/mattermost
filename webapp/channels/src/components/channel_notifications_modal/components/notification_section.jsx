// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import PropTypes from 'prop-types';
import React from 'react';

import {NotificationSections, NotificationLevels} from 'utils/constants';

import CollapseView from './collapse_view';
import ExpandView from './expand_view';

export default class NotificationSection extends React.PureComponent {
    static propTypes = {

        /**
         * Notification section
         */
        section: PropTypes.string.isRequired,

        /**
         * Expand if true, else collapse the section
         */
        expand: PropTypes.bool.isRequired,

        /**
         * Member's desktop notification level
         */
        memberNotificationLevel: PropTypes.string.isRequired,

        memberDesktopSound: PropTypes.string,

        memberDesktopNotificationSound: PropTypes.string,

        /**
         * Member's desktop_threads notification level
         */
        memberThreadsNotificationLevel: PropTypes.string,

        /**
         * Ignore channel-wide mentions @channel, @here and @all
         */
        ignoreChannelMentions: PropTypes.string,

        /**
         * Auto-follow all new threads in this channel
         */
        channelAutoFollowThreads: PropTypes.string,

        /**
         * User's global notification level
         */
        globalNotificationLevel: PropTypes.string,

        /**
         * User's global notification sound
         */
        globalNotificationSound: PropTypes.string,

        /**
         * onChange handles update of desktop notification level
         */
        onChange: PropTypes.func.isRequired,

        /**
         * onChangeThreads handles update of desktop_threads notification level
         */
        onChangeThreads: PropTypes.func,

        onChangeDesktopSound: PropTypes.func,

        onChangeNotificationSound: PropTypes.func,

        onReset: PropTypes.func,

        isNotificationsSettingSameAsGlobal: PropTypes.bool,

        /**
         * Submit function to save notification level
         */
        onSubmit: PropTypes.func.isRequired,

        /**
         * Update function to to expand or collapse a section
         */
        onUpdateSection: PropTypes.func.isRequired,

        /**
         * Error string from the server
         */
        serverError: PropTypes.string,

        /**
         * Whether the preferences are those of a GM
         */
        isGM: PropTypes.bool,
    };

    handleOnChange = (e) => {
        this.props.onChange(e.target.value);
    };

    handleOnChangeThreads = (e) => {
        const value = e.target.checked ? NotificationLevels.ALL : NotificationLevels.MENTION;

        this.props.onChangeThreads(value);
    };

    handleOnChangeDesktopSound = (e) => {
        this.props.onChangeDesktopSound(e.target.value);
    };

    handleOnChangeNotificationSound = (selectedOption) => {
        if (selectedOption && 'value' in selectedOption) {
            this.props.onChangeNotificationSound(selectedOption.value);
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
                    onReset={onReset}
                    onChangeThreads={this.handleOnChangeThreads}
                    onChangeDesktopSound={this.handleOnChangeDesktopSound}
                    onChangeNotificationSound={this.handleOnChangeNotificationSound}
                    onSubmit={onSubmit}
                    serverError={serverError}
                    onCollapseSection={this.handleCollapseSection}
                    isGM={isGM}
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
