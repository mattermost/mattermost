// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import type {ChangeEvent} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';

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

    return (
        <>
            <select
                id={`${idPrefix}Expiry`}
                className={selectClassName}
                value={expiryPreset}
                onChange={onPresetChange}
            >
                {!enforceExpiry && (
                    <option value='none'>
                        {intl.formatMessage({id: 'user.settings.tokens.expiry.none', defaultMessage: 'No expiry'})}
                    </option>
                )}
                {isAllowed('7d') && (
                    <option value='7d'>
                        {intl.formatMessage({id: 'user.settings.tokens.expiry.7d', defaultMessage: '7 days'})}
                    </option>
                )}
                {isAllowed('30d') && (
                    <option value='30d'>
                        {intl.formatMessage({id: 'user.settings.tokens.expiry.30d', defaultMessage: '30 days'})}
                    </option>
                )}
                {isAllowed('90d') && (
                    <option value='90d'>
                        {intl.formatMessage({id: 'user.settings.tokens.expiry.90d', defaultMessage: '90 days'})}
                    </option>
                )}
                {isAllowed('1y') && (
                    <option value='1y'>
                        {intl.formatMessage({id: 'user.settings.tokens.expiry.1y', defaultMessage: '1 year'})}
                    </option>
                )}
                <option value='custom'>
                    {intl.formatMessage({id: 'user.settings.tokens.expiry.custom', defaultMessage: 'Custom date…'})}
                </option>
            </select>
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
