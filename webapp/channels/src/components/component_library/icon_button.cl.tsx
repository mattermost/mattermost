// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState} from 'react';

import IconButton from '../icon_button';
import type {IconButtonProps, IconButtonSize} from '../icon_button';

type Props = {
    backgroundClass: string;
}

const IconButtonComponentLibrary = ({backgroundClass}: Props) => {
    const [toggled, setToggled] = useState(false);
    const [loading, setLoading] = useState(false);

    const sizes: IconButtonSize[] = ['xs', 'sm', 'md', 'lg'];

    const sampleIcon = <i className="icon icon-plus" />;
    const starIcon = <i className="icon icon-star" />;
    const trashIcon = <i className="icon icon-trash" />;
    const menuIcon = <i className="icon icon-menu" />;

    const renderIconButtonRow = (props: Partial<IconButtonProps>, label: string) => (
        <div style={{marginBottom: '24px'}}>
            <h3 style={{marginBottom: '12px', fontSize: '14px', fontWeight: '600'}}>
                {label}
            </h3>
            <div style={{display: 'flex', gap: '8px', alignItems: 'center'}}>
                {sizes.map((size) => (
                    <div key={size} style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px'}}>
                        <IconButton
                            icon={sampleIcon}
                            aria-label={`${label} ${size}`}
                            size={size}
                            {...props}
                        />
                        <span style={{fontSize: '10px', color: 'rgba(var(--center-channel-color-rgb), 0.64)'}}>{size}</span>
                    </div>
                ))}
            </div>
        </div>
    );

    return (
        <div className={backgroundClass}>
            <div style={{padding: '20px', maxWidth: '800px'}}>
                <h1 style={{marginBottom: '24px', fontSize: '24px', fontWeight: '600'}}>
                    IconButton Component
                </h1>

                {renderIconButtonRow({}, 'Default')}
                {renderIconButtonRow({padding: 'compact'}, 'Compact Padding')}
                {renderIconButtonRow({toggled: true}, 'Toggled State')}
                {renderIconButtonRow({destructive: true}, 'Destructive')}
                {renderIconButtonRow({inverted: true}, 'Inverted')}
                {renderIconButtonRow({rounded: true}, 'Rounded')}
                {renderIconButtonRow({disabled: true}, 'Disabled')}
                {renderIconButtonRow({loading: true}, 'Loading')}

                <div style={{marginBottom: '24px'}}>
                    <h3 style={{marginBottom: '12px', fontSize: '14px', fontWeight: '600'}}>
                        Interactive Examples
                    </h3>
                    <div style={{display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap'}}>
                        <IconButton
                            icon={starIcon}
                            aria-label="Toggle favorite"
                            toggled={toggled}
                            onClick={() => setToggled(!toggled)}
                            title="Click to toggle favorite"
                        />
                        <span style={{fontSize: '12px'}}>Toggle: {toggled ? 'ON' : 'OFF'}</span>

                        <IconButton
                            icon={loading ? sampleIcon : sampleIcon}
                            aria-label="Toggle loading"
                            loading={loading}
                            onClick={() => setLoading(!loading)}
                            title="Click to toggle loading state"
                        />
                        <span style={{fontSize: '12px'}}>Loading: {loading ? 'ON' : 'OFF'}</span>

                        <IconButton
                            icon={trashIcon}
                            aria-label="Delete item"
                            destructive
                            title="Delete action"
                        />

                        <IconButton
                            icon={menuIcon}
                            aria-label="Open menu"
                            size="lg"
                            rounded
                            inverted
                            title="Menu button"
                        />
                    </div>
                </div>

                <div style={{marginBottom: '24px'}}>
                    <h3 style={{marginBottom: '12px', fontSize: '14px', fontWeight: '600'}}>
                        Combined Variants
                    </h3>
                    <div style={{display: 'flex', gap: '8px', flexWrap: 'wrap'}}>
                        <IconButton
                            icon={sampleIcon}
                            aria-label="Compact destructive"
                            padding="compact"
                            destructive
                            size="sm"
                        />
                        <IconButton
                            icon={starIcon}
                            aria-label="Rounded toggled"
                            rounded
                            toggled
                            size="md"
                        />
                        <IconButton
                            icon={menuIcon}
                            aria-label="Large inverted rounded"
                            size="lg"
                            inverted
                            rounded
                            padding="compact"
                        />
                    </div>
                </div>

                <div>
                    <h3 style={{marginBottom: '12px', fontSize: '14px', fontWeight: '600'}}>
                        Usage Examples
                    </h3>
                    <pre style={{
                        background: 'rgba(var(--center-channel-color-rgb), 0.04)',
                        padding: '12px',
                        borderRadius: '4px',
                        fontSize: '11px',
                        overflow: 'auto',
                    }}>
{`// Basic icon button
<IconButton 
  icon={<i className="icon icon-plus" />}
  aria-label="Add item"
  onClick={handleAdd}
/>

// Toggled state
<IconButton 
  icon={<i className="icon icon-star" />}
  aria-label="Toggle favorite"
  toggled={isFavorited}
  onClick={handleToggleFavorite}
/>

// Destructive action
<IconButton 
  icon={<i className="icon icon-trash" />}
  aria-label="Delete item"
  destructive
  onClick={handleDelete}
/>

// Rounded with size and inverted style
<IconButton 
  icon={<i className="icon icon-menu" />}
  aria-label="Open menu"
  inverted
  rounded
  size="lg"
  onClick={handleMenu}
/>

// Loading state
<IconButton 
  icon={<i className="icon icon-save" />}
  aria-label="Save changes"
  loading={isSaving}
  onClick={handleSave}
/>`}
                    </pre>
                </div>
            </div>
        </div>
    );
};

export default IconButtonComponentLibrary;