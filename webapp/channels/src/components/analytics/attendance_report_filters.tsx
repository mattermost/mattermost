import React, {useRef, useState, useEffect, useMemo, useCallback, ReactElement} from 'react';
import {DayPicker} from 'react-day-picker';
import {useIntl, FormattedMessage} from 'react-intl';
import {useDispatch} from 'react-redux';
import {components} from 'react-select';
import type {IndicatorsContainerProps, ControlProps, OptionProps, Options, OnChangeValue, StylesConfig} from 'react-select';
import AsyncSelect from 'react-select/async';
import classNames from 'classnames';

import type {Team, TeamSearchOpts} from '@mattermost/types/teams';
import {getTeams, searchTeams} from 'mattermost-redux/actions/teams';
import type {ActionResult} from 'mattermost-redux/types/actions';

import Input from 'components/widgets/inputs/input/input';
import InputError from 'components/input_error';
import LoadingSpinner from 'components/widgets/loading/loading_spinner';

import {TeamFilters} from 'components/admin_console/system_users/constants';
import {getDefaultSelectedTeam} from 'components/admin_console/system_users/utils';

import 'react-day-picker/dist/style.css';
import 'components/admin_console/system_users/system_users_filters_popover/system_users_filter_team/async_team_select.scss';
import './attendance_report.scss';

const TEAMS_PER_PAGE = 50;

type OptionType = {
    label: string | ReactElement;
    value: string;
}

type SearchProps = {
    term: string;
    onSearch: (term: string) => void;
}

export function AttendanceReportSearch({ term, onSearch }: SearchProps) {
    const { formatMessage } = useIntl();
    const [inputValue, setInputValue] = useState(term);
    const timeout = useRef<NodeJS.Timeout>();

    function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
        const { target: { value } } = event;
        setInputValue(value);

        clearTimeout(timeout.current);
        timeout.current = setTimeout(() => {
            onSearch(value);
        }, 500);
    }

    function handleClear() {
        setInputValue('');
        onSearch('');
    }

    return (
        <div className='system-users__filter'>
            <Input
                type='text'
                clearable={true}
                name='searchTerm'
                containerClassName='systemUsersSearch'
                placeholder={formatMessage({ id: 'analytics.attendance.searchPlaceholder', defaultMessage: 'Search by username...' })}
                inputPrefix={<i className={'icon icon-magnify'} />}
                onChange={handleChange}
                onClear={handleClear}
                value={inputValue}
            />
        </div>
    );
}

type DateFilterProps = {
    month: string;
    onChange: (val: string) => void;
    selectedDay: number;
    onDayChange: (day: number) => void;
    filterMode: 'month' | 'date';
    onFilterModeChange: (mode: 'month' | 'date') => void;
}

type MonthPickerProps = {
    month: string;  // YYYY-MM
    onChange: (val: string) => void;
    locale: string;
}

function MonthPicker({month, onChange, locale}: MonthPickerProps) {
    const [yearNum, monthNum] = useMemo(() => {
        const [y, m] = month.split('-');
        return [parseInt(y, 10), parseInt(m, 10)];
    }, [month]);

    const [displayYear, setDisplayYear] = useState(yearNum);

    // Sync displayYear when prop changes externally
    useEffect(() => {
        setDisplayYear(yearNum);
    }, [yearNum]);

    const monthNames = useMemo(() =>
        Array.from({length: 12}, (_, i) =>
            new Intl.DateTimeFormat(locale, {month: 'short'}).format(new Date(2000, i, 1)),
        ),
    [locale]);

    const handleSelect = useCallback((m: number) => {
        const mStr = String(m).padStart(2, '0');
        onChange(`${displayYear}-${mStr}`);
    }, [displayYear, onChange]);

    return (
        <div className='attendance-month-picker'>
            <div className='attendance-month-picker__caption'>
                <button
                    type='button'
                    className='attendance-month-picker__nav'
                    onClick={() => setDisplayYear((y) => y - 1)}
                    aria-label='Previous year'
                >
                    <i className='icon icon-chevron-left'/>
                </button>
                <span className='attendance-month-picker__year'>{displayYear}</span>
                <button
                    type='button'
                    className='attendance-month-picker__nav'
                    onClick={() => setDisplayYear((y) => y + 1)}
                    aria-label='Next year'
                >
                    <i className='icon icon-chevron-right'/>
                </button>
            </div>
            <div className='attendance-month-picker__grid'>
                {monthNames.map((name, idx) => {
                    const m = idx + 1;
                    const isSelected = displayYear === yearNum && m === monthNum;
                    return (
                        <button
                            key={m}
                            type='button'
                            className={`attendance-month-picker__cell${isSelected ? ' selected' : ''}`}
                            onClick={() => handleSelect(m)}
                        >
                            {name}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}

export function AttendanceReportDateFilter({month, onChange, selectedDay, onDayChange, filterMode, onFilterModeChange}: DateFilterProps) {
    const {formatMessage, locale} = useIntl();
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    // Close dropdown on outside click
    useEffect(() => {
        function handleClickOutside(e: MouseEvent) {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Parse month string into year/month for the DayPicker
    const [yearNum, monthNum] = useMemo(() => {
        const [y, m] = month.split('-');
        return [parseInt(y, 10), parseInt(m, 10)];
    }, [month]);

    // The displayed month for DayPicker (0-indexed)
    const displayMonth = useMemo(() => new Date(yearNum, monthNum - 1, 1), [yearNum, monthNum]);

    // The selected date
    const selectedDate = useMemo(() => new Date(yearNum, monthNum - 1, selectedDay), [yearNum, monthNum, selectedDay]);

    // Clamp day if it exceeds days in month
    const daysInMonth = useMemo(() => new Date(yearNum, monthNum, 0).getDate(), [yearNum, monthNum]);
    useEffect(() => {
        if (selectedDay > daysInMonth) {
            onDayChange(daysInMonth);
        }
    }, [daysInMonth, selectedDay, onDayChange]);

    const handleDayClick = useCallback((day: Date) => {
        onDayChange(day.getDate());
        setIsOpen(false);
    }, [onDayChange]);

    const handleMonthChange = useCallback((newMonth: Date) => {
        const y = newMonth.getFullYear();
        const m = String(newMonth.getMonth() + 1).padStart(2, '0');
        onChange(`${y}-${m}`);
    }, [onChange]);

    const handleMonthSelect = useCallback((val: string) => {
        onChange(val);
        setIsOpen(false);
    }, [onChange]);

    const selectedLabel = useMemo(() => {
        if (filterMode === 'month') {
            return new Intl.DateTimeFormat(locale, {month: 'short', year: 'numeric'}).format(new Date(yearNum, monthNum - 1, 1));
        }
        return new Intl.DateTimeFormat(locale, {day: '2-digit', month: '2-digit', year: 'numeric'}).format(new Date(yearNum, monthNum - 1, selectedDay));
    }, [filterMode, locale, yearNum, monthNum, selectedDay]);

    return (
        <div
            className='attendance-date-filter'
            ref={containerRef}
        >
            <button
                type='button'
                className='attendance-date-filter__trigger'
                onClick={() => setIsOpen((v) => !v)}
            >
                <i className='icon icon-calendar-outline'/>
                <span>{selectedLabel}</span>
                <i className={`icon icon-chevron-${isOpen ? 'up' : 'down'}`}/>
            </button>
            {isOpen && (
                <div className='attendance-date-filter__dropdown'>
                    <div className='attendance-date-filter__segment'>
                        <button
                            className={`attendance-date-filter__seg-btn${filterMode === 'month' ? ' active' : ''}`}
                            onClick={() => onFilterModeChange('month')}
                            type='button'
                        >
                            <i className='icon icon-calendar-outline'/>
                            {formatMessage({id: 'analytics.attendance.filterByMonth', defaultMessage: 'By month'})}
                        </button>
                        <button
                            className={`attendance-date-filter__seg-btn${filterMode === 'date' ? ' active' : ''}`}
                            onClick={() => onFilterModeChange('date')}
                            type='button'
                        >
                            <i className='icon icon-calendar-today'/>
                            {formatMessage({id: 'analytics.attendance.filterByDate', defaultMessage: 'By day'})}
                        </button>
                    </div>
                    <div className='attendance-date-filter__calendar'>
                        {filterMode === 'month' ? (
                            <MonthPicker
                                month={month}
                                onChange={handleMonthSelect}
                                locale={locale}
                            />
                        ) : (
                            <DayPicker
                                mode='single'
                                month={displayMonth}
                                onMonthChange={handleMonthChange}
                                selected={selectedDate}
                                onSelect={(day) => day && handleDayClick(day)}
                                className='attendance-day-picker'
                            />
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

type TeamFilterProps = {
    filterTeam: string;
    filterTeamLabel?: string;
    onChange: (id: string, label?: string) => void;
}

export function AttendanceReportTeamFilter({ filterTeam, filterTeamLabel, onChange }: TeamFilterProps) {
    const { formatMessage } = useIntl();
    const dispatch = useDispatch();

    const [error, setError] = useState('');
    const [list, setList] = useState<Options<OptionType>>();
    const [pageNumber, setPageNumber] = useState(0);
    const [value, setValue] = useState<OnChangeValue<OptionType, false>>(getDefaultSelectedTeam(filterTeam, filterTeamLabel));

    async function loadListInPageNumber(page: number) {
        try {
            const response = await dispatch(getTeams(page, TEAMS_PER_PAGE, true)) as ActionResult<{ teams: Team[] }>;
            if (response && response.data && response.data.teams && response.data.teams.length > 0) {
                const list = response.data.teams.
                    map((team: Team) => ({
                        value: team.id,
                        label: team.display_name,
                    })).
                    sort((a: OptionType, b: OptionType) => (a.label as string).localeCompare(b.label as string));

                if (page === 0) {
                    const initialOptions = [
                        {
                            label: formatMessage({ id: 'admin.system_users.filters.team.allTeams', defaultMessage: 'All teams' }),
                            value: TeamFilters.AllTeams,
                        },
                    ];
                    setList([...initialOptions, ...list]);
                } else {
                    setList((existingList) => [...(existingList ?? []), ...list]);
                }

                setPageNumber(page + 1);
            }
        } catch (error) {
            setError(formatMessage({ id: 'admin.system_users.filters.team.errorLoading', defaultMessage: 'Error while loading teams' }));
            console.error(error); // eslint-disable-line no-console
        }
    }

    async function searchInList(term: string) {
        try {
            const response = await dispatch(searchTeams(term, { page: 0, per_page: TEAMS_PER_PAGE } as TeamSearchOpts));
            if (response && response.data && response.data.teams && response.data.teams.length > 0) {
                const teams = response.data.teams.map((team: Team) => ({
                    value: team.id,
                    label: team.display_name,
                }));

                return teams;
            }

            return [];
        } catch (error) {
            setError(formatMessage({ id: 'admin.system_users.filters.team.errorSearching', defaultMessage: 'Error while searching teams' }));
            console.error(error); // eslint-disable-line no-console
            return [];
        }
    }

    function handleMenuScrolledToBottom() {
        loadListInPageNumber(pageNumber);
    }

    function handleOnChange(value: OnChangeValue<OptionType, false>) {
        setValue(value);
        onChange((value as OptionType).value as string, (value as OptionType).label as string);
    }

    useEffect(() => {
        loadListInPageNumber(0);
    }, []);

    // We reuse the styling from SystemUsersFilterTeam but render it inline
    const className = 'attendanceTeamFilter';

    return (
        <div className='system-users__filter' style={{ minWidth: '200px' }}>
            <div
                className='DropdownInput Input_container'
            >
                <fieldset
                    className={classNames('Input_fieldset Input_fieldset___legend', className, {
                        Input_fieldset___error: error,
                    })}
                >
                    <legend className='Input_legend Input_legend___focus'>
                        {formatMessage({ id: 'admin.system_users.filters.team.title', defaultMessage: 'Team' })}
                    </legend>
                    <div className='Input_wrapper'>
                        <AsyncSelect
                            id='asyncTeamSelect'
                            inputId='asyncTeamSelectInput'
                            classNamePrefix='DropDown'
                            className={classNames('Input Input__focus', className)}
                            styles={styles}
                            isMulti={false}
                            isClearable={false}
                            hideSelectedOptions={false}
                            cacheOptions={false}
                            placeholder={''}
                            loadingMessage={() => formatMessage({ id: 'admin.channels.filterBy.team.loading', defaultMessage: 'Loading teams' })}
                            noOptionsMessage={() => formatMessage({ id: 'admin.channels.filterBy.team.noTeams', defaultMessage: 'No teams found' })}
                            loadOptions={searchInList}
                            defaultOptions={list}
                            value={value}
                            onChange={handleOnChange}
                            onMenuScrollToBottom={handleMenuScrolledToBottom}
                            components={{
                                IndicatorsContainer,
                                LoadingIndicator,
                                Option,
                                Control,
                            }}
                        />
                    </div>
                </fieldset>
                <InputError
                    message={error}
                />
            </div>
        </div>
    );
}

const styles = {
    input: (provided) => ({
        ...provided,
        color: 'var(--center-channel-color)',
    }),
    control: (provided) => ({
        ...provided,
        border: 'none',
        boxShadow: 'none',
        padding: '0 2px',
        cursor: 'pointer',
    }),
    indicatorSeparator: (provided) => ({
        ...provided,
        display: 'none',
    }),
    menu: (provided) => ({
        ...provided,
        zIndex: 100,
    }),
    menuPortal: (provided) => ({
        ...provided,
        zIndex: 100,
    }),
} satisfies Partial<StylesConfig<OptionType, false>>;

const IndicatorsContainer = (props: IndicatorsContainerProps<OptionType, false>) => {
    return (
        <div className='asyncTeamSelectInput__indicatorsContainer'>
            <components.IndicatorsContainer {...props}>
                <i className='icon icon-chevron-down' />
            </components.IndicatorsContainer>
        </div>
    );
};

const Control = (props: ControlProps<OptionType, false>) => {
    return (
        <div className='asyncTeamSelectInput__controlContainer'>
            <components.Control {...props} />
        </div>
    );
};

const Option = (props: OptionProps<OptionType, false>) => {
    return (
        <div
            className={classNames('asyncTeamSelectInput__option', {
                selected: props.isSelected,
                focused: props.isFocused,
            })}
        >
            <components.Option {...props} />
        </div>
    );
};

export const LoadingIndicator = () => {
    return (
        <LoadingSpinner />
    );
};
