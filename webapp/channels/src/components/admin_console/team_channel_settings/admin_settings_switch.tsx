// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {type JSX, type ReactNode} from 'react';

import {Switch} from '@mattermost/compass-ui/components/switch';

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

    testId?: string;
};

/**
 * Admin Console settings row: Compass Switch with primary + secondary labels,
 * optional footer, and the legacy section separator between rows.
 *
 * Uses `size="medium"` + `semiBold` to match Channel Settings rows. The old
 * Toggle adapter defaulted to `btn-lg` → Compass `large` (16px label).
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
    testId,
}: Props): JSX.Element => (
    <>
        <div data-testid={testId ? `${testId}.row--group` : undefined}>
            <Switch
                id={id}
                size='medium'
                checked={checked}
                disabled={disabled}
                onChange={onChange}
                data-testid={testId ? `${testId}--switch` : undefined}
                tabIndex={0}
                semiBold={true}
                secondaryLabel={<span data-testid={testId ? `${testId}.help--text` : undefined}>{secondaryLabel}</span>}
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
