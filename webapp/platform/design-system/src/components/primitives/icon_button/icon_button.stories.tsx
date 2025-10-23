// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Meta, StoryObj} from '@storybook/react';
import React from 'react';

import IconButton from './icon_button';

// Mock icon components (in real usage, these would be from @mattermost/compass-icons)
const SearchIcon = () => <span>🔍</span>;
const MenuIcon = () => <span>☰</span>;
const HeartIcon = () => <span>❤️</span>;
const StarIcon = () => <span>⭐</span>;
const DownloadIcon = () => <span>📥</span>;
const DeleteIcon = () => <span>🗑️</span>;
const SettingsIcon = () => <span>⚙️</span>;
const AddIcon = () => <span>➕</span>;

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
        icon: <SearchIcon />,
    },
};

export const Toggled: Story = {
    args: {
        icon: <HeartIcon />,
        toggled: true,
    },
};

export const Destructive: Story = {
    args: {
        icon: <DeleteIcon />,
        destructive: true,
    },
};

export const Loading: Story = {
    args: {
        icon: <DownloadIcon />,
        loading: true,
    },
};

export const Disabled: Story = {
    args: {
        icon: <SettingsIcon />,
        disabled: true,
    },
};

// Sizes
export const Sizes: Story = {
    render: () => (
        <div style={{display: 'flex', gap: '12px', alignItems: 'center'}}>
            <IconButton size='xs' icon={<SearchIcon />} />
            <IconButton size='sm' icon={<SearchIcon />} />
            <IconButton size='md' icon={<SearchIcon />} />
            <IconButton size='lg' icon={<SearchIcon />} />
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
                    <IconButton size='xs' loading icon={<SearchIcon />} title="Extra Small Loading" />
                    <IconButton size='sm' loading icon={<MenuIcon />} title="Small Loading" />
                    <IconButton size='md' loading icon={<HeartIcon />} title="Medium Loading" />
                    <IconButton size='lg' loading icon={<StarIcon />} title="Large Loading" />
                </div>
            </div>

            <div>
                <h3 style={{marginBottom: '12px', fontSize: '16px', fontWeight: 'bold'}}>Loading with Different Padding</h3>
                <div style={{display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap'}}>
                    <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px'}}>
                        <span style={{fontSize: '12px', color: '#666'}}>Default Padding</span>
                        <div style={{display: 'flex', gap: '8px'}}>
                            <IconButton size='xs' loading padding='default' icon={<SearchIcon />} />
                            <IconButton size='sm' loading padding='default' icon={<SearchIcon />} />
                            <IconButton size='md' loading padding='default' icon={<SearchIcon />} />
                            <IconButton size='lg' loading padding='default' icon={<SearchIcon />} />
                        </div>
                    </div>
                    <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px'}}>
                        <span style={{fontSize: '12px', color: '#666'}}>Compact Padding</span>
                        <div style={{display: 'flex', gap: '8px'}}>
                            <IconButton size='xs' loading padding='compact' icon={<SearchIcon />} />
                            <IconButton size='sm' loading padding='compact' icon={<SearchIcon />} />
                            <IconButton size='md' loading padding='compact' icon={<SearchIcon />} />
                            <IconButton size='lg' loading padding='compact' icon={<SearchIcon />} />
                        </div>
                    </div>
                </div>
            </div>

            <div>
                <h3 style={{marginBottom: '12px', fontSize: '16px', fontWeight: 'bold'}}>Destructive Loading States</h3>
                <div style={{display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap'}}>
                    <IconButton size='xs' loading destructive icon={<DeleteIcon />} title="Delete (XS)" />
                    <IconButton size='sm' loading destructive icon={<DeleteIcon />} title="Delete (SM)" />
                    <IconButton size='md' loading destructive icon={<DeleteIcon />} title="Delete (MD)" />
                    <IconButton size='lg' loading destructive icon={<DeleteIcon />} title="Delete (LG)" />
                </div>
            </div>

            <div>
                <h3 style={{marginBottom: '12px', fontSize: '16px', fontWeight: 'bold'}}>Loading with Rounded Buttons</h3>
                <div style={{display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap'}}>
                    <IconButton size='xs' loading rounded icon={<AddIcon />} title="Add (XS)" />
                    <IconButton size='sm' loading rounded icon={<AddIcon />} title="Add (SM)" />
                    <IconButton size='md' loading rounded icon={<AddIcon />} title="Add (MD)" />
                    <IconButton size='lg' loading rounded icon={<AddIcon />} title="Add (LG)" />
                </div>
            </div>

            <div>
                <h3 style={{marginBottom: '12px', fontSize: '16px', fontWeight: 'bold'}}>Loading with Count (Count Hidden During Loading)</h3>
                <div style={{display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap'}}>
                    <IconButton loading showCount count={5} icon={<StarIcon />} title="Favorites" />
                    <IconButton loading showCount count={12} icon={<HeartIcon />} title="Likes" />
                    <IconButton loading showCount count={99} icon={<MenuIcon />} title="Messages" />
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
                    <IconButton size='xs' loading inverted icon={<SearchIcon />} title="Search (XS)" />
                    <IconButton size='sm' loading inverted icon={<MenuIcon />} title="Menu (SM)" />
                    <IconButton size='md' loading inverted icon={<HeartIcon />} title="Like (MD)" />
                    <IconButton size='lg' loading inverted icon={<StarIcon />} title="Favorite (LG)" />
                </div>
            </div>

            <div>
                <h3 style={{marginBottom: '12px', fontSize: '16px', fontWeight: 'bold', color: 'white'}}>Inverted Loading - Various States</h3>
                <div style={{display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap'}}>
                    <IconButton loading inverted icon={<SettingsIcon />} title="Settings" />
                    <IconButton loading inverted toggled icon={<HeartIcon />} title="Liked" />
                    <IconButton loading inverted destructive icon={<DeleteIcon />} title="Delete" />
                    <IconButton loading inverted rounded icon={<AddIcon />} title="Add" />
                </div>
            </div>

            <div>
                <h3 style={{marginBottom: '12px', fontSize: '16px', fontWeight: 'bold', color: 'white'}}>Inverted Loading with Unread Indicators</h3>
                <div style={{display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap'}}>
                    <IconButton loading inverted unread icon={<MenuIcon />} title="Messages (Unread)" />
                    <IconButton loading inverted unread showCount count={3} icon={<StarIcon />} title="Notifications" />
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
        icon: <StarIcon />,
        showCount: true,
        count: 5,
    },
};

export const WithUnreadIndicator: Story = {
    args: {
        icon: <MenuIcon />,
        unread: true,
    },
};

export const Rounded: Story = {
    args: {
        icon: <AddIcon />,
        rounded: true,
    },
};

export const CompactPadding: Story = {
    render: () => (
        <div style={{display: 'flex', gap: '12px', alignItems: 'center'}}>
            <IconButton size='xs' padding='compact' icon={<SearchIcon />} />
            <IconButton size='sm' padding='compact' icon={<SearchIcon />} />
            <IconButton size='md' padding='compact' icon={<SearchIcon />} />
            <IconButton size='lg' padding='compact' icon={<SearchIcon />} />
        </div>
    ),
};

// Inverted (for dark backgrounds)
export const Inverted: Story = {
    args: {
        icon: <SearchIcon />,
        inverted: true,
    },
    decorators: [
        (Story) => (
            <div style={{backgroundColor: '#1e1e1e', padding: '20px'}}>
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
                <IconButton icon={<SearchIcon />} />
                <IconButton toggled icon={<HeartIcon />} />
                <IconButton destructive icon={<DeleteIcon />} />
                <IconButton loading icon={<DownloadIcon />} />
                <IconButton disabled icon={<SettingsIcon />} />
            </div>
            <div style={{display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap'}}>
                <IconButton rounded icon={<AddIcon />} />
                <IconButton showCount count={5} icon={<StarIcon />} />
                <IconButton unread icon={<MenuIcon />} />
                <IconButton padding='compact' icon={<SearchIcon />} />
            </div>
        </div>
    ),
};
