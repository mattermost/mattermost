// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Switch} from '@mattermost/compass-ui/components/switch';
import React, {type JSX, type ReactNode} from 'react';

type Props = {
    id: string;
    children: ReactNode;
    secondaryLabel: ReactNode;
    checked: boolean;
    onChange: () => void;
    last?: boolean;
    disabled?: boolean;

    /** Extra content rendered below the switch row (e.g. domain input). */
    footer?: ReactNode;
};

/**
 * Admin Console settings row: Compass Switch with primary + secondary labels,
 * optional footer, and the legacy section separator between rows.
 *
 * Preserves both `data-testid={id}` (wrapper, for Cypress) and
 * `data-testid={`${id}-button`}` (on the switch input, for unit tests).
 */
const AdminSettingsSwitch = ({
    id,
    children,
    secondaryLabel,
    checked,
    onChange,
    last,
    disabled,
    footer,
}: Props): JSX.Element => (
    <>
        <div data-testid={id}>
            <Switch
                id={id}
                size='medium'
                checked={checked}
                disabled={disabled}
                onChange={onChange}
                data-testid={`${id}-button`}
                tabIndex={0}
                semiBold={true}
                secondaryLabel={secondaryLabel}
            >
                {children}
            </Switch>
        </div>
        {footer}
        {!last && (
            <div className='section-separator'>
                <hr className='separator__hr'/>
            </div>
        )}
    </>
);

export default AdminSettingsSwitch;
