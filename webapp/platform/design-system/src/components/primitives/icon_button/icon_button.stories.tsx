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

// Loading spinner showcase - comprehensive examples
export const LoadingSpinners: Story = {
    render: () => (
        <div style={{display: 'flex', flexDirection: 'column', gap: '24px'}}>
            <div>
                <h3 style={{marginBottom: '12px', fontSize: '16px', fontWeight: 'bold'}}>Loading Spinners - All Sizes</h3>
                <div style={{display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap'}}>
                    <IconButton size='xs' loading icon={<MagnifyIcon/>} title='Extra Small Loading' />
                    <IconButton size='sm' loading icon={<MenuVariantIcon/>} title='Small Loading' />
                    <IconButton size='md' loading icon={<HeartOutlineIcon />} title='Medium Loading' />
                    <IconButton size='lg' loading icon={<StarOutlineIcon />} title='Large Loading' />
                </div>
            </div>

            <div>
                <h3 style={{marginBottom: '12px', fontSize: '16px', fontWeight: 'bold'}}>Loading with Different Padding</h3>
                <div style={{display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap'}}>
                    <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px'}}>
                        <span style={{fontSize: '12px', color: '#666'}}>Default Padding</span>
                        <div style={{display: 'flex', gap: '8px'}}>
                            <IconButton size='xs' loading padding='default' icon={<MagnifyIcon/>} />
                            <IconButton size='sm' loading padding='default' icon={<MagnifyIcon/>} />
                            <IconButton size='md' loading padding='default' icon={<MagnifyIcon/>} />
                            <IconButton size='lg' loading padding='default' icon={<MagnifyIcon/>} />
                        </div>
                    </div>
                    <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px'}}>
                        <span style={{fontSize: '12px', color: '#666'}}>Compact Padding</span>
                        <div style={{display: 'flex', gap: '8px'}}>
                            <IconButton size='xs' loading padding='compact' icon={<MagnifyIcon/>} />
                            <IconButton size='sm' loading padding='compact' icon={<MagnifyIcon/>} />
                            <IconButton size='md' loading padding='compact' icon={<MagnifyIcon/>} />
                            <IconButton size='lg' loading padding='compact' icon={<MagnifyIcon/>} />
                        </div>
                    </div>
                </div>
            </div>

            <div>
                <h3 style={{marginBottom: '12px', fontSize: '16px', fontWeight: 'bold'}}>Destructive Loading States</h3>
                <div style={{display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap'}}>
                    <IconButton size='xs' loading destructive icon={<TrashCanOutlineIcon />} title='Delete (XS)' />
                    <IconButton size='sm' loading destructive icon={<TrashCanOutlineIcon />} title='Delete (SM)' />
                    <IconButton size='md' loading destructive icon={<TrashCanOutlineIcon />} title='Delete (MD)' />
                    <IconButton size='lg' loading destructive icon={<TrashCanOutlineIcon />} title='Delete (LG)' />
                </div>
            </div>

            <div>
                <h3 style={{marginBottom: '12px', fontSize: '16px', fontWeight: 'bold'}}>Loading with Rounded Buttons</h3>
                <div style={{display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap'}}>
                    <IconButton size='xs' loading rounded icon={<PlusIcon/>} title='Add (XS)' />
                    <IconButton size='sm' loading rounded icon={<PlusIcon/>} title='Add (SM)' />
                    <IconButton size='md' loading rounded icon={<PlusIcon/>} title='Add (MD)' />
                    <IconButton size='lg' loading rounded icon={<PlusIcon/>} title='Add (LG)' />
                </div>
            </div>

            <div>
                <h3 style={{marginBottom: '12px', fontSize: '16px', fontWeight: 'bold'}}>Loading with Count (Count Hidden During Loading)</h3>
                <div style={{display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap'}}>
                    <IconButton loading showCount count={5} icon={<StarOutlineIcon/>} title='Favorites' />
                    <IconButton loading showCount count={12} icon={<HeartOutlineIcon/>} title='Likes' />
                    <IconButton loading showCount count={99} icon={<MenuVariantIcon/>} title='Messages' />
                </div>
            </div>
        </div>
    ),
};

// Inverted loading spinners for dark backgrounds
export const InvertedLoadingSpinners: Story = {
    render: () => (
        <div style={{display: 'flex', flexDirection: 'column', gap: '24px'}}>
            <div>
                <h3 style={{marginBottom: '12px', fontSize: '16px', fontWeight: 'bold', color: 'white'}}>Inverted Loading Spinners - All Sizes</h3>
                <div style={{display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap'}}>
                    <IconButton size='xs' loading inverted icon={<MagnifyIcon />} title='Search (XS)' />
                    <IconButton size='sm' loading inverted icon={<MenuVariantIcon />} title='Menu (SM)' />
                    <IconButton size='md' loading inverted icon={<HeartOutlineIcon />} title='Like (MD)' />
                    <IconButton size='lg' loading inverted icon={<StarOutlineIcon />} title='Favorite (LG)' />
                </div>
            </div>

            <div>
                <h3 style={{marginBottom: '12px', fontSize: '16px', fontWeight: 'bold', color: 'white'}}>Inverted Loading - Various States</h3>
                <div style={{display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap'}}>
                    <IconButton loading inverted icon={<CogOutlineIcon />} title='Settings' />
                    <IconButton loading inverted toggled icon={<HeartOutlineIcon />} title='Liked' />
                    <IconButton loading inverted destructive icon={<TrashCanOutlineIcon />} title='Delete' />
                    <IconButton loading inverted rounded icon={<PlusIcon />} title='Add' />
                </div>
            </div>

            <div>
                <h3 style={{marginBottom: '12px', fontSize: '16px', fontWeight: 'bold', color: 'white'}}>Inverted Loading with Unread Indicators</h3>
                <div style={{display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap'}}>
                    <IconButton loading inverted unread icon={<MenuVariantIcon />} title='Messages (Unread)' />
                    <IconButton loading inverted unread showCount count={3} icon={<StarOutlineIcon />} title='Notifications' />
                </div>
            </div>
        </div>
    ),
    decorators: [
        (Story) => (
            <div style={{backgroundColor: '#1e1e1e', padding: '20px'}}>
                <Story />
            </div>
        ),
    ],
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
