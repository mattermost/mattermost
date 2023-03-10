// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import React, {useState, useCallback} from 'react'
import {useIntl} from 'react-intl'
import {DateUtils} from 'react-day-picker'
import MomentLocaleUtils from 'react-day-picker/moment'
import DayPicker from 'react-day-picker/DayPicker'

import moment from 'moment'

import mutator from 'src/mutator'

import Editable from 'src/widgets/editable'
import Button from 'src/widgets/buttons/button'
import {BoardView} from 'src/blocks/boardView'

import Modal from 'src/components/modal'
import ModalWrapper from 'src/components/modalWrapper'
import {Utils} from 'src/utils'

import 'react-day-picker/lib/style.css'
import './dateFilter.scss'

import {FilterClause} from 'src/blocks/filterClause'
import {createFilterGroup} from 'src/blocks/filterGroup'

export type DateProperty = {
    from?: number
    to?: number
    includeTime?: boolean
    timeZone?: string
}

type Props = {
    view: BoardView
    filter: FilterClause
}

const loadedLocales: Record<string, moment.Locale> = {}

function DateFilter(props: Props): JSX.Element {
    const {filter, view} = props
    const [showDialog, setShowDialog] = useState(false)

    const filterValue = filter.values

    let dateValue: Date | undefined
    if (filterValue && filterValue.length > 0) {
        dateValue = new Date(parseInt(filterValue[0], 10))
    }

    const [value, setValue] = useState(dateValue)
    const intl = useIntl()

    const onChange = useCallback((newValue) => {
        if (value !== newValue) {
            const adjustedValue = newValue ? new Date(newValue.getTime() - timeZoneOffset(newValue.getTime())) : undefined
            setValue(adjustedValue)

            const filterIndex = view.fields.filter.filters.indexOf(filter)
            Utils.assert(filterIndex >= 0, "Can't find filter")

            const filterGroup = createFilterGroup(view.fields.filter)
            const newFilter = filterGroup.filters[filterIndex] as FilterClause
            Utils.assert(newFilter, `No filter at index ${filterIndex}`)

            newFilter.values = []
            if (adjustedValue) {
                newFilter.values = [adjustedValue.getTime().toString()]
            }
            mutator.changeViewFilter(view.boardId, view.id, view.fields.filter, filterGroup)
        }
    }, [value, view.boardId, view.id, view.fields.filter])

    const getDisplayDate = (date: Date | null | undefined) => {
        let displayDate = ''
        if (date) {
            displayDate = Utils.displayDate(date, intl)
        }
        return displayDate
    }

    const timeZoneOffset = (date: number): number => {
        return new Date(date).getTimezoneOffset() * 60 * 1000
    }

    // Keep date value as UTC, property dates are stored as 12:00 pm UTC
    // date will need converted to local time, to ensure date stays consistent
    // dateFrom / dateTo will be used for input and calendar dates
    const offsetDate = value ? new Date(value.getTime() + timeZoneOffset(value.getTime())) : undefined
    const [input, setInput] = useState<string>(getDisplayDate(offsetDate))

    const locale = intl.locale.toLowerCase()
    if (locale && locale !== 'en' && !loadedLocales[locale]) {
        // eslint-disable-next-line global-require
        loadedLocales[locale] = require(`moment/locale/${locale}`)
    }

    const handleTodayClick = (day: Date) => {
        day.setHours(12)
        saveValue(day)
    }

    const handleDayClick = (day: Date) => {
        saveValue(day)
    }

    const onClear = () => {
        saveValue(undefined)
    }

    const saveValue = (newValue: Date | undefined) => {
        onChange(newValue)
        setInput(newValue ? Utils.inputDate(newValue, intl) : '')
    }

    const onClose = () => {
        setShowDialog(false)
    }

    let displayValue = ''
    if (offsetDate) {
        displayValue = getDisplayDate(offsetDate)
    }

    let buttonText = displayValue
    if (!buttonText) {
        buttonText = intl.formatMessage({id: 'DateFilter.empty', defaultMessage: 'Empty'})
    }

    const className = 'DateFilter'
    return (
        <div className={`DateFilter ${displayValue ? '' : 'empty'} `}>
            <Button
                onClick={() => setShowDialog(true)}
            >
                {buttonText}
            </Button>

            {showDialog &&
            <ModalWrapper>
                <Modal
                    onClose={() => onClose()}
                >
                    <div
                        className={className + '-overlayWrapper'}
                    >
                        <div className={className + '-overlay'}>
                            <div className={'inputContainer'}>
                                <Editable
                                    value={input}
                                    placeholderText={moment.localeData(locale).longDateFormat('L')}
                                    onFocus={() => {
                                        if (offsetDate) {
                                            return setInput(Utils.inputDate(offsetDate, intl))
                                        }
                                        return undefined
                                    }}
                                    onChange={setInput}
                                    onSave={() => {
                                        const newDate = MomentLocaleUtils.parseDate(input, 'L', intl.locale)
                                        if (newDate && DateUtils.isDate(newDate)) {
                                            newDate.setHours(12)
                                            saveValue(newDate)
                                        } else {
                                            setInput(getDisplayDate(offsetDate))
                                        }
                                    }}
                                    onCancel={() => {
                                        setInput(getDisplayDate(offsetDate))
                                    }}
                                />
                            </div>
                            <DayPicker
                                onDayClick={handleDayClick}
                                initialMonth={offsetDate || new Date()}
                                showOutsideDays={false}
                                locale={locale}
                                localeUtils={MomentLocaleUtils}
                                todayButton={intl.formatMessage({id: 'DateRange.today', defaultMessage: 'Today'})}
                                onTodayButtonClick={handleTodayClick}
                                month={offsetDate}
                                selectedDays={offsetDate}
                            />
                            <hr/>
                            <div
                                className='MenuOption menu-option'
                            >
                                <Button
                                    onClick={onClear}
                                >
                                    {intl.formatMessage({id: 'DateRange.clear', defaultMessage: 'Clear'})}
                                </Button>
                            </div>
                        </div>
                    </div>
                </Modal>
            </ModalWrapper>
            }
        </div>
    )
}

export default DateFilter
