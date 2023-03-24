// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {shallow, mount} from 'enzyme';
import {Provider} from 'react-redux';
import {IntlProvider} from 'react-intl';

import Textbox from 'components/textbox/textbox';

import {mockStore} from 'tests/test_store';

import * as Utils from 'utils/utils';

import SuggestionBox from './suggestion/suggestion_box/suggestion_box';

describe('components/TextBox', () => {
    const baseProps = {
        channelId: 'channelId',
        rootId: 'rootId',
        currentUserId: 'currentUserId',
        currentTeamId: 'currentTeamId',
        profilesInChannel: [
            {id: 'id1'},
            {id: 'id2'},
        ],
        autocompleteGroups: [
            {id: 'gid1'},
            {id: 'gid2'},
        ],
        actions: {
            autocompleteUsersInChannel: jest.fn(),
            autocompleteChannels: jest.fn(),
            searchAssociatedGroupsForReference: jest.fn(),
        },
        useChannelMentions: true,
        tabIndex: 0,
        channelAutocompleteEnabled: true,
    };

    test('should match snapshot with required props', () => {
        function emptyFunction() {} //eslint-disable-line no-empty-function

        const wrapper = shallow(
            <Textbox
                id='someid'
                value='some test text'
                onChange={emptyFunction}
                onKeyPress={emptyFunction}
                characterLimit={4000}
                createMessage='placeholder text'
                supportsCommands={false}
                {...baseProps}
            />,
        );
        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot with additional, optional props', () => {
        function emptyFunction() {} //eslint-disable-line no-empty-function

        const wrapper = shallow(
            <Textbox
                id='someid'
                value='some test text'
                onChange={emptyFunction}
                onKeyPress={emptyFunction}
                characterLimit={4000}
                createMessage='placeholder text'
                supportsCommands={false}
                {...baseProps}
                rootId='root_id'
                onComposition={() => {}}
                onHeightChange={() => {}}
                onKeyDown={() => {}}
                onSelect={() => {}}
                onMouseUp={() => {}}
                onKeyUp={() => {}}
                onBlur={() => {}}
                handlePostError={() => {}}
                suggestionListPosition='top'
                emojiEnabled={true}
                isRHS={true}
                disabled={true}
                badConnection={true}
                listenForMentionKeyClick={true}
                preview={true}
                openWhenEmpty={true}
            />,
        );
        expect(wrapper).toMatchSnapshot();
    });

    test('should throw error when value is too long', () => {
        function emptyFunction() {} //eslint-disable-line no-empty-function

        // this mock function should be called when the textbox value is too long
        let gotError = false;
        function handlePostError(msg: React.ReactNode) {
            gotError = msg !== null;
        }

        const wrapper = shallow(
            <Textbox
                id='someid'
                value='some test text that exceeds char limit'
                onChange={emptyFunction}
                onKeyPress={emptyFunction}
                characterLimit={14}
                createMessage='placeholder text'
                supportsCommands={false}
                handlePostError={handlePostError}
                {...baseProps}
            />,
        );

        expect(gotError).toEqual(true);
        expect(wrapper).toMatchSnapshot();
    });

    test('should throw error when new property is too long', () => {
        function emptyFunction() {} //eslint-disable-line no-empty-function

        // this mock function should be called when the textbox value is too long
        let gotError = false;
        function handlePostError(msg: React.ReactNode) {
            gotError = msg !== null;
        }

        const wrapper = shallow(
            <Textbox
                id='someid'
                value='some test text'
                onChange={emptyFunction}
                onKeyPress={emptyFunction}
                characterLimit={14}
                createMessage='placeholder text'
                supportsCommands={false}
                handlePostError={handlePostError}
                {...baseProps}
            />,
        );

        wrapper.setProps({value: 'some test text that exceeds char limit'});
        wrapper.update();
        expect(gotError).toEqual(true);

        expect(wrapper).toMatchSnapshot();
    });

    test('should update suggestionBoxAlgn after typing ~ when channelAutocompleteEnabled is true', () => {
        function emptyFunction() {}

        const store = mockStore({});

        const wrapper = mount(
            <IntlProvider locale='en'>
                <Provider store={store.store}>
                    <Textbox
                        id='someid'
                        value='some test text'
                        onChange={emptyFunction}
                        onKeyPress={emptyFunction}
                        characterLimit={4000}
                        createMessage='placeholder text'
                        supportsCommands={false}
                        {...baseProps}
                    />
                </Provider>
            </IntlProvider>,
        );

        const suggestionComponent = wrapper.find(SuggestionBox);
        const suggestionInstance = suggestionComponent.instance() as SuggestionBox;

        jest.spyOn(Utils, 'getSuggestionBoxAlgn').mockReturnValue({pixelsToMoveX: 0, pixelsToMoveY: 35});

        suggestionInstance.nonDebouncedPretextChanged('~');

        expect(suggestionComponent.state('suggestionBoxAlgn')).toEqual({pixelsToMoveX: 0, pixelsToMoveY: 35});
    });

    test('should not update suggestionBoxAlgn after typing ~ when channelAutocompleteEnabled is false', () => {
        function emptyFunction() {}
        const store = mockStore({});

        const wrapper = mount(
            <IntlProvider locale='en'>
                <Provider store={store.store}>
                    <Textbox
                        id='someid'
                        value='some test text'
                        onChange={emptyFunction}
                        onKeyPress={emptyFunction}
                        characterLimit={4000}
                        createMessage='placeholder text'
                        supportsCommands={false}
                        {...baseProps}
                        channelAutocompleteEnabled={false}
                    />
                </Provider>
            </IntlProvider>,
        );

        const suggestionComponent = wrapper.find(SuggestionBox);
        const suggestionInstance = suggestionComponent.instance() as SuggestionBox;

        jest.spyOn(Utils, 'getSuggestionBoxAlgn').mockReturnValue({pixelsToMoveX: 0, pixelsToMoveY: 35});

        suggestionInstance.nonDebouncedPretextChanged('~');

        expect(suggestionComponent.state('suggestionBoxAlgn')).toBeUndefined();
    });
});
