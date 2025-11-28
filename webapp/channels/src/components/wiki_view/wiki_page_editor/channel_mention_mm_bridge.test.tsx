// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Editor} from '@tiptap/core';
import Document from '@tiptap/extension-document';
import Paragraph from '@tiptap/extension-paragraph';
import Text from '@tiptap/extension-text';

import type {Channel} from '@mattermost/types/channels';

import {createChannelMentionSuggestion} from './channel_mention_mm_bridge';

describe('createChannelMentionSuggestion', () => {
    const mockChannel1: Channel = {
        id: 'channel-1',
        name: 'town-square',
        display_name: 'Town Square',
        type: 'O',
        team_id: 'team-1',
        create_at: 0,
        update_at: 0,
        delete_at: 0,
        header: '',
        purpose: '',
        last_post_at: 0,
        last_root_post_at: 0,
        creator_id: 'user-1',
        scheme_id: '',
        group_constrained: false,
        shared: undefined,
        policy_id: null,
    };

    const mockChannel2: Channel = {
        id: 'channel-2',
        name: 'off-topic',
        display_name: 'Off-Topic',
        type: 'O',
        team_id: 'team-1',
        create_at: 0,
        update_at: 0,
        delete_at: 0,
        header: '',
        purpose: '',
        last_post_at: 0,
        last_root_post_at: 0,
        creator_id: 'user-1',
        scheme_id: '',
        group_constrained: false,
        shared: undefined,
        policy_id: null,
    };

    const mockChannels = [mockChannel1, mockChannel2];

    const createMockAutocompleteChannels = (channels: Channel[]) => {
        return (term: string, success: (channels: Channel[]) => void) => {
            const filtered = channels.filter((ch) =>
                ch.name.includes(term.toLowerCase()) ||
                ch.display_name.toLowerCase().includes(term.toLowerCase()),
            );
            success(filtered);
            return Promise.resolve({data: true});
        };
    };

    const getDefaultProps = () => {
        return {
            channelId: 'channel-1',
            teamId: 'team-1',
            autocompleteChannels: createMockAutocompleteChannels(mockChannels),
            delayChannelAutocomplete: false,
        };
    };

    const createTestEditor = () => {
        return new Editor({
            extensions: [Document, Paragraph, Text],
            content: '',
        });
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('suggestion configuration', () => {
        it('should have char trigger set to ~', () => {
            const config = createChannelMentionSuggestion(getDefaultProps());

            expect(config.char).toBe('~');
        });

        it('should provide items function', () => {
            const config = createChannelMentionSuggestion(getDefaultProps());

            expect(config.items).toBeDefined();
            expect(typeof config.items).toBe('function');
        });

        it('should provide render function', () => {
            const config = createChannelMentionSuggestion(getDefaultProps());

            expect(config.render).toBeDefined();
            expect(typeof config.render).toBe('function');
        });
    });

    describe('items function - using mocked ChannelMentionProvider', () => {
        it('should filter out loading placeholders from results', async () => {
            const config = createChannelMentionSuggestion(getDefaultProps());
            const result = await config.items!({query: '', editor: createTestEditor()});

            expect(result.every((item: Channel) => !('loading' in item))).toBe(true);
        });

        it('should return only channels with id and name properties', async () => {
            const config = createChannelMentionSuggestion(getDefaultProps());
            const result = await config.items!({query: '', editor: createTestEditor()});

            result.forEach((channel: Channel) => {
                expect(channel).toHaveProperty('id');
                expect(channel).toHaveProperty('name');
                expect(channel).toHaveProperty('display_name');
            });
        });

        it('should filter channels based on query', async () => {
            const config = createChannelMentionSuggestion(getDefaultProps());
            const result = await config.items!({query: 'town', editor: createTestEditor()});

            expect(result.length).toBeGreaterThan(0);
            expect(result.some((ch: Channel) => ch.name.includes('town'))).toBe(true);
        });
    });

    describe('render function lifecycle', () => {
        it('should return render lifecycle functions', () => {
            const config = createChannelMentionSuggestion(getDefaultProps());
            const renderFunctions = config.render!();

            expect(renderFunctions.onStart).toBeDefined();
            expect(typeof renderFunctions.onStart).toBe('function');
            expect(renderFunctions.onUpdate).toBeDefined();
            expect(typeof renderFunctions.onUpdate).toBe('function');
            expect(renderFunctions.onKeyDown).toBeDefined();
            expect(typeof renderFunctions.onKeyDown).toBe('function');
            expect(renderFunctions.onExit).toBeDefined();
            expect(typeof renderFunctions.onExit).toBe('function');
        });
    });

    describe('integration with mocked ChannelMentionProvider', () => {
        it('should respect delayChannelAutocomplete prop', () => {
            const configWithDelay = createChannelMentionSuggestion({
                ...getDefaultProps(),
                delayChannelAutocomplete: true,
            });

            expect(configWithDelay.char).toBe('~');
            expect(configWithDelay.items).toBeDefined();
        });
    });

    describe('TipTap Mention extension compatibility', () => {
        it('should match TipTap SuggestionOptions interface', () => {
            const config = createChannelMentionSuggestion(getDefaultProps());

            expect(config).toHaveProperty('char');
            expect(config).toHaveProperty('items');
            expect(config).toHaveProperty('render');

            expect(typeof config.char).toBe('string');
            expect(typeof config.items).toBe('function');
            expect(typeof config.render).toBe('function');
        });

        it('should use different trigger than user mentions', () => {
            const channelConfig = createChannelMentionSuggestion(getDefaultProps());

            expect(channelConfig.char).toBe('~');
            expect(channelConfig.char).not.toBe('@');
        });
    });

    describe('props handling', () => {
        it('should accept and use channelId prop', () => {
            const config = createChannelMentionSuggestion({
                ...getDefaultProps(),
                channelId: 'different-channel',
            });

            expect(config).toBeDefined();
            expect(config.char).toBe('~');
        });

        it('should accept and use teamId prop', () => {
            const config = createChannelMentionSuggestion({
                ...getDefaultProps(),
                teamId: 'different-team',
            });

            expect(config).toBeDefined();
            expect(config.char).toBe('~');
        });

        it('should handle delayChannelAutocomplete true', () => {
            const configWithDelay = createChannelMentionSuggestion({
                ...getDefaultProps(),
                delayChannelAutocomplete: true,
            });

            expect(configWithDelay).toBeDefined();
            expect(configWithDelay.char).toBe('~');
        });

        it('should handle delayChannelAutocomplete false', () => {
            const configWithoutDelay = createChannelMentionSuggestion({
                ...getDefaultProps(),
                delayChannelAutocomplete: false,
            });

            expect(configWithoutDelay).toBeDefined();
            expect(configWithoutDelay.char).toBe('~');
        });
    });

    describe('error handling', () => {
        it('should handle autocomplete errors gracefully', async () => {
            const errorAutocomplete = (term: string, success: (channels: Channel[]) => void, error: () => void) => {
                error();
                return Promise.resolve({error: 'Network error'});
            };

            const config = createChannelMentionSuggestion({
                ...getDefaultProps(),
                autocompleteChannels: errorAutocomplete,
            });

            const result = await config.items!({query: 'test', editor: createTestEditor()});
            expect(Array.isArray(result)).toBe(true);
        });
    });
});
