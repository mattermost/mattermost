// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useRef} from 'react';
import {FormattedMessage} from 'react-intl';
import {useSelector} from 'react-redux';

import {getMyTeams} from 'mattermost-redux/selectors/entities/teams';

import {getSearchTeam} from 'selectors/rhs';

import SelectTeam from 'components/new_search/select_team';
import type {SearchFilterType} from 'components/search/types';

import type {A11yFocusEventDetail} from 'utils/constants';
import Constants, {A11yCustomEventTypes, DataSearchTypes} from 'utils/constants';
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

type DataSearchLiteral = typeof DataSearchTypes[keyof typeof DataSearchTypes];

export default function MessagesOrFilesSelector(props: Props): JSX.Element {
    const searchTeam = useSelector((state: GlobalState) => getSearchTeam(state));
    const myTeams = useSelector(getMyTeams);
    const hasMoreThanOneTeam = myTeams.length > 1;

    // REFS to the tabs so there is ability to pass the custom A11y focus event
    const messagesTabRef = useRef<HTMLButtonElement>(null);
    const filesTabRef = useRef<HTMLButtonElement>(null);

    // Enhanced arrow key handling to focus the new select tab and also send the a11y custom event
    const handleTabKeyDown = (
        e: React.KeyboardEvent<HTMLButtonElement>,
        currentTab: DataSearchLiteral,
    ) => {
        if (Keyboard.isKeyPressed(e, KeyCodes.LEFT) || Keyboard.isKeyPressed(e, KeyCodes.RIGHT)) {
            e.preventDefault();
            e.stopPropagation();
            let nextTab: SearchType;
            let nextTabRef: React.RefObject<HTMLButtonElement>;

            if (currentTab === DataSearchTypes.MESSAGES_SEARCH_TYPE && props.isFileAttachmentsEnabled) {
                nextTab = DataSearchTypes.FILES_SEARCH_TYPE;
                nextTabRef = filesTabRef;
            } else {
                nextTab = DataSearchTypes.MESSAGES_SEARCH_TYPE;
                nextTabRef = messagesTabRef;
            }

            props.onChange(nextTab);

            // Dispatch the custom a11y focus event to focus the selected tab
            if (nextTabRef.current) {
                setTimeout(() => {
                    document.dispatchEvent(
                        new CustomEvent<A11yFocusEventDetail>(A11yCustomEventTypes.FOCUS, {
                            detail: {
                                target: nextTabRef.current,
                                keyboardOnly: true,
                            },
                        }),
                    );
                }, 0);
            }
            return;
        }

        if (Keyboard.isKeyPressed(e, KeyCodes.ENTER)) {
            props.onChange(currentTab);
        }
    };

    return (
        <div className='MessagesOrFilesSelector'>
            <div
                className='buttons-container'
                role='tablist'
                aria-label='Messages or Files'
            >
                <button
                    ref={messagesTabRef}
                    role='tab'
                    aria-selected={props.selected === DataSearchTypes.MESSAGES_SEARCH_TYPE ? 'true' : 'false'}
                    tabIndex={props.selected === DataSearchTypes.MESSAGES_SEARCH_TYPE ? 0 : -1}
                    aria-controls='messagesPanel'
                    id='messagesTab'
                    onClick={() => props.onChange(DataSearchTypes.MESSAGES_SEARCH_TYPE)}
                    onKeyDown={(e) => handleTabKeyDown(e, DataSearchTypes.MESSAGES_SEARCH_TYPE)}
                    className={props.selected === DataSearchTypes.MESSAGES_SEARCH_TYPE ? 'active tab messages-tab' : 'tab messages-tab'}
                >
                    <FormattedMessage
                        id='search_bar.messages_tab'
                        defaultMessage='Messages'
                    />
                    <span className='counter'>{props.messagesCounter}</span>
                </button>
                {props.isFileAttachmentsEnabled && (
                    <button
                        ref={filesTabRef}
                        role='tab'
                        aria-selected={props.selected === DataSearchTypes.FILES_SEARCH_TYPE ? 'true' : 'false'}
                        tabIndex={props.selected === DataSearchTypes.FILES_SEARCH_TYPE ? 0 : -1}
                        aria-controls='filesPanel'
                        id='filesTab'
                        onClick={() => props.onChange(DataSearchTypes.FILES_SEARCH_TYPE)}
                        onKeyDown={(e) => handleTabKeyDown(e, DataSearchTypes.FILES_SEARCH_TYPE)}
                        className={props.selected === DataSearchTypes.FILES_SEARCH_TYPE ? 'active tab files-tab' : 'tab files-tab'}
                    >
                        <FormattedMessage
                            id='search_bar.files_tab'
                            defaultMessage='Files'
                        />
                        <span className='counter'>{props.filesCounter}</span>
                    </button>
                )}
            </div>
            {props.crossTeamSearchEnabled && hasMoreThanOneTeam && (
                <div className='team-selector-container'>
                    <SelectTeam
                        selectedTeamId={searchTeam}
                        onTeamSelected={props.onTeamChange}
                    />
                </div>
            )}
            {props.selected === DataSearchTypes.FILES_SEARCH_TYPE && (
                <FilesFilterMenu
                    selectedFilter={props.selectedFilter}
                    onFilter={props.onFilter}
                />
            )}
        </div>
    );
}
