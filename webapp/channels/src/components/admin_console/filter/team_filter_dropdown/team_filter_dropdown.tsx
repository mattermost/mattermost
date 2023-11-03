// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect, useState} from 'react';
import {useIntl} from 'react-intl';
import type {ActionMeta, OptionsType, ValueType} from 'react-select';
import AsyncSelect from 'react-select/async';

import type {Team} from '@mattermost/types/teams';

import type {ActionResult} from 'mattermost-redux/types/actions';

import LoadingSpinner from 'components/widgets/loading/loading_spinner';

import type {FilterOption, FilterValues} from '../filter';

import type {PropsFromRedux} from './index';

import './team_filter_dropdown.scss';
import '../filter.scss';

const TEAMS_PER_PAGE = 50;

type SelectOption = {label: string; value: string}

export interface Props extends PropsFromRedux {
    option: FilterOption;
    updateValues: (values: FilterValues, optionKey: string) => void;
}

function TeamFilterDropdown(props: Props) {
    const {formatMessage} = useIntl();

    const [list, setList] = useState<OptionsType<{label: string; value: string}>>([]);
    const [page, setPage] = useState(0);

    async function load(page: number) {
        try {
            const response = await props.getTeams(page, TEAMS_PER_PAGE, true) as ActionResult<{teams: Team[]}>;
            if (response && response.data && response.data.teams && response.data.teams.length > 0) {
                const list = response.data.teams.
                    map((team: Team) => ({
                        value: team.id,
                        label: team.display_name,
                    })).
                    sort((a: SelectOption, b: SelectOption) => a.label.localeCompare(b.label));

                if (page === 0) {
                    setList(list);
                } else {
                    setList((existingList) => [...existingList, ...list]);
                }

                setPage(page + 1);
            }
        } catch (error) {
            console.error(error); // eslint-disable-line no-console
        }
    }

    async function search(term: string, callBack: (options: OptionsType<{label: string; value: string}>) => void) {
        try {
            const response = await props.searchTeams(term, {page: 0, per_page: TEAMS_PER_PAGE}) as ActionResult<{teams: Team[]}>;
            if (response && response.data && response.data.teams && response.data.teams.length > 0) {
                const teams = response.data.teams.map((team: Team) => ({
                    value: team.id,
                    label: team.display_name,
                }));

                callBack(teams);
            }

            callBack([]);
        } catch (error) {
            callBack([]);
        }
    }

    useEffect(() => {
        load(0);
    }, []);

    function handleMenuScrollToBottom() {
        load(page);
    }

    function handleOnChange(value: ValueType<SelectOption>, actionMeta: ActionMeta<SelectOption>) {
        if (!actionMeta.action) {
            return;
        }

        let selected = [];
        if (Array.isArray(value) && value.length > 0) {
            selected = value.map((v) => v.value);
        }

        if (actionMeta.action === 'clear') {
            props.updateValues({team_ids: {name: 'Teams', value: []}}, 'teams');
        } else if (actionMeta.action === 'select-option' || actionMeta.action === 'remove-value') {
            props.updateValues({team_ids: {name: 'Teams', value: selected}}, 'teams');
        }
    }

    return (
        <div className='FilterList FilterList__full'>
            <div className='FilterList_name'>
                {props.option.name}
            </div>
            <AsyncSelect
                inputId='adminConsoleTeamFilterDropdown'
                cacheOptions={true}
                isMulti={true}
                isClearable={true}
                placeholder={formatMessage({id: 'admin.channels.filterBy.team.placeholder', defaultMessage: 'Search and select teams'})}
                loadOptions={search}
                defaultOptions={list}
                onMenuScrollToBottom={handleMenuScrollToBottom}
                onChange={handleOnChange}
                isLoading={true}
                hideSelectedOptions={true}
                loadingMessage={() => formatMessage({id: 'admin.channels.filterBy.team.loading', defaultMessage: 'Loading teams'})}
                noOptionsMessage={() => formatMessage({id: 'admin.channels.filterBy.team.noTeams', defaultMessage: 'No teams found'})}
                components={{
                    LoadingIndicator: () => <LoadingSpinner/>,
                }}
            />
        </div>
    );
}

export default TeamFilterDropdown;
