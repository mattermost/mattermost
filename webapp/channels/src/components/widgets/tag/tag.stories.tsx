// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Meta, StoryObj} from '@storybook/react';
import React from 'react';

import BotTag from './bot_tag';
import GuestTag from './guest_tag';
import Tag from './tag';

const meta: Meta<typeof Tag> = {
    title: 'Widgets/Tag',
    component: Tag,
    tags: ['autodocs'],
    argTypes: {
        text: {
            control: 'text',
            description: 'The text content of the tag',
        },
        variant: {
            control: 'select',
            options: ['info', 'success', 'warning', 'danger', 'dangerDim', 'default'],
            description: 'The visual variant of the tag',
        },
        size: {
            control: 'select',
            options: ['xs', 'sm', 'md', 'lg'],
            description: 'The size of the tag',
        },
        uppercase: {
            control: 'boolean',
            description: 'Whether to display text in uppercase',
        },
        icon: {
            control: 'text',
            description: 'Icon name from Compass Icons',
        },
        onClick: {
            action: 'clicked',
            description: 'Click handler for interactive tags',
        },
    },
};

export default meta;
type Story = StoryObj<typeof Tag>;

export const Default: Story = {
    args: {
        text: 'Default Tag',
        variant: 'default',
        size: 'xs',
        uppercase: false,
    },
};

export const Info: Story = {
    args: {
        text: 'Info',
        variant: 'info',
        size: 'sm',
        uppercase: true,
    },
};

export const Success: Story = {
    args: {
        text: 'Success',
        variant: 'success',
        size: 'sm',
        uppercase: true,
    },
};

export const Warning: Story = {
    args: {
        text: 'Warning',
        variant: 'warning',
        size: 'sm',
        uppercase: true,
    },
};

export const Danger: Story = {
    args: {
        text: 'Danger',
        variant: 'danger',
        size: 'sm',
        uppercase: true,
    },
};

export const DangerDim: Story = {
    args: {
        text: 'Danger Dim',
        variant: 'dangerDim',
        size: 'sm',
        uppercase: true,
    },
};

export const Sizes: Story = {
    render: () => (
        <div style={{display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap'}}>
            <Tag
                text='Extra Small'
                size='xs'
                variant='info'
            />
            <Tag
                text='Small'
                size='sm'
                variant='info'
            />
            <Tag
                text='Medium'
                size='md'
                variant='info'
            />
            <Tag
                text='Large'
                size='lg'
                variant='info'
            />
        </div>
    ),
};

export const Variants: Story = {
    render: () => (
        <div style={{display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap'}}>
            <Tag
                text='Default'
                variant='default'
                size='sm'
                uppercase={true}
            />
            <Tag
                text='Info'
                variant='info'
                size='sm'
                uppercase={true}
            />
            <Tag
                text='Success'
                variant='success'
                size='sm'
                uppercase={true}
            />
            <Tag
                text='Warning'
                variant='warning'
                size='sm'
                uppercase={true}
            />
            <Tag
                text='Danger'
                variant='danger'
                size='sm'
                uppercase={true}
            />
            <Tag
                text='Danger Dim'
                variant='dangerDim'
                size='sm'
                uppercase={true}
            />
        </div>
    ),
};

export const WithIcon: Story = {
    args: {
        text: 'With Icon',
        variant: 'info',
        size: 'md',
        icon: 'check',
        uppercase: false,
    },
};

export const Clickable: Story = {
    args: {
        text: 'Click Me',
        variant: 'info',
        size: 'md',
        uppercase: false,
        // eslint-disable-next-line no-alert
        onClick: () => alert('Tag clicked!'),
    },
};

// Specialized Tag Components
export const Bot: StoryObj<typeof BotTag> = {
    render: () => <BotTag/>,
};

export const BotSizes: StoryObj<typeof BotTag> = {
    render: () => (
        <div style={{display: 'flex', gap: '8px', alignItems: 'center'}}>
            <BotTag size='xs'/>
            <BotTag size='sm'/>
            <BotTag size='md'/>
            <BotTag size='lg'/>
        </div>
    ),
};

export const Guest: StoryObj<typeof GuestTag> = {
    render: () => <GuestTag/>,
};

export const GuestSizes: StoryObj<typeof GuestTag> = {
    render: () => (
        <div style={{display: 'flex', gap: '8px', alignItems: 'center'}}>
            <GuestTag size='xs'/>
            <GuestTag size='sm'/>
            <GuestTag size='md'/>
            <GuestTag size='lg'/>
        </div>
    ),
};

