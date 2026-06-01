// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useEffect, useRef, useState} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';

import {DateTimeDisplayFormat} from '@mattermost/types/config';
import type {PreferenceType} from '@mattermost/types/preferences';

import {deletePreferences, savePreferences} from 'mattermost-redux/actions/preferences';
import {getConfig} from 'mattermost-redux/selectors/entities/general';
import {getDateTimeDisplayFormat} from 'mattermost-redux/selectors/entities/preferences';
import {getCurrentUserId} from 'mattermost-redux/selectors/entities/users';

import SettingItemMax from 'components/setting_item_max';
import SettingItemMin from 'components/setting_item_min';
import type SettingItemMinComponent from 'components/setting_item_min';

import {Preferences} from 'utils/constants';
import {getDateTimeDisplayFormatLabel, getDateTimeDisplayFormatShortLabel} from 'utils/datetime_display_format';

import type {GlobalState} from 'types/store';

type Props = {
    active: boolean;
    areAllSectionsInactive: boolean;
    updateSection: (section?: string) => void;
    configDateTimeDisplayFormat: DateTimeDisplayFormat;
    militaryTime: string;
};

export const DATE_AND_TIME_SECTION = 'date_and_time';

const FORMAT_OPTIONS = [
    DateTimeDisplayFormat.COMPACT,
    DateTimeDisplayFormat.TIME_SECONDS,
    DateTimeDisplayFormat.ISO_DATETIME,
];

export function isDateAndTimeSectionActive(activeSection: string): boolean {
    return activeSection === DATE_AND_TIME_SECTION ||
        activeSection === 'clock' ||
        activeSection === Preferences.DATETIME_DISPLAY_FORMAT;
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
    configDateTimeDisplayFormat,
    militaryTime,
}: Props) {
    const intl = useIntl();
    const dispatch = useDispatch();
    const userId = useSelector(getCurrentUserId);
    const configFormat = useSelector((state: GlobalState) => getConfig(state).DateTimeDisplayFormat as DateTimeDisplayFormat) || configDateTimeDisplayFormat;
    const effectiveFormat = useSelector(getDateTimeDisplayFormat);

    const [formatSelection, setFormatSelection] = useState(effectiveFormat);
    const [clockSelection, setClockSelection] = useState(militaryTime);
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

    const handleUpdateSection = useCallback((section?: string) => {
        if (!section) {
            setFormatSelection(effectiveFormat);
            setClockSelection(militaryTime);
        }
        updateSection(section);
    }, [effectiveFormat, militaryTime, updateSection]);

    const handleSubmit = useCallback(async () => {
        const preferencesToSave: PreferenceType[] = [{
            user_id: userId,
            category: Preferences.CATEGORY_DISPLAY_SETTINGS,
            name: Preferences.USE_MILITARY_TIME,
            value: clockSelection,
        }];

        const formatPreference: PreferenceType = {
            user_id: userId,
            category: Preferences.CATEGORY_DISPLAY_SETTINGS,
            name: Preferences.DATETIME_DISPLAY_FORMAT,
            value: formatSelection,
        };

        if (formatSelection === configFormat) {
            await dispatch(deletePreferences(userId, [formatPreference]));
        } else {
            preferencesToSave.push(formatPreference);
        }

        await dispatch(savePreferences(userId, preferencesToSave));
        updateSection('');
    }, [clockSelection, configFormat, dispatch, formatSelection, updateSection, userId]);

    const summary = intl.formatMessage({
        id: 'user.settings.display.dateAndTimeSummary',
        defaultMessage: '{clock}, {format}',
    }, {
        clock: getClockDisplayShortLabel(militaryTime, intl),
        format: getDateTimeDisplayFormatShortLabel(effectiveFormat, intl),
    });

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
                    <React.Fragment key='dateTimeDisplayFormatSetting'>
                        <hr/>
                        <fieldset>
                            <legend className='form-legend'>
                                <FormattedMessage
                                    id='user.settings.display.dateTimeDisplayFormatTitle'
                                    defaultMessage='Timestamp Format'
                                />
                            </legend>
                            {FORMAT_OPTIONS.map((format) => (
                                <div
                                    className='radio'
                                    key={format}
                                >
                                    <label>
                                        <input
                                            id={`dateTimeDisplayFormat-${format}`}
                                            type='radio'
                                            name='dateTimeDisplayFormat'
                                            checked={formatSelection === format}
                                            onChange={() => setFormatSelection(format)}
                                        />
                                        {getDateTimeDisplayFormatLabel(format, intl)}
                                    </label>
                                    <br/>
                                </div>
                            ))}
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
