// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {shallow} from 'enzyme';

import {Client4} from 'mattermost-redux/client';

import {AutocompleteSuggestion} from '@mattermost/types/integrations';

import CommandProvider, {CommandSuggestion, Results} from './command_provider';

describe('CommandSuggestion', () => {
    const suggestion: AutocompleteSuggestion = {
        Suggestion: '/invite',
        Complete: '/invite',
        Hint: '@[username] ~[channel]',
        Description: 'Invite a user to a channel',
        IconData: '',
    };

    const baseProps = {
        item: suggestion,
        isSelection: true,
        term: '/',
        matchedPretext: '',
    };

    test('should match snapshot', () => {
        const wrapper = shallow(
            <CommandSuggestion {...baseProps}/>,
        );

        expect(wrapper).toMatchSnapshot();
        expect(wrapper.find('.slash-command__title').first().text()).toEqual('invite @[username] ~[channel]');
    });
});

describe('CommandProvider', () => {
    describe('handlePretextChanged', () => {
        test('should fetch command autocomplete results from the server', async () => {
            const f = Client4.getCommandAutocompleteSuggestionsList;

            const mockFunc = jest.fn().mockResolvedValue([{
                Suggestion: 'issue',
                Complete: 'jira issue',
                Hint: 'hint',
                IconData: 'icon_data',
                Description: 'description',
                type: 'commands',
            }]);
            Client4.getCommandAutocompleteSuggestionsList = mockFunc;

            const provider = new CommandProvider({
                teamId: 'current_team',
                channelId: 'current_channel',
                rootId: 'current_root',
            });

            const callback = jest.fn();
            provider.handlePretextChanged('/jira issue', callback);
            await mockFunc();

            const expected: Results = {
                matchedPretext: '/jira issue',
                terms: ['/jira issue'],
                items: [{
                    Complete: '/jira issue',
                    Suggestion: '/issue',
                    Hint: 'hint',
                    IconData: 'icon_data',
                    Description: 'description',
                    type: 'commands',
                }],
                component: CommandSuggestion,
            };
            expect(callback).toHaveBeenCalledWith(expected);

            Client4.getCommandAutocompleteSuggestionsList = f;
        });

        test('should use the app command parser', async () => {
            const f = Client4.getCommandAutocompleteSuggestionsList;

            const mockFunc = jest.fn().mockResolvedValue([{
                Suggestion: 'issue',
                Complete: 'jira issue',
                Hint: 'hint',
                IconData: 'icon_data',
                Description: 'description',
                type: 'commands',
            }]);
            Client4.getCommandAutocompleteSuggestionsList = mockFunc;

            const provider = new CommandProvider({
                teamId: 'current_team',
                channelId: 'current_channel',
                rootId: 'current_root',
            });

            const callback = jest.fn();
            provider.handlePretextChanged('/jira issue', callback);
            await mockFunc();

            const expected: Results = {
                matchedPretext: '/jira issue',
                terms: ['/jira issue'],
                items: [{
                    Complete: '/jira issue',
                    Suggestion: '/issue',
                    Hint: 'hint',
                    IconData: 'icon_data',
                    Description: 'description',
                    type: 'commands',
                }],
                component: CommandSuggestion,
            };
            expect(callback).toHaveBeenCalledWith(expected);

            Client4.getCommandAutocompleteSuggestionsList = f;
        });
    });
});
