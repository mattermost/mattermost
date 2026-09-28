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
import {useDispatch} from 'react-redux';

import {WithTooltip} from '@mattermost/shared/components/tooltip';

import type {ResolvedChannelAttribute} from 'mattermost-redux/selectors/entities/properties';
import {getPropertyFieldLabel} from 'mattermost-redux/utils/property_utils';

import {showChannelInfo} from 'actions/views/rhs';

import type {ChannelLabelSurface} from 'components/common/hooks/useChannelLabels';
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

    // One surface, or several merged into a single row so overflow is decided
    // once. The header passes both so info and header chips collapse together
    // instead of each treating the other as a sibling that eats their space.
    surface: ChannelLabelSurface | ChannelLabelSurface[];

    // Thread header: if a chip will not fit, collapse every chip into +N rather
    // than keeping a clipped first chip beside the count.
    allowEmptyVisible?: boolean;
};

/**
 * The channel's designated attribute values, as chips.
 * Mounted as a child because channel_header.tsx is a class component.
 *
 * Labels are informational — nothing here enforces access, and no string may
 * suggest otherwise.
 */
type ChipSpec = {
    chipId: string;
    fieldLabel: string;
    value: string;
    color?: string;
};

const ChannelAttributeLabels = ({channelId, surface, allowEmptyVisible = false}: Props) => {
    const {formatMessage} = useIntl();
    const dispatch = useDispatch();
    const labels = useChannelLabels(channelId, surface);
    const surfaceId = Array.isArray(surface) ? surface.join('-') : surface;

    // Expand each attribute into one ChipSpec per value (multiselect → N chips).
    const chipSpecs = useMemo((): ChipSpec[] => {
        const specs: ChipSpec[] = [];
        for (const attribute of labels) {
            if (!attribute.displayValue) {
                continue;
            }
            const fieldLabel = getPropertyFieldLabel(attribute.field);
            const values = attribute.displayValues.length > 0 ? attribute.displayValues : [attribute.displayValue];
            if (values.length === 1) {
                specs.push({chipId: attribute.field.id, fieldLabel, value: values[0], color: optionColor(attribute)});
            } else {
                for (let i = 0; i < values.length; i++) {
                    specs.push({chipId: `${attribute.field.id}:${i}`, fieldLabel, value: values[i]});
                }
            }
        }
        return specs;
    }, [labels]);

    const ids = useMemo(() => chipSpecs.map((s) => s.chipId), [chipSpecs]);
    const {containerRef, registerChipRef, overflowRef, visibleIds, overflowIds, measured} = useLabelsOverflow(ids, {allowEmptyVisible});

    const byChipId = useMemo(() => {
        const map = new Map<string, ChipSpec>();
        for (const spec of chipSpecs) {
            map.set(spec.chipId, spec);
        }
        return map;
    }, [chipSpecs]);

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

    const openChannelInfo = useCallback(() => {
        dispatch(showChannelInfo(channelId));
        setPopoverOpen(false);
    }, [dispatch, channelId]);

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

    if (chipSpecs.length === 0) {
        return null;
    }

    const renderChip = (id: string) => {
        const spec = byChipId.get(id);
        if (!spec) {
            return null;
        }

        return (
            <span
                key={id}
                ref={chipRef(id)}
                className='ChannelAttributeLabels__item'
            >
                <WithTooltip title={spec.fieldLabel}>
                    <button
                        type='button'
                        className='ChannelAttributeLabels__chipButton'
                        onClick={openChannelInfo}
                    >
                        <AttributeChip
                            label={spec.fieldLabel}
                            value={spec.value}
                            color={spec.color}
                            size='medium'
                        />
                    </button>
                </WithTooltip>
            </span>
        );
    };

    return (
        <div
            ref={containerRef}
            className='ChannelAttributeLabels'
            data-testid={`channelAttributeLabels-${surfaceId}`}
            style={measured ? undefined : {visibility: 'hidden'}}
        >
            {visibleIds.length > 0 && (
                <div className='ChannelAttributeLabels__visible'>
                    {visibleIds.map(renderChip)}
                </div>
            )}

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
                    data-testid={`channelAttributeLabelsOverflow-${surfaceId}`}
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
                        data-testid={`channelAttributeLabelsPopover-${surfaceId}`}
                        {...getFloatingProps()}
                    >
                        {overflowIds.map((id) => {
                            const spec = byChipId.get(id);
                            if (!spec) {
                                return null;
                            }

                            return (
                                <div
                                    key={id}
                                    className='ChannelAttributeLabels__popoverRow'
                                >
                                    <span className='ChannelAttributeLabels__popoverLabel'>
                                        {spec.fieldLabel}
                                    </span>
                                    <button
                                        type='button'
                                        className='ChannelAttributeLabels__chipButton'
                                        onClick={openChannelInfo}
                                    >
                                        <AttributeChip
                                            label={spec.fieldLabel}
                                            value={spec.value}
                                            color={spec.color}
                                            size='medium'
                                            announceLabel={false}
                                        />
                                    </button>
                                </div>
                            );
                        })}
                        <div
                            className='ChannelAttributeLabels__popoverDivider'
                            role='separator'
                        />
                        <button
                            type='button'
                            className='ChannelAttributeLabels__viewAll'
                            onClick={openChannelInfo}
                            data-testid={`channelAttributeLabelsViewAll-${surfaceId}`}
                        >
                            <FormattedMessage
                                id='channel_attributes.labels.view_all'
                                defaultMessage='View all attributes'
                            />
                        </button>
                    </div>
                </FloatingPortal>
            )}
        </div>
    );
};

export default ChannelAttributeLabels;
