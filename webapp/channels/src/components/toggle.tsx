// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Switch} from '@mattermost/compass-ui/components/switch';
import type {SwitchSize} from '@mattermost/compass-ui/components/switch';
import classNames from 'classnames';
import React, {useCallback} from 'react';

import './toggle.scss';

type Props = {
    onToggle: () => void;
    toggled?: boolean;
    disabled?: boolean;
    onText?: React.ReactNode;
    offText?: React.ReactNode;
    id?: string;
    overrideTestId?: boolean;
    size?: 'btn-lg' | 'btn-md' | 'btn-sm';
    toggleClassName?: string;
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
): React.ReactNode | null {
    if ((toggled && !onText) || (!toggled && !offText)) {
        return null;
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
        toggleClassName,
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

    const switchControl = (
        <Switch
            id={id}
            className={toggleClassName}
            size={SIZE_MAP[size]}
            checked={toggled}
            disabled={disabled}
            onChange={handleChange}
            aria-label={ariaLabel}
            data-testid={dataTestId}
            tabIndex={tabIndex}
        />
    );

    if (!label) {
        return switchControl;
    }

    return (
        <span className={classNames('Toggle', 'Toggle--with-state-label')}>
            {switchControl}
            <span
                className='Toggle__state-label'
                aria-hidden={true}
            >
                {label}
            </span>
        </span>
    );
};

export default Toggle;
