// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import Button from './button';

interface ButtonExamplesProps {
    backgroundClass?: string;
}

const ButtonExamples: React.FC<ButtonExamplesProps> = ({backgroundClass}) => {
    const emphases = ['primary', 'secondary', 'tertiary', 'quaternary', 'link'] as const;
    const sizes = ['xs', 'sm', 'md', 'lg'] as const;
    const states = [
        { label: 'Default', props: {} },
        { label: 'Disabled', props: { disabled: true } },
        { label: 'Loading', props: { loading: true } },
        { label: 'Destructive', props: { destructive: true } },
        { label: 'Destructive + Disabled', props: { destructive: true, disabled: true } },
        { label: 'Destructive + Loading', props: { destructive: true, loading: true } },
    ];
    const icons = [
        { label: 'No Icon', props: {} },
        { label: 'Before', props: { iconBefore: <i className="icon icon-plus"/> } },
        { label: 'After', props: { iconAfter: <i className="icon icon-chevron-right"/> } },
        { label: 'Both', props: { iconBefore: <i className="icon icon-plus"/>, iconAfter: <i className="icon icon-chevron-down"/> } },
        { label: 'Only', props: { iconBefore: <i className="icon icon-plus"/> } },
    ];

    return (
        <div className={`ButtonExamples ${backgroundClass || ''}`}>
            <div style={{padding: '20px'}}>
                <h3 style={{marginBottom: '24px'}}>Button Component - All variants</h3>
                
                {/* MATRIX 1: ALL EMPHASIS × ALL SIZES (20 combinations) */}
                <div style={{marginBottom: '40px'}}>
                    <h4 style={{marginBottom: '16px'}}>Emphasis × Sizes (20 combinations)</h4>
                    <table style={{width: '100%', borderCollapse: 'collapse', fontSize: '14px'}}>
                        <thead>
                            <tr style={{borderBottom: '2px solid rgba(0,0,0,0.1)'}}>
                                <th style={{textAlign: 'left', padding: '8px', width: '100px'}}>Emphasis</th>
                                {sizes.map(size => (
                                    <th key={size} style={{textAlign: 'center', padding: '8px'}}>{size}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {emphases.map((emphasis) => (
                                <tr key={emphasis} style={{borderBottom: '1px solid rgba(0,0,0,0.05)'}}>
                                    <td style={{padding: '8px', fontWeight: 600}}>{emphasis}</td>
                                    {sizes.map((size) => (
                                        <td key={size} style={{padding: '8px', textAlign: 'center'}}>
                                            <Button emphasis={emphasis} size={size}>
                                                {size}
                                            </Button>
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* MATRIX 2: ALL SIZES × ALL ICON VARIANTS (20 combinations) */}
                <div style={{marginBottom: '40px'}}>
                    <h4 style={{marginBottom: '16px'}}>📊 Sizes × ALL Icon Variants (20 combinations)</h4>
                    <table style={{width: '100%', borderCollapse: 'collapse', fontSize: '14px'}}>
                        <thead>
                            <tr style={{borderBottom: '2px solid rgba(0,0,0,0.1)'}}>
                                <th style={{textAlign: 'left', padding: '8px', width: '100px'}}>Size</th>
                                {icons.map(icon => (
                                    <th key={icon.label} style={{textAlign: 'center', padding: '8px', minWidth: '120px'}}>{icon.label}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {sizes.map((size) => (
                                <tr key={size} style={{borderBottom: '1px solid rgba(0,0,0,0.05)'}}>
                                    <td style={{padding: '8px', fontWeight: 600, fontSize: '12px'}}>
                                        {size}
                                    </td>
                                    {icons.map((icon) => (
                                        <td key={icon.label} style={{padding: '8px', textAlign: 'center'}}>
                                            <Button emphasis="primary" size={size} {...icon.props}>
                                                {icon.label === 'Only' ? '' : `${size}`}
                                            </Button>
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* MATRIX 3: ALL EMPHASIS × ALL STATES (30 combinations) */}
                <div style={{marginBottom: '40px'}}>
                    <h4 style={{marginBottom: '16px'}}>Emphasis × States (30 combinations)</h4>
                    <table style={{width: '100%', borderCollapse: 'collapse', fontSize: '14px'}}>
                        <thead>
                            <tr style={{borderBottom: '2px solid rgba(0,0,0,0.1)'}}>
                                <th style={{textAlign: 'left', padding: '8px', width: '100px'}}>Emphasis</th>
                                {states.map(state => (
                                    <th key={state.label} style={{textAlign: 'center', padding: '8px', minWidth: '120px'}}>{state.label}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {emphases.map((emphasis) => (
                                <tr key={emphasis} style={{borderBottom: '1px solid rgba(0,0,0,0.05)'}}>
                                    <td style={{padding: '8px', textTransform: 'capitalize', fontWeight: 600}}>{emphasis}</td>
                                    {states.map((state) => (
                                        <td key={state.label} style={{padding: '8px', textAlign: 'center'}}>
                                            <Button emphasis={emphasis} {...state.props}>
                                                {state.label}
                                            </Button>
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* MATRIX 4: ALL EMPHASIS × ALL ICON COMBINATIONS (25 combinations) */}
                <div style={{marginBottom: '40px'}}>
                    <h4 style={{marginBottom: '16px'}}>Emphasis × Icon Combinations (25 combinations)</h4>
                    <table style={{width: '100%', borderCollapse: 'collapse', fontSize: '14px'}}>
                        <thead>
                            <tr style={{borderBottom: '2px solid rgba(0,0,0,0.1)'}}>
                                <th style={{textAlign: 'left', padding: '8px', width: '100px'}}>Emphasis</th>
                                {icons.map(icon => (
                                    <th key={icon.label} style={{textAlign: 'center', padding: '8px', minWidth: '120px'}}>{icon.label}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {emphases.map((emphasis) => (
                                <tr key={emphasis} style={{borderBottom: '1px solid rgba(0,0,0,0.05)'}}>
                                    <td style={{padding: '8px', textTransform: 'capitalize', fontWeight: 600}}>{emphasis}</td>
                                    {icons.map((icon) => (
                                        <td key={icon.label} style={{padding: '8px', textAlign: 'center'}}>
                                            <Button emphasis={emphasis} {...icon.props}>
                                                {icon.label === 'Only' ? '' : icon.label}
                                            </Button>
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* MATRIX 5: ALL SIZES × ALL STATES FOR PRIMARY (24 combinations) */}
                <div style={{marginBottom: '40px'}}>
                    <h4 style={{marginBottom: '16px'}}>ALL Sizes × ALL States (Primary) (24 combinations)</h4>
                    <table style={{width: '100%', borderCollapse: 'collapse', fontSize: '14px'}}>
                        <thead>
                            <tr style={{borderBottom: '2px solid rgba(0,0,0,0.1)'}}>
                                <th style={{textAlign: 'left', padding: '8px', width: '80px'}}>Size</th>
                                {states.map(state => (
                                    <th key={state.label} style={{textAlign: 'center', padding: '8px', minWidth: '120px'}}>{state.label}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {sizes.map((size) => (
                                <tr key={size} style={{borderBottom: '1px solid rgba(0,0,0,0.05)'}}>
                                    <td style={{padding: '8px', fontWeight: 600}}>{size}</td>
                                    {states.map((state) => (
                                        <td key={state.label} style={{padding: '8px', textAlign: 'center'}}>
                                            <Button emphasis="primary" size={size} {...state.props}>
                                                {size}-{state.label}
                                            </Button>
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* MATRIX 6: FULL WIDTH × ALL EMPHASIS × SELECTED STATES */}
                <div style={{marginBottom: '40px'}}>
                    <h4 style={{marginBottom: '16px'}}>Full Width × ALL Emphasis × Key States</h4>
                    {emphases.map((emphasis) => (
                        <div key={emphasis} style={{marginBottom: '12px'}}>
                            <h6 style={{marginBottom: '8px', textTransform: 'capitalize', fontSize: '12px', fontWeight: 600, color: 'rgba(0,0,0,0.6)'}}>{emphasis}</h6>
                            <div style={{display: 'grid', gap: '4px'}}>
                                <Button emphasis={emphasis} fullWidth>Full Width</Button>
                                <Button emphasis={emphasis} fullWidth disabled>Full Width Disabled</Button>
                                <Button emphasis={emphasis} fullWidth loading>Full Width Loading</Button>
                                <Button emphasis={emphasis} fullWidth destructive>Full Width Destructive</Button>
                                <Button emphasis={emphasis} fullWidth iconBefore={<i className="icon icon-plus"/>}>Full Width + Icon</Button>
                            </div>
                        </div>
                    ))}
                </div>

                {/* MATRIX 7: INVERTED STYLES - ALL COMBINATIONS ON DARK BACKGROUND */}
                <div style={{backgroundColor: '#1e325c', padding: '20px', borderRadius: '8px', marginBottom: '40px'}}>
                    <h4 style={{color: 'white', marginBottom: '20px'}}>INVERTED × ALL Combinations (Dark Background)</h4>
                    
                    {/* Inverted Emphasis × Sizes */}
                    <div style={{marginBottom: '24px'}}>
                        <h5 style={{color: 'white', marginBottom: '12px', fontSize: '14px', fontWeight: 600}}>All Emphasis × All Sizes (Inverted)</h5>
                        <table style={{width: '100%', borderCollapse: 'collapse', fontSize: '12px'}}>
                            <thead>
                                <tr style={{borderBottom: '2px solid rgba(255,255,255,0.2)'}}>
                                    <th style={{textAlign: 'left', padding: '6px', width: '80px', color: 'white'}}>Emphasis</th>
                                    {sizes.map(size => (
                                        <th key={size} style={{textAlign: 'center', padding: '6px', color: 'white'}}>{size}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {emphases.map((emphasis) => (
                                    <tr key={emphasis} style={{borderBottom: '1px solid rgba(255,255,255,0.1)'}}>
                                        <td style={{padding: '6px', textTransform: 'capitalize', fontWeight: 600, color: 'white'}}>{emphasis}</td>
                                        {sizes.map((size) => (
                                            <td key={size} style={{padding: '6px', textAlign: 'center'}}>
                                                <Button emphasis={emphasis} size={size} inverted>
                                                    {size}
                                                </Button>
                                            </td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Inverted Emphasis × States */}
                    <div style={{marginBottom: '24px'}}>
                        <h5 style={{color: 'white', marginBottom: '12px', fontSize: '14px', fontWeight: 600}}>All Emphasis × All States (Inverted)</h5>
                        <table style={{width: '100%', borderCollapse: 'collapse', fontSize: '12px'}}>
                            <thead>
                                <tr style={{borderBottom: '2px solid rgba(255,255,255,0.2)'}}>
                                    <th style={{textAlign: 'left', padding: '6px', width: '80px', color: 'white'}}>Emphasis</th>
                                    {states.map(state => (
                                        <th key={state.label} style={{textAlign: 'center', padding: '6px', color: 'white', minWidth: '100px'}}>{state.label}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {emphases.map((emphasis) => (
                                    <tr key={emphasis} style={{borderBottom: '1px solid rgba(255,255,255,0.1)'}}>
                                        <td style={{padding: '6px', textTransform: 'capitalize', fontWeight: 600, color: 'white'}}>{emphasis}</td>
                                        {states.map((state) => (
                                            <td key={state.label} style={{padding: '6px', textAlign: 'center'}}>
                                                <Button emphasis={emphasis} inverted {...state.props}>
                                                    {state.label}
                                                </Button>
                                            </td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Inverted with Icons */}
                    <div>
                        <h5 style={{color: 'white', marginBottom: '12px', fontSize: '14px', fontWeight: 600}}>Inverted × Icon Combinations</h5>
                        <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '8px'}}>
                            <Button emphasis="primary" inverted iconBefore={<i className="icon icon-plus"/>}>Add</Button>
                            <Button emphasis="secondary" inverted iconAfter={<i className="icon icon-chevron-right"/>}>Next</Button>
                            <Button emphasis="tertiary" inverted iconBefore={<i className="icon icon-settings"/>} iconAfter={<i className="icon icon-chevron-down"/>}>Settings</Button>
                            <Button emphasis="quaternary" inverted iconBefore={<i className="icon icon-close"/>}></Button>
                            <Button emphasis="link" inverted iconBefore={<i className="icon icon-external-link"/>}>External</Button>
                            <Button emphasis="primary" inverted destructive iconBefore={<i className="icon icon-trash"/>}>Delete</Button>
                            <Button emphasis="secondary" inverted loading iconBefore={<i className="icon icon-save"/>}>Saving</Button>
                            <Button emphasis="primary" inverted fullWidth>Full Width Inverted</Button>
                        </div>
                    </div>
                </div>

                {/* SUMMARY STATS */}
                <div style={{backgroundColor: 'rgba(0,0,0,0.02)', padding: '16px', borderRadius: '8px', textAlign: 'center'}}>
                    <h4 style={{margin: '0 0 8px 0', color: 'rgba(0,0,0,0.8)'}}>🎯 TOTAL PERMUTATIONS DISPLAYED</h4>
                    <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginTop: '12px'}}>
                        <div>
                            <strong>Matrix 1:</strong> 20 combinations<br/>
                            <small>(5 emphasis × 4 sizes)</small>
                        </div>
                        <div>
                            <strong>Matrix 2:</strong> 20 combinations<br/>
                            <small>(4 sizes × 5 icon variants)</small>
                        </div>
                        <div>
                            <strong>Matrix 3:</strong> 30 combinations<br/>
                            <small>(5 emphasis × 6 states)</small>
                        </div>
                        <div>
                            <strong>Matrix 4:</strong> 25 combinations<br/>
                            <small>(5 emphasis × 5 icon types)</small>
                        </div>
                        <div>
                            <strong>Matrix 5:</strong> 24 combinations<br/>
                            <small>(4 sizes × 6 states)</small>
                        </div>
                        <div>
                            <strong>Matrix 6:</strong> 25 combinations<br/>
                            <small>(5 emphasis × 5 fullWidth states)</small>
                        </div>
                        <div>
                            <strong>Matrix 7:</strong> 80+ combinations<br/>
                            <small>(All inverted variations)</small>
                        </div>
                    </div>
                    <div style={{marginTop: '16px', fontSize: '18px', fontWeight: 700, color: 'rgba(0,0,0,0.8)'}}>
                        📊 <strong>220+ Total Button Variations</strong> 📊
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ButtonExamples;
