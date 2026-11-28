// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import ColorInput from 'components/color_input';

type Props = {
    id: string;

    /** The chooser's position among the theme's elements. */
    testKey: number;
    label: React.ReactNode;
    value: string;
    onChange?: (id: string, newColor: string) => void;
};

export default function ColorChooser(props: Props) {
    const handleChange = (newColor: string) => {
        props.onChange?.(props.id, newColor);
    };

    return (
        <>
            <label
                className='custom-label'
                htmlFor={`${props.id}-inputColorValue`}
            >
                {props.label}
            </label>
            <ColorInput
                id={props.id}
                testIdScope='settings.display.section.color'
                testKey={props.testKey}
                value={props.value}
                onChange={handleChange}
            />
        </>
    );
}
