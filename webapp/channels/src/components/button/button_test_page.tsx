// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import Button from './button';

// Simple test page that you can temporarily add to any existing route for quick testing
const ButtonTestPage: React.FC = () => {
    return (
        <div style={{padding: '40px', maxWidth: '1200px', margin: '0 auto'}}>
            <h1>Button Component Test</h1>
            
            <section style={{marginBottom: '40px'}}>
                <h2>Primary Buttons</h2>
                <div style={{display: 'flex', gap: '16px', marginBottom: '16px'}}>
                    <Button emphasis="primary" size="xs">X-Small</Button>
                    <Button emphasis="primary" size="sm">Small</Button>
                    <Button emphasis="primary" size="md">Medium</Button>
                    <Button emphasis="primary" size="lg">Large</Button>
                </div>
                <div style={{display: 'flex', gap: '16px', marginBottom: '16px'}}>
                    <Button emphasis="primary">Default</Button>
                    <Button emphasis="primary" disabled>Disabled</Button>
                    <Button emphasis="primary" loading>Loading</Button>
                    <Button emphasis="primary" destructive>Destructive</Button>
                </div>
            </section>

            <section style={{marginBottom: '40px'}}>
                <h2>Secondary Buttons</h2>
                <div style={{display: 'flex', gap: '16px', marginBottom: '16px'}}>
                    <Button emphasis="secondary">Default</Button>
                    <Button emphasis="secondary" disabled>Disabled</Button>
                    <Button emphasis="secondary" destructive>Destructive</Button>
                </div>
            </section>

            <section style={{marginBottom: '40px'}}>
                <h2>All Emphasis Types</h2>
                <div style={{display: 'flex', gap: '16px', marginBottom: '16px'}}>
                    <Button emphasis="primary">Primary</Button>
                    <Button emphasis="secondary">Secondary</Button>
                    <Button emphasis="tertiary">Tertiary</Button>
                    <Button emphasis="quaternary">Quaternary</Button>
                    <Button emphasis="link">Link</Button>
                </div>
            </section>

            <section style={{marginBottom: '40px'}}>
                <h2>With Icons</h2>
                <div style={{display: 'flex', gap: '16px', marginBottom: '16px'}}>
                    <Button emphasis="primary" iconBefore={<span>➕</span>}>Add</Button>
                    <Button emphasis="secondary" iconAfter={<span>→</span>}>Next</Button>
                    <Button emphasis="tertiary" iconBefore={<span>⬇</span>} iconAfter={<span>▼</span>}>Download</Button>
                </div>
            </section>

            <section style={{backgroundColor: '#1e325c', padding: '20px', borderRadius: '8px'}}>
                <h2 style={{color: 'white', margin: '0 0 20px 0'}}>Inverted (Dark Background)</h2>
                <div style={{display: 'flex', gap: '16px'}}>
                    <Button emphasis="primary" style="inverted">Primary</Button>
                    <Button emphasis="secondary" style="inverted">Secondary</Button>
                    <Button emphasis="tertiary" style="inverted">Tertiary</Button>
                    <Button emphasis="quaternary" style="inverted">Quaternary</Button>
                    <Button emphasis="link" style="inverted">Link</Button>
                </div>
            </section>
        </div>
    );
};

export default ButtonTestPage;
