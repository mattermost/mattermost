// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect, useState} from 'react';

import {BorderlessInput} from '../../system_properties/controls';
import type {ClassificationLevel} from '../utils/presets';

type LevelNameCellProps = {
    value: string;
    id: string;
    updateLevel: (id: string, updates: Partial<ClassificationLevel>) => void;
    label: string;
    disabled?: boolean;
    autoFocus?: boolean;
};

export default function LevelNameCell({value, id, updateLevel, label, disabled, autoFocus}: LevelNameCellProps) {
    const [localValue, setLocalValue] = useState(value);

    useEffect(() => {
        setLocalValue(value);
    }, [value]);

    return (
        <BorderlessInput
            type='text'
            aria-label={label}
            $strong={true}
            value={localValue}
            readOnly={disabled}
            autoFocus={autoFocus}
            onFocus={(e: React.FocusEvent<HTMLInputElement>) => {
                if (autoFocus) {
                    e.target.select();
                }
            }}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setLocalValue(e.target.value)}
            onBlur={() => {
                if (localValue !== value) {
                    updateLevel(id, {name: localValue.trim()});
                }
            }}
        />
    );
}
