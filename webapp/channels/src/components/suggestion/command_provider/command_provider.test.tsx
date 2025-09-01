// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {shallow} from 'enzyme';
import React from 'react';

import type {AutocompleteSuggestion} from '@mattermost/types/integrations';

import {Client4} from 'mattermost-redux/client';

import CommandProvider, {commandsGroup, CommandSuggestion} from './command_provider';

describe('CommandSuggestion', () => {
    const suggestion: AutocompleteSuggestion = {
        Suggestion: '/invite',
        Complete: '/invite',
        Hint: '@[username] ~[channel]',
        Description: 'Invite a user to a channel',
        IconData: '',
    };

    const baseProps = {
        id: 'test-suggestion',
        item: suggestion,
        isSelection: true,
        term: '/',
        matchedPretext: '',
        onClick: jest.fn(),
        onMouseMove: jest.fn(),
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

            const expected = {
                matchedPretext: '/jira issue',
                groups: [commandsGroup([{
                    Complete: '/jira issue',
                    Suggestion: '/issue',
                    Hint: 'hint',
                    IconData: 'icon_data',
                    Description: 'description',
                    type: 'commands',
                }])],
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

            const expected = {
                matchedPretext: '/jira issue',
                groups: [commandsGroup([{
                    Complete: '/jira issue',
                    Suggestion: '/issue',
                    Hint: 'hint',
                    IconData: 'icon_data',
                    Description: 'description',
                    type: 'commands',
                }])],
            };
            expect(callback).toHaveBeenCalledWith(expected);

            Client4.getCommandAutocompleteSuggestionsList = f;
        });
    });
});

import * as UserAgent from 'utils/user_agent';

test('should forward pretext to handleWebapp unaltered (case-preserving)', () => {
    const uaSpy = jest.spyOn(UserAgent, 'isMobile').mockReturnValue(false);

    const provider = new CommandProvider({
        teamId: 'current_team',
        channelId: 'current_channel',
        rootId: 'current_root',
    });

    const pretext = '/autolink set AbC Templ.';
    const cb = jest.fn();

    const webappSpy = jest.spyOn(provider as any, 'handleWebapp').mockImplementation(() => true);

    provider.handlePretextChanged(pretext, cb);

    expect(webappSpy).toHaveBeenCalledTimes(1);
    expect(webappSpy.mock.calls[0][0]).toBe(pretext);

    webappSpy.mockRestore();
    uaSpy.mockRestore();
});


test('handleWebapp calls backend with pretext unaltered', async () => {
  const original = Client4.getCommandAutocompleteSuggestionsList;
  const mock = jest.fn().mockResolvedValue([]);
  Client4.getCommandAutocompleteSuggestionsList = mock;

  const provider = new CommandProvider({
    teamId: 'current_team',
    channelId: 'current_channel',
    rootId: 'current_root',
  });

  const pretext = '/autolink set AbC Templ.';
  const cb = jest.fn();

  await (provider as any).handleWebapp(pretext, cb);

  expect(mock).toHaveBeenCalledTimes(1);

  const [argPretext, argTeamId, argOpts] = mock.mock.calls[0];

  expect(argPretext).toBe(pretext);

  expect(argTeamId).toBe('current_team');

  expect(argOpts).toEqual(expect.objectContaining({
    channel_id: 'current_channel',
    root_id: 'current_root',
    team_id: 'current_team',
  }));

  Client4.getCommandAutocompleteSuggestionsList = original;
});
