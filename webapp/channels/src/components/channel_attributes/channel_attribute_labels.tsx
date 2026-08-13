// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {
    autoUpdate,
    offset,
    useClick,
    useDismiss,
    useFloating,
    useFocus,
    useHover,
    useInteractions,
    useRole,
    useTransitionStyles,
    FloatingPortal,
    safePolygon,
} from '@floating-ui/react';
import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';

import type {ResolvedChannelAttribute} from 'mattermost-redux/selectors/entities/properties';
import {getPropertyFieldLabel} from 'mattermost-redux/utils/property_utils';

import useChannelLabels from 'components/common/hooks/useChannelLabels';

import {OverlaysTimings, OverlayTransitionStyles, RootHtmlPortalId} from 'utils/constants';

import AttributeChip from './attribute_chip';
import {useLabelsOverflow} from './use_labels_overflow';

import './channel_attribute_labels.scss';

const TRANSITION_STYLE_PROPS = {
    duration: {
        open: OverlaysTimings.FADE_IN_DURATION,
        close: OverlaysTimings.FADE_OUT_DURATION,
    },
    initial: OverlayTransitionStyles.START,
};

function optionColor(attribute: ResolvedChannelAttribute): string | undefined {
    const color = attribute.option?.color;
    return typeof color === 'string' && color ? color : undefined;
}

type Props = {
    channelId: string;
};

/**
 * The channel's designated attribute values, as chips, for the channel header.
 * Mounted as a child because channel_header.tsx is a class component.
 *
 * Labels are informational — nothing here enforces access, and no string may
 * suggest otherwise.
 */
const ChannelAttributeLabels = ({channelId}: Props) => {
    const {formatMessage} = useIntl();
    const labels = useChannelLabels(channelId, 'header');

    const ids = useMemo(() => labels.map((attribute) => attribute.field.id), [labels]);
    const {containerRef, registerChipRef, overflowRef, visibleIds, overflowIds} = useLabelsOverflow(ids);

    const byId = useMemo(() => {
        const map = new Map<string, ResolvedChannelAttribute>();
        for (const attribute of labels) {
            map.set(attribute.field.id, attribute);
        }
        return map;
    }, [labels]);

    // Stable per chip. An inline arrow is a new function each render, so React
    // detaches and reattaches the node, and the observer refires on every render.
    const chipRefCallbacks = useRef(new Map<string, (element: HTMLElement | null) => void>());
    const chipRef = useCallback((id: string) => {
        let callback = chipRefCallbacks.current.get(id);
        if (!callback) {
            callback = (element: HTMLElement | null) => registerChipRef(id, element);
            chipRefCallbacks.current.set(id, callback);
        }
        return callback;
    }, [registerChipRef]);

    // Drop callbacks for chips that no longer exist.
    useEffect(() => {
        const live = new Set(ids);
        for (const id of chipRefCallbacks.current.keys()) {
            if (!live.has(id)) {
                chipRefCallbacks.current.delete(id);
            }
        }
    }, [ids]);

    const [isPopoverOpen, setPopoverOpen] = useState(false);

    const {refs: {setReference, setFloating}, floatingStyles, context: floatingContext} = useFloating({
        open: overflowIds.length > 0 && isPopoverOpen,
        onOpenChange: setPopoverOpen,
        whileElementsMounted: autoUpdate,
        placement: 'bottom-start',
        middleware: [offset(4)],
    });

    const {isMounted, styles: transitionStyles} = useTransitionStyles(floatingContext, TRANSITION_STYLE_PROPS);

    const hover = useHover(floatingContext, {
        enabled: overflowIds.length > 0,
        handleClose: safePolygon({requireIntent: false}),
    });
    const focus = useFocus(floatingContext);
    const dismiss = useDismiss(floatingContext);
    const click = useClick(floatingContext);
    const role = useRole(floatingContext, {role: 'dialog'});

    const {getReferenceProps, getFloatingProps} = useInteractions([hover, focus, click, dismiss, role]);

    if (labels.length === 0) {
        return null;
    }

    const renderChip = (id: string) => {
        const attribute = byId.get(id);
        if (!attribute) {
            return null;
        }

        return (
            <span
                key={id}
                ref={chipRef(id)}
                className='ChannelAttributeLabels__item'
            >
                <AttributeChip
                    label={getPropertyFieldLabel(attribute.field)}
                    value={attribute.displayValue}
                    color={optionColor(attribute)}
                />
            </span>
        );
    };

    return (
        <div
            ref={containerRef}
            className='ChannelAttributeLabels'
            data-testid='channelAttributeLabels'
        >
            <div className='ChannelAttributeLabels__visible'>
                {visibleIds.map(renderChip)}
            </div>

            {overflowIds.length > 0 && (
                <button
                    ref={(element) => {
                        setReference(element);
                        overflowRef(element);
                    }}
                    type='button'
                    className='ChannelAttributeLabels__overflow'
                    aria-label={formatMessage(
                        {id: 'channel_attributes.labels.overflow_aria', defaultMessage: '{count, plural, one {# more attribute} other {# more attributes}}'},
                        {count: overflowIds.length},
                    )}
                    data-testid='channelAttributeLabelsOverflow'
                    {...getReferenceProps()}
                >
                    <FormattedMessage
                        id='channel_attributes.labels.overflow'
                        defaultMessage='+{count}'
                        values={{count: overflowIds.length}}
                    />
                </button>
            )}

            {isMounted && (
                <FloatingPortal id={RootHtmlPortalId}>
                    <div
                        ref={setFloating}
                        className='ChannelAttributeLabels__popover'
                        style={{...floatingStyles, ...transitionStyles}}
                        data-testid='channelAttributeLabelsPopover'
                        {...getFloatingProps()}
                    >
                        {overflowIds.map((id) => {
                            const attribute = byId.get(id);
                            if (!attribute) {
                                return null;
                            }

                            return (
                                <div
                                    key={id}
                                    className='ChannelAttributeLabels__popoverRow'
                                >
                                    <span className='ChannelAttributeLabels__popoverLabel'>
                                        {getPropertyFieldLabel(attribute.field)}
                                    </span>
                                    <AttributeChip
                                        label={getPropertyFieldLabel(attribute.field)}
                                        value={attribute.displayValue}
                                        color={optionColor(attribute)}
                                        announceLabel={false}
                                    />
                                </div>
                            );
                        })}
                    </div>
                </FloatingPortal>
            )}
        </div>
    );
};

export default ChannelAttributeLabels;
