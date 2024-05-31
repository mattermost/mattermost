// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage, defineMessages} from 'react-intl';

import ConfirmModalRedux from 'components/confirm_modal_redux';
import FormattedMarkdownMessage from 'components/formatted_markdown_message';

type Props = {
    mentions: string[];
    memberNotifyCount: number;
    channelTimezoneCount: number;
    onConfirm: (checked: boolean) => void;
    onExited: () => void;
};

export default class NotifyConfirmModal extends React.PureComponent<Props> {
    render() {
        const {mentions, channelTimezoneCount, memberNotifyCount} = this.props;

        let notifyAllMessage: React.ReactNode = '';
        let notifyAllTitle: React.ReactNode = '';
        if (mentions.includes('@all') || mentions.includes('@channel') || mentions.includes('@here')) {
            notifyAllTitle = (
                <FormattedMessage
                    id='notify_all.title.confirm'
                    defaultMessage='Confirm sending notifications to entire channel'
                />
            );
            if (channelTimezoneCount > 0) {
                const message = mentions.length === 1 && mentions[0] === '@here' ? messages.atHereTimezones : messages.atAllTimezones;
                notifyAllMessage = (
                    <FormattedMarkdownMessage
                        {...message}
                        values={{
                            totalMembers: memberNotifyCount,
                            timezones: channelTimezoneCount,
                        }}
                    />
                );
            } else {
                const message = mentions.length === 1 && mentions[0] === '@here' ? messages.atHere : messages.atAll;
                notifyAllMessage = (
                    <FormattedMarkdownMessage
                        {...message}
                        values={{
                            totalMembers: memberNotifyCount,
                        }}
                    />
                );
            }
        } else if (mentions.length > 0) {
            notifyAllTitle = (
                <FormattedMessage
                    id='notify_all.title.confirm_groups'
                    defaultMessage='Confirm sending notifications to groups'
                />
            );

            if (mentions.length === 1) {
                if (channelTimezoneCount > 0) {
                    notifyAllMessage = (
                        <FormattedMarkdownMessage
                            id='notify_all.question_timezone_one_group'
                            defaultMessage='By using **{mention}** you are about to send notifications of up to **{totalMembers} people** in **{timezones, number} {timezones, plural, one {timezone} other {timezones}}**. Are you sure you want to do this?'
                            values={{
                                mention: mentions[0],
                                totalMembers: memberNotifyCount,
                                timezones: channelTimezoneCount,
                            }}
                        />
                    );
                } else {
                    notifyAllMessage = (
                        <FormattedMarkdownMessage
                            id='notify_all.question_one_group'
                            defaultMessage='By using **{mention}** you are about to send notifications of up to **{totalMembers} people**. Are you sure you want to do this?'
                            values={{
                                mention: mentions[0],
                                totalMembers: memberNotifyCount,
                            }}
                        />
                    );
                }
            } else if (channelTimezoneCount > 0) {
                notifyAllMessage = (
                    <FormattedMarkdownMessage
                        id='notify_all.question_timezone_groups'
                        defaultMessage='By using **{mentions}** and **{finalMention}** you are about to send notifications of up to **{totalMembers} people** in **{timezones, number} {timezones, plural, one {timezone} other {timezones}}**. Are you sure you want to do this?'
                        values={{
                            mentions: mentions.slice(0, -1).join(', '),
                            finalMention: mentions[mentions.length - 1],
                            totalMembers: memberNotifyCount,
                            timezones: channelTimezoneCount,
                        }}
                    />
                );
            } else {
                notifyAllMessage = (
                    <FormattedMarkdownMessage
                        id='notify_all.question_groups'
                        defaultMessage='By using **{mentions}** and **{finalMention}** you are about to send notifications of up to **{totalMembers} people**. Are you sure you want to do this?'
                        values={{
                            mentions: mentions.slice(0, -1).join(', '),
                            finalMention: mentions[mentions.length - 1],
                            totalMembers: memberNotifyCount,
                        }}
                    />
                );
            }
        }

        const notifyAllConfirm = (
            <FormattedMessage
                id='notify_all.confirm'
                defaultMessage='Confirm'
            />
        );

        return (
            <ConfirmModalRedux
                title={notifyAllTitle}
                message={notifyAllMessage}
                confirmButtonText={notifyAllConfirm}
                onConfirm={this.props.onConfirm}
                onExited={this.props.onExited}
            />
        );
    }
}

const messages = defineMessages({
    atAll: {
        id: 'notify_all.question',
        defaultMessage: 'By using **@all** or **@channel** you are about to send notifications to **{totalMembers} people**. Are you sure you want to do this?',
    },
    atAllTimezones: {
        id: 'notify_all.question_timezone',
        defaultMessage: 'By using **@all** or **@channel** you are about to send notifications to **{totalMembers} people** in **{timezones, number} {timezones, plural, one {timezone} other {timezones}}**. Are you sure you want to do this?',
    },
    atHere: {
        id: 'notify_here.question',
        defaultMessage: 'By using **@here** you are about to send notifications to up to **{totalMembers} other people**. Are you sure you want to do this?',
    },
    atHereTimezones: {
        id: 'notify_here.question_timezone',
        defaultMessage: 'By using **@here** you are about to send notifications to up to **{totalMembers} other people** in **{timezones, number} {timezones, plural, one {timezone} other {timezones}}**. Are you sure you want to do this?',
    },
});
