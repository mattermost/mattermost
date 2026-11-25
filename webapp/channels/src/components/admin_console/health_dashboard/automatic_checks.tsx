// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';

import {Button} from '@mattermost/compass-ui/components/button';

import BooleanSetting from 'components/admin_console/boolean_setting';
import AlertBanner from 'components/alert_banner';

export const AUTOMATIC_CHECKS_ID = 'SiteHealthSettings.EnableAutomaticChecks';

type SettingProps = {
    value: boolean;
    setByEnv: boolean;
    disabled: boolean;
    onChange: (id: string, value: boolean) => void;
};

export const AutomaticChecksSetting = ({value, setByEnv, disabled, onChange}: SettingProps) => (
    <form
        className='admin-console__setting-group form-horizontal HealthDashboard__automaticChecks'
        onSubmit={(e) => e.preventDefault()}
    >
        <BooleanSetting
            id={AUTOMATIC_CHECKS_ID}
            label={
                <FormattedMessage
                    id='admin.health_dashboard.automatic_checks.label'
                    defaultMessage='Run checks automatically'
                />
            }
            helpText={
                <FormattedMessage
                    id='admin.health_dashboard.automatic_checks.help'
                    defaultMessage='When true, the server checks site health every hour.'
                />
            }
            value={value}
            setByEnv={setByEnv}
            disabled={disabled}
            onChange={onChange}
        />
    </form>
);

type BannerProps = {

    // Omitted for admins who can't change the setting, who see the text only.
    onTurnOn?: () => void;
    turningOn: boolean;
};

export const AutomaticChecksOffBanner = ({onTurnOn, turningOn}: BannerProps) => (
    <AlertBanner
        mode='info'
        className='HealthDashboard__automaticChecksOff'
        message={
            <FormattedMessage
                id='admin.health_dashboard.automatic_checks.off'
                defaultMessage='Automatic checks are off. Findings show the last run and may be out of date.'
            />
        }
        actionButtonLeft={onTurnOn && (
            <Button
                emphasis='secondary'
                size='small'
                loading={turningOn}
                disabled={turningOn}
                onClick={onTurnOn}
            >
                <FormattedMessage
                    id='admin.health_dashboard.automatic_checks.turn_on'
                    defaultMessage='Turn on'
                />
            </Button>
        )}
    />
);
