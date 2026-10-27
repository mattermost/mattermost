// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';

import {getPropertyFieldLabel} from 'mattermost-redux/utils/property_utils';

import PostAttributeText from './post_attribute_text';
import type {PostAttribute} from './utils';

import './post_attributes_hover_card.scss';

type Props = {
    attributes: PostAttribute[];
    onEdit: () => void;
};

/**
 * The hover card: every attribute the post carries, as plain text.
 */
export default function PostAttributesHoverCard({attributes, onEdit}: Props) {
    return (
        <div className='PostAttributesHoverCard'>
            <div className='PostAttributesHoverCard__header'>
                <span className='PostAttributesHoverCard__title'>
                    <FormattedMessage
                        id='post_attributes.card.title'
                        defaultMessage='Attributes'
                        description='Heading of the hover card that appears over the attribute chips of a post, above the list of attribute names and values. Plural noun.'
                    />
                </span>
                <button
                    type='button'
                    className='PostAttributesHoverCard__edit'
                    onClick={onEdit}
                >
                    <FormattedMessage
                        id='post_attributes.card.edit'
                        defaultMessage='Edit'
                        description='Button in the hover card on the attribute chips of a post. Opens the modal for editing the attributes of that post. Verb.'
                    />
                </button>
            </div>
            <div
                className='PostAttributesHoverCard__divider'
                aria-hidden='true'
            />
            <ul className='PostAttributesHoverCard__list'>
                {attributes.map(({field, value}) => value && (
                    <li
                        key={field.id}
                        className='PostAttributesHoverCard__row'
                    >
                        <span className='PostAttributesHoverCard__name'>{getPropertyFieldLabel(field)}</span>
                        <span className='PostAttributesHoverCard__value'>
                            <PostAttributeText
                                field={field}
                                value={value}
                            />
                        </span>
                    </li>
                ))}
            </ul>
        </div>
    );
}
