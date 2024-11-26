// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';
import {useSelector} from 'react-redux';

import {getMyTeams} from 'mattermost-redux/selectors/entities/teams';

import {getSearchTeam} from 'selectors/rhs';

import type {SearchFilterType} from 'components/search/types';

import Constants from 'utils/constants';
import * as Keyboard from 'utils/keyboard';

import type {GlobalState} from 'types/store';
import type {SearchType} from 'types/store/rhs';

import FilesFilterMenu from './files_filter_menu';

const {KeyCodes} = Constants;

import './messages_or_files_selector.scss';

type Props = {
    selected: string;
    selectedFilter: SearchFilterType;
    messagesCounter: string;
    filesCounter: string;
    isFileAttachmentsEnabled: boolean;
    crossTeamSearchEnabled: boolean;
    onChange: (value: SearchType) => void;
    onFilter: (filter: SearchFilterType) => void;
    onTeamChange: (teamId: string) => void;
};

export default function MessagesOrFilesSelector(props: Props): JSX.Element {
    const teams = useSelector((state: GlobalState) => getMyTeams(state));
    const searchTeam = useSelector((state: GlobalState) => getSearchTeam(state));

    const options = [{value: '', label: 'All teams', selected: searchTeam === ''}];
    for (const team of teams) {
        options.push({value: team.id, label: team.display_name, selected: searchTeam === team.id});
    }

    const onTeamChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        props.onTeamChange(e.target.value);
    };

    return (
        <div className='MessagesOrFilesSelector'>
            <div className='buttons-container'>
                <button
                    onClick={() => props.onChange('messages')}
                    onKeyDown={(e: React.KeyboardEvent<HTMLSpanElement>) => Keyboard.isKeyPressed(e, KeyCodes.ENTER) && props.onChange('messages')}
                    className={props.selected === 'messages' ? 'active tab messages-tab' : 'tab messages-tab'}
                >
                    <FormattedMessage
                        id='search_bar.messages_tab'
                        defaultMessage='Messages'
                    />
                    <span className='counter'>{props.messagesCounter}</span>
                </button>
                {props.isFileAttachmentsEnabled &&
                    <button
                        onClick={() => props.onChange('files')}
                        onKeyDown={(e: React.KeyboardEvent<HTMLSpanElement>) => Keyboard.isKeyPressed(e, KeyCodes.ENTER) && props.onChange('files')}
                        className={props.selected === 'files' ? 'active tab files-tab' : 'tab files-tab'}
                    >
                        <FormattedMessage
                            id='search_bar.files_tab'
                            defaultMessage='Files'
                        />
                        <span className='counter'>{props.filesCounter}</span>
                    </button>
                }
            </div>
            {props.crossTeamSearchEnabled && (
                <div className='team-selector-container'>
                    <select
                        value={searchTeam}
                        onChange={onTeamChange}
                    >
                        {options.map((option) => (
                            <option
                                key={option.value}
                                value={option.value}
                            >
                                {option.label}
                            </option>
                        ))}
                    </select>
                </div>
            )}
            {props.selected === 'files' &&
                <FilesFilterMenu
                    selectedFilter={props.selectedFilter}
                    onFilter={props.onFilter}
                />}
        </div>
    );
}
