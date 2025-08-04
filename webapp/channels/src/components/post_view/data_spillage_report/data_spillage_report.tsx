// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect, useState} from 'react';
import {useIntl} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';

import type {Post} from '@mattermost/types/posts';
import type {PropertyField, PropertyValue} from '@mattermost/types/properties';

import {getMissingProfilesByIds} from 'mattermost-redux/actions/users';
import {getUser} from 'mattermost-redux/selectors/entities/users';

import AtMention from 'components/at_mention';
import PropertiesCardView from 'components/properties_card_view/properties_card_view';

import type {GlobalState} from 'types/store';

import './data_spillage_report.scss';

function getDummyPropertyFields(): PropertyField[] {
    return [
        {
            id: 'status_field_id',
            group_id: 'content_flagging_group_id',
            name: 'Status',
            type: 'select',
            target_type: 'post',
            create_at: 0,
            update_at: 0,
            delete_at: 0,
        },
        {
            id: 'reporting_user_id_field_id',
            group_id: 'content_flagging_group_id',
            name: 'Flagged by',
            type: 'user',
            target_type: 'post',
            create_at: 0,
            update_at: 0,
            delete_at: 0,
        },
        {
            id: 'reason_field_id',
            group_id: 'content_flagging_group_id',
            name: 'Reason',
            type: 'select',
            target_type: 'post',
            create_at: 0,
            update_at: 0,
            delete_at: 0,
        },
        {
            id: 'comment_field_id',
            group_id: 'content_flagging_group_id',
            name: 'Comment',
            type: 'text',
            target_type: 'post',
            create_at: 0,
            update_at: 0,
            delete_at: 0,
        },
        {
            id: 'reporting_time_field_id',
            group_id: 'content_flagging_group_id',
            name: 'Reporting Time',
            type: 'text',
            target_type: 'post',
            create_at: 0,
            update_at: 0,
            delete_at: 0,
        },
        {
            id: 'reviewer_user_id_field_id',
            group_id: 'content_flagging_group_id',
            name: 'Reviewing User',
            type: 'user',
            target_type: 'post',
            create_at: 0,
            update_at: 0,
            delete_at: 0,
        },
        {
            id: 'actor_user_field_id',
            group_id: 'content_flagging_group_id',
            name: 'Action By',
            type: 'user',
            target_type: 'post',
            create_at: 0,
            update_at: 0,
            delete_at: 0,
        },
        {
            id: 'actor_comment_field_id',
            group_id: 'content_flagging_group_id',
            name: 'Action Comment',
            type: 'text',
            target_type: 'post',
            create_at: 0,
            update_at: 0,
            delete_at: 0,
        },
        {
            id: 'action_time_field_id',
            group_id: 'content_flagging_group_id',
            name: 'Action Time',
            type: 'text',
            target_type: 'post',
            create_at: 0,
            update_at: 0,
            delete_at: 0,
        },
        {
            id: 'post_preview_field_id',
            group_id: 'content_flagging_group_id',
            name: 'Message',
            type: 'post',
            target_type: 'post',
            create_at: 0,
            update_at: 0,
            delete_at: 0,
        },
    ];
}

function getDummyPropertyValues(postId: string): Array<PropertyValue<unknown>> {
    return [
        {
            id: 'status_value_id',
            field_id: 'status_field_id',
            target_id: 'reported_post_id',
            target_type: 'post',
            group_id: 'content_flagging_group_id',
            value: 'Under Review',
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
            value: '845mry6gk7fjmra1eocyt7akzo',
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
            value: new Date().toISOString(),
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

        // No reviewer assigned yet
        // {
        //     id: 'reviewer_user_value_id',
        //     field_id: 'reviewer_user_id_field_id',
        //     target_id: 'reported_post_id',
        //     target_type: 'post',
        //     group_id: 'content_flagging_group_id',
        //     value: '',
        //     create_at: 0,
        //     update_at: 0,
        //     delete_at: 0,
        // },
        // No action taken yet
        // {
        //     id: 'actor_user_value_id',
        //     field_id: 'actor_user_field_id',
        //     target_id: 'reported_post_id',
        //     target_type: 'post',
        //     group_id: 'content_flagging_group_id',
        //     value: '',
        //     create_at: 0,
        //     update_at: 0,
        //     delete_at: 0,
        // },
        // {
        //     id: 'actor_comment_value_id',
        //     field_id: 'actor_comment_field_id',
        //     target_id: 'reported_post_id',
        //     target_type: 'post',
        //     group_id: 'content_flagging_group_id',
        //     value: '',
        //     create_at: 0,
        //     update_at: 0,
        //     delete_at: 0,
        // },
        // {
        //     id: 'action_time_value_id',
        //     field_id: 'action_time_field_id',
        //     target_id: 'reported_post_id',
        //     target_type:
        // }
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
];

type Props = {
    post: Post;
}

export default function DataSpillageReport({post}: Props) {
    const dispatch = useDispatch();
    const {formatMessage} = useIntl();

    const [propertyFields, setPropertyFields] = useState<PropertyField[]>([]);
    const [propertyValues, setPropertyValues] = useState<Array<PropertyValue<unknown>>>([]);

    const reportingUserIdValue = propertyValues.find((value) => value.field_id === 'reporting_user_id_field_id');
    const reportingUser = useSelector((state: GlobalState) => getUser(state, reportingUserIdValue ? reportingUserIdValue.value as string : ''));

    useEffect(() => {
        if (!reportingUser && reportingUserIdValue) {
            dispatch(getMissingProfilesByIds([reportingUserIdValue.value as string]));
        }
    }, [dispatch, reportingUser, reportingUserIdValue]);

    const title = formatMessage({
        id: 'data_spillage_report_post.title',
        defaultMessage: '{user} flagged a message for review',
    }, {
        user: (<AtMention mentionName={reportingUser?.username || ''}/>),
    });

    useEffect(() => {
        const reportedPostId = post.props.reported_post_id as string;
        if (reportedPostId) {
            setPropertyFields(getDummyPropertyFields());
            setPropertyValues(getDummyPropertyValues(reportedPostId));
        }
    }, [post.props.reported_post_id]);

    return (
        <div className={'DataSpillageReport'}>
            <PropertiesCardView
                title={title}
                propertyFields={propertyFields}
                propertyValues={propertyValues}
                fieldOrder={fieldOrder}
            />
        </div>
    );
}
