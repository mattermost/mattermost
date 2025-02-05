// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {fireEvent, render, screen} from '@testing-library/react';
import React from 'react';
import {Provider} from 'react-redux';
import {IntlProvider} from 'react-intl';

import MessagesOrFilesSelector from 'components/search_results/messages_or_files_selector';

import mockStore from 'tests/test_store';

describe('components/search_results/MessagesOrFilesSelector', () => {
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

    const renderComponent = (props = {}, storeData = {}) => {
        const store = mockStore({
            entities: {
                general: {
                    config: {},
                },
                ...storeData,
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

    it('shows omnisearch tab when enabled', () => {
        renderComponent({}, {
            entities: {
                general: {
                    config: {
                        EnableOmniSearch: 'true',
                    },
                },
            },
        });

        expect(screen.getByText('Omnisearch')).toBeInTheDocument();
        expect(screen.getByText('7')).toBeInTheDocument();
    });

    it('hides omnisearch tab when disabled', () => {
        renderComponent({}, {
            entities: {
                general: {
                    config: {
                        EnableOmniSearch: 'false',
                    },
                },
            },
        });

        expect(screen.queryByText('Omnisearch')).not.toBeInTheDocument();
    });

    it('calls onChange when clicking omnisearch tab', () => {
        const onChange = jest.fn();
        renderComponent({onChange}, {
            entities: {
                general: {
                    config: {
                        EnableOmniSearch: 'true',
                    },
                },
            },
        });

        fireEvent.click(screen.getByText('Omnisearch'));
        expect(onChange).toHaveBeenCalledWith('omnisearch');
    });

    it('handles keyboard navigation to omnisearch tab', () => {
        const onChange = jest.fn();
        renderComponent({onChange}, {
            entities: {
                general: {
                    config: {
                        EnableOmniSearch: 'true',
                    },
                },
            },
        });

        const omnisearchButton = screen.getByText('Omnisearch');
        fireEvent.keyDown(omnisearchButton, {key: 'Enter', code: 'Enter'});
        expect(onChange).toHaveBeenCalledWith('omnisearch');
    });
});
