// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React, {useMemo} from 'react';
import {FormattedMessage} from 'react-intl';

import {CloseCircleIcon} from '@mattermost/compass-icons/components';

import {getContrastingSimpleColor} from 'mattermost-redux/utils/theme_utils';

import './attribute_chip.scss';

// getContrastingSimpleColor only checks length, so a 6-character non-hex string
// (e.g. 'zzzzzz') parses to NaN channels and still returns a contrasting colour
// instead of failing -- forcing white/black text onto a background the browser
// then silently ignores as invalid CSS.
const HEX_COLOR_PATTERN = /^#?[0-9a-fA-F]{6}$/;

type Props = {
    label: string;
    value: string;

    // Hex from the option definition. Absent falls back to the neutral treatment.
    color?: string;

    // False where the label is already visible beside the chip, so a screen reader
    // does not hear it twice.
    announceLabel?: boolean;

    // Channel Info and the channel header both use medium.
    size?: 'small' | 'medium';

    className?: string;
};

type RemoveButtonProps = {
    onRemove: (event: React.MouseEvent) => void;
    removeLabel: string;
    disabled?: boolean;
};

export const AttributeChipRemoveButton = ({onRemove, removeLabel, disabled}: RemoveButtonProps) => (
    <button
        type='button'
        className='AttributeChip__remove'
        data-testid='attributeChipRemove'
        aria-label={removeLabel}
        disabled={disabled}
        onMouseDown={(event) => {
            event.preventDefault();
            event.stopPropagation();
        }}
        onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            event.nativeEvent.stopImmediatePropagation();
            onRemove(event);
        }}
    >
        <CloseCircleIcon
            size={14}
            aria-hidden={true}
        />
    </button>
);

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
const AttributeChip = ({
    label,
    value,
    color,
    announceLabel = true,
    size = 'small',
    className,
}: Props) => {
    const style = useMemo(() => {
        if (!color || !HEX_COLOR_PATTERN.test(color)) {
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
            className={classNames(
                'AttributeChip',
                `AttributeChip--${size}`,
                {
                    'AttributeChip--neutral': !style,
                },
                className,
            )}
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
