// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, type JSX} from 'react';

import {Checkbox} from '@mattermost/compass-ui/components/checkbox';

type Props = {
    name: string;
    checked: boolean;
    label: string | JSX.Element;
    updateOption: (checked: boolean, name: string) => void;
};

function FilterCheckbox({
    name,
    checked,
    label,
    updateOption,
}: Props) {
    const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        updateOption(e.target.checked, name);
    }, [name, updateOption]);

    return (
        <div className='FilterList_checkbox'>
            <Checkbox
                id={name}
                name={name}
                checked={checked}
                onChange={handleChange}
            >
                {label}
            </Checkbox>
        </div>
    );
}

export default React.memo(FilterCheckbox);
