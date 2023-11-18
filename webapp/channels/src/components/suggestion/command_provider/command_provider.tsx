// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import type {Store} from 'redux';

import {DockWindowIcon} from '@mattermost/compass-icons/components';
import type {AutocompleteSuggestion, CommandArgs} from '@mattermost/types/integrations';

import {Client4} from 'mattermost-redux/client';
import {appsEnabled} from 'mattermost-redux/selectors/entities/apps';

import globalStore from 'stores/redux_store';

import {Constants} from 'utils/constants';
import * as UserAgent from 'utils/user_agent';

import type {GlobalState} from 'types/store';

import {AppCommandParser} from './app_command_parser/app_command_parser';
import {intlShim} from './app_command_parser/app_command_parser_dependencies';

import Provider from '../provider';
import type {ResultsCallback} from '../provider';
import {SuggestionContainer} from '../suggestion';
import type {SuggestionProps} from '../suggestion';

const EXECUTE_CURRENT_COMMAND_ITEM_ID = Constants.Integrations.EXECUTE_CURRENT_COMMAND_ITEM_ID;
const OPEN_COMMAND_IN_MODAL_ITEM_ID = Constants.Integrations.OPEN_COMMAND_IN_MODAL_ITEM_ID;
const COMMAND_SUGGESTION_ERROR = Constants.Integrations.COMMAND_SUGGESTION_ERROR;

const CommandSuggestion = React.forwardRef<HTMLDivElement, SuggestionProps<AutocompleteSuggestion>>((props, ref) => {
    const {item} = props;

    let symbolSpan = <span>{'/'}</span>;
    switch (item.IconData) {
    case EXECUTE_CURRENT_COMMAND_ITEM_ID:
        symbolSpan = <span className='block mt-1'>{'↵'}</span>;
        break;
    case OPEN_COMMAND_IN_MODAL_ITEM_ID:
        symbolSpan = (
            <span className='block mt-1'>
                <DockWindowIcon size={28}/>
            </span>
        );
        break;
    case COMMAND_SUGGESTION_ERROR:
        symbolSpan = <span>{'!'}</span>;
        break;
    }
    let icon = <div className='slash-command__icon'>{symbolSpan}</div>;
    if (item.IconData && ![EXECUTE_CURRENT_COMMAND_ITEM_ID, COMMAND_SUGGESTION_ERROR, OPEN_COMMAND_IN_MODAL_ITEM_ID].includes(item.IconData)) {
        icon = (
            <div
                className='slash-command__icon'
                style={{backgroundColor: 'transparent'}}
            >
                <img src={item.IconData}/>
            </div>);
    }

    return (
        <SuggestionContainer
            ref={ref}
            {...props}
        >
            {icon}
            <div className='slash-command__info'>
                <div className='slash-command__title'>
                    {item.Suggestion.substring(1) + ' ' + item.Hint}
                </div>
                <div className='slash-command__desc'>
                    {item.Description}
                </div>
            </div>
        </SuggestionContainer>
    );
});
CommandSuggestion.displayName = 'CommandSuggestion';
export {CommandSuggestion};

type Props = {
    teamId: string;
    channelId: string;
    rootId?: string;
};

export default class CommandProvider extends Provider {
    private props: Props;
    private store: Store<GlobalState>;
    public triggerCharacter: string;
    private appCommandParser: AppCommandParser;

    constructor(props: Props) {
        super();

        this.store = globalStore;
        this.props = props;
        this.appCommandParser = new AppCommandParser(this.store as any, intlShim, props.channelId, props.teamId, props.rootId);
        this.triggerCharacter = '/';
    }

    setProps(props: Props) {
        this.props = props;
        this.appCommandParser.setChannelContext(props.channelId, props.teamId, props.rootId);
    }

    handlePretextChanged(pretext: string, resultCallback: ResultsCallback<AutocompleteSuggestion>) {
        if (!pretext.startsWith(this.triggerCharacter)) {
            return false;
        }

        if (appsEnabled(this.store.getState()) && this.appCommandParser.isAppCommand(pretext)) {
            this.appCommandParser.getSuggestions(pretext).then((suggestions) => {
                const matches = suggestions.map((suggestion) => ({
                    ...suggestion,
                    Complete: '/' + suggestion.Complete,
                    Suggestion: '/' + suggestion.Suggestion,
                }));

                const terms = matches.map((suggestion) => suggestion.Complete);
                resultCallback({
                    matchedPretext: pretext,
                    terms,
                    items: matches,
                    component: CommandSuggestion,
                });
            });
            return true;
        }

        if (UserAgent.isMobile()) {
            this.handleMobile(pretext, resultCallback);
        } else {
            this.handleWebapp(pretext, resultCallback);
        }

        return true;
    }

    handleCompleteWord(term: string, pretext: string, callback: (s: string) => void) {
        callback(term + ' ');
    }

    handleMobile(pretext: string, resultCallback: ResultsCallback<AutocompleteSuggestion>) {
        const {teamId} = this.props;

        const command = pretext.toLowerCase();
        Client4.getCommandsList(teamId).then(
            (data) => {
                let matches: AutocompleteSuggestion[] = [];
                if (appsEnabled(this.store.getState())) {
                    const appCommandSuggestions = this.appCommandParser.getSuggestionsBase(pretext);
                    matches = matches.concat(appCommandSuggestions);
                }

                data.forEach((cmd) => {
                    if (!cmd.auto_complete) {
                        return;
                    }

                    if (cmd.trigger === 'shortcuts') {
                        return;
                    }

                    if ((this.triggerCharacter + cmd.trigger).indexOf(command) === 0) {
                        const s = this.triggerCharacter + cmd.trigger;
                        let hint = '';
                        if (cmd.auto_complete_hint && cmd.auto_complete_hint.length !== 0) {
                            hint = cmd.auto_complete_hint;
                        }
                        matches.push({
                            Suggestion: s,
                            Complete: '',
                            Hint: hint,
                            Description: cmd.auto_complete_desc,
                            IconData: '',
                            type: Constants.Integrations.COMMAND,
                        });
                    }
                });

                matches = matches.sort((a, b) => a.Suggestion.localeCompare(b.Suggestion));

                // pull out the suggested commands from the returned data
                const terms = matches.map((suggestion) => suggestion.Suggestion);

                resultCallback({
                    matchedPretext: command,
                    terms,
                    items: matches,
                    component: CommandSuggestion,
                });
            },
        );
    }

    handleWebapp(pretext: string, resultCallback: ResultsCallback<AutocompleteSuggestion>) {
        const command = pretext.toLowerCase();

        const {teamId, channelId, rootId} = this.props;
        const args: CommandArgs = {
            team_id: teamId,
            channel_id: channelId,
            root_id: rootId,
        };

        Client4.getCommandAutocompleteSuggestionsList(command, teamId, args).then(
            ((data: AutocompleteSuggestion[]) => {
                let matches: AutocompleteSuggestion[] = [];

                let cmd = 'Ctrl';
                if (UserAgent.isMac()) {
                    cmd = '⌘';
                }

                if (appsEnabled(this.store.getState())) {
                    const appCommandSuggestions = this.appCommandParser.getSuggestionsBase(pretext).map((suggestion) => ({
                        ...suggestion,
                        Complete: '/' + suggestion.Complete,
                        Suggestion: suggestion.Suggestion,
                    }));
                    matches = matches.concat(appCommandSuggestions);
                }

                data.forEach((s) => {
                    if (!this.contains(matches, this.triggerCharacter + s.Complete)) {
                        matches.push({
                            Complete: this.triggerCharacter + s.Complete,
                            Suggestion: this.triggerCharacter + s.Suggestion,
                            Hint: s.Hint,
                            Description: s.Description,
                            IconData: s.IconData,
                            type: Constants.Integrations.COMMAND,
                        });
                    }
                });

                // sort only if we are looking at base commands
                if (!pretext.includes(' ')) {
                    matches.sort((a, b) => {
                        if (a.Suggestion.toLowerCase() > b.Suggestion.toLowerCase()) {
                            return 1;
                        } else if (a.Suggestion.toLowerCase() < b.Suggestion.toLowerCase()) {
                            return -1;
                        }
                        return 0;
                    });
                }

                if (this.shouldAddExecuteItem(data, pretext)) {
                    matches.unshift({
                        Complete: pretext + EXECUTE_CURRENT_COMMAND_ITEM_ID,
                        Suggestion: '/Execute Current Command',
                        Hint: '',
                        Description: 'Select this option or use ' + cmd + '+Enter to execute the current command.',
                        IconData: EXECUTE_CURRENT_COMMAND_ITEM_ID,
                        type: Constants.Integrations.COMMAND,
                    });
                }

                // pull out the suggested commands from the returned data
                const terms = matches.map((suggestion) => suggestion.Complete);

                resultCallback({
                    matchedPretext: command,
                    terms,
                    items: matches,
                    component: CommandSuggestion,
                });
            }),
        );
    }

    shouldAddExecuteItem(data: AutocompleteSuggestion[], pretext: string) {
        if (data.length === 0) {
            return false;
        }
        if (pretext[pretext.length - 1] === ' ') {
            return true;
        }

        // If suggestion is empty it means that user can input any text so we allow them to execute.
        return data.findIndex((item) => item.Suggestion === '') !== -1;
    }

    contains(matches: AutocompleteSuggestion[], complete: string) {
        return matches.findIndex((match) => match.Complete === complete) !== -1;
    }
}
