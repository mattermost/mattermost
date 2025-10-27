// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Meta, StoryObj} from '@storybook/react';
import React from 'react';

import * as CompassIcons from '@mattermost/compass-icons/components';

import Button from './button';

// Get all available compass icons dynamically
const iconOptions = ['None', ...Object.keys(CompassIcons).sort()];

const meta: Meta<typeof Button> = {
    title: 'DesignSystem/Primitives/Button',
    component: Button,
    tags: ['autodocs'],
    render: (args) => {
        const {iconBefore, iconAfter, ...rest} = args;

        let iconBeforeElement;
        if (iconBefore && iconBefore !== 'None') {
            const IconBeforeComponent = CompassIcons[iconBefore as keyof typeof CompassIcons] as React.ComponentType;
            iconBeforeElement = <IconBeforeComponent />;
        }

        let iconAfterElement;
        if (iconAfter && iconAfter !== 'None') {
            const IconAfterComponent = CompassIcons[iconAfter as keyof typeof CompassIcons] as React.ComponentType;
            iconAfterElement = <IconAfterComponent />;
        }

        return (
            <Button
                {...rest}
                iconBefore={iconBeforeElement}
                iconAfter={iconAfterElement}
            />
        );
    },
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
        iconBefore: {
            control: 'select',
            options: iconOptions,
            description: 'Icon to display before the button text',
        },
        iconAfter: {
            control: 'select',
            options: iconOptions,
            description: 'Icon to display after the button text',
        },
    },
};

export default meta;
type Story = StoryObj<typeof Button>;

export const Default: Story = {
    args: {
        children: 'Default Button',
        size: 'md',
        emphasis: 'primary',
        inverted: false,
        destructive: false,
        loading: false,
        disabled: false,
        fullWidth: false,
        width: undefined,
    },
};
export const ExtraSmall: Story = {
    args: {
        children: 'Extra Small Button',
        size: 'xs',

    },
    parameters: {
        controls: {
            exclude: ['size'],
        },
    },
};

export const Small: Story = {
    args: {
        children: 'Small Button',
        size: 'sm',
    },
    parameters: {
        controls: {
            exclude: ['size'],
        },
    },
};

export const Medium: Story = {
    args: {
        children: 'Medium Button',
        size: 'md',
    },
    parameters: {
        controls: {
            exclude: ['size'],
        },
    },
};

export const Large: Story = {
    args: {
        children: 'Large Button',
        size: 'lg',
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
            <Button size='xs'>Extra Small</Button>
            <Button size='sm'>Small</Button>
            <Button size='md'>Medium</Button>
            <Button size='lg'>Large</Button>
        </div>
    ),
    parameters: {
        controls: {disable: true},
    },
};

export const Primary: Story = {
    args: {
        children: 'Primary Button',
        emphasis: 'primary',
    },
    parameters: {
        controls: {
            exclude: ['emphasis'],
        },
    },
};

export const Secondary: Story = {
    args: {
        children: 'Secondary Button',
        emphasis: 'secondary',
    },
    parameters: {
        controls: {
            exclude: ['emphasis'],
        },
    },
};

export const Tertiary: Story = {
    args: {
        children: 'Tertiary Button',
        emphasis: 'tertiary',
    },
    parameters: {
        controls: {
            exclude: ['emphasis'],
        },
    },
};

export const Quaternary: Story = {
    args: {
        children: 'Quaternary Button',
        emphasis: 'quaternary',
    },
    parameters: {
        controls: {
            exclude: ['emphasis'],
        },
    },
};

export const Link: Story = {
    args: {
        children: 'Link Button',
        emphasis: 'link',
    },
    parameters: {
        controls: {
            exclude: ['emphasis'],
        },
    },
};

//Emphasis levels
export const AllEmphasis: Story = {
    render: () => (
        <div style={{display: 'flex', gap: '12px', alignItems: 'center'}}>
            <Button emphasis='primary'>Primary</Button>
            <Button emphasis='secondary'>Secondary</Button>
            <Button emphasis='tertiary'>Tertiary</Button>
            <Button emphasis='quaternary'>Quaternary</Button>
            <Button emphasis='link'>Link</Button>
        </div>
    ),
    parameters: {
        controls: {disable: true},
    },
};

// States
export const Destructive: Story = {
    args: {
        children: 'Delete',
        destructive: true,
    },
    parameters: {
        controls: {
            exclude: ['destructive'],
        },
    },
};

export const Loading: Story = {
    args: {
        children: 'Loading',
        loading: true,
    },
    parameters: {
        controls: {
            exclude: ['loading'],
        },
    },
};

export const Disabled: Story = {
    args: {
        children: 'Disabled',
        disabled: true,
    },
    parameters: {
        controls: {
            exclude: ['disabled'],
        },
    },
};

// Layout
export const FullWidth: Story = {
    args: {
        children: 'Full Width Button',
        fullWidth: true,
    },
    parameters: {
        controls: {
            exclude: ['fullWidth'],
        },
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
            <div style={{backgroundColor: '#1E325C', padding: '20px'}}>
                <Story />
            </div>
        ),
    ],
    parameters: {
        controls: {
            exclude: ['inverted'],
        },
    },
};

// With icons
export const WithIcons: Story = {
    args: {
        iconBefore: 'CheckIcon',
        iconAfter: 'None',
        children: 'With Icons',
        emphasis: 'primary',
    },
    parameters: {
        controls: {
            include: ['children', 'iconBefore', 'iconAfter', 'emphasis', 'size', 'disabled'],
        },
    },
};
