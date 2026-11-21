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
import type {ReactNode} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import {useDispatch} from 'react-redux';

import {WithTooltip} from '@mattermost/shared/components/tooltip';
import type {PropertyField} from '@mattermost/types/properties';

import {DISPLAY_LABEL_HEADER} from 'mattermost-redux/constants/properties';
import type {ResolvedChannelAttribute} from 'mattermost-redux/selectors/entities/properties';
import {comparePropertyFieldOrder, getPropertyFieldLabel} from 'mattermost-redux/utils/property_utils';

import {openChannelAttributeEditor, showChannelInfo} from 'actions/views/rhs';

import type {ChannelLabelSurface} from 'components/common/hooks/useChannelLabels';
import useChannelLabels from 'components/common/hooks/useChannelLabels';
import useFixableMissingRequiredAttributes from 'components/common/hooks/useFixableMissingRequiredAttributes';

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

    // A chip opens Channel Info, which is bound to the channel being viewed.
    // Global Threads and the thread popout have no such channel, so there the
    // chips are labels only rather than controls that cannot do anything.
    interactive?: boolean;

    // Also show a "Set {label}" chip for each required attribute this channel lacks
    // a value for, that the viewer can set and that is designated for the header.
    showMissingPlaceholders?: boolean;

    // The row's testid scope: the row is `<testId>`, its chips `<testId>.chip:<position>`, the "+N" button `<testId>.overflow--button`, and its popover
    // `<testId>.overflow_popover` with the hidden chips at `.chip:<position>` and `.view_all--button`.
    testId?: string;
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

    // A "Set {label}" prompt for a missing value instead of a value chip.
    missingFieldId?: string;
    missingFieldName?: string;
};

const ChannelAttributeLabels = ({channelId, surface, testId, allowEmptyVisible = false, interactive = true, showMissingPlaceholders = false}: Props) => {
    const {formatMessage} = useIntl();
    const dispatch = useDispatch();
    const labels = useChannelLabels(channelId, surface);
    const {fields: fixableMissingFields} = useFixableMissingRequiredAttributes(channelId, {skip: !showMissingPlaceholders || !interactive});

    // Expand each attribute into one ChipSpec per value (multiselect → N chips).
    // "Set {label}" prompts take their field's place in the configured order, so a
    // missing value never pushes a set one into the overflow.
    const chipSpecs = useMemo((): ChipSpec[] => {
        const entries: Array<{field: PropertyField; specs: ChipSpec[]}> = [];
        for (const missingField of fixableMissingFields) {
            const actions = missingField.attrs?.actions;
            if (!Array.isArray(actions) || !actions.includes(DISPLAY_LABEL_HEADER)) {
                continue;
            }
            const fieldLabel = getPropertyFieldLabel(missingField);
            entries.push({
                field: missingField,
                specs: [{
                    chipId: `missing:${missingField.id}`,
                    fieldLabel,
                    value: formatMessage({id: 'channel_attributes.labels.set_value', defaultMessage: 'Set {label}'}, {label: fieldLabel}),
                    missingFieldId: missingField.id,
                    missingFieldName: missingField.name,
                }],
            });
        }
        for (const attribute of labels) {
            if (!attribute.displayValue) {
                continue;
            }
            const fieldLabel = getPropertyFieldLabel(attribute.field);
            const values = attribute.displayValues.length > 0 ? attribute.displayValues : [attribute.displayValue];
            if (values.length === 1) {
                entries.push({field: attribute.field, specs: [{chipId: attribute.field.id, fieldLabel, value: values[0], color: optionColor(attribute)}]});
            } else {
                entries.push({field: attribute.field, specs: values.map((value, i) => ({chipId: `${attribute.field.id}:${i}`, fieldLabel, value}))});
            }
        }
        if (fixableMissingFields.length > 0) {
            entries.sort((a, b) => comparePropertyFieldOrder(a.field, b.field));
        }
        return entries.flatMap((entry) => entry.specs);
    }, [labels, fixableMissingFields, formatMessage]);

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

    const renderMissingChip = (spec: ChipSpec, fieldId: string) => (
        <button
            type='button'
            className='ChannelAttributeLabels__chipButton'
            onClick={() => {
                dispatch(openChannelAttributeEditor(channelId, fieldId));
                setPopoverOpen(false);
            }}
            data-testid={`channelHeaderMissingAttributeChip-${spec.missingFieldName}`}
        >
            <AttributeChip
                label={spec.fieldLabel}
                value={spec.value}
                size='medium'
                announceLabel={false}
                className='AttributeChip--missing'
            />
        </button>
    );

    const wrapChip = (chip: ReactNode) => (interactive ? (
        <button
            type='button'
            className='ChannelAttributeLabels__chipButton'
            onClick={openChannelInfo}
        >
            {chip}
        </button>
    ) : (
        <span className='ChannelAttributeLabels__chipStatic'>
            {chip}
        </span>
    ));

    const renderChip = (id: string, index: number) => {
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
                {spec.missingFieldId ? renderMissingChip(spec, spec.missingFieldId) : (
                    <WithTooltip title={spec.fieldLabel}>
                        {wrapChip(
                            <AttributeChip
                                testId={testId ? `${testId}.chip` : undefined}
                                testKey={index}
                                label={spec.fieldLabel}
                                value={spec.value}
                                color={spec.color}
                                size='medium'
                            />,
                        )}
                    </WithTooltip>
                )}
            </span>
        );
    };

    return (
        <div
            ref={containerRef}
            className='ChannelAttributeLabels'
            data-testid={testId}
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
                        {id: 'generic.more_attributes', defaultMessage: '{count, plural, one {# more attribute} other {# more attributes}}', description: 'Accessible label (screen readers only) on the overflow badge that stands in for attribute chips that do not fit, shown on channel attribute labels and on post attribute chips. {count} is the number of hidden attributes.'},
                        {count: overflowIds.length},
                    )}
                    data-testid={testId ? `${testId}.overflow--button` : undefined}
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
                        data-testid={testId ? `${testId}.overflow_popover` : undefined}
                        {...getFloatingProps()}
                    >
                        {overflowIds.map((id, index) => {
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
                                    {spec.missingFieldId ? renderMissingChip(spec, spec.missingFieldId) : wrapChip(
                                        <AttributeChip
                                            testId={testId ? `${testId}.overflow_popover.chip` : undefined}
                                            testKey={index}
                                            label={spec.fieldLabel}
                                            value={spec.value}
                                            color={spec.color}
                                            size='medium'
                                            announceLabel={false}
                                        />,
                                    )}
                                </div>
                            );
                        })}
                        {interactive && (
                            <>
                                <div
                                    className='ChannelAttributeLabels__popoverDivider'
                                    role='separator'
                                />
                                <button
                                    type='button'
                                    className='ChannelAttributeLabels__viewAll'
                                    onClick={openChannelInfo}
                                    data-testid={testId ? `${testId}.overflow_popover.view_all--button` : undefined}
                                >
                                    <FormattedMessage
                                        id='channel_attributes.labels.view_all'
                                        defaultMessage='View all attributes'
                                    />
                                </button>
                            </>
                        )}
                    </div>
                </FloatingPortal>
            )}
        </div>
    );
};

export default ChannelAttributeLabels;
