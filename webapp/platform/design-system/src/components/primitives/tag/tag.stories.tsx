// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Meta, StoryObj} from '@storybook/react';
import React from 'react';

import * as CompassIcons from '@mattermost/compass-icons/components';

import Tag from './tag';

// Get all available compass icons dynamically
const iconOptions = ['None', ...Object.keys(CompassIcons).sort()];

// Type for Storybook args that allows string icon names
type TagStoryArgs = Omit<React.ComponentProps<typeof Tag>, 'icon'> & {
    icon?: string;
};

const meta: Meta<TagStoryArgs> = {
    title: 'DesignSystem/Primitives/Tag',
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    component: Tag as any,
    tags: ['autodocs'],
    render: (args: TagStoryArgs) => {
        const {icon, onClick, ...rest} = args;

        // Convert icon string to icon name (remove 'Icon' suffix if present)
        let iconName;
        if (icon && icon !== 'None') {
            // CompassIcons keys end with 'Icon' (e.g., 'CheckIcon')
            // but Tag component expects the name without suffix (e.g., 'check')
            iconName = icon.
                replace(/Icon$/, ''). // Remove 'Icon' suffix
                replace(/([A-Z])/g, '-$1'). // Convert camelCase to kebab-case
                toLowerCase().
                replace(/^-/, ''); // Remove leading dash
        }

        return (
            <Tag
                {...rest}
                icon={iconName as never}
                onClick={onClick}
            />
        );
    },
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
            options: ['xs', 'sm', 'md'],
            description: 'The size of the tag',
        },
        uppercase: {
            control: 'boolean',
            description: 'Whether to display text in uppercase',
        },
        icon: {
            control: 'select',
            options: iconOptions,
            description: 'Icon to display in the tag',
        },
        onClick: {
            action: 'clicked',
            description: 'Click handler for interactive tags',
        },
    },
};

export default meta;
type Story = StoryObj<TagStoryArgs>;

export const Default: Story = {
    args: {
        text: 'Default Tag',
        variant: 'default',
        size: 'sm',
        uppercase: false,
        onClick: undefined,
    },
};

export const Info: Story = {
    args: {
        text: 'Info',
        variant: 'info',
        size: 'sm',
        uppercase: true,
        onClick: undefined,
    },
};

export const Success: Story = {
    args: {
        text: 'Success',
        variant: 'success',
        size: 'sm',
        uppercase: true,
        onClick: undefined,
    },
};

export const Warning: Story = {
    args: {
        text: 'Warning',
        variant: 'warning',
        size: 'sm',
        uppercase: true,
        onClick: undefined,
    },
};

export const Danger: Story = {
    args: {
        text: 'Danger',
        variant: 'danger',
        size: 'sm',
        uppercase: true,
        onClick: undefined,
    },
};

export const DangerDim: Story = {
    args: {
        text: 'Danger Dim',
        variant: 'dangerDim',
        size: 'sm',
        uppercase: true,
        onClick: undefined,
    },
};

export const Sizes: Story = {
    render: () => (
        <div style={{display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap'}}>
            <Tag
                text='Extra Small'
                size='xs'
                variant='default'
            />
            <Tag
                text='Small'
                size='sm'
                variant='default'
            />
            <Tag
                text='Medium'
                size='md'
                variant='default'
            />
        </div>
    ),
    parameters: {
        controls: {
            disable: true,
        },
    },
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
    parameters: {
        controls: {
            disable: true,
        },
    },
};

export const WithIcon: Story = {
    args: {
        text: 'With Icon',
        variant: 'default',
        size: 'sm',
        icon: 'CheckIcon',
        uppercase: false,
        onClick: undefined,
    },
};

export const Clickable: Story = {
    args: {
        text: 'Click Me',
        variant: 'default',
        size: 'sm',
        uppercase: false,
        // eslint-disable-next-line no-alert
        onClick: () => alert('Tag clicked!'),
    },
};

export const ClickableVariants: Story = {
    render: () => (
        <div style={{display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap'}}>
            <Tag
                text='Default'
                variant='default'
                size='sm'
                uppercase={true}
                // eslint-disable-next-line no-alert
                onClick={() => alert('Default clicked!')}
            />
            <Tag
                text='Info'
                variant='info'
                size='sm'
                uppercase={true}
                // eslint-disable-next-line no-alert
                onClick={() => alert('Info clicked!')}
            />
            <Tag
                text='Success'
                variant='success'
                size='sm'
                uppercase={true}
                // eslint-disable-next-line no-alert
                onClick={() => alert('Success clicked!')}
            />
            <Tag
                text='Warning'
                variant='warning'
                size='sm'
                uppercase={true}
                // eslint-disable-next-line no-alert
                onClick={() => alert('Warning clicked!')}
            />
            <Tag
                text='Danger'
                variant='danger'
                size='sm'
                uppercase={true}
                // eslint-disable-next-line no-alert
                onClick={() => alert('Danger clicked!')}
            />
            <Tag
                text='Danger Dim'
                variant='dangerDim'
                size='sm'
                uppercase={true}
                // eslint-disable-next-line no-alert
                onClick={() => alert('Danger Dim clicked!')}
            />
        </div>
    ),
    parameters: {
        controls: {
            disable: true,
        },
    },
};
