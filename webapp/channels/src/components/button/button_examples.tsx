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
                                                {size === 'xs' ? 'X-small' : size === 'sm' ? 'Small' : size === 'md' ? 'Medium' : 'Large'}
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

                {/* MATRIX 2: ALL SIZES × ALL ICON VARIANTS (16 combinations) */}
                <div style={{marginBottom: '40px'}}>
                    <h4 style={{marginBottom: '16px'}}>Sizes × All Icon Variants (16 combinations)</h4>
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
                                                {size === 'xs' ? 'X-small' : size === 'sm' ? 'Small' : size === 'md' ? 'Medium' : 'Large'}
                                            </Button>
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* MATRIX 4: ALL EMPHASIS × ALL ICON COMBINATIONS (20 combinations) */}
                <div style={{marginBottom: '40px'}}>
                    <h4 style={{marginBottom: '16px'}}>Emphasis × Icon Combinations (20 combinations)</h4>
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
                                                {icon.label}
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
                                                {(size === 'xs' ? 'X-small' : size === 'sm' ? 'Small' : size === 'md' ? 'Medium' : 'Large')} {state.label}
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
                    <h4 style={{marginBottom: '16px'}}>Full Width × Selected Emphasis × Key States</h4>
                    {emphases.filter(emphasis => !['quaternary', 'link'].includes(emphasis)).map((emphasis) => (
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
                <div style={{backgroundColor: 'var(--sidebar-bg)', padding: '20px', borderRadius: '8px', marginBottom: '40px'}}>
                    <h4 style={{color: 'white', marginBottom: '20px'}}>INVERTED × ALL Combinations (Dark Background)</h4>
                    
                    {/* INVERTED MATRIX 1: ALL EMPHASIS × ALL SIZES (20 combinations) */}
                    <div style={{marginBottom: '32px'}}>
                        <h5 style={{color: 'white', marginBottom: '12px', fontSize: '14px', fontWeight: 600}}>Emphasis × Sizes (Inverted) - 20 combinations</h5>
                        <table style={{width: '100%', borderCollapse: 'collapse', fontSize: '14px'}}>
                            <thead>
                                <tr style={{borderBottom: '2px solid rgba(255,255,255,0.2)'}}>
                                    <th style={{textAlign: 'left', padding: '8px', width: '100px', color: 'white'}}>Emphasis</th>
                                    {sizes.map(size => (
                                        <th key={size} style={{textAlign: 'center', padding: '8px', color: 'white'}}>{size}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {emphases.map((emphasis) => (
                                    <tr key={emphasis} style={{borderBottom: '1px solid rgba(255,255,255,0.1)'}}>
                                        <td style={{padding: '8px', fontWeight: 600, color: 'white'}}>{emphasis}</td>
                                        {sizes.map((size) => (
                                            <td key={size} style={{padding: '8px', textAlign: 'center'}}>
                                                <Button emphasis={emphasis} size={size} inverted>
                                                    {size === 'xs' ? 'X-small' : size === 'sm' ? 'Small' : size === 'md' ? 'Medium' : 'Large'}
                                                </Button>
                                            </td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* INVERTED MATRIX 2: ALL EMPHASIS × ALL STATES (30 combinations) */}
                    <div style={{marginBottom: '32px'}}>
                        <h5 style={{color: 'white', marginBottom: '12px', fontSize: '14px', fontWeight: 600}}>Emphasis × States (Inverted) - 30 combinations</h5>
                        <table style={{width: '100%', borderCollapse: 'collapse', fontSize: '14px'}}>
                            <thead>
                                <tr style={{borderBottom: '2px solid rgba(255,255,255,0.2)'}}>
                                    <th style={{textAlign: 'left', padding: '8px', width: '100px', color: 'white'}}>Emphasis</th>
                                    {states.map(state => (
                                        <th key={state.label} style={{textAlign: 'center', padding: '8px', minWidth: '120px', color: 'white'}}>{state.label}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {emphases.map((emphasis) => (
                                    <tr key={emphasis} style={{borderBottom: '1px solid rgba(255,255,255,0.1)'}}>
                                        <td style={{padding: '8px', textTransform: 'capitalize', fontWeight: 600, color: 'white'}}>{emphasis}</td>
                                        {states.map((state) => (
                                            <td key={state.label} style={{padding: '8px', textAlign: 'center'}}>
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

                    {/* INVERTED MATRIX 3: ALL SIZES × ALL ICON VARIANTS (16 combinations) */}
                    <div style={{marginBottom: '32px'}}>
                        <h5 style={{color: 'white', marginBottom: '12px', fontSize: '14px', fontWeight: 600}}>Sizes × Icon Variants (Inverted) - 16 combinations</h5>
                        <table style={{width: '100%', borderCollapse: 'collapse', fontSize: '14px'}}>
                            <thead>
                                <tr style={{borderBottom: '2px solid rgba(255,255,255,0.2)'}}>
                                    <th style={{textAlign: 'left', padding: '8px', width: '100px', color: 'white'}}>Size</th>
                                    {icons.map(icon => (
                                        <th key={icon.label} style={{textAlign: 'center', padding: '8px', minWidth: '120px', color: 'white'}}>{icon.label}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {sizes.map((size) => (
                                    <tr key={size} style={{borderBottom: '1px solid rgba(255,255,255,0.1)'}}>
                                        <td style={{padding: '8px', fontWeight: 600, fontSize: '12px', color: 'white'}}>
                                            {size}
                                        </td>
                                        {icons.map((icon) => (
                                            <td key={icon.label} style={{padding: '8px', textAlign: 'center'}}>
                                                <Button emphasis="primary" size={size} inverted {...icon.props}>
                                                    {size === 'xs' ? 'X-small' : size === 'sm' ? 'Small' : size === 'md' ? 'Medium' : 'Large'}
                                                </Button>
                                            </td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* INVERTED MATRIX 4: ALL EMPHASIS × ALL ICON COMBINATIONS (20 combinations) */}
                    <div style={{marginBottom: '32px'}}>
                        <h5 style={{color: 'white', marginBottom: '12px', fontSize: '14px', fontWeight: 600}}>Emphasis × Icon Combinations (Inverted) - 20 combinations</h5>
                        <table style={{width: '100%', borderCollapse: 'collapse', fontSize: '14px'}}>
                            <thead>
                                <tr style={{borderBottom: '2px solid rgba(255,255,255,0.2)'}}>
                                    <th style={{textAlign: 'left', padding: '8px', width: '100px', color: 'white'}}>Emphasis</th>
                                    {icons.map(icon => (
                                        <th key={icon.label} style={{textAlign: 'center', padding: '8px', minWidth: '120px', color: 'white'}}>{icon.label}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {emphases.map((emphasis) => (
                                    <tr key={emphasis} style={{borderBottom: '1px solid rgba(255,255,255,0.1)'}}>
                                        <td style={{padding: '8px', textTransform: 'capitalize', fontWeight: 600, color: 'white'}}>{emphasis}</td>
                                        {icons.map((icon) => (
                                            <td key={icon.label} style={{padding: '8px', textAlign: 'center'}}>
                                                <Button emphasis={emphasis} inverted {...icon.props}>
                                                    {icon.label}
                                                </Button>
                                            </td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* INVERTED MATRIX 5: ALL SIZES × ALL STATES FOR PRIMARY (24 combinations) */}
                    <div style={{marginBottom: '32px'}}>
                        <h5 style={{color: 'white', marginBottom: '12px', fontSize: '14px', fontWeight: 600}}>Sizes × States (Primary Inverted) - 24 combinations</h5>
                        <table style={{width: '100%', borderCollapse: 'collapse', fontSize: '14px'}}>
                            <thead>
                                <tr style={{borderBottom: '2px solid rgba(255,255,255,0.2)'}}>
                                    <th style={{textAlign: 'left', padding: '8px', width: '80px', color: 'white'}}>Size</th>
                                    {states.map(state => (
                                        <th key={state.label} style={{textAlign: 'center', padding: '8px', minWidth: '120px', color: 'white'}}>{state.label}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {sizes.map((size) => (
                                    <tr key={size} style={{borderBottom: '1px solid rgba(255,255,255,0.1)'}}>
                                        <td style={{padding: '8px', fontWeight: 600, color: 'white'}}>{size}</td>
                                        {states.map((state) => (
                                            <td key={state.label} style={{padding: '8px', textAlign: 'center'}}>
                                                <Button emphasis="primary" size={size} inverted {...state.props}>
                                                    {(size === 'xs' ? 'X-small' : size === 'sm' ? 'Small' : size === 'md' ? 'Medium' : 'Large')} {state.label}
                                                </Button>
                                            </td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* INVERTED MATRIX 6: FULL WIDTH × SELECTED EMPHASIS × SELECTED STATES */}
                    <div style={{marginBottom: '24px'}}>
                        <h5 style={{color: 'white', marginBottom: '12px', fontSize: '14px', fontWeight: 600}}>Full Width × Selected Emphasis × Key States (Inverted)</h5>
                        {emphases.filter(emphasis => !['quaternary', 'link'].includes(emphasis)).map((emphasis) => (
                            <div key={emphasis} style={{marginBottom: '12px'}}>
                                <h6 style={{marginBottom: '8px', textTransform: 'capitalize', fontSize: '12px', fontWeight: 600, color: 'rgba(255,255,255,0.7)'}}>{emphasis}</h6>
                                <div style={{display: 'grid', gap: '4px'}}>
                                    <Button emphasis={emphasis} fullWidth inverted>Full Width</Button>
                                    <Button emphasis={emphasis} fullWidth disabled inverted>Full Width Disabled</Button>
                                    <Button emphasis={emphasis} fullWidth loading inverted>Full Width Loading</Button>
                                    <Button emphasis={emphasis} fullWidth destructive inverted>Full Width Destructive</Button>
                                    <Button emphasis={emphasis} fullWidth inverted iconBefore={<i className="icon icon-plus"/>}>Full Width + Icon</Button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

            </div>
        </div>
    );
};

export default ButtonExamples;
