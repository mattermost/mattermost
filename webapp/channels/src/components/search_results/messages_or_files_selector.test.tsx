// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {shallow} from 'enzyme';
import type {ShallowWrapper} from 'enzyme';

import {fireEvent, render, screen} from '@testing-library/react';
import React from 'react';
import {Provider} from 'react-redux';
import {IntlProvider} from 'react-intl';

import MessagesOrFilesSelector from 'components/search_results/messages_or_files_selector';

import mockStore from 'tests/test_store';

describe('components/search_results/MessagesOrFilesSelector', () => {
    const store = mockStore({});

    test('should match snapshot, on messages selected', () => {
        const wrapper: ShallowWrapper<any, any, any> = shallow(
            <Provider store={store}>
                <MessagesOrFilesSelector
                    selected='messages'
                    selectedFilter='code'
                    messagesCounter='5'
                    filesCounter='10'
                    omnisearchCounter='7'
                    isFileAttachmentsEnabled={true}
                    onChange={jest.fn()}
                    onFilter={jest.fn()}
                    onTeamChange={jest.fn()}
                    crossTeamSearchEnabled={false}
                />
            </Provider>,
        );

        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot, on files selected', () => {
        const wrapper: ShallowWrapper<any, any, any> = shallow(

            <Provider store={store}>
                <MessagesOrFilesSelector
                    selected='files'
                    selectedFilter='code'
                    messagesCounter='5'
                    filesCounter='10'
                    omnisearchCounter='7'
                    isFileAttachmentsEnabled={true}
                    onChange={jest.fn()}
                    onFilter={jest.fn()}
                    onTeamChange={jest.fn()}
                    crossTeamSearchEnabled={false}
                />
            </Provider>,
        );

        expect(wrapper).toMatchSnapshot();
    });
    test('should match snapshot, without files tab', () => {
        const wrapper: ShallowWrapper<any, any, any> = shallow(

            <Provider store={store}>
                <MessagesOrFilesSelector
                    selected='files'
                    selectedFilter='code'
                    messagesCounter='5'
                    filesCounter='10'
                    omnisearchCounter='7'
                    isFileAttachmentsEnabled={false}
                    onChange={jest.fn()}
                    onFilter={jest.fn()}
                    onTeamChange={jest.fn()}
                    crossTeamSearchEnabled={false}
                />

            </Provider>,
        );

        expect(wrapper).toMatchSnapshot();
    });

    const baseProps = {
        selected: 'messages',
        selectedFilter: 'code',
        messagesCounter: '5',
        filesCounter: '10',
        omnisearchCounter: '7',
        isFileAttachmentsEnabled: true,
        onChange: jest.fn(),
        onFilter: jest.fn(),
        onTeamChange: jest.fn(),
        crossTeamSearchEnabled: false,
    };

    const renderComponent = (props: any = {}, storeData = {}) => {
        const store = mockStore({
            entities: {
                general: {
                    config: {},
                },
                teams: {
                    currentTeamId: 'team-id',
                },
                ...storeData,
            },
            views: {
                rhs: {
                    searchTeam: null,
                },
            },
        });

        return render(
            <Provider store={store}>
                <IntlProvider locale='en'>
                    <MessagesOrFilesSelector {...baseProps} {...props}/>
                </IntlProvider>
            </Provider>,
        );
    };

    test('shows omnisearch tab when enabled', () => {
        renderComponent({}, {
            general: {
                config: {
                    EnableOmniSearch: 'true',
                },
            },
        });

        expect(screen.getByText('Omnisearch')).toBeInTheDocument();
        expect(screen.getByText('7')).toBeInTheDocument();
    });

    test('hides omnisearch tab when disabled', () => {
        renderComponent({}, {
            general: {
                config: {
                    EnableOmniSearch: 'false',
                },
            },
        });

        expect(screen.queryByText('Omnisearch')).not.toBeInTheDocument();
    });

    test('calls onChange when clicking omnisearch tab', () => {
        const onChange = jest.fn();
        renderComponent({onChange}, {
            general: {
                config: {
                    EnableOmniSearch: 'true',
                },
            },
        });

        fireEvent.click(screen.getByText('Omnisearch'));
        expect(onChange).toHaveBeenCalledWith('omnisearch');
    });

    test('handles keyboard navigation to omnisearch tab', () => {
        const onChange = jest.fn();
        renderComponent({onChange}, {
            general: {
                config: {
                    EnableOmniSearch: 'true',
                },
            },
        });

        const omnisearchButton = screen.getByText('Omnisearch');
        fireEvent.keyDown(omnisearchButton, {key: 'Enter', code: 'Enter'});
        expect(onChange).toHaveBeenCalledWith('omnisearch');
    });
});
