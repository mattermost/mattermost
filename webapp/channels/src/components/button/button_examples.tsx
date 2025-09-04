// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import Button from './button';

interface ButtonExamplesProps {
    backgroundClass?: string;
}

const ButtonExamples: React.FC<ButtonExamplesProps> = ({backgroundClass}) => {
    return (
        <div className={`ButtonExamples ${backgroundClass || ''}`}>
            <div style={{padding: '20px'}}>
                <h3>Button Component Examples</h3>
                
                <div style={{marginBottom: '24px'}}>
                    <h4>Emphasis Variants (Medium)</h4>
                    <div style={{display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '12px'}}>
                        <Button emphasis="primary">Primary</Button>
                        <Button emphasis="secondary">Secondary</Button>
                        <Button emphasis="tertiary">Tertiary</Button>
                        <Button emphasis="quaternary">Quaternary</Button>
                        <Button emphasis="link">Link</Button>
                    </div>
                </div>

                <div style={{marginBottom: '24px'}}>
                    <h4>Destructive Variants</h4>
                    <div style={{display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '12px'}}>
                        <Button emphasis="primary" destructive={true}>Destructive Primary</Button>
                        <Button emphasis="secondary" destructive={true}>Destructive Secondary</Button>
                        <Button emphasis="tertiary" destructive={true}>Destructive Tertiary</Button>
                        <Button emphasis="quaternary" destructive={true}>Destructive Quaternary</Button>
                        <Button emphasis="link" destructive={true}>Destructive Link</Button>
                    </div>
                </div>

                <div style={{marginBottom: '24px'}}>
                    <h4>Size Variants (Primary)</h4>
                    <div style={{display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '12px'}}>
                        <Button emphasis="primary" size="xs">X-Small</Button>
                        <Button emphasis="primary" size="sm">Small</Button>
                        <Button emphasis="primary" size="md">Medium</Button>
                        <Button emphasis="primary" size="lg">Large</Button>
                    </div>
                </div>

                <div style={{marginBottom: '24px'}}>
                    <h4>States</h4>
                    <div style={{display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '12px'}}>
                        <Button emphasis="primary">Default</Button>
                        <Button emphasis="primary" disabled={true}>Disabled</Button>
                        <Button emphasis="primary" loading={true}>Loading</Button>
                    </div>
                </div>

                <div style={{marginBottom: '24px'}}>
                    <h4>With Icons</h4>
                    <div style={{display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '12px'}}>
                        <Button emphasis="primary" iconBefore={<i className="icon icon-plus"/>}>Add Item</Button>
                        <Button emphasis="secondary" iconAfter={<i className="icon icon-chevron-right"/>}>Next</Button>
                        <Button emphasis="tertiary" iconBefore={<i className="icon icon-download"/>} iconAfter={<i className="icon icon-chevron-down"/>}>Download</Button>
                    </div>
                </div>

                <div style={{marginBottom: '24px'}}>
                    <h4>Full Width</h4>
                    <div style={{marginBottom: '12px'}}>
                        <Button emphasis="primary" fullWidth={true}>Full Width Button</Button>
                    </div>
                </div>

                <div style={{backgroundColor: '#1e325c', padding: '20px', borderRadius: '8px'}}>
                    <h4 style={{color: 'white', margin: '0 0 16px 0'}}>Inverted Style (Dark Background)</h4>
                    <div style={{display: 'flex', gap: '12px', flexWrap: 'wrap'}}>
                        <Button emphasis="primary" style="inverted">Primary Inverted</Button>
                        <Button emphasis="secondary" style="inverted">Secondary Inverted</Button>
                        <Button emphasis="tertiary" style="inverted">Tertiary Inverted</Button>
                        <Button emphasis="quaternary" style="inverted">Quaternary Inverted</Button>
                        <Button emphasis="link" style="inverted">Link Inverted</Button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ButtonExamples;
