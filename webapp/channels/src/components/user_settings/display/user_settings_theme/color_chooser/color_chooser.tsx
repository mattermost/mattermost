// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import ColorInput from 'components/color_input';

type Props = {
    id: string;
    label: React.ReactNode;
    value: string;
    onChange?: (id: string, newColor: string) => void;
}

export default function ColorChooser(props: Props) {
    const handleChange = (newColor: string) => {
        props.onChange?.(props.id, newColor);
    };

    return (
        <React.Fragment>
            <label className='custom-label'>{props.label}</label>
            <ColorInput
                id={props.id}
                value={props.value}
                onChange={handleChange}
            />
        </React.Fragment>
    );
}
