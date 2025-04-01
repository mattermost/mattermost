// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {components} from 'react-select';
import type {OptionProps} from 'react-select';

import type {Channel} from '@mattermost/types/channels';

const {Option} = components;
export const SelectChannelOption = (props: OptionProps<Channel>) => {
    const item = props.data;

    const channelName = item.display_name;
    const purpose = item.purpose;

    const icon = (
        <span className='select-option-icon select-option-icon--large'>
            <i className='icon icon--standard icon--no-spacing icon-globe'/>
        </span>
    );

    const description = '(~' + item.name + ')';

    return (
        <Option
            className='apps-form-select-option'
            {...props}
        >
            <div className='select-option-item'>
                {icon}
                <div className='select-option-item-label'>
                    <span className='select-option-main'>
                        {channelName}
                    </span>
                    <span className='ml-2'>
                        {' '}
                        {description}
                    </span>
                    <span className='ml-2'>
                        {' '}
                        {purpose}
                    </span>
                </div>
            </div>
        </Option>);
};
