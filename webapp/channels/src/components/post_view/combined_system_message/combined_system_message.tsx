// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {injectIntl, IntlShape, MessageDescriptor} from 'react-intl';

import {Posts} from 'mattermost-redux/constants';

import {UserProfile} from '@mattermost/types/users';

import {ActionFunc} from 'mattermost-redux/types/actions';

import {t} from 'utils/i18n';
import Markdown from 'components/markdown';

import LastUsers from './last_users';

const {
    JOIN_CHANNEL, ADD_TO_CHANNEL, REMOVE_FROM_CHANNEL, LEAVE_CHANNEL, JOIN_LEAVE_CHANNEL,
    JOIN_TEAM, ADD_TO_TEAM, REMOVE_FROM_TEAM, LEAVE_TEAM,
} = Posts.POST_TYPES;

const postTypeMessage = {
    [JOIN_CHANNEL]: {
        one: {
            id: t('combined_system_message.joined_channel.one'),
            defaultMessage: '{firstUser} **joined the channel**.',
        },
        one_you: {
            id: t('combined_system_message.joined_channel.one_you'),
            defaultMessage: 'You **joined the channel**.',
        },
        two: {
            id: t('combined_system_message.joined_channel.two'),
            defaultMessage: '{firstUser} and {secondUser} **joined the channel**.',
        },
        many_expanded: {
            id: t('combined_system_message.joined_channel.many_expanded'),
            defaultMessage: '{users} and {lastUser} **joined the channel**.',
        },
    },
    [ADD_TO_CHANNEL]: {
        one: {
            id: t('combined_system_message.added_to_channel.one'),
            defaultMessage: '{firstUser} **added to the channel** by {actor}.',
        },
        one_you: {
            id: t('combined_system_message.added_to_channel.one_you'),
            defaultMessage: 'You were **added to the channel** by {actor}.',
        },
        two: {
            id: t('combined_system_message.added_to_channel.two'),
            defaultMessage: '{firstUser} and {secondUser} **added to the channel** by {actor}.',
        },
        many_expanded: {
            id: t('combined_system_message.added_to_channel.many_expanded'),
            defaultMessage: '{users} and {lastUser} were **added to the channel** by {actor}.',
        },
    },
    [REMOVE_FROM_CHANNEL]: {
        one: {
            id: t('combined_system_message.removed_from_channel.one'),
            defaultMessage: '{firstUser} was **removed from the channel**.',
        },
        one_you: {
            id: t('combined_system_message.removed_from_channel.one_you'),
            defaultMessage: 'You were **removed from the channel**.',
        },
        two: {
            id: t('combined_system_message.removed_from_channel.two'),
            defaultMessage: '{firstUser} and {secondUser} were **removed from the channel**.',
        },
        many_expanded: {
            id: t('combined_system_message.removed_from_channel.many_expanded'),
            defaultMessage: '{users} and {lastUser} were **removed from the channel**.',
        },
    },
    [LEAVE_CHANNEL]: {
        one: {
            id: t('combined_system_message.left_channel.one'),
            defaultMessage: '{firstUser} **left the channel**.',
        },
        one_you: {
            id: t('combined_system_message.left_channel.one_you'),
            defaultMessage: 'You **left the channel**.',
        },
        two: {
            id: t('combined_system_message.left_channel.two'),
            defaultMessage: '{firstUser} and {secondUser} **left the channel**.',
        },
        many_expanded: {
            id: t('combined_system_message.left_channel.many_expanded'),
            defaultMessage: '{users} and {lastUser} **left the channel**.',
        },
    },
    [JOIN_LEAVE_CHANNEL]: {
        one: {
            id: t('combined_system_message.join_left_channel.one'),
            defaultMessage: '{firstUser} **joined and left the channel**.',
        },
        one_you: {
            id: t('combined_system_message.join_left_channel.one_you'),
            defaultMessage: 'You **joined and left the channel**.',
        },
        two: {
            id: t('combined_system_message.join_left_channel.two'),
            defaultMessage: '{firstUser} and {secondUser} **joined and left the channel**.',
        },
        many_expanded: {
            id: t('combined_system_message.join_left_channel.many_expanded'),
            defaultMessage: '{users} and {lastUser} **joined and left the channel**.',
        },
    },
    [JOIN_TEAM]: {
        one: {
            id: t('combined_system_message.joined_team.one'),
            defaultMessage: '{firstUser} **joined the team**.',
        },
        one_you: {
            id: t('combined_system_message.joined_team.one_you'),
            defaultMessage: 'You **joined the team**.',
        },
        two: {
            id: t('combined_system_message.joined_team.two'),
            defaultMessage: '{firstUser} and {secondUser} **joined the team**.',
        },
        many_expanded: {
            id: t('combined_system_message.joined_team.many_expanded'),
            defaultMessage: '{users} and {lastUser} **joined the team**.',
        },
    },
    [ADD_TO_TEAM]: {
        one: {
            id: t('combined_system_message.added_to_team.one'),
            defaultMessage: '{firstUser} **added to the team** by {actor}.',
        },
        one_you: {
            id: t('combined_system_message.added_to_team.one_you'),
            defaultMessage: 'You were **added to the team** by {actor}.',
        },
        two: {
            id: t('combined_system_message.added_to_team.two'),
            defaultMessage: '{firstUser} and {secondUser} **added to the team** by {actor}.',
        },
        many_expanded: {
            id: t('combined_system_message.added_to_team.many_expanded'),
            defaultMessage: '{users} and {lastUser} were **added to the team** by {actor}.',
        },
    },
    [REMOVE_FROM_TEAM]: {
        one: {
            id: t('combined_system_message.removed_from_team.one'),
            defaultMessage: '{firstUser} was **removed from the team**.',
        },
        one_you: {
            id: t('combined_system_message.removed_from_team.one_you'),
            defaultMessage: 'You were **removed from the team**.',
        },
        two: {
            id: t('combined_system_message.removed_from_team.two'),
            defaultMessage: '{firstUser} and {secondUser} were **removed from the team**.',
        },
        many_expanded: {
            id: t('combined_system_message.removed_from_team.many_expanded'),
            defaultMessage: '{users} and {lastUser} were **removed from the team**.',
        },
    },
    [LEAVE_TEAM]: {
        one: {
            id: t('combined_system_message.left_team.one'),
            defaultMessage: '{firstUser} **left the team**.',
        },
        one_you: {
            id: t('combined_system_message.left_team.one_you'),
            defaultMessage: 'You **left the team**.',
        },
        two: {
            id: t('combined_system_message.left_team.two'),
            defaultMessage: '{firstUser} and {secondUser} **left the team**.',
        },
        many_expanded: {
            id: t('combined_system_message.left_team.many_expanded'),
            defaultMessage: '{users} and {lastUser} **left the team**.',
        },
    },
};

export type Props = {
    allUserIds: string[];
    allUsernames: string[];
    currentUserId: string;
    currentUsername: string;
    intl: IntlShape;
    messageData: Array<{
        actorId?: string;
        postType: string;
        userIds: string[];
    }>;
    showJoinLeave: boolean;
    userProfiles: UserProfile[];
    actions: {
        getMissingProfilesByIds: (userIds: string[]) => ActionFunc ;
        getMissingProfilesByUsernames: (usernames: string[]) => ActionFunc;
    };
}

export class CombinedSystemMessage extends React.PureComponent<Props> {
    static defaultProps = {
        allUserIds: [],
        allUsernames: [],
    };

    componentDidMount(): void {
        this.loadUserProfiles(this.props.allUserIds, this.props.allUsernames);
    }

    componentDidUpdate(prevProps: Props): void {
        const {allUserIds, allUsernames} = this.props;
        if (allUserIds !== prevProps.allUserIds || allUsernames !== prevProps.allUsernames) {
            this.loadUserProfiles(allUserIds, allUsernames);
        }
    }

    loadUserProfiles = (allUserIds: string[], allUsernames: string[]): void => {
        if (allUserIds.length > 0) {
            this.props.actions.getMissingProfilesByIds(allUserIds);
        }

        if (allUsernames.length > 0) {
            this.props.actions.getMissingProfilesByUsernames(allUsernames);
        }
    };

    getAllUsernames = (): {[p: string]: string} => {
        const {
            allUserIds,
            allUsernames,
            currentUserId,
            currentUsername,
            userProfiles,
        } = this.props;
        const {formatMessage} = this.props.intl;
        const usernames = userProfiles.reduce((acc: {[key: string]: string}, user: UserProfile) => {
            acc[user.id] = user.username;
            acc[user.username] = user.username;
            return acc;
        }, {});

        const currentUserDisplayName = formatMessage({id: t('combined_system_message.you'), defaultMessage: 'You'});
        if (allUserIds.includes(currentUserId)) {
            usernames[currentUserId] = currentUserDisplayName;
        } else if (allUsernames.includes(currentUsername)) {
            usernames[currentUsername] = currentUserDisplayName;
        }

        return usernames;
    };

    getUsernamesByIds = (userIds: string | string[] = []): string[] => {
        const userIdsArray = Array.isArray(userIds) ? userIds : [userIds];
        const {currentUserId, currentUsername} = this.props;
        const allUsernames = this.getAllUsernames();

        const {formatMessage} = this.props.intl;
        const someone = formatMessage({id: t('channel_loader.someone'), defaultMessage: 'Someone'});

        const usernames = userIdsArray.
            filter((userId) => {
                return userId !== currentUserId && userId !== currentUsername;
            }).
            map((userId) => {
                return allUsernames[userId] ? `@${allUsernames[userId]}` : someone;
            }).
            filter((username) => {
                return username && username !== '';
            });

        if (userIdsArray.includes(currentUserId)) {
            usernames.unshift(allUsernames[currentUserId]);
        } else if (userIdsArray.includes(currentUsername)) {
            usernames.unshift(allUsernames[currentUsername]);
        }

        return Array.from(new Set(usernames));
    };

    renderFormattedMessage(postType: string, userIds: string[], actorId?: string): JSX.Element {
        const {formatMessage} = this.props.intl;
        const {currentUserId, currentUsername} = this.props;
        const usernames = this.getUsernamesByIds(userIds);
        let actor = actorId ? this.getUsernamesByIds([actorId])[0] : '';
        if (actor && (actorId === currentUserId || actorId === currentUsername)) {
            actor = actor.toLowerCase();
        }

        const firstUser = usernames[0];
        const secondUser = usernames[1];
        const numOthers = usernames.length - 1;

        const options = {
            atMentions: true,
            mentionKeys: [{key: firstUser}, {key: secondUser}, {key: actor}],
            mentionHighlight: false,
            singleline: true,
        };

        if (numOthers > 1) {
            return (
                <LastUsers
                    actor={actor}
                    expandedLocale={postTypeMessage[postType].many_expanded}
                    formatOptions={options}
                    postType={postType}
                    usernames={usernames}
                />
            );
        }

        let localeHolder: MessageDescriptor = {};
        if (numOthers === 0) {
            localeHolder = postTypeMessage[postType].one;

            if (
                (userIds[0] === this.props.currentUserId || userIds[0] === this.props.currentUsername) &&
                postTypeMessage[postType].one_you
            ) {
                localeHolder = postTypeMessage[postType].one_you;
            }
        } else if (numOthers === 1) {
            localeHolder = postTypeMessage[postType].two;
        }

        const formattedMessage = formatMessage(localeHolder, {firstUser, secondUser, actor});

        return (
            <Markdown
                message={formattedMessage}
                options={options}
            />
        );
    }

    renderMessage(index: number, postType: string, userIds: string[], actorId?: string): JSX.Element {
        return (
            <React.Fragment key={index}>
                {this.renderFormattedMessage(postType, userIds, actorId)}
                <br/>
            </React.Fragment>
        );
    }

    render(): JSX.Element {
        const {
            currentUserId,
            messageData,
        } = this.props;

        const content = [];
        for (let i = 0; i < messageData.length; i++) {
            const message = messageData[i];
            const {
                postType,
                actorId,
            } = message;
            let userIds = message.userIds;

            if (!this.props.showJoinLeave && actorId !== currentUserId) {
                const affectsCurrentUser = userIds.indexOf(currentUserId) !== -1;

                if (affectsCurrentUser) {
                    // Only show the message that the current user was added, etc
                    userIds = [currentUserId];
                } else {
                    // Not something the current user did or was affected by
                    continue;
                }
            }

            content.push(this.renderMessage(i, postType, userIds, actorId));
        }

        return (
            <React.Fragment>
                {content}
            </React.Fragment>
        );
    }
}

export default injectIntl(CombinedSystemMessage);
