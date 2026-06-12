// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useEffect, useRef, useState} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';

import {TimestampFormat} from '@mattermost/types/config';
import type {PreferenceType} from '@mattermost/types/preferences';

import {deletePreferences, savePreferences} from 'mattermost-redux/actions/preferences';
import {getConfig} from 'mattermost-redux/selectors/entities/general';
import {
    getShowTimestampSeconds,
    getTimestampFormat,
    getUseMilitaryTime,
} from 'mattermost-redux/selectors/entities/preferences';
import {getCurrentUserId} from 'mattermost-redux/selectors/entities/users';

import SettingItemMax from 'components/setting_item_max';
import SettingItemMin from 'components/setting_item_min';
import type SettingItemMinComponent from 'components/setting_item_min';

import {Preferences} from 'utils/constants';
import {getTimestampFormatLabel, getTimestampFormatShortLabel, getTimestampFormatTimeExample, supportsTimestampSeconds} from 'utils/datetime_display_format';

import type {GlobalState} from 'types/store';

import './date_time_display_format_setting.scss';

type Props = {
    active: boolean;
    areAllSectionsInactive: boolean;
    updateSection: (section?: string) => void;
    configTimestampFormat: TimestampFormat;
    configShowTimestampSeconds: boolean;
    militaryTime: string;
    showTimestampSeconds: string;
};

export const DATE_AND_TIME_SECTION = 'date_and_time';

const FORMAT_OPTIONS = [
    TimestampFormat.STANDARD,
    TimestampFormat.RELATIVE,
    TimestampFormat.DATE_AND_TIME,
];

export function isDateAndTimeSectionActive(activeSection: string): boolean {
    return activeSection === DATE_AND_TIME_SECTION ||
        activeSection === 'clock' ||
        activeSection === Preferences.TIMESTAMP_FORMAT;
}

function getClockDisplayShortLabel(militaryTime: string, intl: ReturnType<typeof useIntl>) {
    if (militaryTime === 'true') {
        return intl.formatMessage({
            id: 'user.settings.display.militaryClockShort',
            defaultMessage: '24-hour clock',
        });
    }

    return intl.formatMessage({
        id: 'user.settings.display.normalClockShort',
        defaultMessage: '12-hour clock',
    });
}

export default function DateTimeDisplayFormatSetting({
    active,
    areAllSectionsInactive,
    updateSection,
    configTimestampFormat,
    configShowTimestampSeconds,
    militaryTime,
    showTimestampSeconds,
}: Props) {
    const intl = useIntl();
    const dispatch = useDispatch();
    const userId = useSelector(getCurrentUserId);
    const configFormat = useSelector((state: GlobalState) => getConfig(state).DefaultTimestampFormat as TimestampFormat) || configTimestampFormat;
    const configSeconds = useSelector((state: GlobalState) => getConfig(state).ShowTimestampSeconds === 'true') || configShowTimestampSeconds;
    const effectiveFormat = useSelector(getTimestampFormat);
    const effectiveShowSeconds = useSelector(getShowTimestampSeconds);
    const effectiveMilitaryTime = useSelector(getUseMilitaryTime);

    const [formatSelection, setFormatSelection] = useState(effectiveFormat);
    const [clockSelection, setClockSelection] = useState(militaryTime);
    const [secondsSelection, setSecondsSelection] = useState(showTimestampSeconds);
    const minRef = useRef<SettingItemMinComponent>(null);

    useEffect(() => {
        if (!active && areAllSectionsInactive) {
            minRef.current?.focus();
        }
    }, [active, areAllSectionsInactive]);

    useEffect(() => {
        setFormatSelection(effectiveFormat);
    }, [effectiveFormat]);

    useEffect(() => {
        setClockSelection(militaryTime);
    }, [militaryTime]);

    useEffect(() => {
        setSecondsSelection(showTimestampSeconds);
    }, [showTimestampSeconds]);

    const handleUpdateSection = useCallback((section?: string) => {
        if (!section) {
            setFormatSelection(effectiveFormat);
            setClockSelection(militaryTime);
            setSecondsSelection(showTimestampSeconds);
        }
        updateSection(section);
    }, [effectiveFormat, militaryTime, showTimestampSeconds, updateSection]);

    const handleSubmit = useCallback(async () => {
        const preferencesToSave: PreferenceType[] = [];
        const preferencesToDelete: PreferenceType[] = [];

        const clockPreference: PreferenceType = {
            user_id: userId,
            category: Preferences.CATEGORY_DISPLAY_SETTINGS,
            name: Preferences.USE_MILITARY_TIME,
            value: clockSelection,
        };

        const secondsPreference: PreferenceType = {
            user_id: userId,
            category: Preferences.CATEGORY_DISPLAY_SETTINGS,
            name: Preferences.SHOW_TIMESTAMP_SECONDS,
            value: secondsSelection,
        };

        const formatPreference: PreferenceType = {
            user_id: userId,
            category: Preferences.CATEGORY_DISPLAY_SETTINGS,
            name: Preferences.TIMESTAMP_FORMAT,
            value: formatSelection,
        };

        if (clockSelection === Preferences.USE_MILITARY_TIME_DEFAULT) {
            preferencesToDelete.push(clockPreference);
        } else {
            preferencesToSave.push(clockPreference);
        }

        if (secondsSelection === (configSeconds ? 'true' : 'false')) {
            preferencesToDelete.push(secondsPreference);
        } else {
            preferencesToSave.push(secondsPreference);
        }

        if (formatSelection === configFormat) {
            preferencesToDelete.push(formatPreference);
        } else {
            preferencesToSave.push(formatPreference);
        }

        if (preferencesToDelete.length > 0) {
            await dispatch(deletePreferences(userId, preferencesToDelete));
        }

        if (preferencesToSave.length > 0) {
            await dispatch(savePreferences(userId, preferencesToSave));
        }

        updateSection('');
    }, [clockSelection, configFormat, configSeconds, dispatch, formatSelection, secondsSelection, updateSection, userId]);

    const summary = intl.formatMessage({
        id: 'user.settings.display.dateAndTimeSummary',
        defaultMessage: '{clock}{secondsPrefix}{formatPrefix}',
    }, {
        clock: getClockDisplayShortLabel(effectiveMilitaryTime ? 'true' : 'false', intl),
        secondsPrefix: effectiveShowSeconds ? intl.formatMessage({
            id: 'user.settings.display.dateAndTimeSummarySeconds',
            defaultMessage: ', with seconds',
        }) : '',
        formatPrefix: intl.formatMessage({
            id: 'user.settings.display.dateAndTimeSummaryFormat',
            defaultMessage: ' · {format}',
        }, {
            format: getTimestampFormatShortLabel(effectiveFormat, intl),
        }),
    });

    const labelOptions = {
        useMilitaryTime: clockSelection === 'true',
        showTimestampSeconds: secondsSelection === 'true',
    };
    const showSecondsSetting = supportsTimestampSeconds(formatSelection);

    if (active) {
        return (
            <SettingItemMax
                title={
                    <FormattedMessage
                        id='user.settings.display.dateAndTimeTitle'
                        defaultMessage='Date and Time'
                    />
                }
                inputs={[
                    <fieldset key='clockDisplaySetting'>
                        <legend className='form-legend'>
                            <FormattedMessage
                                id='user.settings.display.clockDisplay'
                                defaultMessage='Clock Display'
                            />
                        </legend>
                        <div className='radio'>
                            <label>
                                <input
                                    id='dateAndTimeClockFormatA'
                                    type='radio'
                                    name='dateAndTimeClockFormat'
                                    checked={clockSelection === 'false'}
                                    onChange={() => setClockSelection('false')}
                                />
                                <FormattedMessage
                                    id='user.settings.display.normalClock'
                                    defaultMessage='12-hour clock (example: 4:00 PM)'
                                />
                            </label>
                            <br/>
                        </div>
                        <div className='radio'>
                            <label>
                                <input
                                    id='dateAndTimeClockFormatB'
                                    type='radio'
                                    name='dateAndTimeClockFormat'
                                    checked={clockSelection === 'true'}
                                    onChange={() => setClockSelection('true')}
                                />
                                <FormattedMessage
                                    id='user.settings.display.militaryClock'
                                    defaultMessage='24-hour clock (example: 16:00)'
                                />
                            </label>
                            <br/>
                        </div>
                    </fieldset>,
                    <React.Fragment key='timestampFormatSetting'>
                        <hr/>
                        <fieldset className='timestamp-format-setting'>
                            <legend className='form-legend'>
                                <FormattedMessage
                                    id='user.settings.display.timestampFormatTitle'
                                    defaultMessage='Timestamp Format'
                                />
                            </legend>
                            <div className='timestamp-format-options'>
                                {FORMAT_OPTIONS.map((format) => (
                                    <div
                                        className='radio'
                                        key={format}
                                    >
                                        <label>
                                            <input
                                                id={`timestampFormat-${format}`}
                                                type='radio'
                                                name='timestampFormat'
                                                checked={formatSelection === format}
                                                onChange={() => setFormatSelection(format)}
                                            />
                                            {getTimestampFormatLabel(format, intl, labelOptions)}
                                        </label>
                                        <br/>
                                    </div>
                                ))}
                            </div>
                            {showSecondsSetting && (
                                <div className='checkbox'>
                                    <label>
                                        <input
                                            id='dateAndTimeShowSeconds'
                                            type='checkbox'
                                            checked={secondsSelection === 'true'}
                                            onChange={() => setSecondsSelection(secondsSelection === 'true' ? 'false' : 'true')}
                                        />
                                        <FormattedMessage
                                            id='user.settings.display.showTimestampSeconds'
                                            defaultMessage='Show seconds in timestamps (example: {timeExample})'
                                            values={{
                                                timeExample: getTimestampFormatTimeExample(labelOptions),
                                            }}
                                        />
                                    </label>
                                </div>
                            )}
                        </fieldset>
                    </React.Fragment>,
                ]}
                submit={handleSubmit}
                updateSection={handleUpdateSection}
            />
        );
    }

    return (
        <div>
            <SettingItemMin
                ref={minRef}
                title={
                    <FormattedMessage
                        id='user.settings.display.dateAndTimeTitle'
                        defaultMessage='Date and Time'
                    />
                }
                describe={summary}
                section={DATE_AND_TIME_SECTION}
                updateSection={handleUpdateSection}
            />
            <div className='divider-dark'/>
        </div>
    );
}
