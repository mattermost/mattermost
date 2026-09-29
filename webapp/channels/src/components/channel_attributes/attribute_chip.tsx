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

    // When set, renders a circular dismiss control inside the chip (Figma Chip).
    onRemove?: (event: React.MouseEvent) => void;
    removeLabel?: string;
    disabled?: boolean;
};

type RemoveButtonProps = {
    onRemove: (event: React.MouseEvent) => void;
    removeLabel: string;
    disabled?: boolean;
};

export const AttributeChipRemoveButton = ({onRemove, removeLabel, disabled}: RemoveButtonProps) => (
    <span
        role='button'
        tabIndex={disabled ? -1 : 0}
        className='AttributeChip__remove'
        data-testid='attributeChipRemove'
        data-menu-prevent-open={true}
        aria-label={removeLabel}
        aria-disabled={disabled || undefined}
        onPointerDown={(event) => {
            if (disabled || event.button !== 0) {
                return;
            }

            // Inside a Menu trigger / <label>: cancel activation so the click
            // reaches this control instead of opening the parent.
            event.preventDefault();
            event.stopPropagation();
        }}
        onMouseDown={(event) => {
            if (disabled) {
                return;
            }
            event.preventDefault();
            event.stopPropagation();
        }}
        onClick={(event) => {
            if (disabled) {
                return;
            }
            event.preventDefault();
            event.stopPropagation();
            event.nativeEvent.stopImmediatePropagation();
            onRemove(event);
        }}
        onKeyDown={(event) => {
            if (disabled) {
                return;
            }
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                event.stopPropagation();
                onRemove(event as unknown as React.MouseEvent);
            }
        }}
    >
        <CloseCircleIcon
            size={14}
            aria-hidden={true}
        />
    </span>
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
 *
 * Dismissible chips follow Components — Chip: circular CloseCircle inside the chip.
 */
const AttributeChip = ({
    label,
    value,
    color,
    announceLabel = true,
    size = 'small',
    className,
    onRemove,
    removeLabel,
    disabled,
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

    const dismissible = Boolean(onRemove && removeLabel);

    return (
        <span
            className={classNames(
                'AttributeChip',
                `AttributeChip--${size}`,
                {
                    'AttributeChip--neutral': !style,
                    'AttributeChip--dismissible': dismissible,
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
            {dismissible && (
                <AttributeChipRemoveButton
                    onRemove={onRemove!}
                    removeLabel={removeLabel!}
                    disabled={disabled}
                />
            )}
        </span>
    );
};

export default AttributeChip;
