// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Meta} from '@storybook/react';
import React, {type ComponentProps, useState} from 'react';

import {Toggle} from './toggle';

const meta: Meta<typeof Toggle> = {
    title: 'DesignSystem/Primitives/Toggle',
    component: Toggle,
    tags: ['autodocs'],
};

export default meta;

// Interactive wrapper component
type ToggleWithStateProps = Omit<ComponentProps<typeof Toggle>, 'onToggle'>;

const ToggleWithState = (args: ToggleWithStateProps) => {
    const [toggled, setToggled] = useState(args.toggled || false);

    return (
        <div style={{display: 'flex', alignItems: 'center', minHeight: '60px'}}>
            <Toggle
                {...args}
                toggled={toggled}
                onToggle={() => setToggled(!toggled)}
            />
        </div>
    );
};

export const Default = () => <ToggleWithState />;

export const WithText = () => (
    <ToggleWithState
        onText='ON'
        offText='OFF'
    />
);

export const Toggled = () => (
    <ToggleWithState
        toggled={true}
        onText='ON'
        offText='OFF'
    />
);

export const Disabled = () => (
    <ToggleWithState
        disabled={true}
    />
);

export const DisabledToggled = () => (
    <ToggleWithState
        disabled={true}
        toggled={true}
    />
);

export const Small = () => (
    <ToggleWithState
        size='btn-sm'
        onText='ON'
        offText='OFF'
    />
);

export const Medium = () => (
    <ToggleWithState
        size='btn-md'
        onText='ON'
        offText='OFF'
    />
);

export const Large = () => (
    <ToggleWithState
        size='btn-lg'
        onText='ON'
        offText='OFF'
    />
);

export const Primary = () => (
    <ToggleWithState
        toggleClassName='btn-toggle-primary'
        onText='ON'
        offText='OFF'
    />
);

export const PrimarySmall = () => (
    <ToggleWithState
        toggleClassName='btn-toggle-primary'
        size='btn-sm'
        onText='ON'
        offText='OFF'
    />
);

export const PrimaryMedium = () => (
    <ToggleWithState
        toggleClassName='btn-toggle-primary'
        size='btn-md'
        onText='ON'
        offText='OFF'
    />
);

export const PrimaryLarge = () => (
    <ToggleWithState
        toggleClassName='btn-toggle-primary'
        size='btn-lg'
        onText='ON'
        offText='OFF'
    />
);
