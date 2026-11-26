// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {defineMessage, FormattedMessage} from 'react-intl';

import {Switch} from '@mattermost/compass-ui/components/switch';
import {WithTooltip} from '@mattermost/shared/components/tooltip';

import AlertBanner from 'components/alert_banner';

const setByEnvMessage = defineMessage({
    id: 'admin.set_by_env',
    defaultMessage: 'This setting has been set through an environment variable. It cannot be changed through the System Console.',
});

type SwitchProps = {
    checked: boolean;
    setByEnv: boolean;
    disabled: boolean;
    onChange: (value: boolean) => void;
};

// Always wrapped so the switch node is stable whether or not the tooltip applies. The span
// receives the hover, which a disabled input doesn't.
export const AutomaticChecksSwitch = ({checked, setByEnv, disabled, onChange}: SwitchProps) => (
    <WithTooltip
        title={setByEnvMessage}
        disabled={!setByEnv}
    >
        <span className='HealthDashboard__automaticChecks'>
            <Switch
                size='small'
                data-testid='healthDashboardAutomaticChecks'
                checked={checked}
                disabled={disabled || setByEnv}
                onChange={(e) => onChange(e.target.checked)}
            >
                <FormattedMessage
                    id='admin.health_dashboard.automatic_checks.label'
                    defaultMessage='Automatic checks'
                />
            </Switch>
        </span>
    </WithTooltip>
);

export const AutomaticChecksOffBanner = () => (
    <AlertBanner
        mode='info'
        className='HealthDashboard__automaticChecksOff'
        message={
            <FormattedMessage
                id='admin.health_dashboard.automatic_checks.off'
                defaultMessage='Automatic checks are off. Findings show the last run and may be out of date.'
            />
        }
    />
);
