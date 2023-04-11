// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {ComponentStory, ComponentMeta} from '@storybook/react';

import Typography from './typography';

export default {
    title: 'Typography',
    component: Typography,
} as ComponentMeta<typeof Typography>;

const Template: ComponentStory<typeof Typography> = (args) => <Typography {...args}>{`Typography variant 1: "${args.variant}"`}</Typography>;

export const Heading = Template.bind({});
Heading.args = {variant: 'h100'};
Heading.argTypes = {
    variant: {
        control: 'select',
        options: [
            'h25',
            'h50',
            'h75',
            'h100',
            'h200',
            'h300',
            'h400',
            'h500',
            'h600',
            'h700',
            'h800',
            'h900',
            'h1000',
        ],
    },
};

export const Body = Template.bind({});
Body.args = {variant: 'b100'};
Body.argTypes = {
    variant: {
        control: 'select',
        options: [
            'b25',
            'b50',
            'b75',
            'b100',
            'b200',
            'b300',
        ],
    },
};
