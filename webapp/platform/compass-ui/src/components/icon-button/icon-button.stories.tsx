// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {EmoticonOutlineIcon} from '@mattermost/compass-icons/components';
import React from 'react';
import {ComponentStory} from '@storybook/react';

import IconButton from './icon-button';

export default {
    title: 'IconButton',
    component: IconButton,
};

export const NormalIconButton: ComponentStory<typeof IconButton> = (args) => {
    return <IconButton {...args}/>;
};
NormalIconButton.args = {
    size: 'medium',
    IconComponent: EmoticonOutlineIcon,
    destructive: false,
    disabled: false,
    toggled: false,
    compact: false,
    inverted: false,
    label: '',
};
NormalIconButton.argTypes = {
    size: {
        control: 'select',
        options: [
            'x-small',
            'small',
            'medium',
            'large',
        ],
    },
    destructive: {
        control: 'boolean',
    },
    disabled: {
        control: 'boolean',
    },
    toggled: {
        control: 'boolean',
    },
    compact: {
        control: 'boolean',
    },
    inverted: {
        control: 'boolean',
    },
    label: {
        control: 'text',
    },
};
