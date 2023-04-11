// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {ComponentStory} from '@storybook/react';

import Button from './button';

export default {
    title: 'Button',
    component: Button,
};

export const NormalButton: ComponentStory<typeof Button> = (args) => {
    return <Button {...args}>{'BUTTON'}</Button>;
};
NormalButton.args = {
    variant: 'primary',
    size: 'medium',
    destructive: false,
    disabled: false,
    inverted: false,
};
NormalButton.argTypes = {
    variant: {
        control: 'select',
        options: [
            'primary',
            'secondary',
            'tertiary',
        ],
    },
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
    inverted: {
        control: 'boolean',
    },
};
