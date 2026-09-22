// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {
    FloatingPortal,
    autoUpdate,
    flip,
    offset,
    safePolygon,
    shift,
    useFloating,
    useHover,
    useInteractions,
} from '@floating-ui/react';
import React, {useCallback, useState} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import {useDispatch} from 'react-redux';

import type {Channel} from '@mattermost/types/channels';
import type {Post} from '@mattermost/types/posts';

import {openModal} from 'actions/views/modals';

import {usePostAttributeFields, usePostAttributeValues} from 'components/common/hooks/usePostAttributes';
import PropertyValueRenderer from 'components/properties_card_view/propertyValueRenderer/propertyValueRenderer';

import {ModalIdentifiers, RootHtmlPortalId} from 'utils/constants';

import PostAttributesHoverCard from './post_attributes_hover_card';
import PostAttributesModal from './post_attributes_modal';
import {allocateChipBudget, useVisibleAttributes} from './utils';

import './post_attributes_chips.scss';

const MAX_VISIBLE_CHIPS = 2;

type Props = {
    post: Post;
    channel?: Channel;
};

function PostAttributesChips({post, channel}: Props) {
    const {formatMessage} = useIntl();
    const dispatch = useDispatch();
    const fields = usePostAttributeFields(channel);
    const values = usePostAttributeValues(post.id);

    const visible = useVisibleAttributes(fields, values);

    // Every hook has to run before the two early returns below, which is why the
    // budget is spent here rather than next to the render that uses it.
    const {shown, overflow} = allocateChipBudget(visible, MAX_VISIBLE_CHIPS);

    const [open, setOpen] = useState(false);

    // The card is a hover surface; leaving it up behind the modal would leave two
    // readings of the same values on screen at once.
    const handleEdit = useCallback(() => {
        setOpen(false);
        dispatch(openModal({
            modalId: ModalIdentifiers.POST_ATTRIBUTES,
            dialogType: PostAttributesModal,
            dialogProps: {post},
        }));
    }, [dispatch, post]);

    const {refs, floatingStyles, context} = useFloating({
        open,
        onOpenChange: setOpen,
        placement: 'bottom-start',
        whileElementsMounted: autoUpdate,
        middleware: [
            offset(6),
            flip({
                fallbackPlacements: ['top-start'],
                padding: 12,
            }),
            shift({
                padding: 12,
            }),
        ],
    });

    const {getReferenceProps, getFloatingProps} = useInteractions([
        useHover(context, {
            mouseOnly: true,
            delay: {
                open: 300,
                close: 0,
            },
            restMs: 100,
            handleClose: safePolygon({
                blockPointerEvents: false,
            }),
        }),
    ]);

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

    return (
        <>
            <div
                className='PostAttributesChips'
                data-testid='post-attributes-chips'
                ref={refs.setReference}
                {...getReferenceProps()}
            >
                {shown.map(({field, value, maxItems}) => value && (
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
                                id: 'generic.more_attributes',
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
            {open && (
                <FloatingPortal id={RootHtmlPortalId}>
                    <div
                        ref={refs.setFloating}
                        className='PostAttributesHoverCard__anchor'
                        style={floatingStyles}
                        data-testid='post-attributes-card'
                        {...getFloatingProps()}
                    >
                        <PostAttributesHoverCard
                            attributes={visible}
                            onEdit={handleEdit}
                        />
                    </div>
                </FloatingPortal>
            )}
        </>
    );
}

// Not decorative: post_component holds hover state set from onMouseOver, so without
// this every pointer move across the message list re-renders this subtree. Both props
// are stable references from mapStateToProps.
export default React.memo(PostAttributesChips);
