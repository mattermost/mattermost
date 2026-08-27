// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/**
 * Local-only compass-ui smoke UI (testing branch only).
 * Shown by default. Hide: click Dismiss, or localStorage.setItem('compass_ui_smoke', '0')
 * Show again: localStorage.removeItem('compass_ui_smoke'); location.reload()
 * Delete this file (and App import) before any mergeable webapp PR.
 */

import React, {useState} from 'react';
import ReactDOM from 'react-dom';
import AccountMultipleOutlineIcon from '@mattermost/compass-icons/components/account-multiple-outline';
import {Button, Icon, Select} from '@mattermost/compass-ui';

import './compass_ui_smoke.scss';

const CompassUiSmoke = () => {
    const [team, setTeam] = useState('a');
    const [hidden, setHidden] = useState(() => {
        if (typeof window === 'undefined') {
            return true;
        }
        return window.localStorage.getItem('compass_ui_smoke') === '0';
    });

    if (hidden || typeof document === 'undefined') {
        return null;
    }

    const dismiss = () => {
        window.localStorage.setItem('compass_ui_smoke', '0');
        setHidden(true);
    };

    return ReactDOM.createPortal(
        (
            <div className='compass-ui-smoke' data-testid='compass-ui-smoke'>
                <div className='compass-ui-smoke__header'>
                    <strong>{'compass-ui smoke'}</strong>
                    <button type='button' className='compass-ui-smoke__dismiss' onClick={dismiss}>
                        {'Dismiss'}
                    </button>
                </div>
                <Select
                    label='Team'
                    leadingIcon={<Icon glyph={<AccountMultipleOutlineIcon/>} size='16'/>}
                    value={team}
                    options={[
                        {value: 'a', label: 'Alpha'},
                        {value: 'b', label: 'Bravo'},
                    ]}
                    onChange={(value) => setTeam(value)}
                />
                <Button emphasis='primary'>{'Primary'}</Button>
                <Button emphasis='secondary'>{'Secondary'}</Button>
                <Button emphasis='primary' destructive={true}>{'Destructive'}</Button>
            </div>
        ),
        document.body,
    );
};

export default React.memo(CompassUiSmoke);
