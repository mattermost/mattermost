// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Meta, StoryObj} from '@storybook/react';

import Button from './button';

const meta: Meta<typeof Button> = {
    title: 'DesignSystem/Primitives/Button',
    component: Button,
    tags: ['autodocs'],
    argTypes: {
        size: {
            control: 'select',
            options: ['xs', 'sm', 'md', 'lg'],
            description: 'Size variant of the button',
        },
        emphasis: {
            control: 'select',
            options: ['primary', 'secondary', 'tertiary', 'quaternary', 'link'],
            description: 'Emphasis level of the button',
        },
        inverted: {
            control: 'boolean',
            description: 'Visual style variant - inverted for dark backgrounds',
        },
        destructive: {
            control: 'boolean',
            description: 'Whether the button represents a destructive action',
        },
        loading: {
            control: 'boolean',
            description: 'Loading state - shows spinner and disables interaction',
        },
        disabled: {
            control: 'boolean',
            description: 'Whether the button is disabled',
        },
        fullWidth: {
            control: 'boolean',
            description: 'Whether the button should take full width of its container',
        },
    },
};

export default meta;
type Story = StoryObj<typeof Button>;

// Basic button examples
export const Primary: Story = {
    args: {
        children: 'Primary Button',
        emphasis: 'primary',
    },
};

export const Secondary: Story = {
    args: {
        children: 'Secondary Button',
        emphasis: 'secondary',
    },
};

export const Tertiary: Story = {
    args: {
        children: 'Tertiary Button',
        emphasis: 'tertiary',
    },
};

export const Quaternary: Story = {
    args: {
        children: 'Quaternary Button',
        emphasis: 'quaternary',
    },
};

export const Link: Story = {
    args: {
        children: 'Link Button',
        emphasis: 'link',
    },
};

// Sizes
export const Sizes: Story = {
    render: () => (
        <div style={{display: 'flex', gap: '12px', alignItems: 'center'}}>
            <Button size='xs'>Extra Small</Button>
            <Button size='sm'>Small</Button>
            <Button size='md'>Medium</Button>
            <Button size='lg'>Large</Button>
        </div>
    ),
};

// States
export const Destructive: Story = {
    args: {
        children: 'Delete',
        destructive: true,
    },
};

export const Loading: Story = {
    args: {
        children: 'Loading',
        loading: true,
    },
};

export const Disabled: Story = {
    args: {
        children: 'Disabled',
        disabled: true,
    },
};

// Layout
export const FullWidth: Story = {
    args: {
        children: 'Full Width Button',
        fullWidth: true,
    },
};

// Inverted (for dark backgrounds)
export const Inverted: Story = {
    args: {
        children: 'Inverted Button',
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

// With icons (placeholder)
export const WithIcons: Story = {
    render: () => (
        <div style={{display: 'flex', gap: '12px', flexDirection: 'column'}}>
            <Button iconBefore={<span>→</span>}>
                Icon Before
            </Button>
            <Button iconAfter={<span>→</span>}>
                Icon After
            </Button>
            <Button
                iconBefore={<span>✓</span>}
                iconAfter={<span>→</span>}
            >
                Both Icons
            </Button>
        </div>
    ),
};

// All emphasis levels comparison
export const AllEmphasis: Story = {
    render: () => (
        <div style={{display: 'flex', gap: '12px', flexDirection: 'column', maxWidth: '300px'}}>
            <Button emphasis='primary'>Primary</Button>
            <Button emphasis='secondary'>Secondary</Button>
            <Button emphasis='tertiary'>Tertiary</Button>
            <Button emphasis='quaternary'>Quaternary</Button>
            <Button emphasis='link'>Link</Button>
        </div>
    ),
};

