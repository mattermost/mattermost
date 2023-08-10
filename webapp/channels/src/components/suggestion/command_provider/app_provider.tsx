// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {appsEnabled} from 'mattermost-redux/selectors/entities/apps';

import {openAppsModal} from 'actions/apps';
import globalStore from 'stores/redux_store';

import {Constants} from 'utils/constants';

import {AppCommandParser} from './app_command_parser/app_command_parser';
import {COMMAND_SUGGESTION_CHANNEL, COMMAND_SUGGESTION_USER, intlShim} from './app_command_parser/app_command_parser_dependencies';
import {CommandSuggestion} from './command_provider';

import AtMentionSuggestion from '../at_mention_provider/at_mention_suggestion';
import {ChannelMentionSuggestion} from '../channel_mention_provider';
import Provider from '../provider';

import type {AutocompleteSuggestion, Channel, UserProfile} from './app_command_parser/app_command_parser_dependencies';
import type {ResultsCallback} from '../provider';
import type React from 'react';
import type {Store} from 'redux';
import type {GlobalState} from 'types/store';

type Props = {
    teamId: string;
    channelId: string;
    rootId?: string;
};

type Item = AutocompleteSuggestion | UserProfile | {channel: Channel};

export default class AppCommandProvider extends Provider {
    private store: Store<GlobalState>;
    public triggerCharacter: string;
    private appCommandParser: AppCommandParser;

    constructor(props: Props) {
        super();

        this.store = globalStore;
        this.appCommandParser = new AppCommandParser(this.store as any, intlShim, props.channelId, props.teamId, props.rootId);
        this.triggerCharacter = '/';
    }

    setProps(props: Props) {
        this.appCommandParser.setChannelContext(props.channelId, props.teamId, props.rootId);
    }

    handlePretextChanged(pretext: string, resultCallback: ResultsCallback<Item>) {
        if (!pretext.startsWith(this.triggerCharacter)) {
            return false;
        }

        if (!appsEnabled(this.store.getState())) {
            return false;
        }

        if (!this.appCommandParser.isAppCommand(pretext)) {
            return false;
        }

        this.appCommandParser.getSuggestions(pretext).then((suggestions) => {
            const element: React.ElementType[] = [];
            const matches = suggestions.map((suggestion) => {
                switch (suggestion.type) {
                case COMMAND_SUGGESTION_USER:
                    element.push(AtMentionSuggestion);
                    return {...suggestion.item! as UserProfile, type: Constants.Integrations.COMMAND};
                case COMMAND_SUGGESTION_CHANNEL:
                    element.push(ChannelMentionSuggestion);
                    return {channel: suggestion.item! as Channel, type: Constants.Integrations.COMMAND};
                default:
                    element.push(CommandSuggestion);
                    return {
                        ...suggestion,
                        Complete: '/' + suggestion.Complete,
                        Suggestion: '/' + suggestion.Suggestion,
                        type: Constants.Integrations.COMMAND,
                    };
                }
            });

            const terms = suggestions.map((suggestion) => '/' + suggestion.Complete);
            resultCallback({
                matchedPretext: pretext,
                terms,
                items: matches,
                components: element,
            });
        });
        return true;
    }

    public async openAppsModalFromCommand(pretext: string) {
        const {form, context} = await this.appCommandParser.composeFormFromCommand(pretext);
        if (!form || !context) {
            return;
        }
        this.store.dispatch(openAppsModal(form, context) as any);
    }
}
