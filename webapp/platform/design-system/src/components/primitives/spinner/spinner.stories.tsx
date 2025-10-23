// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Meta, StoryObj} from '@storybook/react';
import React from 'react';

import Button from '../button/button';
import IconButton from '../icon_button/icon_button';
import Spinner from './spinner';

// Mock icon components (in real usage, these would be from @mattermost/compass-icons)
const SearchIcon = () => <span>🔍</span>;
const HeartIcon = () => <span>❤️</span>;
const DownloadIcon = () => <span>📥</span>;
const DeleteIcon = () => <span>🗑️</span>;
const SaveIcon = () => <span>💾</span>;

const meta: Meta<typeof Spinner> = {
    title: 'DesignSystem/Primitives/Spinner',
    component: Spinner,
    tags: ['autodocs'],
    argTypes: {
        size: {
            control: 'select',
            options: ['xs', 'sm', 'md', 'lg'],
            description: 'Size of the spinner',
        },
        inverted: {
            control: 'boolean',
            description: 'Whether the spinner should use inverted colors for dark backgrounds',
        },
        forIconButton: {
            control: 'boolean',
            description: 'Whether this spinner is being used in an IconButton (affects sizing)',
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
        size: 'md',
    },
};

export const AllSizes: Story = {
    render: () => (
        <div style={{display: 'flex', gap: '16px', alignItems: 'center'}}>
            <div style={{textAlign: 'center'}}>
                <Spinner size='xs' />
                <div style={{marginTop: '8px', fontSize: '12px'}}>XS (12px)</div>
            </div>
            <div style={{textAlign: 'center'}}>
                <Spinner size='sm' />
                <div style={{marginTop: '8px', fontSize: '12px'}}>SM (14px)</div>
            </div>
            <div style={{textAlign: 'center'}}>
                <Spinner size='md' />
                <div style={{marginTop: '8px', fontSize: '12px'}}>MD (16px)</div>
            </div>
            <div style={{textAlign: 'center'}}>
                <Spinner size='lg' />
                <div style={{marginTop: '8px', fontSize: '12px'}}>LG (20px)</div>
            </div>
        </div>
    ),
};

export const IconButtonSizes: Story = {
    render: () => (
        <div style={{display: 'flex', gap: '16px', alignItems: 'center'}}>
            <div style={{textAlign: 'center'}}>
                <Spinner size='xs' forIconButton />
                <div style={{marginTop: '8px', fontSize: '12px'}}>XS (12px)</div>
            </div>
            <div style={{textAlign: 'center'}}>
                <Spinner size='sm' forIconButton />
                <div style={{marginTop: '8px', fontSize: '12px'}}>SM (16px)</div>
            </div>
            <div style={{textAlign: 'center'}}>
                <Spinner size='md' forIconButton />
                <div style={{marginTop: '8px', fontSize: '12px'}}>MD (20px)</div>
            </div>
            <div style={{textAlign: 'center'}}>
                <Spinner size='lg' forIconButton />
                <div style={{marginTop: '8px', fontSize: '12px'}}>LG (24px)</div>
            </div>
        </div>
    ),
};

export const Inverted: Story = {
    render: () => (
        <div style={{display: 'flex', gap: '16px', alignItems: 'center'}}>
            <div style={{textAlign: 'center'}}>
                <Spinner size='xs' inverted />
                <div style={{marginTop: '8px', fontSize: '12px', color: 'white'}}>XS Inverted</div>
            </div>
            <div style={{textAlign: 'center'}}>
                <Spinner size='sm' inverted />
                <div style={{marginTop: '8px', fontSize: '12px', color: 'white'}}>SM Inverted</div>
            </div>
            <div style={{textAlign: 'center'}}>
                <Spinner size='md' inverted />
                <div style={{marginTop: '8px', fontSize: '12px', color: 'white'}}>MD Inverted</div>
            </div>
            <div style={{textAlign: 'center'}}>
                <Spinner size='lg' inverted />
                <div style={{marginTop: '8px', fontSize: '12px', color: 'white'}}>LG Inverted</div>
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

// Comprehensive showcase comparing Button and IconButton spinners
export const ButtonAndIconButtonComparison: Story = {
    render: () => (
        <div style={{display: 'flex', flexDirection: 'column', gap: '32px'}}>
            <div>
                <h2 style={{marginBottom: '20px', fontSize: '18px', fontWeight: 'bold'}}>Loading Spinner Showcase</h2>
                <p style={{marginBottom: '20px', color: '#666', fontSize: '14px'}}>
                    Comprehensive comparison of loading spinners across Button and IconButton components with all sizes and variations.
                </p>
            </div>

            <div>
                <h3 style={{marginBottom: '16px', fontSize: '16px', fontWeight: 'bold'}}>Size Comparison - Button vs IconButton</h3>
                <div style={{display: 'grid', gridTemplateColumns: 'auto 1fr 1fr', gap: '12px', alignItems: 'center'}}>
                    <div style={{fontWeight: 'bold', fontSize: '14px'}}>Size</div>
                    <div style={{fontWeight: 'bold', fontSize: '14px'}}>Button</div>
                    <div style={{fontWeight: 'bold', fontSize: '14px'}}>IconButton</div>
                    
                    <div style={{fontSize: '12px'}}>XS</div>
                    <Button size='xs' loading>Extra Small</Button>
                    <IconButton size='xs' loading icon={<SearchIcon />} />
                    
                    <div style={{fontSize: '12px'}}>SM</div>
                    <Button size='sm' loading>Small</Button>
                    <IconButton size='sm' loading icon={<SearchIcon />} />
                    
                    <div style={{fontSize: '12px'}}>MD</div>
                    <Button size='md' loading>Medium</Button>
                    <IconButton size='md' loading icon={<SearchIcon />} />
                    
                    <div style={{fontSize: '12px'}}>LG</div>
                    <Button size='lg' loading>Large</Button>
                    <IconButton size='lg' loading icon={<SearchIcon />} />
                </div>
            </div>

            <div>
                <h3 style={{marginBottom: '16px', fontSize: '16px', fontWeight: 'bold'}}>Emphasis and State Variations</h3>
                <div style={{display: 'flex', flexDirection: 'column', gap: '16px'}}>
                    <div>
                        <h4 style={{marginBottom: '8px', fontSize: '14px', fontWeight: '600'}}>Primary States</h4>
                        <div style={{display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap'}}>
                            <Button emphasis='primary' loading>Primary Loading</Button>
                            <IconButton loading icon={<SaveIcon />} />
                            <Button emphasis='primary' loading destructive>Delete All</Button>
                            <IconButton loading destructive icon={<DeleteIcon />} />
                        </div>
                    </div>
                    
                    <div>
                        <h4 style={{marginBottom: '8px', fontSize: '14px', fontWeight: '600'}}>Secondary States</h4>
                        <div style={{display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap'}}>
                            <Button emphasis='secondary' loading>Secondary Loading</Button>
                            <Button emphasis='tertiary' loading>Tertiary Loading</Button>
                            <Button emphasis='quaternary' loading>Quaternary Loading</Button>
                            <IconButton loading toggled icon={<HeartIcon />} />
                        </div>
                    </div>
                </div>
            </div>

            <div>
                <h3 style={{marginBottom: '16px', fontSize: '16px', fontWeight: 'bold'}}>Special Features</h3>
                <div style={{display: 'flex', flexDirection: 'column', gap: '16px'}}>
                    <div>
                        <h4 style={{marginBottom: '8px', fontSize: '14px', fontWeight: '600'}}>Icons Hidden During Loading</h4>
                        <div style={{display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap'}}>
                            <Button loading iconBefore={<SaveIcon />}>Save Document</Button>
                            <Button loading iconAfter={<DownloadIcon />}>Download File</Button>
                        </div>
                    </div>
                    
                    <div>
                        <h4 style={{marginBottom: '8px', fontSize: '14px', fontWeight: '600'}}>Count Hidden During Loading</h4>
                        <div style={{display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap'}}>
                            <IconButton loading showCount count={5} icon={<HeartIcon />} />
                            <IconButton loading showCount count={99} icon={<SearchIcon />} />
                        </div>
                    </div>
                </div>
            </div>

            <div>
                <h3 style={{marginBottom: '16px', fontSize: '16px', fontWeight: 'bold'}}>Standalone Spinner Components</h3>
                <div style={{display: 'flex', gap: '20px', alignItems: 'center'}}>
                    <div style={{textAlign: 'center'}}>
                        <Spinner size='xs' />
                        <div style={{marginTop: '4px', fontSize: '10px'}}>Button XS (12px)</div>
                    </div>
                    <div style={{textAlign: 'center'}}>
                        <Spinner size='sm' />
                        <div style={{marginTop: '4px', fontSize: '10px'}}>Button SM (14px)</div>
                    </div>
                    <div style={{textAlign: 'center'}}>
                        <Spinner size='md' />
                        <div style={{marginTop: '4px', fontSize: '10px'}}>Button MD (16px)</div>
                    </div>
                    <div style={{textAlign: 'center'}}>
                        <Spinner size='lg' />
                        <div style={{marginTop: '4px', fontSize: '10px'}}>Button LG (20px)</div>
                    </div>
                    <div style={{width: '2px', height: '30px', backgroundColor: '#ccc'}}></div>
                    <div style={{textAlign: 'center'}}>
                        <Spinner size='xs' forIconButton />
                        <div style={{marginTop: '4px', fontSize: '10px'}}>IconBtn XS (12px)</div>
                    </div>
                    <div style={{textAlign: 'center'}}>
                        <Spinner size='sm' forIconButton />
                        <div style={{marginTop: '4px', fontSize: '10px'}}>IconBtn SM (16px)</div>
                    </div>
                    <div style={{textAlign: 'center'}}>
                        <Spinner size='md' forIconButton />
                        <div style={{marginTop: '4px', fontSize: '10px'}}>IconBtn MD (20px)</div>
                    </div>
                    <div style={{textAlign: 'center'}}>
                        <Spinner size='lg' forIconButton />
                        <div style={{marginTop: '4px', fontSize: '10px'}}>IconBtn LG (24px)</div>
                    </div>
                </div>
            </div>
        </div>
    ),
};

// Inverted showcase for dark backgrounds
export const InvertedShowcase: Story = {
    render: () => (
        <div style={{display: 'flex', flexDirection: 'column', gap: '24px'}}>
            <div>
                <h2 style={{marginBottom: '16px', fontSize: '18px', fontWeight: 'bold', color: 'white'}}>Inverted Spinners (Dark Background)</h2>
                <p style={{marginBottom: '16px', color: '#ccc', fontSize: '14px'}}>
                    All spinner variations optimized for dark backgrounds using inverted colors.
                </p>
            </div>

            <div>
                <h3 style={{marginBottom: '12px', fontSize: '16px', fontWeight: 'bold', color: 'white'}}>Button Inverted Spinners</h3>
                <div style={{display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap'}}>
                    <Button size='xs' loading inverted>Extra Small</Button>
                    <Button size='sm' loading inverted>Small</Button>
                    <Button size='md' loading inverted>Medium</Button>
                    <Button size='lg' loading inverted>Large</Button>
                </div>
            </div>

            <div>
                <h3 style={{marginBottom: '12px', fontSize: '16px', fontWeight: 'bold', color: 'white'}}>IconButton Inverted Spinners</h3>
                <div style={{display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap'}}>
                    <IconButton size='xs' loading inverted icon={<SearchIcon />} />
                    <IconButton size='sm' loading inverted icon={<HeartIcon />} />
                    <IconButton size='md' loading inverted icon={<DownloadIcon />} />
                    <IconButton size='lg' loading inverted icon={<SaveIcon />} />
                </div>
            </div>

            <div>
                <h3 style={{marginBottom: '12px', fontSize: '16px', fontWeight: 'bold', color: 'white'}}>Standalone Inverted Spinners</h3>
                <div style={{display: 'flex', gap: '16px', alignItems: 'center'}}>
                    <Spinner size='xs' inverted />
                    <Spinner size='sm' inverted />
                    <Spinner size='md' inverted />
                    <Spinner size='lg' inverted />
                    <div style={{width: '2px', height: '20px', backgroundColor: '#555'}}></div>
                    <Spinner size='xs' inverted forIconButton />
                    <Spinner size='sm' inverted forIconButton />
                    <Spinner size='md' inverted forIconButton />
                    <Spinner size='lg' inverted forIconButton />
                </div>
            </div>
        </div>
    ),
    decorators: [
        (Story) => (
            <div style={{backgroundColor: '#1e1e1e', padding: '24px'}}>
                <Story />
            </div>
        ),
    ],
};
