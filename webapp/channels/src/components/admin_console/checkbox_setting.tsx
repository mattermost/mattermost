// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {memo} from 'react';

import {Checkbox} from '@mattermost/compass-ui/components/checkbox';

import SetByEnv from './set_by_env';

type Props = {
    id: string;
    label: React.ReactNode;
    defaultChecked?: boolean;
    onChange: (id: string, foo: boolean) => void;
    disabled?: boolean;
    setByEnv: boolean;

    testId?: string;
    testKey?: string;
};

const CheckboxSetting = ({
    disabled = false,
    id,
    label,
    defaultChecked,
    setByEnv,
    onChange,
    testId,
    testKey,
}: Props) => {
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        onChange(id, e.target.checked);
    };

    let checkboxTestId;
    if (testId && testKey) {
        checkboxTestId = `${testId}:${testKey}--checkbox`;
    } else if (testId) {
        checkboxTestId = `${testId}--checkbox`;
    }

    return (
        <div>
            <Checkbox
                className='checkbox-inline'
                data-testid={checkboxTestId}
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
