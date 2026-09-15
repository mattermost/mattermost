// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage, useIntl} from 'react-intl';

import type {Channel} from '@mattermost/types/channels';
import type {Post} from '@mattermost/types/posts';

import {usePostAttributeFields, usePostAttributeValues} from 'components/common/hooks/usePostAttributes';
import PropertyValueRenderer from 'components/properties_card_view/propertyValueRenderer/propertyValueRenderer';

import {allocateChipBudget, useVisibleAttributes} from './utils';

import './post_attributes_chips.scss';

const MAX_VISIBLE_CHIPS = 2;

type Props = {
    post: Post;
    channel?: Channel;
};

function PostAttributesChips({post, channel}: Props) {
    const {formatMessage} = useIntl();
    const fields = usePostAttributeFields(channel);
    const values = usePostAttributeValues(post.id);

    const visible = useVisibleAttributes(fields, values);

    // Ahead of every other check, including the one for fields. The server sets this
    // only when it was asked for a post's values and could not read them, and it never
    // asks for a channel with no applicable fields — so this says the post has
    // attributes that cannot be shown, which outranks anything the store holds. Any
    // values left over from an earlier fetch are stale by definition, and rendering
    // them is the failure this marker exists to prevent.
    if (post.metadata?.property_values_unavailable) {
        return (
            <div
                className='PostAttributesChips'
                data-testid='post-attributes-chips-unavailable'
            >
                <span
                    className='PostAttributesChips__unavailable'
                    data-testid='post-attributes-unavailable'
                >
                    <FormattedMessage
                        id='post_attributes.chips.unavailable'
                        defaultMessage='Attributes unavailable'
                    />
                </span>
            </div>
        );
    }

    if (visible.length === 0) {
        return null;
    }

    const {shown, overflow} = allocateChipBudget(visible, MAX_VISIBLE_CHIPS);

    return (
        <div
            className='PostAttributesChips'
            data-testid='post-attributes-chips'
        >
            {shown.map(({field, value, maxItems}) => (
                <PropertyValueRenderer
                    key={field.id}
                    field={field}
                    value={value}
                    maxItems={maxItems}
                />
            ))}
            {overflow > 0 && (

                /*
                 * `role='img'` rather than a bare span, because a span maps to the
                 * `generic` role, which ARIA prohibits naming — `aria-label` on one is
                 * non-conforming and announced inconsistently. The role also makes the
                 * badge opaque to assistive technology, so the label replaces "+2"
                 * rather than being read alongside it.
                 */
                <span
                    className='PostAttributesChips__overflow'
                    data-testid='post-attributes-overflow'
                    role='img'
                    aria-label={formatMessage(
                        {
                            id: 'post_attributes.chips.overflow_description',
                            defaultMessage: '{count, plural, one {# more attribute} other {# more attributes}}',
                        },
                        {count: overflow},
                    )}
                >
                    <FormattedMessage
                        id='post_attributes.chips.overflow'
                        defaultMessage='+{count, number}'
                        values={{count: overflow}}
                    />
                </span>
            )}
        </div>
    );
}

// Not decorative: post_component holds hover state set from onMouseOver, so without
// this every pointer move across the message list re-renders this subtree. Both props
// are stable references from mapStateToProps.
export default React.memo(PostAttributesChips);
