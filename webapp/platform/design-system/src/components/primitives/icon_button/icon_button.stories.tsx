// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Meta, StoryObj} from '@storybook/react';
import React from 'react';

import * as CompassIcons from '@mattermost/compass-icons/components';

import IconButton from './icon_button';

// Get all available compass icons dynamically
const iconOptions = Object.keys(CompassIcons).sort();

const meta: Meta<typeof IconButton> = {
    title: 'DesignSystem/Primitives/IconButton',
    component: IconButton,
    tags: ['autodocs'],
    render: (args) => {
        const {icon, ...rest} = args;
        const IconComponent = (typeof icon === 'string' ? CompassIcons[icon as keyof typeof CompassIcons] : icon) as React.ComponentType;
        return <IconButton {...rest} icon={<IconComponent />} />;
    },
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
        icon: {
            control: 'select',
            options: iconOptions,
            description: 'Icon to display in the button',
        },
    },
};

export default meta;
type Story = StoryObj<typeof IconButton>;

// Basic examples
export const ExtraSmall: Story = {
    args: {
        icon: 'MagnifyIcon',
        size: 'xs',
        padding: 'default',
        toggled: false,
        destructive: false,
        inverted: false,
        rounded: false,
        showCount: false,
        count: 0,
        unread: false,
        loading: false,
        disabled: false,
    },
    parameters: {
        controls: {
            exclude: ['size'],
        },
    },
};

export const Small: Story = {
    args: {
        icon: 'MagnifyIcon',
        size: 'sm',
        padding: 'default',
        toggled: false,
        destructive: false,
        inverted: false,
        rounded: false,
        showCount: false,
        count: 0,
        unread: false,
        loading: false,
        disabled: false,
    },
    parameters: {
        controls: {
            exclude: ['size'],
        },
    },
};

export const Medium: Story = {
    args: {
        icon: 'MagnifyIcon',
        size: 'md',
        padding: 'default',
        toggled: false,
        destructive: false,
        inverted: false,
        rounded: false,
        showCount: false,
        count: 0,
        unread: false,
        loading: false,
        disabled: false,
    },
    parameters: {
        controls: {
            exclude: ['size'],
        },
    },
};

export const Large: Story = {
    args: {
        icon: 'MagnifyIcon',
        size: 'lg',
        padding: 'default',
        toggled: false,
        destructive: false,
        inverted: false,
        rounded: false,
        showCount: false,
        count: 0,
        unread: false,
        loading: false,
        disabled: false,
    },
    parameters: {
        controls: {
            exclude: ['size'],
        },
    },
};

// Sizes
export const AllSizes: Story = {
    render: () => (
        <div style={{display: 'flex', gap: '12px', alignItems: 'center'}}>
            <IconButton size='xs' icon={<CompassIcons.MagnifyIcon/>} />
            <IconButton size='sm' icon={<CompassIcons.MagnifyIcon/>} />
            <IconButton size='md' icon={<CompassIcons.MagnifyIcon/>} />
            <IconButton size='lg' icon={<CompassIcons.MagnifyIcon/>} />
        </div>
    ),
    parameters: {
        controls: {
            disable: true,
        },
    },
};

export const Toggled: Story = {
    args: {
        icon: 'HeartOutlineIcon',
        toggled: true,
    },
};

export const Destructive: Story = {
    args: {
        icon: 'TrashCanOutlineIcon',
        destructive: true,
    },
};

export const Loading: Story = {
    args: {
        icon: 'DownloadOutlineIcon',
        loading: true,
    },
};

export const Disabled: Story = {
    args: {
        icon: 'CogOutlineIcon',
        disabled: true,
    },
};

// Other variations
export const WithCount: Story = {
    args: {
        icon: 'StarOutlineIcon',
        showCount: true,
        count: 5,
    },
};

export const WithUnreadIndicator: Story = {
    args: {
        icon: 'MenuVariantIcon',
        unread: true,
    },
};

export const Rounded: Story = {
    args: {
        icon: 'PlusIcon',
        rounded: true,
    },
};

// Inverted (for dark backgrounds)
export const Inverted: Story = {
    args: {
        icon: 'MagnifyIcon',
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

export const CompactPadding: Story = {
    args: {
        icon: 'MagnifyIcon',
        padding: 'compact',
    },
    parameters: {
        controls: {
            exclude: ['padding'],
        },
    },
};

// All variations comparison
export const AllVariations: Story = {
    render: () => (
        <div style={{display: 'flex', flexDirection: 'column', gap: '16px'}}>
            <div style={{display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap'}}>
                <IconButton icon={<CompassIcons.MagnifyIcon />} />
                <IconButton toggled icon={<CompassIcons.HeartOutlineIcon />} />
                <IconButton destructive icon={<CompassIcons.TrashCanOutlineIcon />} />
                <IconButton loading icon={<CompassIcons.DownloadOutlineIcon />} />
                <IconButton disabled icon={<CompassIcons.CogOutlineIcon />} />
            </div>
            <div style={{display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap'}}>
                <IconButton rounded icon={<CompassIcons.PlusIcon />} />
                <IconButton showCount count={5} icon={<CompassIcons.StarOutlineIcon />} />
                <IconButton unread icon={<CompassIcons.MenuVariantIcon />} />
                <IconButton padding='compact' icon={<CompassIcons.MagnifyIcon />} />
            </div>
        </div>
    ),
    parameters: {
        controls: {
            disable: true,
        },
    },
};
