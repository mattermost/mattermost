// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Meta, StoryObj} from '@storybook/react';
import React from 'react';

import Tag from './tag';
 import TagGroup from './tag_group';
import {BetaTag, BotTag, GuestTag} from './tag_presets';

import WithTooltip from '../with_tooltip';

// Mock Compass Icon for demonstration
const MockIcon = ({size = 16}: {size?: number}) => (
    <svg width={size} height={size} viewBox='0 0 24 24' fill='currentColor'>
        <path d='M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z'/>
    </svg>
);

const meta: Meta<typeof Tag> = {
    title: 'DesignSystem/Primitives/Tag',
    component: Tag,
    tags: ['autodocs'],
    argTypes: {
        text: {
            control: 'text',
            description: 'The text content of the tag',
        },
        variant: {
            control: 'select',
            options: ['default', 'info', 'success', 'warning', 'danger', 'dangerDim', 'primary', 'secondary'],
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
        fullWidth: {
            control: 'boolean',
            description: 'Whether the tag should take full width',
        },
        onClick: {
            action: 'clicked',
            description: 'Click handler for interactive tags',
        },
    },
};

export default meta;
type Story = StoryObj<typeof Tag>;

// Basic Examples
export const Default: Story = {
    render: () => (
        <div style={{padding: '20px', background: '#f0f0f0'}}>
            <Tag text='Default Tag' variant='default' size='xs' />
        </div>
    ),
};

export const Info: Story = {
    render: () => (
        <div style={{padding: '20px', background: '#f0f0f0'}}>
            <Tag text='Info' variant='info' size='sm' uppercase={true} />
        </div>
    ),
};

export const Success: Story = {
    render: () => (
        <div style={{padding: '20px', background: '#f0f0f0'}}>
            <Tag text='Success' variant='success' size='sm' uppercase={true} />
        </div>
    ),
};

export const Warning: Story = {
    render: () => (
        <div style={{padding: '20px', background: '#f0f0f0'}}>
            <Tag text='Warning' variant='warning' size='sm' uppercase={true} />
        </div>
    ),
};

export const Danger: Story = {
    render: () => (
        <div style={{padding: '20px', background: '#f0f0f0'}}>
            <Tag text='Danger' variant='danger' size='sm' uppercase={true} />
        </div>
    ),
};

export const DangerDim: Story = {
    render: () => (
        <div style={{padding: '20px', background: '#f0f0f0'}}>
            <Tag text='Danger Dim' variant='dangerDim' size='sm' uppercase={true} />
        </div>
    ),
};

// Size Variants
export const Sizes: Story = {
    render: () => (
        <div style={{display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap'}}>
            <Tag text='Extra Small' size='xs' variant='info'/>
            <Tag text='Small' size='sm' variant='info'/>
            <Tag text='Medium' size='md' variant='info'/>
            <Tag text='Large' size='lg' variant='info'/>
        </div>
    ),
};

// All Variants
export const AllVariants: Story = {
    render: () => (
        <div style={{display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap'}}>
            <Tag text='Default' variant='default' size='sm' uppercase={true}/>
            <Tag text='Primary' variant='primary' size='sm' uppercase={true}/>
            <Tag text='Info' variant='info' size='sm' uppercase={true}/>
            <Tag text='Success' variant='success' size='sm' uppercase={true}/>
            <Tag text='Warning' variant='warning' size='sm' uppercase={true}/>
            <Tag text='Danger' variant='danger' size='sm' uppercase={true}/>
            <Tag text='Danger Dim' variant='dangerDim' size='sm' uppercase={true}/>
        </div>
    ),
};

// Preset Tags
export const BetaTagStory: Story = {
    name: 'Preset: Beta',
    render: () => (
        <div style={{display: 'flex', gap: '8px', alignItems: 'center'}}>
            <BetaTag size='xs'/>
            <BetaTag size='sm'/>
            <BetaTag size='md'/>
            <BetaTag size='lg'/>
        </div>
    ),
};

export const BotTagStory: Story = {
    name: 'Preset: Bot',
    render: () => (
        <div style={{display: 'flex', gap: '8px', alignItems: 'center'}}>
            <BotTag size='xs'/>
            <BotTag size='sm'/>
            <BotTag size='md'/>
            <BotTag size='lg'/>
        </div>
    ),
};

export const GuestTagStory: Story = {
    name: 'Preset: Guest',
    render: () => (
        <div style={{display: 'flex', gap: '8px', alignItems: 'center'}}>
            <GuestTag size='xs'/>
            <GuestTag size='sm'/>
            <GuestTag size='md'/>
            <GuestTag size='lg'/>
        </div>
    ),
};

// With Icon
export const WithIcon: Story = {
    render: () => (
        <div style={{display: 'flex', gap: '12px', flexDirection: 'column', alignItems: 'flex-start'}}>
            <Tag text='With Icon' icon={<MockIcon size={12}/>} variant='success' size='xs'/>
            <Tag text='With Icon' icon={<MockIcon size={16}/>} variant='success' size='sm'/>
            <Tag text='With Icon' icon={<MockIcon size={18}/>} variant='info' size='md'/>
            <Tag text='With Icon' icon={<MockIcon size={20}/>} variant='warning' size='lg'/>
        </div>
    ),
};

// Clickable
export const Clickable: Story = {
    render: () => (
        <div style={{padding: '20px', background: '#f0f0f0'}}>
            <div style={{display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap'}}>
                <Tag
                    text='Click Me'
                    variant='info'
                    size='sm'
                    uppercase={true}
                    // eslint-disable-next-line no-alert
                    onClick={() => alert('Tag clicked!')}
                />
                <Tag
                    text='Clickable with Icon'
                    icon={<MockIcon size={18}/>}
                    variant='success'
                    size='md'
                    uppercase={true}
                    // eslint-disable-next-line no-alert
                    onClick={() => alert('Tag with icon clicked!')}
                />
            </div>
        </div>
    ),
};

// With Tooltip
export const WithTooltipStory: Story = {
    name: 'With Tooltip',
    render: () => (
        <div style={{padding: '20px', background: '#f0f0f0'}}>
            <div style={{display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap'}}>
                <WithTooltip title='This is additional information about the tag'>
                    <Tag
                        text='Hover Me'
                        variant='info'
                        size='md'
                        uppercase={true}
                    />
                </WithTooltip>
                <WithTooltip title='Additional user context information'>
                    <Tag
                        text='User Info'
                        variant='success'
                        size='sm'
                    />
                </WithTooltip>
            </div>
        </div>
    ),
};

// Long Text Overflow
export const LongTextOverflow: Story = {
    render: () => (
        <div style={{maxWidth: '200px', padding: '20px', border: '1px dashed #ccc'}}>
            <Tag
                text='This is a very long tag text that will overflow'
                variant='info'
                size='sm'
            />
        </div>
    ),
};

// Full Width
export const FullWidth: Story = {
    render: () => (
        <div style={{width: '300px', padding: '20px', border: '1px dashed #ccc'}}>
            <Tag
                text='Full Width Tag'
                variant='primary'
                size='md'
                fullWidth={true}
            />
        </div>
    ),
};

// Tag Group Examples
export const TagGroupExample: Story = {
    render: () => (
        <TagGroup>
            <BetaTag size='sm'/>
            <BotTag size='sm'/>
            <GuestTag size='sm'/>
            <Tag text='Custom' variant='warning' size='sm' uppercase={true}/>
        </TagGroup>
    ),
};

export const TagGroupWithIcons: Story = {
    render: () => (
        <TagGroup>
            <Tag text='Active' icon={<MockIcon size={16}/>} variant='success' size='sm'/>
            <Tag text='Pending' icon={<MockIcon size={16}/>} variant='warning' size='sm'/>
            <Tag text='Error' icon={<MockIcon size={16}/>} variant='danger' size='sm'/>
        </TagGroup>
    ),
};

// Mixed Sizes in Group
export const MixedSizesInGroup: Story = {
    render: () => (
        <TagGroup>
            <Tag text='XS' variant='info' size='xs'/>
            <Tag text='Small' variant='success' size='sm'/>
            <Tag text='Medium' variant='warning' size='md'/>
            <Tag text='Large' variant='danger' size='lg'/>
        </TagGroup>
    ),
};

// Real-World Use Cases
export const StatusIndicators: Story = {
    name: 'Example: Status Indicators',
    render: () => (
        <div style={{padding: '20px'}}>
            <TagGroup>
                <Tag text='Online' icon={<MockIcon size={16}/>} variant='success' size='sm'/>
                <Tag text='Away' icon={<MockIcon size={16}/>} variant='warning' size='sm'/>
                <Tag text='Do Not Disturb' icon={<MockIcon size={16}/>} variant='danger' size='sm'/>
                <Tag text='Offline' variant='default' size='sm'/>
            </TagGroup>
        </div>
    ),
};

export const ChannelTags: Story = {
    name: 'Example: Channel Tags',
    render: () => (
        <div style={{padding: '20px'}}>
            <div style={{display: 'flex', flexDirection: 'column', gap: '16px'}}>
                <div style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
                    <span style={{fontWeight: 'bold'}}>general</span>
                    <Tag text='Public' variant='info' size='xs'/>
                </div>
                <div style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
                    <span style={{fontWeight: 'bold'}}>engineering</span>
                    <Tag text='Private' variant='default' size='xs'/>
                </div>
                <div style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
                    <span style={{fontWeight: 'bold'}}>announcements</span>
                    <Tag text='Read-Only' variant='warning' size='xs'/>
                </div>
                <div style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
                    <span style={{fontWeight: 'bold'}}>archived-project</span>
                    <Tag text='Archived' variant='default' size='xs'/>
                </div>
            </div>
        </div>
    ),
};

export const UserBadges: Story = {
    name: 'Example: User Badges',
    render: () => (
        <div style={{padding: '20px'}}>
            <div style={{display: 'flex', flexDirection: 'column', gap: '16px'}}>
                <div style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
                    <span>john.doe</span>
                    <TagGroup>
                        <BotTag size='xs'/>
                        <Tag text='Admin' variant='primary' size='xs' uppercase={true}/>
                    </TagGroup>
                </div>
                <div style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
                    <span>jane.smith</span>
                    <TagGroup>
                        <GuestTag size='xs'/>
                    </TagGroup>
                </div>
                <div style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
                    <span>assistant</span>
                    <TagGroup>
                        <BotTag size='xs'/>
                    </TagGroup>
                </div>
                <div style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
                    <span>new-feature</span>
                    <TagGroup>
                        <BetaTag size='xs'/>
                    </TagGroup>
                </div>
            </div>
        </div>
    ),
};

export const MessageActions: Story = {
    name: 'Example: Message Actions',
    render: () => (
        <div style={{padding: '20px', background: '#fff', borderRadius: '4px', border: '1px solid #ddd'}}>
            <div style={{marginBottom: '12px'}}>
                <strong>john.doe</strong>
                <span style={{color: '#888', marginLeft: '8px', fontSize: '12px'}}>2:30 PM</span>
            </div>
            <div style={{marginBottom: '12px'}}>
                Hey team, the new authentication system is ready for testing!
            </div>
            <TagGroup>
                <Tag text='Pinned' icon={<MockIcon size={12}/>} variant='info' size='xs'/>
                <Tag text='Edited' variant='default' size='xs'/>
            </TagGroup>
        </div>
    ),
};

export const FeatureFlags: Story = {
    name: 'Example: Feature Flags',
    render: () => (
        <div style={{padding: '20px'}}>
            <div style={{display: 'flex', flexDirection: 'column', gap: '12px'}}>
                <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px', border: '1px solid #ddd', borderRadius: '4px'}}>
                    <div>
                        <div style={{fontWeight: 'bold', marginBottom: '4px'}}>AI Assistant</div>
                        <div style={{fontSize: '12px', color: '#888'}}>Enable AI-powered chat assistance</div>
                    </div>
                    <BetaTag size='sm'/>
                </div>
                <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px', border: '1px solid #ddd', borderRadius: '4px'}}>
                    <div>
                        <div style={{fontWeight: 'bold', marginBottom: '4px'}}>New Message Editor</div>
                        <div style={{fontSize: '12px', color: '#888'}}>Try the redesigned message composer</div>
                    </div>
                    <Tag text='Experimental' variant='warning' size='sm' uppercase={true}/>
                </div>
                <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px', border: '1px solid #ddd', borderRadius: '4px'}}>
                    <div>
                        <div style={{fontWeight: 'bold', marginBottom: '4px'}}>Video Calls</div>
                        <div style={{fontSize: '12px', color: '#888'}}>Start video calls from channels</div>
                    </div>
                    <Tag text='Stable' variant='success' size='sm' uppercase={true}/>
                </div>
            </div>
        </div>
    ),
};

// Backward compatibility removed - all consumers use new size names (xs, sm, md, lg)

