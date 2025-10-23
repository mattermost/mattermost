// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Meta, StoryObj} from '@storybook/react';
import React from 'react';

import {CogOutlineIcon, DownloadOutlineIcon, HeartOutlineIcon, MagnifyIcon, MenuVariantIcon, PlusIcon, StarOutlineIcon, TrashCanOutlineIcon} from '@mattermost/compass-icons/components';

import IconButton from './icon_button';

// Mock icon components (in real usage, these would be from @mattermost/compass-icons)

const meta: Meta<typeof IconButton> = {
    title: 'DesignSystem/Primitives/IconButton',
    component: IconButton,
    tags: ['autodocs'],
    argTypes: {
        size: {
            control: 'select',
            options: ['xs', 'sm', 'md', 'lg'],
            description: 'Icon size and overall button dimensions',
        },
        padding: {
            control: 'select',
            options: ['default', 'compact'],
            description: 'Internal padding variation',
        },
        toggled: {
            control: 'boolean',
            description: 'Toggle state for buttons that can be toggled on/off',
        },
        destructive: {
            control: 'boolean',
            description: 'Destructive action styling (error/danger color scheme)',
        },
        inverted: {
            control: 'boolean',
            description: 'Visual style variant - inverted for dark backgrounds',
        },
        rounded: {
            control: 'boolean',
            description: 'Border radius style',
        },
        showCount: {
            control: 'boolean',
            description: 'Show count/number alongside icon',
        },
        count: {
            control: 'number',
            description: 'The count to display',
        },
        unread: {
            control: 'boolean',
            description: 'Show unread indicator (notification dot)',
        },
        loading: {
            control: 'boolean',
            description: 'Loading state - shows spinner instead of icon',
        },
        disabled: {
            control: 'boolean',
            description: 'Whether the button is disabled',
        },
    },
};

export default meta;
type Story = StoryObj<typeof IconButton>;

// Basic examples
export const Default: Story = {
    args: {
        icon: <MagnifyIcon/>,
    },
};

export const Toggled: Story = {
    args: {
        icon: <HeartOutlineIcon/>,
        toggled: true,
    },
};

export const Destructive: Story = {
    args: {
        icon: <TrashCanOutlineIcon/>,
        destructive: true,
    },
};

export const Loading: Story = {
    args: {
        icon: <DownloadOutlineIcon/>,
        loading: true,
    },
};

export const Disabled: Story = {
    args: {
        icon: <CogOutlineIcon/>,
        disabled: true,
    },
};

// Sizes
export const Sizes: Story = {
    render: () => (
        <div style={{display: 'flex', gap: '12px', alignItems: 'center'}}>
            <IconButton size='xs' icon={<MagnifyIcon/>} />
            <IconButton size='sm' icon={<MagnifyIcon/>} />
            <IconButton size='md' icon={<MagnifyIcon/>} />
            <IconButton size='lg' icon={<MagnifyIcon/>} />
        </div>
    ),
};

// Other variations
export const WithCount: Story = {
    args: {
        icon: <StarOutlineIcon />,
        showCount: true,
        count: 5,
    },
};

export const WithUnreadIndicator: Story = {
    args: {
        icon: <MenuVariantIcon />,
        unread: true,
    },
};

export const Rounded: Story = {
    args: {
        icon: <PlusIcon />,
        rounded: true,
    },
};

export const CompactPadding: Story = {
    render: () => (
        <div style={{display: 'flex', gap: '12px', alignItems: 'center'}}>
            <IconButton size='xs' padding='compact' icon={<MagnifyIcon />} />
            <IconButton size='sm' padding='compact' icon={<MagnifyIcon />} />
            <IconButton size='md' padding='compact' icon={<MagnifyIcon />} />
            <IconButton size='lg' padding='compact' icon={<MagnifyIcon />} />
        </div>
    ),
};

// Inverted (for dark backgrounds)
export const Inverted: Story = {
    args: {
        icon: <MagnifyIcon />,
        inverted: true,
    },
    decorators: [
        (Story) => (
            <div style={{backgroundColor: '#1E325C', padding: '20px'}}>
                <Story />
            </div>
        ),
    ],
};

// All variations comparison
export const AllVariations: Story = {
    render: () => (
        <div style={{display: 'flex', flexDirection: 'column', gap: '16px'}}>
            <div style={{display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap'}}>
                <IconButton icon={<MagnifyIcon />} />
                <IconButton toggled icon={<HeartOutlineIcon />} />
                <IconButton destructive icon={<TrashCanOutlineIcon />} />
                <IconButton loading icon={<DownloadOutlineIcon />} />
                <IconButton disabled icon={<CogOutlineIcon />} />
            </div>
            <div style={{display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap'}}>
                <IconButton rounded icon={<PlusIcon />} />
                <IconButton showCount count={5} icon={<StarOutlineIcon />} />
                <IconButton unread icon={<MenuVariantIcon />} />
                <IconButton padding='compact' icon={<MagnifyIcon />} />
            </div>
        </div>
    ),
};
