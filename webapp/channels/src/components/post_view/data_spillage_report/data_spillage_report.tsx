// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect, useState} from 'react';
import {useIntl} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';

import type {Post} from '@mattermost/types/posts';
import type {
    PropertyField,
    PropertyValue,
} from '@mattermost/types/properties';

import {getMissingProfilesByIds} from 'mattermost-redux/actions/users';
import {getUser} from 'mattermost-redux/selectors/entities/users';

import AtMention from 'components/at_mention';
import {useChannel} from 'components/common/hooks/useChannel';
import {usePost} from 'components/common/hooks/usePost';
import DataSpillageAction from 'components/post_view/data_spillage_report/data_spillage_actions/data_spillage_actions';
import PropertiesCardView from 'components/properties_card_view/properties_card_view';

import {DataSpillagePropertyNames} from 'utils/constants';

import type {GlobalState} from 'types/store';

import './data_spillage_report.scss';

// TODO: this function will be replaced with actual data fetched from API in a later PR
function getDummyPropertyFields(): PropertyField[] {
    return [
        {
            id: 'status_field_id',
            group_id: 'content_flagging_group_id',
            name: DataSpillagePropertyNames.Status,
            type: 'select',
            target_type: 'post',
            create_at: 0,
            update_at: 0,
            delete_at: 0,
            attrs: {
                editable: false,
                options: [
                    {
                        id: 'option_pending_review',
                        name: 'Pending review',
                        color: 'light_gray',
                    },
                    {
                        id: 'option_reviewer_assigned',
                        name: 'Reviewer assigned',
                        color: 'light_blue',
                    },
                    {
                        id: 'option_dismissed',
                        name: 'Flag dismissed',
                        color: 'dark_blue',
                    },
                    {
                        id: 'option_removed',
                        name: 'Removed',
                        color: 'dark_red',
                    },
                ],
            },
        },
        {
            id: 'reporting_user_id_field_id',
            group_id: 'content_flagging_group_id',
            name: DataSpillagePropertyNames.FlaggedBy,
            type: 'user',
            target_type: 'post',
            create_at: 0,
            update_at: 0,
            delete_at: 0,
        },
        {
            id: 'reason_field_id',
            group_id: 'content_flagging_group_id',
            name: DataSpillagePropertyNames.Reason,
            type: 'select',
            target_type: 'post',
            create_at: 0,
            update_at: 0,
            delete_at: 0,
        },
        {
            id: 'comment_field_id',
            group_id: 'content_flagging_group_id',
            name: DataSpillagePropertyNames.Comment,
            type: 'text',
            target_type: 'post',
            create_at: 0,
            update_at: 0,
            delete_at: 0,
        },
        {
            id: 'reporting_time_field_id',
            group_id: 'content_flagging_group_id',
            name: DataSpillagePropertyNames.ReportingTime,
            type: 'text',
            attrs: {subType: 'timestamp'},
            target_type: 'post',
            create_at: 0,
            update_at: 0,
            delete_at: 0,
        },
        {
            id: 'reviewer_user_id_field_id',
            group_id: 'content_flagging_group_id',
            name: DataSpillagePropertyNames.ReviewingUser,
            type: 'user',
            target_type: 'post',
            create_at: 0,
            update_at: 0,
            delete_at: 0,
            attrs: {
                editable: true,
            },
        },
        {
            id: 'actor_user_field_id',
            group_id: 'content_flagging_group_id',
            name: DataSpillagePropertyNames.ActionBy,
            type: 'user',
            target_type: 'post',
            create_at: 0,
            update_at: 0,
            delete_at: 0,
        },
        {
            id: 'actor_comment_field_id',
            group_id: 'content_flagging_group_id',
            name: DataSpillagePropertyNames.ActionComment,
            type: 'text',
            target_type: 'post',
            create_at: 0,
            update_at: 0,
            delete_at: 0,
        },
        {
            id: 'action_time_field_id',
            group_id: 'content_flagging_group_id',
            name: DataSpillagePropertyNames.ActionTime,
            type: 'text',
            target_type: 'post',
            create_at: 0,
            update_at: 0,
            delete_at: 0,
        },
        {
            id: 'post_preview_field_id',
            group_id: 'content_flagging_group_id',
            name: DataSpillagePropertyNames.Message,
            type: 'text',
            attrs: {subType: 'post'},
            target_type: 'post',
            create_at: 0,
            update_at: 0,
            delete_at: 0,
        },
        {
            id: 'channel_field_id',
            group_id: 'content_flagging_group_id',
            name: DataSpillagePropertyNames.PostedIn,
            type: 'text',
            attrs: {subType: 'channel'},
            target_type: 'post',
            create_at: 0,
            update_at: 0,
            delete_at: 0,
        },
        {
            id: 'team_field_id',
            group_id: 'content_flagging_group_id',
            name: DataSpillagePropertyNames.Team,
            type: 'text',
            attrs: {subType: 'team'},
            target_type: 'post',
            create_at: 0,
            update_at: 0,
            delete_at: 0,
        },
        {
            id: 'post_author_field_id',
            group_id: 'content_flagging_group_id',
            name: DataSpillagePropertyNames.PostedBy,
            type: 'user',
            target_type: 'post',
            create_at: 0,
            update_at: 0,
            delete_at: 0,
        },
        {
            id: 'post_creation_time_field_id',
            group_id: 'content_flagging_group_id',
            name: DataSpillagePropertyNames.PostedAt,
            type: 'text',
            attrs: {subType: 'timestamp'},
            target_type: 'post',
            create_at: 0,
            update_at: 0,
            delete_at: 0,
        },
    ];
}

// TODO: this function will be replaced with actual data fetched from API in a later PR
function getDummyPropertyValues(postId: string, channelId: string, teamId: string, authorId: string, postCreateAt: number): Array<PropertyValue<unknown>> {
    return [
        {
            id: 'status_value_id',
            field_id: 'status_field_id',
            target_id: 'reported_post_id',
            target_type: 'post',
            group_id: 'content_flagging_group_id',
            value: 'Flag dismissed',
            create_at: 0,
            update_at: 0,
            delete_at: 0,
        },
        {
            id: 'reporting_user_value_id',
            field_id: 'reporting_user_id_field_id',
            target_id: 'reported_post_id',
            target_type: 'post',
            group_id: 'content_flagging_group_id',
            value: 'ewgposajm3fwpjbqu1t6scncia',
            create_at: 0,
            update_at: 0,
            delete_at: 0,
        },
        {
            id: 'reason_value_id',
            field_id: 'reason_field_id',
            target_id: 'reported_post_id',
            target_type: 'post',
            group_id: 'content_flagging_group_id',
            value: 'Inappropriate content',
            create_at: 0,
            update_at: 0,
            delete_at: 0,
        },
        {
            id: 'comment_value_id',
            field_id: 'comment_field_id',
            target_id: 'reported_post_id',
            target_type: 'post',
            group_id: 'content_flagging_group_id',
            value: 'Please review this post for potential violations.',
            create_at: 0,
            update_at: 0,
            delete_at: 0,
        },
        {
            id: 'reporting_time_value_id',
            field_id: 'reporting_time_field_id',
            target_id: 'reported_post_id',
            target_type: 'post',
            group_id: 'content_flagging_group_id',
            value: new Date(2025, 0, 1, 0, 1, 0, 0).getTime(),
            create_at: 0,
            update_at: 0,
            delete_at: 0,
        },
        {
            id: 'post_preview_value_id',
            field_id: 'post_preview_field_id',
            target_id: 'reported_post_id',
            target_type: 'post',
            group_id: 'content_flagging_group_id',
            value: postId,
            create_at: 0,
            update_at: 0,
            delete_at: 0,
        },
        {
            id: 'channel_value_id',
            field_id: 'channel_field_id',
            target_id: 'reported_post_id',
            target_type: 'post',
            group_id: 'content_flagging_group_id',
            value: channelId,
            create_at: 0,
            update_at: 0,
            delete_at: 0,
        },
        {
            id: 'team_value_id',
            field_id: 'team_field_id',
            target_id: 'reported_post_id',
            target_type: 'post',
            group_id: 'content_flagging_group_id',
            value: teamId,
            create_at: 0,
            update_at: 0,
            delete_at: 0,
        },
        {
            id: 'post_author_value_id',
            field_id: 'post_author_field_id',
            target_id: 'reported_post_id',
            target_type: 'post',
            group_id: 'content_flagging_group_id',
            value: authorId,
            create_at: 0,
            update_at: 0,
            delete_at: 0,
        },
        {
            id: 'post_creation_time_value_id',
            field_id: 'post_creation_time_field_id',
            target_id: 'reported_post_id',
            target_type: 'post',
            group_id: 'content_flagging_group_id',
            value: postCreateAt,
            create_at: 0,
            update_at: 0,
            delete_at: 0,
        },

        // No reviewer assigned yet
        {
            id: 'reviewer_user_value_id',
            field_id: 'reviewer_user_id_field_id',
            target_id: 'reported_post_id',
            target_type: 'post',
            group_id: 'content_flagging_group_id',
            value: '',
            create_at: 0,
            update_at: 0,
            delete_at: 0,
        },
    ];
}

const fieldOrder = [
    'status_field_id',
    'reason_field_id',
    'post_preview_field_id',
    'reporting_user_id_field_id',
    'comment_field_id',
    'reporting_time_field_id',
    'reviewer_user_id_field_id',
    'actor_user_field_id',
    'actor_comment_field_id',
    'action_time_field_id',
    'channel_field_id',
    'team_field_id',
    'post_author_field_id',
    'post_creation_time_field_id',
];

const shortModeFieldOrder = [
    'status_field_id',
    'reason_field_id',
    'post_preview_field_id',
    'reviewer_user_id_field_id',
];

type Props = {
    post: Post;
    isRHS?: boolean;
};

export default function DataSpillageReport({post, isRHS}: Props) {
    const dispatch = useDispatch();
    const {formatMessage} = useIntl();

    const [propertyFields, setPropertyFields] = useState<PropertyField[]>([]);
    const [propertyValues, setPropertyValues] = useState<Array<PropertyValue<unknown>>>([]);

    const reportedPostId = post.props.reported_post_id as string;
    const reportedPost = usePost(reportedPostId);
    const channel = useChannel(reportedPost?.channel_id || '');

    const reportingUserFieldId = propertyFields.find((field) => field.name === DataSpillagePropertyNames.FlaggedBy);
    const reportingUserIdValue = propertyValues.find((value) => value.field_id === reportingUserFieldId?.id);
    const reportingUser = useSelector((state: GlobalState) => getUser(state, reportingUserIdValue ? reportingUserIdValue.value as string : ''));

    useEffect(() => {
        if (!reportingUser && reportingUserIdValue && reportedPost) {
            dispatch(getMissingProfilesByIds([
                reportingUserIdValue.value as string,
                reportedPost.user_id,
            ]));
        }
    }, [dispatch, reportedPost, reportingUser, reportingUserIdValue]);

    useEffect(() => {
        if (reportedPost && channel) {
            // TODO: this function will be replaced with actual data fetched from API in a later PR
            setPropertyFields(getDummyPropertyFields());
            setPropertyValues(getDummyPropertyValues(reportedPostId, reportedPost.channel_id, channel.team_id, reportedPost.user_id, post.create_at));
        }
    }, [reportedPost, reportedPostId, channel, post.create_at]);

    const title = formatMessage({
        id: 'data_spillage_report_post.title',
        defaultMessage: '{user} flagged a message for review',
    }, {
        user: (<AtMention mentionName={reportingUser?.username || ''}/>),
    });

    const mode = isRHS ? 'full' : 'short';

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
                fieldOrder={fieldOrder}
                shortModeFieldOrder={shortModeFieldOrder}
                actionsRow={<DataSpillageAction/>}
                mode={mode}
            />
        </div>
    );
}
