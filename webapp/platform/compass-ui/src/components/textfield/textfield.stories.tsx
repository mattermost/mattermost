// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {MagnifyIcon, AccountOutlineIcon} from '@mattermost/compass-icons/components';
import {ComponentStory} from '@storybook/react';
import React, {useState} from 'react';

import Textfield from './textfield';

const icons = {
    MagnifyIcon,
    AccountOutlineIcon,
};

export default {
    title: 'Textfield',
    component: Textfield,
};

export const Outlined: ComponentStory<typeof Textfield> = (args) => {
    const [value, setValue] = useState('');
    const handleOnChange = (event: React.ChangeEvent<HTMLInputElement>) => setValue(event.target.value);
    return (
        <Textfield
            {...args}
            value={value}
            onChange={handleOnChange}
        />
    );
};
Outlined.args = {
    label: 'example Label',
    size: 'medium',
    fullWidth: false,
    placeholder: undefined,
};
Outlined.argTypes = {
    label: {
        control: 'text',
    },
    placeholder: {
        control: 'text',
    },
    size: {
        control: 'select',
        options: [
            'small',
            'medium',
            'large',
        ],
    },
    fullWidth: {
        control: 'boolean',
    },
    StartIcon: {
        options: Object.keys(icons),
        mapping: icons,
        control: {
            type: 'select',
            labels: {
                MagnifyIcon: 'Search',
                AccountOutlineIcon: 'Account',
            },
        },
    },
};
