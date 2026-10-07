// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Checkbox} from '@mattermost/compass-ui/components/checkbox';
import React, {memo} from 'react';

import SetByEnv from './set_by_env';

type Props = {
    id: string;
    label: React.ReactNode;
    defaultChecked?: boolean;
    onChange: (id: string, foo: boolean) => void;
    disabled?: boolean;
    setByEnv: boolean;
};

const CheckboxSetting = ({
    disabled = false,
    id,
    label,
    defaultChecked,
    setByEnv,
    onChange,
}: Props) => {
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        onChange(id, e.target.checked);
    };

    return (
        <div>
            <Checkbox
                className='checkbox-inline'
                data-testid={id}
                id={id}
                name={id}
                defaultChecked={defaultChecked}
                onChange={handleChange}
                disabled={disabled || setByEnv}
            >
                {label}
            </Checkbox>
            {setByEnv ? <SetByEnv/> : null}
        </div>
    );
};

export default memo(CheckboxSetting);
