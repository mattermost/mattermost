// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React, {useMemo} from 'react';
import {FormattedMessage} from 'react-intl';

import {getContrastingSimpleColor} from 'mattermost-redux/utils/theme_utils';

import './attribute_chip.scss';

type Props = {
    label: string;
    value: string;

    // Hex from the option definition. Absent falls back to the neutral treatment.
    color?: string;

    // False where the label is already visible beside the chip, so a screen reader
    // does not hear it twice.
    announceLabel?: boolean;

    className?: string;
};

/**
 * A single channel attribute value, rendered as a chip. The value is always text:
 * colour must never be the only carrier of meaning.
 *
 * Not a Tag variant — Tag's variants are a fixed semantic set, and widening it for
 * an arbitrary colour opens it as a styling surface for every existing caller.
 *
 * The background is admin-chosen, so the foreground is derived from its luminance,
 * as the channel banner already does. That is what holds contrast in all themes.
 */
const AttributeChip = ({label, value, color, announceLabel = true, className}: Props) => {
    const style = useMemo(() => {
        if (!color) {
            return undefined;
        }

        const foreground = getContrastingSimpleColor(color);
        if (!foreground) {
            // Malformed hex: neutral beats unknown text on an unknown background.
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
