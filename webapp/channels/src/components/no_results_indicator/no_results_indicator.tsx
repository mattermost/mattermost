// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React from 'react';
import type {ReactNode, CSSProperties} from 'react';
import {FormattedMessage, defineMessages} from 'react-intl';

import {SearchSVG, ChannelSearchSVG, MentionsSVG, SavedMessagesSVG, PinSVG, ChannelFilesSVG, UserGroupsSVG, UserGroupMembersSVG} from 'components/common/svg_images_components';

import {NoResultsVariant, NoResultsLayout} from './types';
import './no_results_indicator.scss';

interface Props {
    expanded?: boolean;
    iconGraphic?: ReactNode;
    title?: ReactNode;
    subtitle?: ReactNode;
    variant?: NoResultsVariant;
    titleValues?: Record<string, ReactNode>;
    subtitleValues?: Record<string, ReactNode>;
    style?: CSSProperties;
    layout?: NoResultsLayout;
    titleClassName?: string;
    subtitleClassName?: string;
}

const iconMap: {[key in NoResultsVariant]: React.ReactNode } = {
    [NoResultsVariant.Search]: <SearchSVG className='no-results__icon'/>,
    [NoResultsVariant.ChannelSearch]: <ChannelSearchSVG className='no-results__icon'/>,
    [NoResultsVariant.Files]: <ChannelFilesSVG className='no-results__icon'/>,
    [NoResultsVariant.Mentions]: <MentionsSVG className='no-results__icon'/>,
    [NoResultsVariant.FlaggedPosts]: <SavedMessagesSVG className='no-results__icon'/>,
    [NoResultsVariant.PinnedPosts]: <PinSVG className='no-results__icon'/>,
    [NoResultsVariant.ChannelFiles]: <ChannelFilesSVG className='no-results__icon'/>,
    [NoResultsVariant.ChannelFilesFiltered]: <ChannelFilesSVG className='no-results__icon'/>,
    [NoResultsVariant.UserGroups]: <UserGroupsSVG className='no-results__icon'/>,
    [NoResultsVariant.UserGroupMembers]: <UserGroupMembersSVG className='no-results__icon'/>,
    [NoResultsVariant.UserGroupsArchived]: <UserGroupsSVG className='no-results__icon'/>,
};

const titleMap = defineMessages({
    [NoResultsVariant.Search]: {
        id: 'no_results.search.title',
        defaultMessage: 'No results for “{channelName}”',
    },
    [NoResultsVariant.Files]: {
        id: 'no_results.Files.title',
        defaultMessage: 'No file results for “{searchTerm}”',
    },
    [NoResultsVariant.ChannelSearch]: {
        id: 'no_results.channel_search.title',
        defaultMessage: 'No results for “{channelName}”',
    },
    [NoResultsVariant.Mentions]: {
        id: 'no_results.mentions.title',
        defaultMessage: 'No mentions yet',
    },
    [NoResultsVariant.FlaggedPosts]: {
        id: 'no_results.flagged_posts.title',
        defaultMessage: 'No saved messages yet',
    },
    [NoResultsVariant.PinnedPosts]: {
        id: 'no_results.pinned_messages.title',
        defaultMessage: 'No pinned messages yet',
    },
    [NoResultsVariant.ChannelFiles]: {
        id: 'no_results.channel_files.title',
        defaultMessage: 'No files yet',
    },
    [NoResultsVariant.ChannelFilesFiltered]: {
        id: 'no_results.channel_files_filtered.title',
        defaultMessage: 'No files found',
    },
    [NoResultsVariant.UserGroups]: {
        id: 'no_results.user_groups.title',
        defaultMessage: 'No groups yet',
    },
    [NoResultsVariant.UserGroupMembers]: {
        id: 'no_results.user_group_members.title',
        defaultMessage: 'No members yet',
    },
    [NoResultsVariant.UserGroupsArchived]: {
        id: 'no_results.user_groups.archived.title',
        defaultMessage: 'No archived groups',
    },
});

const subtitleMap = defineMessages({
    [NoResultsVariant.Search]: {
        id: 'no_results.search.subtitle',
        defaultMessage: 'Check the spelling or try another search.',
    },
    [NoResultsVariant.Files]: {
        id: 'no_results.Files.subtitle',
        defaultMessage: 'Check the spelling or try another search.',
    },
    [NoResultsVariant.ChannelSearch]: {
        id: 'no_results.channel_search.subtitle',
        defaultMessage: 'Check the spelling or try another search.',
    },
    [NoResultsVariant.Mentions]: {
        id: 'no_results.mentions.subtitle',
        defaultMessage: 'Messages where someone mentions you or includes your trigger words are saved here.',
    },
    [NoResultsVariant.FlaggedPosts]: {
        id: 'no_results.flagged_posts.subtitle',
        defaultMessage: 'To save something for later, open the context menu on a message and choose {buttonText}. Saved messages are only visible to you',
    },
    [NoResultsVariant.PinnedPosts]: {
        id: 'no_results.pinned_messages.subtitle',
        defaultMessage: 'To pin important messages, open the context menu on a message and choose {text}. Pinned messages will be visible to everyone in this channel.',
    },
    [NoResultsVariant.ChannelFiles]: {
        id: 'no_results.channel_files.subtitle',
        defaultMessage: 'Files posted in this channel will show here.',
    },
    [NoResultsVariant.ChannelFilesFiltered]: {
        id: 'no_results.channel_files_filtered.subtitle',
        defaultMessage: "This channel doesn't contains any file with the selected file format.",
    },
    [NoResultsVariant.UserGroups]: {
        id: 'no_results.user_groups.subtitle',
        defaultMessage: 'Groups are a custom collection of users that can be used for mentions and invites.',
    },
    [NoResultsVariant.UserGroupMembers]: {
        id: 'no_results.user_group_members.subtitle',
        defaultMessage: 'There are currently no members in this group, please add one.',
    },
    [NoResultsVariant.UserGroupsArchived]: {
        id: 'no_results.user_groups.archived.subtitle',
        defaultMessage: 'Groups that are no longer relevant or are not being used can be archived',
    },
});

const NoResultsIndicator = ({
    expanded,
    style,
    variant,
    iconGraphic = variant ? (
        <div className='no-results__variant-wrapper'>
            {iconMap[variant]}
        </div>
    ) : null,
    titleValues,
    title = variant ? (
        <FormattedMessage
            {...titleMap[variant]}
            values={titleValues}
        />
    ) : null,
    subtitleValues,
    subtitle = variant ? (
        <FormattedMessage
            {...subtitleMap[variant]}
            values={subtitleValues}
        />
    ) : null,
    layout = NoResultsLayout.Vertical,
    titleClassName,
    subtitleClassName,
}: Props) => {
    let content = (
        <div
            className={classNames('no-results__wrapper', {'horizontal-layout': layout === NoResultsLayout.Horizontal})}
            style={style}
        >
            {iconGraphic}

            <div
                className='no-results__text-container'
            >
                {title && (
                    <h3 className={classNames('no-results__title', {'only-title': !subtitle}, titleClassName)}>
                        {title}
                    </h3>
                )}

                {subtitle && (
                    <div className={classNames('no-results__subtitle', subtitleClassName)}>
                        {subtitle}
                    </div>
                )}
            </div>

        </div>
    );

    if (expanded) {
        content = (
            <div className='no-results__holder'>
                {content}
            </div>
        );
    }

    return content;
};

export default NoResultsIndicator;
