// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {fireEvent, render, screen, waitFor} from '@testing-library/react';
import React from 'react';
import {IntlProvider} from 'react-intl';
import {Provider} from 'react-redux';

import type {Post} from '@mattermost/types/posts';

import configureStore from 'tests/test_store';

import InteractiveMessages from './index';

const mockDoBlockAction = jest.fn();
const mockDoPostActionWithCookie = jest.fn();
const mockOpenInteractiveDialog = jest.fn();
let mockLookupResult: Array<{text: string; value: string}> | undefined;
let mockIntegrationFormat: 'mm_block' | 'attachment' | 'block' | 'card' = 'mm_block';

jest.mock('mattermost-redux/actions/posts', () => ({
    doBlockAction: (...args: unknown[]) => mockDoBlockAction(...args),
    doPostActionWithCookie: (...args: unknown[]) => mockDoPostActionWithCookie(...args),
}));

jest.mock('plugins/interactive_dialog', () => ({
    openInteractiveDialog: (...args: unknown[]) => mockOpenInteractiveDialog(...args),
}));

jest.mock('components/block_renderer', () => ({
    BlockRenderer: (props: any) => (
        <div data-testid='block-renderer'>
            <button
                type='button'
                data-testid='post-action'
                onClick={() => props.onAction('btn1', undefined, undefined, 'attach-cookie')}
            >
                {'Act'}
            </button>
            <button
                type='button'
                data-testid='post-lookup'
                onClick={async () => {
                    mockLookupResult = await props.onLookup?.('lookup_act', 'alp', {title: 't'});
                }}
            >
                {'Lookup'}
            </button>
            {props.blocks?.map((b: any, i: number) => (
                <div
                    key={i}
                    data-testid='block-text'
                >
                    {b.text}
                </div>
            ))}
        </div>
    ),
}));

jest.mock('components/block_renderer/translation', () => ({
    getPostInteractiveIntegrationFormat: () => mockIntegrationFormat,
    translatePostProps: () => [{type: 'button', text: 'Go', action_id: 'btn1'}],
}));

jest.mock('components/block_renderer/translation/mm_block', () => ({
    translateMMBlocks: (blocks: unknown[]) => blocks,
}));

describe('InteractiveMessages', () => {
    const store = configureStore({
        entities: {
            general: {config: {}},
            users: {currentUserId: 'user1', profiles: {}},
            teams: {currentTeamId: 'team1'},
            channels: {currentChannelId: 'channel1'},
            preferences: {myPreferences: {}},
        },
    } as any);

    const post = {
        id: 'post1',
        channel_id: 'ch1',
        update_at: 1,
        props: {
            mm_blocks: [{type: 'button', text: 'Go', action_id: 'btn1'}],
            mm_blocks_actions: 'post-cookie',
        },
        metadata: {},
    } as unknown as Post;

    beforeEach(() => {
        mockDoBlockAction.mockReset();
        mockDoPostActionWithCookie.mockReset();
        mockOpenInteractiveDialog.mockReset();
        mockLookupResult = undefined;
        mockIntegrationFormat = 'mm_block';
        mockDoBlockAction.mockReturnValue(() => Promise.resolve({data: {type: 'ok'}}));
        mockDoPostActionWithCookie.mockReturnValue(() => Promise.resolve({data: {status: 'OK'}}));
    });

    test('type refresh refreshes post blocks', async () => {
        mockDoBlockAction.mockReturnValueOnce(() => Promise.resolve({
            data: {
                type: 'refresh',
                mm_blocks: [{type: 'text', text: 'Refreshed'}],
                mm_blocks_actions: 'new-cookie',
            },
        }));

        render(
            <Provider store={store}>
                <IntlProvider locale='en'>
                    <InteractiveMessages post={post}/>
                </IntlProvider>
            </Provider>,
        );

        fireEvent.click(screen.getByTestId('post-action'));
        await waitFor(() => {
            expect(screen.getByText('Refreshed')).toBeInTheDocument();
        });
        expect(mockOpenInteractiveDialog).not.toHaveBeenCalled();
    });

    test('type dialog opens interactive dialog', async () => {
        mockDoBlockAction.mockReturnValueOnce(() => Promise.resolve({
            data: {
                type: 'dialog',
                trigger_id: 'trig1',
                block_dialog: {
                    title: 'From post',
                    blocks: [{type: 'text', text: 'Hi'}],
                    actions: 'dialog-cookie',
                },
            },
        }));

        render(
            <Provider store={store}>
                <IntlProvider locale='en'>
                    <InteractiveMessages post={post}/>
                </IntlProvider>
            </Provider>,
        );

        fireEvent.click(screen.getByTestId('post-action'));
        await waitFor(() => {
            expect(mockOpenInteractiveDialog).toHaveBeenCalledWith({
                trigger_id: 'trig1',
                block_dialog: {
                    title: 'From post',
                    blocks: [{type: 'text', text: 'Hi'}],
                    actions: 'dialog-cookie',
                },
            });
        });
    });

    test('onLookup dispatches doBlockAction subtype lookup and returns items', async () => {
        mockDoBlockAction.mockReturnValueOnce(() => Promise.resolve({
            data: {
                items: [
                    {text: 'Alpha', value: 'a'},
                    {text: 'Beta', value: 'b'},
                ],
            },
        }));

        render(
            <Provider store={store}>
                <IntlProvider locale='en'>
                    <InteractiveMessages post={post}/>
                </IntlProvider>
            </Provider>,
        );

        fireEvent.click(screen.getByTestId('post-lookup'));

        await waitFor(() => {
            expect(mockDoBlockAction).toHaveBeenCalledWith({
                subtype: 'lookup',
                context: 'post',
                post_id: 'post1',
                action_id: 'lookup_act',
                cookie: 'post-cookie',
                query: {query: 'alp'},
                form_values: {title: 't'},
                integration_format: 'mm_block',
            });
        });

        await waitFor(() => {
            expect(mockLookupResult).toEqual([
                {text: 'Alpha', value: 'a'},
                {text: 'Beta', value: 'b'},
            ]);
        });
    });

    test('mm_block actions dispatch doBlockAction', async () => {
        render(
            <Provider store={store}>
                <IntlProvider locale='en'>
                    <InteractiveMessages post={post}/>
                </IntlProvider>
            </Provider>,
        );

        fireEvent.click(screen.getByTestId('post-action'));

        await waitFor(() => {
            expect(mockDoBlockAction).toHaveBeenCalledWith({
                subtype: 'execute',
                context: 'post',
                post_id: 'post1',
                action_id: 'btn1',
                cookie: 'post-cookie',
                selected_option: undefined,
                query: undefined,
                form_values: undefined,
                integration_format: 'mm_block',
            });
        });
        expect(mockDoPostActionWithCookie).not.toHaveBeenCalled();
    });

    test('legacy attachment actions dispatch doPostActionWithCookie', async () => {
        mockIntegrationFormat = 'attachment';

        render(
            <Provider store={store}>
                <IntlProvider locale='en'>
                    <InteractiveMessages post={post}/>
                </IntlProvider>
            </Provider>,
        );

        fireEvent.click(screen.getByTestId('post-action'));

        await waitFor(() => {
            expect(mockDoPostActionWithCookie).toHaveBeenCalledWith(
                'post1',
                'btn1',
                'attach-cookie',
                '',
                undefined,
                'attachment',
            );
        });
        expect(mockDoBlockAction).not.toHaveBeenCalled();
    });
});
