// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import Button from './button';

interface ButtonExamplesProps {
    backgroundClass?: string;
}

const ButtonExamples: React.FC<ButtonExamplesProps> = ({backgroundClass}) => {
    const emphasesTypes = ['primary', 'secondary', 'tertiary', 'quaternary', 'link'] as const;
    const sizes = ['xs', 'sm', 'md', 'lg'] as const;

    return (
        <div className={`ButtonExamples ${backgroundClass || ''}`}>
            <div style={{padding: '20px'}}>
                <h3 style={{marginBottom: '24px'}}>Button Component - All Variations</h3>
                
                {/* All Emphasis Types in All Sizes */}
                <div style={{marginBottom: '32px'}}>
                    <h4 style={{marginBottom: '16px'}}>All Emphasis Types × All Sizes</h4>
                    {emphasesTypes.map((emphasis) => (
                        <div key={emphasis} style={{marginBottom: '16px'}}>
                            <h5 style={{marginBottom: '8px', textTransform: 'capitalize', fontSize: '12px', fontWeight: 600}}>{emphasis}</h5>
                            <div style={{display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap'}}>
                                {sizes.map((size) => (
                                    <Button key={size} emphasis={emphasis} size={size}>
                                        {size.toUpperCase()}
                                    </Button>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>

                {/* All States for Each Emphasis Type */}
                <div style={{marginBottom: '32px'}}>
                    <h4 style={{marginBottom: '16px'}}>All States × All Emphasis Types</h4>
                    {emphasesTypes.map((emphasis) => (
                        <div key={emphasis} style={{marginBottom: '16px'}}>
                            <h5 style={{marginBottom: '8px', textTransform: 'capitalize', fontSize: '12px', fontWeight: 600}}>{emphasis}</h5>
                            <div style={{display: 'flex', gap: '8px', flexWrap: 'wrap'}}>
                                <Button emphasis={emphasis}>Default</Button>
                                <Button emphasis={emphasis} disabled>Disabled</Button>
                                <Button emphasis={emphasis} loading>Loading</Button>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Destructive Variants */}
                <div style={{marginBottom: '32px'}}>
                    <h4 style={{marginBottom: '16px'}}>Destructive Variants</h4>
                    {emphasesTypes.map((emphasis) => (
                        <div key={emphasis} style={{marginBottom: '16px'}}>
                            <h5 style={{marginBottom: '8px', textTransform: 'capitalize', fontSize: '12px', fontWeight: 600}}>{emphasis}</h5>
                            <div style={{display: 'flex', gap: '8px', flexWrap: 'wrap'}}>
                                <Button emphasis={emphasis} destructive>Destructive</Button>
                                <Button emphasis={emphasis} destructive disabled>Destructive Disabled</Button>
                                <Button emphasis={emphasis} destructive loading>Destructive Loading</Button>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Icon Combinations */}
                <div style={{marginBottom: '32px'}}>
                    <h4 style={{marginBottom: '16px'}}>Icon Combinations</h4>
                    <div style={{display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '12px'}}>
                        <Button emphasis="primary" iconBefore={<i className="icon icon-plus"/>}>Icon Before</Button>
                        <Button emphasis="secondary" iconAfter={<i className="icon icon-chevron-right"/>}>Icon After</Button>
                        <Button emphasis="tertiary" iconBefore={<i className="icon icon-download"/>} iconAfter={<i className="icon icon-chevron-down"/>}>Both Icons</Button>
                        <Button emphasis="quaternary" iconBefore={<i className="icon icon-close"/>}></Button>
                        <Button emphasis="primary" iconAfter={<i className="icon icon-settings"/>}></Button>
                    </div>
                    <div style={{display: 'flex', gap: '8px', flexWrap: 'wrap'}}>
                        <Button emphasis="primary" iconBefore={<i className="icon icon-plus"/>} loading>Icon + Loading</Button>
                        <Button emphasis="secondary" iconBefore={<i className="icon icon-plus"/>} disabled>Icon + Disabled</Button>
                        <Button emphasis="primary" iconBefore={<i className="icon icon-trash"/>} destructive>Icon + Destructive</Button>
                    </div>
                </div>

                {/* Full Width Variants */}
                <div style={{marginBottom: '32px'}}>
                    <h4 style={{marginBottom: '16px'}}>Full Width Variants</h4>
                    <div style={{marginBottom: '8px'}}>
                        <Button emphasis="primary" fullWidth>Primary Full Width</Button>
                    </div>
                    <div style={{marginBottom: '8px'}}>
                        <Button emphasis="secondary" fullWidth>Secondary Full Width</Button>
                    </div>
                    <div style={{marginBottom: '8px'}}>
                        <Button emphasis="tertiary" fullWidth iconBefore={<i className="icon icon-plus"/>}>Tertiary Full Width with Icon</Button>
                    </div>
                    <div style={{marginBottom: '8px'}}>
                        <Button emphasis="primary" fullWidth loading>Primary Full Width Loading</Button>
                    </div>
                </div>

                {/* Inverted Styles */}
                <div style={{backgroundColor: '#1e325c', padding: '20px', borderRadius: '8px', marginBottom: '32px'}}>
                    <h4 style={{color: 'white', margin: '0 0 16px 0'}}>Inverted Styles (Dark Background)</h4>
                    
                    <div style={{marginBottom: '16px'}}>
                        <h5 style={{color: 'white', marginBottom: '8px', fontSize: '12px', fontWeight: 600}}>All Emphasis Types</h5>
                        <div style={{display: 'flex', gap: '8px', flexWrap: 'wrap'}}>
                            {emphasesTypes.map((emphasis) => (
                                <Button key={emphasis} emphasis={emphasis} inverted>
                                    {emphasis}
                                </Button>
                            ))}
                        </div>
                    </div>

                    <div style={{marginBottom: '16px'}}>
                        <h5 style={{color: 'white', marginBottom: '8px', fontSize: '12px', fontWeight: 600}}>States</h5>
                        <div style={{display: 'flex', gap: '8px', flexWrap: 'wrap'}}>
                            <Button emphasis="primary" inverted>Default</Button>
                            <Button emphasis="primary" inverted disabled>Disabled</Button>
                            <Button emphasis="primary" inverted loading>Loading</Button>
                        </div>
                    </div>

                    <div style={{marginBottom: '16px'}}>
                        <h5 style={{color: 'white', marginBottom: '8px', fontSize: '12px', fontWeight: 600}}>Sizes</h5>
                        <div style={{display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap'}}>
                            {sizes.map((size) => (
                                <Button key={size} emphasis="primary" inverted size={size}>
                                    {size.toUpperCase()}
                                </Button>
                            ))}
                        </div>
                    </div>

                    <div>
                        <h5 style={{color: 'white', marginBottom: '8px', fontSize: '12px', fontWeight: 600}}>With Icons</h5>
                        <div style={{display: 'flex', gap: '8px', flexWrap: 'wrap'}}>
                            <Button emphasis="primary" inverted iconBefore={<i className="icon icon-plus"/>}>Add</Button>
                            <Button emphasis="secondary" inverted iconAfter={<i className="icon icon-chevron-right"/>}>Next</Button>
                            <Button emphasis="tertiary" inverted iconBefore={<i className="icon icon-settings"/>} iconAfter={<i className="icon icon-chevron-down"/>}>Settings</Button>
                        </div>
                    </div>
                </div>

                {/* Edge Cases & Combinations */}
                <div style={{marginBottom: '32px'}}>
                    <h4 style={{marginBottom: '16px'}}>Edge Cases & Special Combinations</h4>
                    <div style={{display: 'flex', gap: '8px', flexWrap: 'wrap'}}>
                        <Button emphasis="primary" size="xs" iconBefore={<i className="icon icon-plus"/>}>XS + Icon</Button>
                        <Button emphasis="link" size="lg">Large Link</Button>
                        <Button emphasis="quaternary" destructive iconBefore={<i className="icon icon-trash"/>}>Delete</Button>
                        <Button emphasis="primary" fullWidth iconBefore={<i className="icon icon-save"/>} loading>Saving...</Button>
                        <Button emphasis="secondary" size="xs">Tiny</Button>
                        <Button emphasis="tertiary" size="lg" iconAfter={<i className="icon icon-external-link"/>}>External</Button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ButtonExamples;
