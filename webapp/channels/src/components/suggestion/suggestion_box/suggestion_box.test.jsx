// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import AtMentionProvider from 'components/suggestion/at_mention_provider/at_mention_provider';
import CommandProvider from 'components/suggestion/command_provider/command_provider';
import SuggestionBox from 'components/suggestion/suggestion_box/suggestion_box';
import SuggestionList from 'components/suggestion/suggestion_list';

import {render, act} from 'tests/react_testing_utils';
import * as Utils from 'utils/utils';

jest.mock('mattermost-redux/client', () => {
    const actual = jest.requireActual('mattermost-redux/client');

    return {
        ...actual,
        Client4: {
            ...actual.Client4,
            getCommandAutocompleteSuggestionsList: jest.fn().mockResolvedValue([]),
        },
    };
});

jest.mock('utils/user_agent', () => {
    const original = jest.requireActual('utils/user_agent');
    return {
        ...original,
        isIos: jest.fn().mockReturnValue(true),
    };
});

// Helper to create a mock container with required DOM methods
const createMockContainer = (containsFn) => ({
    contains: containsFn,
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
});

describe('components/SuggestionBox', () => {
    const baseProps = {
        listComponent: SuggestionList,
        value: 'value',
        containerClass: 'test',
        openOnFocus: true,
        providers: [],
        actions: {
            openModalFromCommand: jest.fn(),
            addMessageIntoHistory: jest.fn(),
        },
    };

    test('findOverlap', () => {
        expect(SuggestionBox.findOverlap('', 'blue')).toBe('');
        expect(SuggestionBox.findOverlap('red', '')).toBe('');
        expect(SuggestionBox.findOverlap('red', 'blue')).toBe('');
        expect(SuggestionBox.findOverlap('red', 'dog')).toBe('d');
        expect(SuggestionBox.findOverlap('red', 'education')).toBe('ed');
        expect(SuggestionBox.findOverlap('red', 'reduce')).toBe('red');
        expect(SuggestionBox.findOverlap('black', 'ack')).toBe('ack');
    });

    test('should avoid ref access on unmount race', (done) => {
        const ref = React.createRef();
        const {unmount} = render(
            <SuggestionBox
                {...baseProps}
                ref={ref}
            />,
        );
        ref.current.handleFocusIn({});
        unmount();
        done();
    });

    test('should match state and/or call function on handleFocusOut', () => {
        const onBlur = jest.fn();
        const ref = React.createRef();
        render(
            <SuggestionBox
                {...baseProps}
                onBlur={onBlur}
                ref={ref}
            />,
        );
        const instance = ref.current;
        act(() => {
            instance.setState({focused: true});
        });
        const contains = jest.fn().mockReturnValueOnce(true).mockReturnValue(false);
        const relatedTarget = jest.fn();
        instance.container = createMockContainer(contains);
        instance.handleEmitClearSuggestions = jest.fn();

        act(() => {
            instance.handleFocusOut({relatedTarget});
        });
        expect(instance.handleEmitClearSuggestions).not.toHaveBeenCalled();
        expect(instance.state.focused).toEqual(true);
        expect(onBlur).not.toHaveBeenCalled();

        // test for iOS agent
        act(() => {
            instance.handleFocusOut({});
        });
        expect(instance.handleEmitClearSuggestions).not.toHaveBeenCalled();
        expect(instance.state.focused).toEqual(true);
        expect(onBlur).not.toHaveBeenCalled();

        act(() => {
            instance.handleFocusOut({relatedTarget});
        });
        expect(instance.handleEmitClearSuggestions).toHaveBeenCalledTimes(1);
        expect(instance.state.focused).toEqual(false);
        expect(onBlur).toHaveBeenCalledTimes(1);
    });

    test('should force pretext change on context change', () => {
        const ref = React.createRef();
        const {rerender} = render(
            <SuggestionBox
                {...baseProps}
                ref={ref}
            />,
        );
        const instance = ref.current;
        instance.handlePretextChanged = jest.fn();
        instance.getTextbox = jest.fn().mockReturnValue({value: 'value'});

        rerender(
            <SuggestionBox
                {...baseProps}
                ref={ref}
            />,
        );
        expect(instance.handlePretextChanged).not.toHaveBeenCalled();

        rerender(
            <SuggestionBox
                {...baseProps}
                contextId='new'
                ref={ref}
            />,
        );
        expect(instance.handlePretextChanged).toHaveBeenCalledWith('value');

        rerender(
            <SuggestionBox
                {...baseProps}
                contextId='new'
                ref={ref}
            />,
        );
        expect(instance.handlePretextChanged.mock.calls.length).toBe(1);
    });

    test('should force pretext change after text has been cleared by parent', async () => {
        const ref = React.createRef();
        const {rerender} = render(
            <SuggestionBox
                {...baseProps}
                ref={ref}
            />,
        );
        const instance = ref.current;
        instance.handlePretextChanged = jest.fn();
        instance.pretext = 'value';

        rerender(
            <SuggestionBox
                {...baseProps}
                ref={ref}
            />,
        );
        expect(instance.handlePretextChanged).not.toHaveBeenCalled();

        rerender(
            <SuggestionBox
                {...baseProps}
                value=''
                ref={ref}
            />,
        );
        expect(instance.handlePretextChanged).toHaveBeenCalledWith('');
    });

    test('should force pretext change on composition update', () => {
        const ref = React.createRef();
        render(
            <SuggestionBox
                {...baseProps}
                ref={ref}
            />,
        );
        const instance = ref.current;
        instance.handlePretextChanged = jest.fn();
        instance.getTextbox = jest.fn().mockReturnValue({value: ''});

        instance.handleCompositionUpdate({data: '@ㅈ'});
        expect(instance.handlePretextChanged).toHaveBeenCalledWith('@ㅈ');

        instance.handleCompositionUpdate({data: '@저'});
        expect(instance.handlePretextChanged).toHaveBeenCalledWith('@저');
    });

    test('should reset selection after provider.handlePretextChanged is handled', () => {
        const userid1 = {id: 'userid1', username: 'user', first_name: 'a', last_name: 'b', nickname: 'c'};
        const userid2 = {id: 'userid2', username: 'user2', first_name: 'd', last_name: 'e', nickname: 'f'};
        const userid3 = {id: 'userid3', username: 'other', first_name: 'X', last_name: 'Y', nickname: 'Z'};

        const groupid1 = {id: 'groupid1', name: 'board', display_name: 'board'};
        const groupid2 = {id: 'groupid2', name: 'developers', display_name: 'developers'};

        const baseParams = {
            currentChannelId: 'channelid1',
            currentTeamId: 'teamid1',
            currentUserId: 'userid1',
            autocompleteGroups: [groupid1, groupid2],
            autocompleteUsersInChannel: jest.fn().mockResolvedValue(false),
            searchAssociatedGroupsForReference: jest.fn().mockResolvedValue(false),
        };
        const provider = new AtMentionProvider(baseParams);
        jest.spyOn(provider, 'getProfilesWithLastViewAtInChannel').mockImplementation(() => [userid1, userid2, userid3]);

        // Mock getSuggestionBoxAlgn to avoid DOM measurement issues
        Utils.getSuggestionBoxAlgn = jest.fn().mockReturnValue({pixelsToMoveX: 0, pixelsToMoveY: 0});

        const props = {
            ...baseProps,
            providers: [provider],
        };
        const ref = React.createRef();
        render(
            <SuggestionBox
                {...props}
                ref={ref}
            />,
        );
        const instance = ref.current;

        expect(instance.state.selection).toEqual('');

        act(() => {
            instance.nonDebouncedPretextChanged('hello world @');
        });
        expect(instance.state.selection).toEqual('@other');

        act(() => {
            instance.nonDebouncedPretextChanged('hello world @u');
        });
        expect(instance.state.selection).toEqual('@user');

        act(() => {
            instance.nonDebouncedPretextChanged('hello world @');
        });
        expect(instance.state.selection).toEqual('@other');

        act(() => {
            instance.nonDebouncedPretextChanged('hello world ');
        });
        expect(instance.state.selection).toEqual('');
    });

    test('Test for suggestionBoxAlgn when slash command at beginning and when slash command in middle of text', () => {
        const provider = new CommandProvider({
            teamId: 'current_team',
            channelId: 'current_channel',
            rootId: 'current_root',
        });
        const props = {
            ...baseProps,
            providers: [provider],
        };
        const ref = React.createRef();
        render(
            <SuggestionBox
                {...props}
                ref={ref}
            />,
        );
        const instance = ref.current;

        Utils.getSuggestionBoxAlgn = jest.fn().mockReturnValue({pixelsToMoveX: 0, pixelsToMoveY: 35});

        act(() => {
            instance.nonDebouncedPretextChanged('/');
        });
        expect(instance.state.suggestionBoxAlgn).toEqual({pixelsToMoveX: 0, pixelsToMoveY: 35});

        act(() => {
            instance.setState({suggestionBoxAlgn: {}});
        });

        act(() => {
            instance.nonDebouncedPretextChanged('I should still have a empty suggestionBoxAlgn /');
        });
        expect(instance.state.suggestionBoxAlgn).toEqual({});
    });

    test('should call setState for clear based on present cleared state', () => {
        const ref = React.createRef();
        render(
            <SuggestionBox
                {...baseProps}
                ref={ref}
            />,
        );

        const instance = ref.current;
        instance.setState = jest.fn();
        instance.clear();
        expect(instance.setState).not.toHaveBeenCalled();

        // Restore setState to set cleared to false, then re-mock
        const origSetState = React.PureComponent.prototype.setState.bind(instance);
        act(() => {
            origSetState({cleared: false});
        });

        // Re-mock setState after state update
        instance.setState = jest.fn();
        instance.clear();
        expect(instance.setState).toHaveBeenCalled();
    });

    test('should not call clear search resutls when forceSuggestionsWhenBlur is true', () => {
        const onBlur = jest.fn();
        const ref = React.createRef();
        render(
            <SuggestionBox
                {...baseProps}
                onBlur={onBlur}
                forceSuggestionsWhenBlur={true}
                ref={ref}
            />,
        );

        const instance = ref.current;
        act(() => {
            instance.setState({focused: true});
        });
        const contains = jest.fn().mockReturnValue(false);
        const relatedTarget = jest.fn();
        instance.container = createMockContainer(contains);
        instance.handleEmitClearSuggestions = jest.fn();

        act(() => {
            instance.handleFocusOut({relatedTarget});
        });
        expect(instance.handleEmitClearSuggestions).not.toHaveBeenCalled();
        expect(instance.state.focused).toEqual(false);
        expect(onBlur).toHaveBeenCalledTimes(1);
    });

    test('should call for handlePretextChanged on handleFocusIn and change of pretext', () => {
        jest.useFakeTimers();
        const onFocus = jest.fn();
        const ref = React.createRef();
        render(
            <SuggestionBox
                {...baseProps}
                openOnFocus={true}
                onFocus={onFocus}
                ref={ref}
            />,
        );
        const instance = ref.current;
        instance.handlePretextChanged = jest.fn();
        instance.getTextbox = jest.fn().mockReturnValue({value: 'value'});

        const contains = jest.fn().mockReturnValue(false);
        const relatedTarget = jest.fn();
        instance.container = createMockContainer(contains);

        act(() => {
            instance.handleFocusIn({relatedTarget});
            jest.runOnlyPendingTimers();
        });
        expect(instance.handlePretextChanged).toHaveBeenCalledTimes(1);
        instance.handleFocusIn({relatedTarget});
        expect(instance.handlePretextChanged).toHaveBeenCalledTimes(1);
        expect(onFocus).toHaveBeenCalled();
    });

    test('should call for handlePretextChanged on componentDidMount', () => {
        const ref = React.createRef();
        render(
            <SuggestionBox
                {...baseProps}
                ref={ref}
            />,
        );
        const instance = ref.current;
        instance.handlePretextChanged = jest.fn();
        instance.componentDidMount();
        expect(instance.handlePretextChanged).toHaveBeenCalledTimes(1);
    });

    test('should not clear pretext when clearing the suggestion list', () => {
        const ref = React.createRef();
        render(
            <SuggestionBox
                {...baseProps}
                ref={ref}
            />,
        );
        const instance = ref.current;
        instance.handlePretextChanged = jest.fn();
        instance.clear();
        expect(instance.handlePretextChanged).not.toHaveBeenCalled();
    });
});
