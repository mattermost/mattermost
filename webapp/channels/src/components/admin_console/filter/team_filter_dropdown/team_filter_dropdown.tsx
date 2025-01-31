// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect, useState} from 'react';
import {useIntl} from 'react-intl';
import type {ActionMeta, Options, OnChangeValue} from 'react-select';
import AsyncSelect from 'react-select/async';

import type {PagedTeamSearchOpts, Team} from '@mattermost/types/teams';

import type {ActionResult} from 'mattermost-redux/types/actions';

import LoadingSpinner from 'components/widgets/loading/loading_spinner';

import type {FilterOption, FilterValues} from '../filter';

import type {PropsFromRedux} from './index';

const TEAMS_PER_PAGE = 50;

type TeamSelectOption = {label: string; value: string}

export interface Props extends PropsFromRedux {
    option: FilterOption;
    updateValues: (values: FilterValues, optionKey: string) => void;
}

function TeamFilterDropdown(props: Props) {
    const {formatMessage} = useIntl();

    const [list, setList] = useState<Options<TeamSelectOption>>([]);
    const [pageNumber, setPageNumber] = useState(0);

    async function loadListInPageNumber(page: number) {
        try {
            const response = await props.getTeams(page, TEAMS_PER_PAGE, true) as ActionResult<{teams: Team[]}>;
            if (response && response.data && response.data.teams && response.data.teams.length > 0) {
                const list = response.data.teams.
                    map((team: Team) => ({
                        value: team.id,
                        label: team.display_name,
                    })).
                    sort((a: TeamSelectOption, b: TeamSelectOption) => a.label.localeCompare(b.label));

                if (page === 0) {
                    setList(list);
                } else {
                    setList((existingList) => [...existingList, ...list]);
                }

                setPageNumber(page + 1);
            }
        } catch (error) {
            console.error(error); // eslint-disable-line no-console
        }
    }

    async function searchInList(term: string, callBack: (options: Options<TeamSelectOption>) => void) {
        try {
            const response = await props.searchTeams(term, {page: 0, per_page: TEAMS_PER_PAGE} as PagedTeamSearchOpts);
            if (response && response.data && response.data.teams && response.data.teams.length > 0) {
                const teams = response.data.teams.map((team: Team) => ({
                    value: team.id,
                    label: team.display_name,
                }));

                callBack(teams);
            }

            callBack([]);
        } catch (error) {
            console.error(error); // eslint-disable-line no-console
            callBack([]);
        }
    }

    function handleMenuScrolledToBottom() {
        loadListInPageNumber(pageNumber);
    }

    function handleOnChange(value: OnChangeValue<TeamSelectOption, true>, actionMeta: ActionMeta<TeamSelectOption>) {
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

    useEffect(() => {
        loadListInPageNumber(0);
    }, []);

    const optionValues = props.option.values?.team_ids?.value as string[];
    const selectedValues = list.filter((item) => optionValues.includes(item.value));

    return (
        <div className='FilterList FilterList__full'>
            <div className='FilterList_name'>
                {props.option.name}
            </div>
            <AsyncSelect
                inputId='adminConsoleTeamFilterDropdown'
                isMulti={true}
                isClearable={true}
                hideSelectedOptions={true}
                classNamePrefix='filterListSelect'
                cacheOptions={false}
                placeholder={formatMessage({id: 'admin.channels.filterBy.team.placeholder', defaultMessage: 'Search and select teams'})}
                loadingMessage={() => formatMessage({id: 'admin.channels.filterBy.team.loading', defaultMessage: 'Loading teams'})}
                noOptionsMessage={() => formatMessage({id: 'admin.channels.filterBy.team.noTeams', defaultMessage: 'No teams found'})}
                // eslint-disable-next-line no-void
                loadOptions={void searchInList} // disabled eslint rule because of conflict between Promise<void> and void.
                defaultOptions={list}
                value={selectedValues}
                onChange={handleOnChange}
                onMenuScrollToBottom={handleMenuScrolledToBottom}
                components={{
                    LoadingIndicator: () => <LoadingSpinner/>,
                }}
            />
        </div>
    );
}

export default TeamFilterDropdown;
