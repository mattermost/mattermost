// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useMemo} from 'react';
import type {ChangeEvent} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';

import {Select} from '@mattermost/compass-ui/components/select';

import type {ExpiryPreset} from './token_expiry';
import {isExpiryPresetAllowed, isoPlusDays, todayIso} from './token_expiry';

type Props = {
    idPrefix: string;
    expiryPreset: ExpiryPreset;
    customExpiryDate: string;
    maxLifetimeDays: number;

    /** A configured maximum lifetime implies tokens must expire, so "No expiry" is withheld. */
    enforceExpiry: boolean;
    onPresetChange: (e: ChangeEvent<HTMLSelectElement>) => void;
    onCustomDateChange: (e: ChangeEvent<HTMLInputElement>) => void;

    /** Call sites differ in form sizing and help-text styling. */
    selectClassName?: string;
    hintClassName?: string;
};

/**
 * The expiry preset select, its custom-date input and the policy hints, shared by the
 * user-settings token form, the Add Bot form and the bot token rows.
 */
export default function TokenExpiryPicker({
    idPrefix,
    expiryPreset,
    customExpiryDate,
    maxLifetimeDays,
    enforceExpiry,
    onPresetChange,
    onCustomDateChange,
    selectClassName = 'form-control',
    hintClassName = 'pt-2',
}: Props) {
    const intl = useIntl();
    const maxCustomIso = maxLifetimeDays > 0 ? isoPlusDays(maxLifetimeDays) : undefined;
    const isAllowed = (preset: ExpiryPreset) => isExpiryPresetAllowed(preset, maxLifetimeDays);

    const options = useMemo(() => {
        const presetOptions: Array<{value: ExpiryPreset; label: string}> = [];

        if (!enforceExpiry) {
            presetOptions.push({
                value: 'none',
                label: intl.formatMessage({id: 'user.settings.tokens.expiry.none', defaultMessage: 'No expiry'}),
            });
        }
        if (isAllowed('7d')) {
            presetOptions.push({
                value: '7d',
                label: intl.formatMessage({id: 'user.settings.tokens.expiry.7d', defaultMessage: '7 days'}),
            });
        }
        if (isAllowed('30d')) {
            presetOptions.push({
                value: '30d',
                label: intl.formatMessage({id: 'user.settings.tokens.expiry.30d', defaultMessage: '30 days'}),
            });
        }
        if (isAllowed('90d')) {
            presetOptions.push({
                value: '90d',
                label: intl.formatMessage({id: 'user.settings.tokens.expiry.90d', defaultMessage: '90 days'}),
            });
        }
        if (isAllowed('1y')) {
            presetOptions.push({
                value: '1y',
                label: intl.formatMessage({id: 'user.settings.tokens.expiry.1y', defaultMessage: '1 year'}),
            });
        }
        presetOptions.push({
            value: 'custom',
            label: intl.formatMessage({id: 'user.settings.tokens.expiry.custom', defaultMessage: 'Custom date…'}),
        });

        return presetOptions;
    }, [enforceExpiry, intl, maxLifetimeDays]);

    const handlePresetChange = useCallback((value: string) => {
        onPresetChange({target: {value}} as ChangeEvent<HTMLSelectElement>);
    }, [onPresetChange]);

    return (
        <>
            <Select
                id={`${idPrefix}Expiry`}
                className={selectClassName}
                value={expiryPreset}
                onChange={handlePresetChange}
                options={options}
            />
            {expiryPreset === 'custom' && (
                <input
                    id={`${idPrefix}ExpiryCustom`}
                    className={`${selectClassName} mt-2`}
                    type='date'
                    aria-label={intl.formatMessage({id: 'user.settings.tokens.expiry.customDate', defaultMessage: 'Custom expiry date'})}
                    value={customExpiryDate}
                    min={todayIso()}
                    max={maxCustomIso}
                    onChange={onCustomDateChange}
                />
            )}
            {maxLifetimeDays > 0 && (
                <div className={hintClassName}>
                    <FormattedMessage
                        id='user.settings.tokens.maxLifetimeHint'
                        defaultMessage='Tokens can be valid for up to {days, number} {days, plural, one {day} other {days}}.'
                        values={{days: maxLifetimeDays}}
                    />
                </div>
            )}
            {enforceExpiry && (
                <div className={hintClassName}>
                    <FormattedMessage
                        id='user.settings.tokens.expiryEnforced'
                        defaultMessage='Your administrator requires all personal access tokens to have an expiry date.'
                    />
                </div>
            )}
        </>
    );
}
