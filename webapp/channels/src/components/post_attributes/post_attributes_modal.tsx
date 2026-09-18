// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {Fragment, useCallback, useState} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';

import {PlusIcon} from '@mattermost/compass-icons/components';
import {GenericModal} from '@mattermost/components';
import type {ServerError} from '@mattermost/types/errors';
import type {Post} from '@mattermost/types/posts';
import {
    POST_ATTRIBUTES_PROPERTY_GROUP_NAME,
    POST_ATTRIBUTES_PROPERTY_OBJECT_TYPE,
} from '@mattermost/types/properties_post';
import type {UserProfile} from '@mattermost/types/users';

import {patchPropertyValues} from 'mattermost-redux/actions/properties';
import {getChannel} from 'mattermost-redux/selectors/entities/channels';
import {getTeammateNameDisplaySetting} from 'mattermost-redux/selectors/entities/preferences';
import {getCurrentUserId, isCurrentUserSystemAdmin} from 'mattermost-redux/selectors/entities/users';
import {displayUsername} from 'mattermost-redux/utils/user_utils';

import {usePostAttributeFields, usePostAttributeValues} from 'components/common/hooks/usePostAttributes';
import {useUser} from 'components/common/hooks/useUser';
import Timestamp from 'components/timestamp';
import Avatar from 'components/widgets/users/avatar/avatar';

import {imageURLForUser} from 'utils/utils';

import type {GlobalState} from 'types/store';

import {canEditPostAttributeValue, isChannelPropertyAdmin} from './permissions';
import PostAttributesModalRow from './post_attributes_modal_row';
import {useModalAttributes} from './utils';

import './post_attributes_modal.scss';

type Props = {
    post: Post;
    onExited: () => void;
};

/**
 * The edit modal: every attribute the post's channel declares that is visible
 * here, one row each, written one at a time.
 *
 * No footer, no Save, no Cancel — picking a value writes it.
 */
export default function PostAttributesModal({post, onExited}: Props) {
    const {formatMessage} = useIntl();
    const dispatch = useDispatch();

    const channel = useSelector((state: GlobalState) => getChannel(state, post.channel_id));
    const currentUserId = useSelector(getCurrentUserId);
    const isSystemAdmin = useSelector(isCurrentUserSystemAdmin);

    const author = useUser(post.user_id);
    const teammateNameDisplay = useSelector(getTeammateNameDisplaySetting);
    const authorName = displayUsername(author, teammateNameDisplay);

    const isChannelAdmin = useSelector((state: GlobalState) => {
        const postChannel = getChannel(state, post.channel_id);
        return postChannel ? isChannelPropertyAdmin(state, postChannel) : true;
    });

    const fields = usePostAttributeFields(channel);
    const values = usePostAttributeValues(post.id);
    const attributes = useModalAttributes(fields, values);

    /*
     * Field ids and error strings, never values. No copy of any value lives
     * here, so there is nothing to reconcile against the PATCH response, against
     * this write's own `property_values_updated` broadcast, or against somebody
     * else's. Every row reads the store.
     *
     * Keyed per field rather than held in a single slot. Only the row being
     * written is disabled, so picking on a second row while the first is still
     * in flight is reachable — and a single slot would clear the first row's
     * pending state, wipe its error, and then re-enable the second row when the
     * first resolves. Writes to different fields are independent PATCHes and are
     * allowed to overlap.
     */
    const [writing, setWriting] = useState<ReadonlySet<string>>(() => new Set());
    const [errors, setErrors] = useState<Record<string, string>>({});

    const handleChange = useCallback(async (fieldId: string, next: unknown) => {
        setWriting((current) => new Set(current).add(fieldId));
        setErrors((current) => {
            if (!(fieldId in current)) {
                return current;
            }

            const remaining = {...current};
            delete remaining[fieldId];
            return remaining;
        });

        const {error: writeError} = await dispatch(patchPropertyValues(
            POST_ATTRIBUTES_PROPERTY_GROUP_NAME,
            POST_ATTRIBUTES_PROPERTY_OBJECT_TYPE,
            post.id,
            [{field_id: fieldId, value: next}],
        ));

        setWriting((current) => {
            const remaining = new Set(current);
            remaining.delete(fieldId);
            return remaining;
        });

        if (writeError) {
            setErrors((current) => ({...current, [fieldId]: messageFor(writeError as ServerError, formatMessage)}));
        }
    }, [dispatch, post.id, formatMessage]);

    return (
        <GenericModal
            id='postAttributesModal'
            className='PostAttributesModal'
            dataTestId='post-attributes-modal'
            compassDesign={true}
            bodyPadding={false}
            modalHeaderText={
                <FormattedMessage
                    id='post_attributes.modal.title'
                    defaultMessage='Post attributes'
                />
            }
            modalSubheaderText={
                <Subtitle
                    authorName={authorName}
                    channelName={channel?.display_name ?? ''}
                />
            }
            onExited={onExited}
        >
            <div className='PostAttributesModal__body'>
                <PostReprise
                    post={post}
                    author={author}
                    authorName={authorName}
                />
                <div className='PostAttributesModal__rows'>
                    {attributes.map(({field, value}) => (
                        <Fragment key={field.id}>
                            <PostAttributesModalRow
                                field={field}
                                value={value}
                                canEdit={canEditPostAttributeValue(field, post, currentUserId, isSystemAdmin, isChannelAdmin)}
                                writing={writing.has(field.id)}
                                onChange={handleChange}
                            />
                            {errors[field.id] && (
                                <div
                                    className='PostAttributesModal__error'
                                    data-testid={`post-attribute-error-${field.name}`}
                                    role='alert'
                                >
                                    {errors[field.id]}
                                </div>
                            )}
                        </Fragment>
                    ))}
                </div>

                {/*
                  * Inert until the field picker lands, which is why it carries
                  * no handler at all. `aria-disabled` rather than native
                  * `disabled`: native would take it out of the tab order and out
                  * of screen readers entirely, and this is a real control in a
                  * modal the user opened deliberately.
                  */}
                <button
                    type='button'
                    className='PostAttributesModal__add'
                    data-testid='post-attributes-add'
                    aria-disabled='true'
                >
                    <PlusIcon size={16}/>
                    <FormattedMessage
                        id='post_attributes.modal.add'
                        defaultMessage='Add attribute'
                    />
                </button>
            </div>
        </GenericModal>
    );
}

/**
 * A `403` is the expected answer when the client resolved a permission level
 * optimistically and the server disagreed, so it gets its own message rather
 * than the generic one.
 */
function messageFor(error: ServerError, formatMessage: ReturnType<typeof useIntl>['formatMessage']): string {
    if (error.status_code === 403) {
        return formatMessage({
            id: 'post_attributes.modal.error.forbidden',
            defaultMessage: 'You do not have permission to change this attribute',
        });
    }

    return formatMessage({
        id: 'post_attributes.modal.error.generic',
        defaultMessage: 'Could not update this attribute. Please try again.',
    });
}

function Subtitle({authorName, channelName}: {authorName: string; channelName: string}) {
    return (
        <FormattedMessage
            id='post_attributes.modal.subtitle'
            defaultMessage='{author} · {channel}'
            values={{author: authorName, channel: channelName}}
        />
    );
}

/**
 * A read-only reprise of the post being marked.
 *
 * `PostMessageView` is deliberately not mounted — it drags reactions, the action
 * toolbar and the whole hot-path subtree into a modal that needs none of it. The
 * avatar and the timestamp are reused directly instead, and the message is plain
 * text.
 */
function PostReprise({post, author, authorName}: {post: Post; author?: UserProfile; authorName: string}) {
    return (
        <div
            className='PostAttributesModal__reprise'
            data-testid='post-attributes-reprise'
        >
            <Avatar
                size='sm'
                username={author?.username}
                url={imageURLForUser(post.user_id, author?.last_picture_update)}
                alt=''
            />
            <div className='PostAttributesModal__repriseBody'>
                <div className='PostAttributesModal__repriseHeader'>
                    <span className='PostAttributesModal__repriseAuthor'>{authorName}</span>
                    <Timestamp
                        value={post.create_at}
                        className='PostAttributesModal__repriseTime'
                        useDate={false}
                    />
                </div>
                <div className='PostAttributesModal__repriseMessage'>{post.message}</div>
            </div>
        </div>
    );
}
