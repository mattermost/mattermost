// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React, {useMemo} from 'react';
import {FormattedMessage} from 'react-intl';

import {getContrastingSimpleColor} from 'mattermost-redux/utils/theme_utils';

import './attribute_chip.scss';

type Props = {

    // The attribute's label, e.g. "Program". Always part of the accessible name:
    // a chip reading only "AURORA" tells a screen reader nothing about what it is.
    label: string;

    // The resolved value name, e.g. "AURORA". Always rendered as text — colour
    // alone must never be the carrier of meaning.
    value: string;

    // Hex background from the option definition. Absent falls back to the
    // neutral treatment rather than an invented colour.
    color?: string;

    // Set false where the label is already rendered as visible text beside the
    // chip, so a screen reader doesn't hear it twice.
    announceLabel?: boolean;

    className?: string;
};

/**
 * A single channel attribute value, rendered as a chip.
 *
 * Deliberately not a variant of the shared Tag widget: Tag's variants are a
 * fixed semantic set (info/success/warning/danger), and widening it to accept an
 * arbitrary colour would turn a constrained primitive into an open styling
 * surface for every existing caller.
 *
 * Contrast is derived rather than configured. The background is whatever an
 * administrator picked, so the foreground is computed from its luminance —
 * the same approach the channel banner already takes for admin-chosen colours,
 * which is what keeps this legible in all five themes without per-theme rules.
 */
const AttributeChip = ({label, value, color, announceLabel = true, className}: Props) => {
    const style = useMemo(() => {
        if (!color) {
            return undefined;
        }

        const foreground = getContrastingSimpleColor(color);
        if (!foreground) {
            // Malformed hex. Falling back to the neutral chip keeps the value
            // readable instead of painting unknown text on unknown background.
            return undefined;
        }

        return {backgroundColor: color, color: foreground};
    }, [color]);

    return (
        <span
            className={classNames('AttributeChip', {'AttributeChip--neutral': !style}, className)}
            style={style}
            data-testid='attributeChip'
        >
            {announceLabel && (
                <span className='sr-only'>
                    <FormattedMessage
                        id='channel_attributes.chip.label_prefix'
                        defaultMessage='{label}: '
                        values={{label}}
                    />
                </span>
            )}
            <span className='AttributeChip__value'>{value}</span>
        </span>
    );
};

export default AttributeChip;
