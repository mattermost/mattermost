// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import React, {useState} from 'react'
import {IntlShape, useIntl} from 'react-intl'
import DayPickerInput from 'react-day-picker/DayPickerInput'
import MomentLocaleUtils from 'react-day-picker/moment'

import {Utils} from 'src/utils'

import 'react-day-picker/lib/style.css'
import './editableDayPicker.scss'

type Props = {
    className: string
    value: string
    onChange: (value: string | undefined) => void
}

const loadedLocales: Record<string, moment.Locale> = {}

const updateLocales = (locale: string) => {
    if (locale && locale !== 'en' && !loadedLocales[locale]) {
        // eslint-disable-next-line global-require
        loadedLocales[locale] = require(`moment/locale/${locale}`)
    }
}

const parseValue = (value: string): Date | undefined => {
    return value ? new Date(parseInt(value, 10)) : undefined
}

const displayDate = (date: Date | undefined, intl: IntlShape): string | undefined => {
    if (date === undefined) {
        return undefined
    }

    return Utils.displayDate(date, intl)
}

const dateFormat = 'MM/DD/YYYY'

function EditableDayPicker(props: Props): JSX.Element {
    const {className, onChange} = props
    const intl = useIntl()
    const [value, setValue] = useState(() => parseValue(props.value))
    const [dayPickerVisible, setDayPickerVisible] = useState(false)

    const locale = intl.locale.toLowerCase()
    updateLocales(locale)

    const saveSelection = () => {
        onChange(value?.getTime().toString())
    }

    const inputValue = dayPickerVisible ? value : displayDate(value, intl)

    const parseDate = (str: string, format: string, withLocale: string) => {
        if (str === inputValue) {
            return value
        }

        return MomentLocaleUtils.parseDate(str, format, withLocale)
    }

    return (
        <div className={'EditableDayPicker ' + className}>
            <DayPickerInput
                value={inputValue}
                onDayChange={(day: Date) => setValue(day)}
                onDayPickerShow={() => setDayPickerVisible(true)}
                onDayPickerHide={() => {
                    setDayPickerVisible(false)
                    saveSelection()
                }}
                inputProps={{
                    onKeyUp: (e: KeyboardEvent) => {
                        if (e.key === 'Enter') {
                            saveSelection()
                        }
                    },
                }}
                dayPickerProps={{
                    locale,
                    localeUtils: MomentLocaleUtils,
                    todayButton: intl.formatMessage({id: 'EditableDayPicker.today', defaultMessage: 'Today'}),
                }}
                formatDate={MomentLocaleUtils.formatDate}
                parseDate={parseDate}
                format={dateFormat}
                placeholder={dateFormat}
            />
        </div>
    )
}

export default EditableDayPicker
