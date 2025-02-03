// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage, defineMessages} from 'react-intl';

import ConfirmModalRedux from 'components/confirm_modal_redux';

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
                    <FormattedMessage
                        {...message}
                        values={{
                            totalMembers: memberNotifyCount,
                            timezones: channelTimezoneCount,
                            b: (chunks: string) => <b>{chunks}</b>,
                        }}
                    />
                );
            } else {
                const message = mentions.length === 1 && mentions[0] === '@here' ? messages.atHere : messages.atAll;
                notifyAllMessage = (
                    <FormattedMessage
                        {...message}
                        values={{
                            totalMembers: memberNotifyCount,
                            b: (chunks: string) => <b>{chunks}</b>,
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
                        <FormattedMessage
                            id='notifyAll.question_timezone_oneGroup'
                            defaultMessage='By using <b>{mention}</b> you are about to send notifications to at least <b>{totalMembers} people</b> in <b>{timezones, number} {timezones, plural, one {timezone} other {timezones}}</b>. Are you sure you want to do this?'
                            values={{
                                mention: mentions[0],
                                totalMembers: memberNotifyCount,
                                timezones: channelTimezoneCount,
                                b: (chunks: string) => <b>{chunks}</b>,
                            }}
                        />
                    );
                } else {
                    notifyAllMessage = (
                        <FormattedMessage
                            id='notifyAll.question_oneGroup'
                            defaultMessage='By using <b>{mention}</b> you are about to send notifications to at least <b>{totalMembers} people</b>. Are you sure you want to do this?'
                            values={{
                                mention: mentions[0],
                                totalMembers: memberNotifyCount,
                                b: (chunks: string) => <b>{chunks}</b>,
                            }}
                        />
                    );
                }
            } else if (channelTimezoneCount > 0) {
                notifyAllMessage = (
                    <FormattedMessage
                        id='notifyAll.question_timezoneGroups'
                        defaultMessage='By using <b>{mentions}</b> and <b>{finalMention}</b> you are about to send notifications to at least <b>{totalMembers} people</b> in <b>{timezones, number} {timezones, plural, one {timezone} other {timezones}}</b>. Are you sure you want to do this?'
                        values={{
                            mentions: mentions.slice(0, -1).join(', '),
                            finalMention: mentions[mentions.length - 1],
                            totalMembers: memberNotifyCount,
                            timezones: channelTimezoneCount,
                            b: (chunks: string) => <b>{chunks}</b>,
                        }}
                    />
                );
            } else {
                notifyAllMessage = (
                    <FormattedMessage
                        id='notifyAll.question_groups'
                        defaultMessage='By using <b>{mentions}</b> and <b>{finalMention}</b> you are about to send notifications to at least <b>{totalMembers} people</b>. Are you sure you want to do this?'
                        values={{
                            mentions: mentions.slice(0, -1).join(', '),
                            finalMention: mentions[mentions.length - 1],
                            totalMembers: memberNotifyCount,
                            b: (chunks: string) => <b>{chunks}</b>,
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
        id: 'notifyAll.question',
        defaultMessage: 'By using <b>@all</b> or <b>@channel</b> you are about to send notifications to <b>{totalMembers} people</b>. Are you sure you want to do this?',
    },
    atAllTimezones: {
        id: 'notifyAll.questionTimezone',
        defaultMessage: 'By using <b>@all</b> or <b>@channel</b> you are about to send notifications to <b>{totalMembers} people</b> in <b>{timezones, number} {timezones, plural, one {timezone} other {timezones}}</b>. Are you sure you want to do this?',
    },
    atHere: {
        id: 'notify_here.question',
        defaultMessage: 'By using <b>@here</b> you are about to send notifications to at least <b>{totalMembers} other people</b>. Are you sure you want to do this?',
    },
    atHereTimezones: {
        id: 'notifyHere.question_timezone',
        defaultMessage: 'By using <b>@here</b> you are about to send notifications to at least <b>{totalMembers} other people</b> in <b>{timezones, number} {timezones, plural, one {timezone} other {timezones}}</b>. Are you sure you want to do this?',
    },
});
