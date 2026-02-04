// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import type {MultiValueProps} from 'react-select';

import CloseCircleSolidIcon from 'components/widgets/icons/close_circle_solid_icon';

import './reason_option.scss';

function Remove(props: any) {
    const {innerProps, children} = props;

    return (
        <div
            className='Remove'
            {...innerProps}
            onClick={props.onClick}
        >
            {children || <CloseCircleSolidIcon/>}
        </div>
    );
}

export function ReasonOption(props: MultiValueProps<{label: string; value: string}, true>) {
    const {data, innerProps, selectProps, removeProps} = props;

    return (
        <div
            className='ReasonOption'
            {...innerProps}
        >
            {data.label}

            <Remove
                data={data}
                innerProps={innerProps}
                selectProps={selectProps}
                {...removeProps}
            />
        </div>
    );
}
