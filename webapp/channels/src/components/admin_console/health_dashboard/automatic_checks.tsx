// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useId} from 'react';
import {defineMessage, defineMessages, FormattedMessage} from 'react-intl';
import type {MessageDescriptor} from 'react-intl';

import {Switch} from '@mattermost/compass-ui/components/switch';
import {WithTooltip} from '@mattermost/shared/components/tooltip';

import AlertBanner from 'components/alert_banner';

export type AutomaticChecksDisabledReason = 'set_by_env' | 'restricted' | 'not_allowed';

const hourlyMessage = defineMessage({
    id: 'admin.health_dashboard.automatic_checks.description',
    defaultMessage: 'Runs the health check every hour. Re-run checks still works when this is off.',
});

const disabledReasonMessages: Record<AutomaticChecksDisabledReason, MessageDescriptor> = defineMessages({
    set_by_env: {
        id: 'admin.set_by_env',
        defaultMessage: 'This setting has been set through an environment variable. It cannot be changed through the System Console.',
    },
    restricted: {
        id: 'admin.health_dashboard.automatic_checks.restricted',
        defaultMessage: "This setting can't be changed while System Console changes are restricted.",
    },
    not_allowed: {
        id: 'admin.health_dashboard.automatic_checks.not_allowed',
        defaultMessage: 'Only system admins can change this setting.',
    },
});

type SwitchProps = {
    checked: boolean;
    saving: boolean;
    disabledReason?: AutomaticChecksDisabledReason;
    onChange: (value: boolean) => void;
};

// The tooltip only reaches the wrapping span, which takes the hover a disabled input doesn't, so
// the same text is also tied to the input as its description for screen readers.
export const AutomaticChecksSwitch = ({checked, saving, disabledReason, onChange}: SwitchProps) => {
    const descriptionId = useId();
    const description = disabledReason ? disabledReasonMessages[disabledReason] : hourlyMessage;

    return (
        <WithTooltip title={description}>
            <span className='HealthDashboard__automaticChecks'>
                <Switch
                    size='small'
                    data-testid='healthDashboardAutomaticChecks'
                    checked={checked}
                    disabled={saving || Boolean(disabledReason)}
                    aria-describedby={descriptionId}
                    onChange={(e) => onChange(e.target.checked)}
                >
                    <FormattedMessage
                        id='admin.health_dashboard.automatic_checks.label'
                        defaultMessage='Automatic checks'
                    />
                </Switch>
                <span
                    id={descriptionId}
                    className='sr-only'
                >
                    <FormattedMessage {...description}/>
                </span>
            </span>
        </WithTooltip>
    );
};

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
