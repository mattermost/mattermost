// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, { useEffect, useMemo, useState } from "react";
import {useIntl} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';

import type {Post} from '@mattermost/types/posts';
import type {
    NameMappedPropertyFields,
    PropertyField,
    PropertyValue,
} from "@mattermost/types/properties";

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
import { useUser } from "components/common/hooks/useUser";
import {
    useContentFlaggingFields,
    usePostContentFlaggingValues,
} from "components/common/hooks/useContentFlaggingFields";
import { postContentFlaggingValues } from "mattermost-redux/selectors/entities/content_flagging";

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

function getSyntheticPropertyFields(groupId: string): NameMappedPropertyFields {
    return {
        post_preview: {
            id: 'post_preview_field_id',
            group_id: groupId,
            name: 'post_preview',
            type: 'text',
            attrs: {subType: 'post'},
            create_at: 0,
            update_at: 0,
            delete_at: 0,
        },
    };
}

function getSyntheticPropertyValues(groupId: string, reportedPostId: string): Array<PropertyValue<unknown>> {
    return [
        {
            id: 'post_preview_value_id',
            field_id: 'post_preview_field_id',
            target_id: reportedPostId,
            target_type: 'post',
            group_id: groupId,
            value: reportedPostId,
            create_at: 0,
            update_at: 0,
            delete_at: 0,
        },
    ];
}

const orderedFieldName = [
    'status',
    'reporting_reason',
    'post_preview',
    'reporting_user_id',
    'reporting_time',
    'reviewer_user_id',
    'actor_user_id',
    'actor_comment',
    'action_time',
    // 'channel',
    // 'team',
    // 'post_author',
    // 'post_creation_time',
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

export default function DataSpillageReport({post, isRHS}: Props) {
    const {formatMessage} = useIntl();
    const reportedPostId = post.props.reported_post_id as string;

    const naturalPropertyFields = useContentFlaggingFields('fetch');
    const naturalPropertyValues = usePostContentFlaggingValues(reportedPostId);

    // const reportedPost = usePost(reportedPostId);
    // const channel = useChannel(reportedPost?.channel_id || '');

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
        const syntheticValues = getSyntheticPropertyValues(naturalPropertyValues[0].group_id, reportedPostId);
        return [...naturalPropertyValues, ...syntheticValues];
    }, [naturalPropertyValues, reportedPostId]);

    const reportingUserFieldId = propertyFields[DataSpillagePropertyNames.FlaggedBy];
    const reportingUserIdValue = propertyValues.find((value) => value.field_id === reportingUserFieldId?.id);
    const reportingUser = useSelector((state: GlobalState) => getUser(state, reportingUserIdValue ? reportingUserIdValue.value as string : ''));

    // useEffect(() => {
    //     if (reportedPost && channel) {
    //         // TODO: this function will be replaced with actual data fetched from API in a later PR
    //         setPropertyValues(getDummyPropertyValues(reportedPostId, reportedPost.channel_id, channel.team_id, reportedPost.user_id, post.create_at));
    //     }
    // }, [reportedPost, reportedPostId, channel, post.create_at]);

    const title = formatMessage({
        id: 'data_spillage_report_post.title',
        defaultMessage: '{user} flagged a message for review',
    }, {
        user: (<AtMention mentionName={reportingUser?.username || ''}/>),
    });

    const mode = isRHS ? 'full' : 'short';

    // orderedFieldName.forEach((fieldName) => {
    //     if (naturalPropertyFields && !naturalPropertyFields[fieldName]) {
    //         console.log(fieldName);
    //     }
    // });

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
                actionsRow={<DataSpillageAction/>}
                mode={mode}
            />
        </div>
    );
}
