// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Meta, StoryObj} from '@storybook/react';
import React from 'react';

import Spinner from './spinner';

const meta: Meta<typeof Spinner> = {
    title: 'DesignSystem/Primitives/Spinner',
    component: Spinner,
    tags: ['autodocs'],
    argTypes: {
        size: {
            control: 'select',
            options: [10, 12, 16, 20, 24, 28, 32],
            description: 'Size of the spinner in pixels (Figma design system values)',
        },
        inverted: {
            control: 'boolean',
            description: 'Whether the spinner should use inverted colors for dark backgrounds',
        },
        'aria-label': {
            control: 'text',
            description: 'Accessible label for screen readers',
        },
    },
};

export default meta;
type Story = StoryObj<typeof Spinner>;

// Basic spinner examples
export const Default: Story = {
    args: {
        size: 16,
    },
};

export const AllSizes: Story = {
    render: () => (
        <div style={{display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap'}}>
            <div style={{textAlign: 'center'}}>
                <Spinner size={10} />
                <div style={{marginTop: '8px', fontSize: '12px'}}>10px</div>
            </div>
            <div style={{textAlign: 'center'}}>
                <Spinner size={12} />
                <div style={{marginTop: '8px', fontSize: '12px'}}>12px</div>
            </div>
            <div style={{textAlign: 'center'}}>
                <Spinner size={16} />
                <div style={{marginTop: '8px', fontSize: '12px'}}>16px</div>
            </div>
            <div style={{textAlign: 'center'}}>
                <Spinner size={20} />
                <div style={{marginTop: '8px', fontSize: '12px'}}>20px</div>
            </div>
            <div style={{textAlign: 'center'}}>
                <Spinner size={24} />
                <div style={{marginTop: '8px', fontSize: '12px'}}>24px</div>
            </div>
            <div style={{textAlign: 'center'}}>
                <Spinner size={28} />
                <div style={{marginTop: '8px', fontSize: '12px'}}>28px</div>
            </div>
            <div style={{textAlign: 'center'}}>
                <Spinner size={32} />
                <div style={{marginTop: '8px', fontSize: '12px'}}>32px</div>
            </div>
        </div>
    ),
};

export const Inverted: Story = {
    render: () => (
        <div style={{display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap'}}>
            <div style={{textAlign: 'center'}}>
                <Spinner size={12} inverted />
                <div style={{marginTop: '8px', fontSize: '12px', color: 'white'}}>12px</div>
            </div>
            <div style={{textAlign: 'center'}}>
                <Spinner size={16} inverted />
                <div style={{marginTop: '8px', fontSize: '12px', color: 'white'}}>16px</div>
            </div>
            <div style={{textAlign: 'center'}}>
                <Spinner size={20} inverted />
                <div style={{marginTop: '8px', fontSize: '12px', color: 'white'}}>20px</div>
            </div>
            <div style={{textAlign: 'center'}}>
                <Spinner size={24} inverted />
                <div style={{marginTop: '8px', fontSize: '12px', color: 'white'}}>24px</div>
            </div>
            <div style={{textAlign: 'center'}}>
                <Spinner size={28} inverted />
                <div style={{marginTop: '8px', fontSize: '12px', color: 'white'}}>28px</div>
            </div>
            <div style={{textAlign: 'center'}}>
                <Spinner size={32} inverted />
                <div style={{marginTop: '8px', fontSize: '12px', color: 'white'}}>32px</div>
            </div>
        </div>
    ),
    decorators: [
        (Story) => (
            <div style={{backgroundColor: '#1E325C', padding: '20px'}}>
                <Story />
            </div>
        ),
    ],
};
