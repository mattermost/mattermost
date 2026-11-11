// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React, {type JSX, type ReactNode} from 'react';

import './admin_settings_segmented_row.scss';

export type AdminSettingsSegment = {
    id: string;
    label: ReactNode;
    selected: boolean;
    onSelect: () => void;
    testId?: string;
};

type Props = {
    id: string;
    children: ReactNode;
    secondaryLabel: ReactNode;
    segments: AdminSettingsSegment[];
    last?: boolean;
    disabled?: boolean;
    footer?: ReactNode;
    groupAriaLabel?: string;
};

/**
 * Admin Console settings row with a temporary segmented control.
 * Use for mutually exclusive named modes (e.g. Public / Private) until
 * Compass ships a segmented control primitive.
 */
const AdminSettingsSegmentedRow = ({
    id,
    children,
    secondaryLabel,
    segments,
    last,
    disabled,
    footer,
    groupAriaLabel,
}: Props): JSX.Element => (
    <>
        <div
            className='AdminSettingsSegmentedRow'
            data-testid={id}
        >
            <div className='AdminSettingsSegmentedRow__text'>
                <div className='AdminSettingsSegmentedRow__title'>
                    {children}
                </div>
                <div className='AdminSettingsSegmentedRow__description'>
                    {secondaryLabel}
                </div>
            </div>
            <div
                className='AdminSettingsSegmentedRow__segments'
                role='group'
                aria-label={groupAriaLabel}
            >
                {segments.map((segment) => (
                    <button
                        key={segment.id}
                        type='button'
                        id={`${id}-${segment.id}`}
                        data-testid={segment.testId ?? `${id}-${segment.id}`}
                        className={classNames('AdminSettingsSegmentedRow__segment', {
                            'AdminSettingsSegmentedRow__segment--active': segment.selected,
                        })}
                        aria-pressed={segment.selected}
                        disabled={disabled}
                        onClick={() => {
                            if (!segment.selected) {
                                segment.onSelect();
                            }
                        }}
                    >
                        {segment.label}
                    </button>
                ))}
            </div>
        </div>
        {footer}
        {!last && (
            <div className='section-separator'>
                <hr className='separator__hr'/>
            </div>
        )}
    </>
);

export default AdminSettingsSegmentedRow;
