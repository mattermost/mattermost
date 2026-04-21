// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect, useState} from 'react';

import ClassificationColorInput from './classification_color_input';

import type {ClassificationLevel} from '../utils/presets';

type LevelColorCellProps = {
    value: string;
    id: string;
    updateLevel: (id: string, updates: Partial<ClassificationLevel>) => void;
    swatchAriaLabel: string;
};

export default function LevelColorCell({value, id, updateLevel, swatchAriaLabel}: LevelColorCellProps) {
    const [localColor, setLocalColor] = useState(value);

    useEffect(() => {
        setLocalColor(value);
    }, [value]);

    return (
        <div
            onBlur={() => {
                if (localColor !== value) {
                    updateLevel(id, {color: localColor});
                }
            }}
        >
            <ClassificationColorInput
                id={`classification-color-${id}`}
                value={localColor}
                onChange={setLocalColor}
                swatchAriaLabel={swatchAriaLabel}
            />
        </div>
    );
}
