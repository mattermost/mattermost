// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import type {CSSProperties, ReactElement} from 'react';
import React, {useEffect, useState} from 'react';
import {useIntl} from 'react-intl';
import {useDispatch} from 'react-redux';
import {components} from 'react-select';
import type {IndicatorContainerProps, ControlProps, OptionProps, OptionsType, ValueType, StylesConfig} from 'react-select';
import AsyncSelect from 'react-select/async';

import type {Team, TeamSearchOpts} from '@mattermost/types/teams';

import {getTeams, searchTeams} from 'mattermost-redux/actions/teams';
import type {ActionResult} from 'mattermost-redux/types/actions';

import InputError from 'components/input_error';
import LoadingSpinner from 'components/widgets/loading/loading_spinner';

import {TeamFilters} from '../../constants';
import {getDefaultSelectedTeam} from '../../utils';

import './async_team_select.scss';

const TEAMS_PER_PAGE = 50;

export type OptionType = {
    label: string | ReactElement;
    value: string;
}

interface Props {
    className?: string;
    error?: string;
    initialValue: Team['id'];
    initialLabel?: string;
    onChange: (value: Team['id'], label?: string) => void;
}

export function SystemUsersFilterTeam(props: Props) {
    const {formatMessage} = useIntl();

    const dispatch = useDispatch();

    const [error, setError] = useState('');

    const [list, setList] = useState<OptionsType<OptionType>>();
    const [pageNumber, setPageNumber] = useState(0);
    const [value, setValue] = useState<ValueType<OptionType>>(getDefaultSelectedTeam(props.initialValue, props.initialLabel));

    async function loadListInPageNumber(page: number) {
        try {
            const response = await dispatch(getTeams(page, TEAMS_PER_PAGE, true)) as ActionResult<{teams: Team[]}>;
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
                            label: formatMessage({id: 'admin.system_users.filters.team.allTeams', defaultMessage: 'All teams'}),
                            value: TeamFilters.AllTeams,
                        },
                        {
                            label: formatMessage({id: 'admin.system_users.filters.team.noTeams', defaultMessage: 'No teams'}),
                            value: TeamFilters.NoTeams,
                        },
                    ];
                    setList([...initialOptions, ...list]);
                } else {
                    setList((existingList) => [...(existingList ?? []), ...list]);
                }

                setPageNumber(page + 1);
            }
        } catch (error) {
            setError(formatMessage({id: 'admin.system_users.filters.team.errorLoading', defaultMessage: 'Error while loading teams'}));
            console.error(error); // eslint-disable-line no-console
        }
    }

    async function searchInList(term: string, callBack: (options: OptionsType<{label: string; value: string}>) => void) {
        try {
            const response = await dispatch(searchTeams(term, {page: 0, per_page: TEAMS_PER_PAGE} as TeamSearchOpts));
            if (response && response.data && response.data.teams && response.data.teams.length > 0) {
                const teams = response.data.teams.map((team: Team) => ({
                    value: team.id,
                    label: team.display_name,
                }));

                callBack(teams);
            }

            callBack([]);
        } catch (error) {
            setError(formatMessage({id: 'admin.system_users.filters.team.errorSearching', defaultMessage: 'Error while searching teams'}));
            console.error(error); // eslint-disable-line no-console
            callBack([]);
        }
    }

    function handleMenuScrolledToBottom() {
        loadListInPageNumber(pageNumber);
    }

    function handleOnChange(value: ValueType<OptionType>) {
        setValue(value);
        props.onChange((value as OptionType).value as string, (value as OptionType).label as string);
    }

    useEffect(() => {
        loadListInPageNumber(0);
    }, []);

    return (
        <div
            className='DropdownInput Input_container'
        >
            <fieldset
                className={classNames('Input_fieldset Input_fieldset___legend', props.className, {
                    Input_fieldset___error: props.error || error,
                })}
            >
                <legend className='Input_legend Input_legend___focus'>
                    {formatMessage({id: 'admin.system_users.filters.team.title', defaultMessage: 'Team'})}
                </legend>
                <div className='Input_wrapper'>
                    <AsyncSelect
                        id='asyncTeamSelect'
                        inputId='asyncTeamSelectInput'
                        classNamePrefix='DropDown'
                        className={classNames('Input Input__focus', props.className)}
                        styles={styles}
                        isMulti={false}
                        isClearable={false}
                        hideSelectedOptions={false}
                        cacheOptions={false}
                        placeholder={''} // Since we have a default value, we don't need placeholder
                        loadingMessage={() => formatMessage({id: 'admin.channels.filterBy.team.loading', defaultMessage: 'Loading teams'})}
                        noOptionsMessage={() => formatMessage({id: 'admin.channels.filterBy.team.noTeams', defaultMessage: 'No teams found'})}
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
                message={props.error || error}
            />
        </div>
    );
}

const styles: Partial<StylesConfig> = {
    input: (provided: CSSProperties) => ({
        ...provided,
        color: 'var(--center-channel-color)',
    }),
    control: (provided: CSSProperties) => ({
        ...provided,
        border: 'none',
        boxShadow: 'none',
        padding: '0 2px',
        cursor: 'pointer',
    }),
    indicatorSeparator: (provided: CSSProperties) => ({
        ...provided,
        display: 'none',
    }),
    menu: (provided: CSSProperties) => ({
        ...provided,
        zIndex: 100,
    }),
    menuPortal: (provided: CSSProperties) => ({
        ...provided,
        zIndex: 100,
    }),
};

const IndicatorsContainer = (props: IndicatorContainerProps<OptionType>) => {
    return (
        <div className='asyncTeamSelectInput__indicatorsContainer'>
            <components.IndicatorsContainer {...props}>
                <i className='icon icon-chevron-down'/>
            </components.IndicatorsContainer>
        </div>
    );
};

const Control = (props: ControlProps<OptionType>) => {
    return (
        <div className='asyncTeamSelectInput__controlContainer'>
            <components.Control {...props}/>
        </div>
    );
};

const Option = (props: OptionProps<OptionType>) => {
    return (
        <div
            className={classNames('asyncTeamSelectInput__option', {
                selected: props.isSelected,
                focused: props.isFocused,
            })}
        >
            <components.Option {...props}/>
        </div>
    );
};

const LoadingIndicator = () => {
    return (
        <LoadingSpinner/>
    );
};

