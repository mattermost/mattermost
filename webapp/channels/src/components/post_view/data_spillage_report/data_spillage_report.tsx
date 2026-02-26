// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useMemo} from 'react';
import {useIntl} from 'react-intl';

import {ContentFlaggingStatus} from '@mattermost/types/content_flagging';
import type {Post} from '@mattermost/types/posts';
import type {NameMappedPropertyFields, PropertyValue} from '@mattermost/types/properties';

import {Client4} from 'mattermost-redux/client';
import {getFileDownloadUrl} from 'mattermost-redux/utils/file_utils';

import AtMention from 'components/at_mention';
import {useGetContentFlaggingChannel, useGetContentFlaggingTeam, useGetFlaggedPost} from 'components/common/hooks/content_flagging';
import {useContentFlaggingFields, usePostContentFlaggingValues} from 'components/common/hooks/useContentFlaggingFields';
import {useUser} from 'components/common/hooks/useUser';
import DataSpillageAction from 'components/post_view/data_spillage_report/data_spillage_actions/data_spillage_actions';
import type {PropertiesCardViewMetadata} from 'components/properties_card_view/properties_card_view';
import PropertiesCardView from 'components/properties_card_view/properties_card_view';

import {DataSpillagePropertyNames} from 'utils/constants';

import './data_spillage_report.scss';
import DataSpillageFooter from './data_spillage_footer/data_spillage_footer';
import {getSyntheticPropertyFields, getSyntheticPropertyValues} from './synthetic_data';

// The order of fields to be displayed in the report, from top to bottom.
const orderedFieldName = [
    'status',
    'reporting_reason',
    'actor_user_id',
    'actor_comment',
    'action_time',
    'post_preview',
    'post_id',
    'reviewer_user_id',
    'reporting_user_id',
    'reporting_time',
    'reporting_comment',
    'channel',
    'team',
    'post_author',
    'post_creation_time',
];

const shortModeFieldOrder = [
    'status',
    'reporting_reason',
    'post_preview',
    'reviewer_user_id',
];

type Props = {
    post: Post;
    isRHS?: boolean;
};

export function DataSpillageReport({post, isRHS}: Props) {
    const {formatMessage} = useIntl();

    const reportedPostId = post.props.reported_post_id as string;

    const naturalPropertyFields = useContentFlaggingFields('fetch');
    const naturalPropertyValues = usePostContentFlaggingValues(reportedPostId);

    const reportedPost = useGetFlaggedPost(reportedPostId);
    const channel = useGetContentFlaggingChannel({flaggedPostId: reportedPostId, channelId: reportedPost?.channel_id});
    const team = useGetContentFlaggingTeam({flaggedPostId: reportedPostId, teamId: channel?.team_id});

    const propertyFields = useMemo((): NameMappedPropertyFields => {
        if (!naturalPropertyFields || !Object.keys(naturalPropertyFields).length) {
            return {};
        }

        const syntheticFields = getSyntheticPropertyFields(naturalPropertyFields.status.group_id);
        return {...naturalPropertyFields, ...syntheticFields};
    }, [naturalPropertyFields]);

    const propertyValues = useMemo((): Array<PropertyValue<unknown>> => {
        if (!naturalPropertyValues || !naturalPropertyValues.length) {
            return [];
        }

        const syntheticValues = getSyntheticPropertyValues(
            naturalPropertyValues[0].group_id,
            reportedPostId,
            reportedPost?.channel_id || '',
            channel?.team_id || '',
            reportedPost?.user_id || '',
            reportedPost?.create_at || 0,
        );
        return [...naturalPropertyValues, ...syntheticValues];
    }, [channel?.team_id, naturalPropertyValues, reportedPost?.channel_id, reportedPost?.create_at, reportedPost?.user_id, reportedPostId]);

    const reportingUserFieldId = propertyFields[DataSpillagePropertyNames.FlaggedBy];
    const reportingUserIdValue = propertyValues.find((value) => value.field_id === reportingUserFieldId?.id);

    const reportingUserId = reportingUserIdValue ? reportingUserIdValue.value as string : '';
    const reportingUser = useUser(reportingUserId);

    const title = formatMessage({
        id: 'data_spillage_report_post.title',
        defaultMessage: '{user} flagged a message for review',
    }, {
        user: (<AtMention mentionName={reportingUser?.username || ''}/>),
    });

    const mode = isRHS ? 'full' : 'short';

    const metadata = useMemo<PropertiesCardViewMetadata>(() => {
        const fieldMetadata: PropertiesCardViewMetadata = {
            post_preview: {
                post: reportedPost,
                fetchDeletedPost: true,
                channel,
                team,
                generateFileDownloadUrl:
                    generateFileDownloadUrl(reportedPostId),
            },
            reporting_comment: {
                placeholder: formatMessage({
                    id: 'data_spillage_report_post.reporting_comment.placeholder',
                    defaultMessage: 'No comment',
                }),
            },
            team: {
                team,
            },
            channel: {
                channel,
            },
        };

        if (channel) {
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore
            fieldMetadata.reviewer_user_id = {
                searchUsers: getSearchContentReviewersFunction(channel.team_id),
                setUser: saveReviewerSelection(reportedPostId),
            };
        }

        return fieldMetadata;
    }, [channel, formatMessage, reportedPost, reportedPostId, team]);

    const footer = useMemo(() => {
        if (isRHS) {
            return null;
        }

        return (<DataSpillageFooter post={post}/>);
    }, [isRHS, post]);

    const actionRow = useMemo(() => {
        if (!reportedPost || !reportingUser) {
            return null;
        }

        let showActionRow;
        if (!propertyFields || !propertyValues) {
            showActionRow = true;
        } else {
            const status = propertyValues.find((value) => value.field_id === propertyFields.status.id)?.value as string | undefined;
            showActionRow = reportedPost && reportingUser && status && (status === ContentFlaggingStatus.Pending || status === ContentFlaggingStatus.Assigned);
        }

        return showActionRow ? (
            <DataSpillageAction
                flaggedPost={reportedPost}
                reportingUser={reportingUser}
            />) : null;
    }, [propertyFields, propertyValues, reportedPost, reportingUser]);

    return (
        <div
            className={`DataSpillageReport mode_${mode}`}
            data-testid='data-spillage-report'
            onClick={(e) => e.stopPropagation()}
        >
            <PropertiesCardView
                title={title}
                propertyFields={propertyFields}
                propertyValues={propertyValues}
                fieldOrder={orderedFieldName}
                shortModeFieldOrder={shortModeFieldOrder}
                actionsRow={actionRow}
                mode={mode}
                metadata={metadata}
                footer={footer}
            />
        </div>
    );
}

function getSearchContentReviewersFunction(teamId: string) {
    return (term: string) => {
        return Client4.searchContentFlaggingReviewers(term, teamId);
    };
}

function saveReviewerSelection(flaggedPostId: string) {
    return (userId: string) => {
        return Client4.setContentFlaggingReviewer(flaggedPostId, userId);
    };
}

function generateFileDownloadUrl(flaggedPostId: string) {
    return (fileId: string) => getFileDownloadUrl(fileId, true, flaggedPostId);
}
