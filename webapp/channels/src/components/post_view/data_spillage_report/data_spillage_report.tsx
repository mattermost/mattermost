// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect, useMemo, useRef, useState} from 'react';
import {useIntl} from 'react-intl';
import {useDispatch} from 'react-redux';

import type {Post} from '@mattermost/types/posts';
import type {NameMappedPropertyFields, PropertyValue} from '@mattermost/types/properties';

import {Client4} from 'mattermost-redux/client';

import AtMention from 'components/at_mention';
import {useChannel} from 'components/common/hooks/useChannel';
import {useUser} from 'components/common/hooks/useUser';
import DataSpillageAction from 'components/post_view/data_spillage_report/data_spillage_actions/data_spillage_actions';
import type {PropertiesCardViewMetadata} from 'components/properties_card_view/properties_card_view';
import PropertiesCardView from 'components/properties_card_view/properties_card_view';

import {DataSpillagePropertyNames} from 'utils/constants';

import './data_spillage_report.scss';
import {getSyntheticPropertyFields, getSyntheticPropertyValues} from './synthetic_data';

import {useContentFlaggingFields, usePostContentFlaggingValues} from '../../common/hooks/useContentFlaggingFields';

// The order of fields to be displayed in the report, from top to bottom.
const orderedFieldName = [
    'status',
    'reporting_reason',
    'post_preview',
    'reviewer',
    'reporting_user_id',
    'reporting_time',
    'reporting_comment',
    'actor_user_id',
    'actor_comment',
    'action_time',
    'channel',
    'team',
    'post_author',
    'post_creation_time',
];

const shortModeFieldOrder = [
    'status',
    'reporting_reason',
    'post_preview',
    'reviewer',
];

type Props = {
    post: Post;
    isRHS?: boolean;
};

export function DataSpillageReport({post, isRHS}: Props) {
    const {formatMessage} = useIntl();
    const loaded = useRef(false);
    const dispatch = useDispatch();

    const reportedPostId = post.props.reported_post_id as string;

    const naturalPropertyFields = useContentFlaggingFields('fetch');
    const naturalPropertyValues = usePostContentFlaggingValues(reportedPostId);

    const [reportedPost, setReportedPost] = useState<Post>();
    const channel = useChannel(reportedPost?.channel_id || '');

    useEffect(() => {
        const work = async () => {
            if (!loaded.current && !reportedPost) {
                // We need to obtain the post directly from action bypassing the selectors
                // because the post might be soft-deleted and the post reducers do not store deleted posts
                // in the store.
                const post = await Client4.getFlaggedPost(reportedPostId);
                if (post) {
                    setReportedPost(post);
                    loaded.current = true;
                }
            }
        };

        work();
    }, [dispatch, reportedPost, reportedPostId]);

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
        return {
            post_preview: {
                getPost: loadFlaggedPost,
                fetchDeletedPost: true,
            },
            reporting_comment: {
                placeholder: formatMessage({id: 'data_spillage_report_post.reporting_comment.placeholder', defaultMessage: 'No comment'}),
            },
        };
    }, [formatMessage]);

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
                metadata={metadata}
            />
        </div>
    );
}

async function loadFlaggedPost(postId: string) {
    return Client4.getFlaggedPost(postId);
}
