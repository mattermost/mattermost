// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Switch} from '@mattermost/compass-ui/components/switch';
import type {SwitchSize} from '@mattermost/compass-ui/components/switch';
import React, {useCallback} from 'react';

type Props = {
    onToggle: () => void;
    toggled?: boolean;
    disabled?: boolean;
    onText?: React.ReactNode;
    offText?: React.ReactNode;
    id?: string;
    overrideTestId?: boolean;
    size?: 'btn-lg' | 'btn-md' | 'btn-sm';
    ariaLabel?: string;
    tabIndex?: number;
};

const SIZE_MAP: Record<NonNullable<Props['size']>, SwitchSize> = {
    'btn-sm': 'small',
    'btn-md': 'medium',
    'btn-lg': 'large',
};

function stateLabel(
    toggled?: boolean,
    onText?: React.ReactNode,
    offText?: React.ReactNode,
): React.ReactNode | undefined {
    if ((toggled && !onText) || (!toggled && !offText)) {
        return undefined;
    }
    return toggled ? onText : offText;
}

const Toggle: React.FC<Props> = (props: Props) => {
    const {
        onToggle,
        toggled,
        disabled,
        onText,
        offText,
        id,
        overrideTestId,
        ariaLabel,
        size = 'btn-lg',
        tabIndex = 0,
    } = props;

    let dataTestId = `${id}-button`;
    if (overrideTestId) {
        dataTestId = id || '';
    }

    const handleChange = useCallback(() => {
        onToggle();
    }, [onToggle]);

    const label = stateLabel(toggled, onText, offText);

    return (
        <Switch
            id={id}
            size={SIZE_MAP[size]}
            checked={toggled}
            disabled={disabled}
            onChange={handleChange}
            aria-label={ariaLabel}
            data-testid={dataTestId}
            tabIndex={tabIndex}
            semiBold={Boolean(label)}
        >
            {label}
        </Switch>
    );
};

export default Toggle;
