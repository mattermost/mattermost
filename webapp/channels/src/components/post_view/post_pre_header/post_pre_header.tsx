// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage, defineMessages, injectIntl} from 'react-intl';
import type {IntlShape} from 'react-intl';

import FlagIconFilled from 'components/widgets/icons/flag_icon_filled';

export type Props = {
    intl: IntlShape;
    isFlagged: boolean;
    isPinned?: boolean;
    skipPinned?: boolean;
    skipFlagged?: boolean;
    channelId: string;
    actions: {
        showFlaggedPosts: () => void;
        showPinnedPosts: (channelId: string) => void;
    };
}

export enum PostPinnedOrFlagged {
    Flagged,
    Pinned,
    PinnedAndFlagged,
    Neither,
}

enum MessageInfoKey {
    Flagged = 'flagged',
    Pinned = 'pinned',
    PinnedAndFlagged = 'pinnedAndFlagged',
}

class PostPreHeader extends React.PureComponent<Props> {
    getPostStatus(isFlagged: boolean, isPinned?: boolean): PostPinnedOrFlagged {
        if (isFlagged) {
            if (isPinned) {
                return PostPinnedOrFlagged.PinnedAndFlagged;
            }

            return PostPinnedOrFlagged.Flagged;
        }

        if (isPinned) {
            return PostPinnedOrFlagged.Pinned;
        }

        return PostPinnedOrFlagged.Neither;
    }

    getMessageInfo(postStatus: PostPinnedOrFlagged, skipFlagged?: boolean, skipPinned?: boolean): MessageInfoKey | false {
        if (skipFlagged && skipPinned) {
            return false;
        }

        if (postStatus === PostPinnedOrFlagged.PinnedAndFlagged) {
            if (!skipPinned && !skipFlagged) {
                return MessageInfoKey.PinnedAndFlagged;
            }

            if (skipPinned) {
                return MessageInfoKey.Flagged;
            }

            if (skipFlagged) {
                return MessageInfoKey.Pinned;
            }
        }

        if (postStatus === PostPinnedOrFlagged.Flagged && !skipFlagged) {
            return MessageInfoKey.Flagged;
        }

        if (postStatus === PostPinnedOrFlagged.Pinned && !skipPinned) {
            return MessageInfoKey.Pinned;
        }

        return false;
    }

    handleLinkClick = (messageKey: MessageInfoKey, channelId?: string) => {
        if (messageKey === MessageInfoKey.Pinned && channelId) {
            this.props.actions.showPinnedPosts(channelId);
        } else {
            this.props.actions.showFlaggedPosts();
        }
    };

    render() {
        const {isFlagged, isPinned, skipPinned, skipFlagged, channelId} = this.props;

        const messageKey = this.getMessageInfo(this.getPostStatus(isFlagged, isPinned), skipFlagged, skipPinned);

        if ((!isFlagged && !isPinned) || !messageKey) {
            return null;
        }

        return (
            <div className='post-pre-header'>
                <div className='post-pre-header__icons-container'>
                    {isPinned && !skipPinned && <span className='icon-pin icon icon--post-pre-header'/>}
                    {isFlagged && !skipFlagged && <FlagIconFilled className='icon icon--post-pre-header'/>}
                </div>
                <div className='post-pre-header__text-container'>
                    {messageKey &&
                    messageKey !== MessageInfoKey.PinnedAndFlagged && (
                        <span>
                            <a onClick={() => this.handleLinkClick(messageKey, channelId)}>
                                <FormattedMessage
                                    {...messages[messageKey]}
                                />
                            </a>
                        </span>
                    )}
                    {messageKey &&
                    messageKey === MessageInfoKey.PinnedAndFlagged && (
                        <span>
                            <a onClick={() => this.handleLinkClick(MessageInfoKey.Pinned, channelId)}>
                                <FormattedMessage
                                    {...messages[MessageInfoKey.Pinned]}
                                />
                            </a>
                            <span className='post-pre-header__link-separator'>{'\u2B24'}</span>
                            <a onClick={() => this.handleLinkClick(MessageInfoKey.Flagged)}>
                                <FormattedMessage
                                    {...messages[MessageInfoKey.Flagged]}
                                />
                            </a>
                        </span>
                    )}
                </div>
            </div>
        );
    }
}

const messages = defineMessages({
    [MessageInfoKey.Flagged]: {
        id: 'post_pre_header.flagged',
        defaultMessage: 'Saved',
    },
    [MessageInfoKey.Pinned]: {
        id: 'post_pre_header.pinned',
        defaultMessage: 'Pinned',
    },
});

export default injectIntl(PostPreHeader);
