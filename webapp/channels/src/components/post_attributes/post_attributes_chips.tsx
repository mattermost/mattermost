// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {Channel} from '@mattermost/types/channels';
import type {Post} from '@mattermost/types/posts';

import {usePostAttributeFields, usePostAttributeValues} from 'components/common/hooks/usePostAttributes';
import PropertyValueRenderer from 'components/properties_card_view/propertyValueRenderer/propertyValueRenderer';

import {useVisibleAttributes} from './utils';

import './post_attributes_chips.scss';

type Props = {
    post: Post;
    channel?: Channel;
};

function PostAttributesChips({post, channel}: Props) {
    const fields = usePostAttributeFields(channel);
    const values = usePostAttributeValues(post.id);

    const visible = useVisibleAttributes(fields, values);

    if (visible.length === 0) {
        return null;
    }

    return (
        <div
            className='PostAttributesChips'
            data-testid='post-attributes-chips'
        >
            {visible.map(({field, value}) => (
                <PropertyValueRenderer
                    key={field.id}
                    field={field}
                    value={value}
                />
            ))}
        </div>
    );
}

// Not decorative: post_component holds hover state set from onMouseOver, so without
// this every pointer move across the message list re-renders this subtree. Both props
// are stable references from mapStateToProps.
export default React.memo(PostAttributesChips);
