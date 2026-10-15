// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Checkbox} from '@mattermost/compass-ui/components/checkbox';
import React, {type ChangeEvent, type JSX, type MouseEvent} from 'react';

type Props = {
    value?: string;
    id?: string;
    disabled?: boolean;
    onChange?: () => void;
};

const PermissionCheckbox = ({
    value = '',
    id = '',
    disabled = false,
    onChange,
}: Props): JSX.Element => {
    const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
        e.stopPropagation();
        onChange?.();
    };

    // Stop row-level click handlers from also firing when the checkbox is used.
    const handleWrapperClick = (e: MouseEvent) => {
        e.stopPropagation();
    };

    return (
        <span
            className='permission-check'
            onClick={handleWrapperClick}
        >
            <Checkbox
                data-testid={id}
                id={id || undefined}
                checked={value === 'checked'}
                indeterminate={value === 'intermediate'}
                disabled={disabled}
                onChange={handleChange}
            />
        </span>
    );
};

export default PermissionCheckbox;
