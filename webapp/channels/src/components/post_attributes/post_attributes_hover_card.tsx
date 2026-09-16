// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';

import PostAttributeText from './post_attribute_text';
import type {VisibleAttribute} from './utils';
import {fieldLabel} from './utils';

import './post_attributes_hover_card.scss';

type Props = {
    attributes: VisibleAttribute[];
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
                    />
                </button>
            </div>
            <div
                className='PostAttributesHoverCard__divider'
                aria-hidden='true'
            />
            <ul className='PostAttributesHoverCard__list'>
                {attributes.map(({field, value}) => (
                    <li
                        key={field.id}
                        className='PostAttributesHoverCard__row'
                    >
                        <span className='PostAttributesHoverCard__name'>{fieldLabel(field)}</span>
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
