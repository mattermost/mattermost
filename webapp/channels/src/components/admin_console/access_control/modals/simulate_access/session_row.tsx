// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useMemo} from 'react';
import {FormattedMessage, FormattedRelativeTime} from 'react-intl';

import type {PolicySimulationSession} from '@mattermost/types/access_control';

import {aggregateDecisions} from './decision_aggregate';
import SessionStateChip from './session_state_chip';

import './session_row.scss';

type Props = {
    session: PolicySimulationSession;
    actions: string[];
};

/**
 * Per-session unfold row inside the picker. Renders a one-line
 * "device · network" caption + last-active timestamp + an aggregate
 * SessionStateChip for the session's verdict across the requested
 * actions. Mounted by PickerRow when the user toggles the parent row
 * open and the simulator returned a `sessions[]` list for that user.
 */
export default function SessionRow({session, actions}: Props): JSX.Element {
    const aggregate = useMemo(
        () => aggregateDecisions(actions, session.decisions, false),
        [actions, session.decisions],
    );

    const meta: string[] = [];
    if (session.device) {
        meta.push(session.device);
    }
    if (session.network) {
        meta.push(session.network);
    }

    // Compute the relative-time delta + unit here and let
    // `FormattedRelativeTime` own the locale-aware formatting and
    // pluralisation. Missing (`undefined` / wrong type) or otherwise
    // unusable timestamps (clock skew, non-finite delta) fall back to
    // the localised "Last active —" message so the row never renders
    // raw English and the field label always stays visible — hiding
    // the row entirely was misleading because an absent timestamp
    // looked identical to a session that simply hadn't been used
    // recently.
    const lastActive = useMemo(() => {
        const unknown = (
            <FormattedMessage
                id='admin.access_control.simulate_access.session.last_active_unknown'
                defaultMessage='Last active —'
            />
        );
        if (typeof session.last_active_at !== 'number') {
            return unknown;
        }
        const deltaMs = Date.now() - session.last_active_at;
        if (deltaMs < 0 || !Number.isFinite(deltaMs)) {
            return unknown;
        }
        const sec = Math.floor(deltaMs / 1000);
        let value: number;
        let unit: 'second' | 'minute' | 'hour' | 'day';
        if (sec < 60) {
            value = -sec;
            unit = 'second';
        } else {
            const min = Math.floor(sec / 60);
            if (min < 60) {
                value = -min;
                unit = 'minute';
            } else {
                const hr = Math.floor(min / 60);
                if (hr < 24) {
                    value = -hr;
                    unit = 'hour';
                } else {
                    const day = Math.floor(hr / 24);
                    value = -day;
                    unit = 'day';
                }
            }
        }
        return (
            <FormattedMessage
                id='admin.access_control.simulate_access.session.last_active'
                defaultMessage='Last active {ts}'
                values={{
                    ts: (
                        <FormattedRelativeTime
                            value={value}
                            unit={unit}
                        />
                    ),
                }}
            />
        );
    }, [session.last_active_at]);

    return (
        <tr
            className='SimulateAccessModal__sessionRow'
            data-testid='simulate-access-session-row'
        >
            <td colSpan={2}>
                <div className='SimulateAccessModal__sessionMeta'>
                    <span
                        className='SimulateAccessModal__sessionDot'
                        aria-hidden='true'
                    >{'—'}</span>
                    <div>
                        <div className='SimulateAccessModal__sessionDevice'>{meta.join(' · ') || '—'}</div>
                        <div className='SimulateAccessModal__sessionLastActive'>
                            {lastActive}
                        </div>
                    </div>
                </div>
            </td>
            <td colSpan={2}>
                <SessionStateChip state={aggregate}/>
            </td>
        </tr>
    );
}
