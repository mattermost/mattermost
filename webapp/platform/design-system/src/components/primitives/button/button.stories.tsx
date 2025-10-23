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

// Loading spinner showcase - all sizes and variations
export const LoadingSpinners: Story = {
    render: () => (
        <div style={{display: 'flex', flexDirection: 'column', gap: '24px'}}>
            <div>
                <h3 style={{marginBottom: '12px', fontSize: '16px', fontWeight: 'bold'}}>Loading Spinners - All Sizes</h3>
                <div style={{display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap'}}>
                    <Button size='xs' loading>Extra Small</Button>
                    <Button size='sm' loading>Small</Button>
                    <Button size='md' loading>Medium</Button>
                    <Button size='lg' loading>Large</Button>
                </div>
            </div>

            <div>
                <h3 style={{marginBottom: '12px', fontSize: '16px', fontWeight: 'bold'}}>Loading Spinners - All Emphasis Levels</h3>
                <div style={{display: 'flex', gap: '12px', flexWrap: 'wrap'}}>
                    <Button emphasis='primary' loading>Primary Loading</Button>
                    <Button emphasis='secondary' loading>Secondary Loading</Button>
                    <Button emphasis='tertiary' loading>Tertiary Loading</Button>
                    <Button emphasis='quaternary' loading>Quaternary Loading</Button>
                    <Button emphasis='link' loading>Link Loading</Button>
                </div>
            </div>

            <div>
                <h3 style={{marginBottom: '12px', fontSize: '16px', fontWeight: 'bold'}}>Destructive Loading States</h3>
                <div style={{display: 'flex', gap: '12px', flexWrap: 'wrap'}}>
                    <Button emphasis='primary' destructive loading>Delete All</Button>
                    <Button emphasis='secondary' destructive loading>Remove</Button>
                    <Button emphasis='tertiary' destructive loading>Clear</Button>
                    <Button emphasis='quaternary' destructive loading>Reset</Button>
                </div>
            </div>

            <div>
                <h3 style={{marginBottom: '12px', fontSize: '16px', fontWeight: 'bold'}}>Loading with Icons (Icons Hidden During Loading)</h3>
                <div style={{display: 'flex', gap: '12px', flexWrap: 'wrap'}}>
                    <Button loading iconBefore={<span>📁</span>}>Save File</Button>
                    <Button loading iconAfter={<span>→</span>}>Continue</Button>
                    <Button loading iconBefore={<span>✓</span>} iconAfter={<span>→</span>}>Complete</Button>
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
                    <Button size='xs' loading inverted>Extra Small</Button>
                    <Button size='sm' loading inverted>Small</Button>
                    <Button size='md' loading inverted>Medium</Button>
                    <Button size='lg' loading inverted>Large</Button>
                </div>
            </div>

            <div>
                <h3 style={{marginBottom: '12px', fontSize: '16px', fontWeight: 'bold', color: 'white'}}>Inverted Loading - All Emphasis Levels</h3>
                <div style={{display: 'flex', gap: '12px', flexWrap: 'wrap'}}>
                    <Button emphasis='primary' loading inverted>Primary Loading</Button>
                    <Button emphasis='secondary' loading inverted>Secondary Loading</Button>
                    <Button emphasis='tertiary' loading inverted>Tertiary Loading</Button>
                    <Button emphasis='quaternary' loading inverted>Quaternary Loading</Button>
                    <Button emphasis='link' loading inverted>Link Loading</Button>
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

