// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {General} from 'mattermost-redux/constants';
import mockStore from 'tests/test_store';

import {
    runDesktopNotificationHooks,
    runMessageWillBePostedHooks,
    runMessageWillBeUpdatedHooks,
    runSlashCommandWillBePostedHooks,
} from './hooks';

describe('runMessageWillBePostedHooks', () => {
    test('should do nothing when no hooks are registered', async () => {
        const store = mockStore({
            plugins: {
                components: {},
            },
        });
        const post = {message: 'test'};

        const result = await store.dispatch(runMessageWillBePostedHooks(post));

        expect(result).toEqual({data: post});
    });

    test('should pass the post through every hook', async () => {
        const hook1 = jest.fn((post) => ({post}));
        const hook2 = jest.fn((post) => ({post}));
        const hook3 = jest.fn((post) => ({post}));

        const store = mockStore({
            plugins: {
                components: {
                    MessageWillBePosted: [
                        {hook: hook1},
                        {hook: hook2},
                        {hook: hook3},
                    ],
                },
            },
        });
        const post = {message: 'test'};

        const result = await store.dispatch(runMessageWillBePostedHooks(post));

        expect(result).toEqual({data: post});
        expect(hook1).toHaveBeenCalledWith(post);
        expect(hook2).toHaveBeenCalledWith(post);
        expect(hook3).toHaveBeenCalledWith(post);
    });

    test('should return an error when a hook rejects the post', async () => {
        const hook1 = jest.fn((post) => ({post}));
        const hook2 = jest.fn(() => ({error: {message: 'an error occurred'}}));
        const hook3 = jest.fn((post) => ({post}));

        const store = mockStore({
            plugins: {
                components: {
                    MessageWillBePosted: [
                        {hook: hook1},
                        {hook: hook2},
                        {hook: hook3},
                    ],
                },
            },
        });
        const post = {message: 'test'};

        const result = await store.dispatch(runMessageWillBePostedHooks(post));

        expect(result).toEqual({error: {message: 'an error occurred'}});
        expect(hook1).toHaveBeenCalledWith(post);
        expect(hook2).toHaveBeenCalledWith(post);
        expect(hook3).not.toHaveBeenCalled();
    });

    test('should pass the result of each hook to the next', async () => {
        const hook1 = jest.fn((post) => ({post: {...post, message: post.message + 'a'}}));
        const hook2 = jest.fn((post) => ({post: {...post, message: post.message + 'b'}}));
        const hook3 = jest.fn((post) => ({post: {...post, message: post.message + 'c'}}));

        const store = mockStore({
            plugins: {
                components: {
                    MessageWillBePosted: [
                        {hook: hook1},
                        {hook: hook2},
                        {hook: hook3},
                    ],
                },
            },
        });
        const post = {message: 'test'};

        const result = await store.dispatch(runMessageWillBePostedHooks(post));

        expect(result).toEqual({data: {message: 'testabc'}});
        expect(hook1).toHaveBeenCalledWith(post);
        expect(hook2).toHaveBeenCalled();
        expect(hook2).not.toHaveBeenCalledWith(post);
        expect(hook3).toHaveBeenCalled();
        expect(hook3).not.toHaveBeenCalledWith(post);
    });

    test('should wait for async hooks', async () => {
        jest.useFakeTimers();

        const hook = jest.fn((post) => {
            return new Promise((resolve) => {
                setTimeout(() => {
                    resolve({post: {...post, message: post.message + 'async'}});
                }, 100);

                jest.runOnlyPendingTimers();
            });
        });

        const store = mockStore({
            plugins: {
                components: {
                    MessageWillBePosted: [
                        {hook},
                    ],
                },
            },
        });
        const post = {message: 'test'};

        const result = await store.dispatch(runMessageWillBePostedHooks(post));

        expect(result).toEqual({data: {message: 'testasync'}});
        expect(hook).toHaveBeenCalledWith(post);
    });

    test('should assume post is unchanged if a hook returns undefined', async () => {
        const hook1 = jest.fn();
        const hook2 = jest.fn((post) => ({post: {...post, message: post.message + 'b'}}));

        const store = mockStore({
            plugins: {
                components: {
                    MessageWillBePosted: [
                        {hook: hook1},
                        {hook: hook2},
                    ],
                },
            },
        });
        const post = {message: 'test'};

        const result = await store.dispatch(runMessageWillBePostedHooks(post));

        expect(result).toEqual({data: {message: 'testb'}});
        expect(hook1).toHaveBeenCalledWith(post);
        expect(hook2).toHaveBeenCalled();
        expect(hook2).toHaveBeenCalledWith(post);
    });
});

describe('runSlashCommandWillBePostedHooks', () => {
    test('should do nothing when no hooks are registered', async () => {
        const store = mockStore({
            plugins: {
                components: {},
            },
        });
        const message = '/test';
        const args = {channelId: 'abcdefg'};

        const result = await store.dispatch(runSlashCommandWillBePostedHooks(message, args));

        expect(result.data).toEqual({message, args});
    });

    test('should pass the command through every hook', async () => {
        const hook1 = jest.fn((message, args) => ({message, args}));
        const hook2 = jest.fn((message, args) => ({message, args}));
        const hook3 = jest.fn((message, args) => ({message, args}));

        const store = mockStore({
            plugins: {
                components: {
                    SlashCommandWillBePosted: [
                        {hook: hook1},
                        {hook: hook2},
                        {hook: hook3},
                    ],
                },
            },
        });
        const message = '/test';
        const args = {channelId: 'abcdefg'};

        const result = await store.dispatch(runSlashCommandWillBePostedHooks(message, args));

        expect(result.data).toEqual({message, args});
        expect(hook1).toHaveBeenCalledWith(message, args);
        expect(hook2).toHaveBeenCalledWith(message, args);
        expect(hook3).toHaveBeenCalledWith(message, args);
    });

    test('should return an error when a hook rejects the command', async () => {
        const hook1 = jest.fn((message, args) => ({message, args}));
        const hook2 = jest.fn(() => ({error: {message: 'an error occurred'}}));
        const hook3 = jest.fn((message, args) => ({message, args}));

        const store = mockStore({
            plugins: {
                components: {
                    SlashCommandWillBePosted: [
                        {hook: hook1},
                        {hook: hook2},
                        {hook: hook3},
                    ],
                },
            },
        });
        const message = '/test';
        const args = {channelId: 'abcdefg'};

        const result = await store.dispatch(runSlashCommandWillBePostedHooks(message, args));

        expect(result).toEqual({error: {message: 'an error occurred'}});
        expect(hook1).toHaveBeenCalledWith(message, args);
        expect(hook2).toHaveBeenCalledWith(message, args);
        expect(hook3).not.toHaveBeenCalled();
    });

    test('should pass the result of each hook to the next', async () => {
        const hook1 = jest.fn((message, args) => ({message: message + 'a', args}));
        const hook2 = jest.fn((message, args) => ({message: message + 'b', args}));
        const hook3 = jest.fn((message, args) => ({message: message + 'c', args}));

        const store = mockStore({
            plugins: {
                components: {
                    SlashCommandWillBePosted: [
                        {hook: hook1},
                        {hook: hook2},
                        {hook: hook3},
                    ],
                },
            },
        });
        const message = '/test';
        const args = {channelId: 'abcdefg'};

        const result = await store.dispatch(runSlashCommandWillBePostedHooks(message, args));

        expect(result.data).toEqual({message: '/testabc', args});
        expect(hook1).toHaveBeenCalledWith('/test', args);
        expect(hook2).toHaveBeenCalledWith('/testa', args);
        expect(hook3).toHaveBeenCalledWith('/testab', args);
    });

    test('should pass the result of each hook to the next, until one consumes the command by returning an empty object', async () => {
        const hook1 = jest.fn((message, args) => ({message: message + 'a', args}));
        const hook2 = jest.fn(() => ({}));
        const hook3 = jest.fn((message, args) => ({message: message + 'c', args}));

        const store = mockStore({
            plugins: {
                components: {
                    SlashCommandWillBePosted: [
                        {hook: hook1},
                        {hook: hook2},
                        {hook: hook3},
                    ],
                },
            },
        });
        const message = '/test';
        const args = {channelId: 'abcdefg'};

        const result = await store.dispatch(runSlashCommandWillBePostedHooks(message, args));

        expect(result.data).toEqual({});
        expect(hook1).toHaveBeenCalledWith('/test', args);
        expect(hook2).toHaveBeenCalledWith('/testa', args);
        expect(hook3).not.toHaveBeenCalled();
    });

    test('should wait for async hooks', async () => {
        jest.useFakeTimers();

        const hook = jest.fn((message, args) => {
            return new Promise((resolve) => {
                setTimeout(() => {
                    resolve({message: message + 'async', args});
                }, 100);

                jest.runOnlyPendingTimers();
            });
        });

        const store = mockStore({
            plugins: {
                components: {
                    SlashCommandWillBePosted: [
                        {hook},
                    ],
                },
            },
        });
        const message = '/test';
        const args = {channelId: 'abcdefg'};

        const result = await store.dispatch(runSlashCommandWillBePostedHooks(message, args));

        expect(result.data).toEqual({message: '/testasync', args});
        expect(hook).toHaveBeenCalledWith(message, args);
    });

    test('should assume command is unchanged if a hook returns undefined', async () => {
        const hook1 = jest.fn();
        const hook2 = jest.fn((message, args) => ({message: message + 'b', args}));

        const store = mockStore({
            plugins: {
                components: {
                    SlashCommandWillBePosted: [
                        {hook: hook1},
                        {hook: hook2},
                    ],
                },
            },
        });
        const message = '/test';
        const args = {channelId: 'abcdefg'};

        const result = await store.dispatch(runSlashCommandWillBePostedHooks(message, args));

        expect(result.data).toEqual({message: '/testb', args});
        expect(hook1).toHaveBeenCalledWith(message, args);
        expect(hook2).toHaveBeenCalled();
        expect(hook2).toHaveBeenCalledWith(message, args);
    });
});

describe('runMessageWillBeUpdatedHooks', () => {
    test('should do nothing when no hooks are registered', async () => {
        const store = mockStore({
            plugins: {
                components: {},
            },
        });

        const oldPost = {message: 'test'};
        const newPost = {message: 'edited'};

        const result = await store.dispatch(runMessageWillBeUpdatedHooks(newPost, oldPost));

        expect(result).toEqual({data: newPost});
    });

    test('should pass the post through every hook', async () => {
        const hook1 = jest.fn((post) => ({post}));
        const hook2 = jest.fn((post) => ({post}));
        const hook3 = jest.fn((post) => ({post}));

        const store = mockStore({
            plugins: {
                components: {
                    MessageWillBeUpdated: [
                        {hook: hook1},
                        {hook: hook2},
                        {hook: hook3},
                    ],
                },
            },
        });

        const oldPost = {message: 'test'};
        const newPost = {message: 'edited'};

        const result = await store.dispatch(runMessageWillBeUpdatedHooks(newPost, oldPost));

        expect(result).toEqual({data: newPost});
        expect(hook1).toHaveBeenCalledWith(newPost, oldPost);
        expect(hook2).toHaveBeenCalledWith(newPost, oldPost);
        expect(hook3).toHaveBeenCalledWith(newPost, oldPost);
    });

    test('should return an error when a hook rejects the post', async () => {
        const hook1 = jest.fn((post) => ({post}));
        const hook2 = jest.fn(() => ({error: {message: 'an error occurred'}}));
        const hook3 = jest.fn((post) => ({post}));

        const store = mockStore({
            plugins: {
                components: {
                    MessageWillBeUpdated: [
                        {hook: hook1},
                        {hook: hook2},
                        {hook: hook3},
                    ],
                },
            },
        });

        const oldPost = {message: 'test'};
        const newPost = {message: 'edited'};

        const result = await store.dispatch(runMessageWillBeUpdatedHooks(newPost, oldPost));

        expect(result).toEqual({error: {message: 'an error occurred'}});
        expect(hook1).toHaveBeenCalledWith(newPost, oldPost);
        expect(hook2).toHaveBeenCalledWith(newPost, oldPost);
        expect(hook3).not.toHaveBeenCalled();
    });

    test('should pass the result of each hook to the next', async () => {
        const hook1 = jest.fn((post) => ({post: {...post, message: post.message + 'a'}}));
        const hook2 = jest.fn((post) => ({post: {...post, message: post.message + 'b'}}));
        const hook3 = jest.fn((post) => ({post: {...post, message: post.message + 'c'}}));

        const store = mockStore({
            plugins: {
                components: {
                    MessageWillBeUpdated: [
                        {hook: hook1},
                        {hook: hook2},
                        {hook: hook3},
                    ],
                },
            },
        });

        const oldPost = {message: 'test'};
        const newPost = {message: 'edited'};

        const result = await store.dispatch(runMessageWillBeUpdatedHooks(newPost, oldPost));

        expect(result).toEqual({data: {message: 'editedabc'}});
        expect(hook1).toHaveBeenCalledWith(newPost, oldPost);
        expect(hook2).toHaveBeenCalled();
        expect(hook2).not.toHaveBeenCalledWith(newPost, oldPost);
        expect(hook3).toHaveBeenCalled();
        expect(hook3).not.toHaveBeenCalledWith(newPost, oldPost);
    });

    test('should wait for async hooks', async () => {
        jest.useFakeTimers();

        const hook = jest.fn((post) => {
            return new Promise((resolve) => {
                setTimeout(() => {
                    resolve({post: {...post, message: post.message + 'async'}});
                }, 100);

                jest.runOnlyPendingTimers();
            });
        });

        const store = mockStore({
            plugins: {
                components: {
                    MessageWillBeUpdated: [
                        {hook},
                    ],
                },
            },
        });

        const oldPost = {message: 'test'};
        const newPost = {message: 'edited'};

        const result = await store.dispatch(runMessageWillBeUpdatedHooks(newPost, oldPost));

        expect(result).toEqual({data: {message: 'editedasync'}});
        expect(hook).toHaveBeenCalledWith(newPost, oldPost);
    });

    test('should assume post is unchanged if a hook returns undefined', async () => {
        const hook1 = jest.fn();
        const hook2 = jest.fn((post) => ({post: {...post, message: post.message + 'b'}}));

        const store = mockStore({
            plugins: {
                components: {
                    MessageWillBeUpdated: [
                        {hook: hook1},
                        {hook: hook2},
                    ],
                },
            },
        });
        const oldPost = {message: 'test'};
        const newPost = {message: 'edited'};

        const result = await store.dispatch(runMessageWillBeUpdatedHooks(newPost, oldPost));

        expect(result).toEqual({data: {message: 'editedb'}});
        expect(hook1).toHaveBeenCalledWith(newPost, oldPost);
        expect(hook2).toHaveBeenCalled();
        expect(hook2).toHaveBeenCalledWith(newPost, oldPost);
    });
});

describe('runDesktopNotificationHooks', () => {
    test('should do nothing when no hooks are registered', async () => {
        const store = mockStore({
            plugins: {
                components: {},
            },
        });
        const post = {id: 'postid01234567890123456789'};
        const teamId = 'teamid01234567890123456789';
        const msgProps = {mentions: ['userid1'], team_id: teamId};
        const channel = {type: General.DM_CHANNEL};
        const args = {
            title: 'Notification title',
            body: 'Notification body',
            silent: false,
            soundName: 'Bing',
            url: 'http://localhost:8065/ad-1/channels/test',
            notify: true,
        };

        const result = await store.dispatch(runDesktopNotificationHooks(post, msgProps, channel, teamId, args));

        expect(result.args).toEqual(args);
    });

    test('should pass the args through every hook', async () => {
        const hook1 = jest.fn((post, msgProps, channel, teamId, args) => ({args}));
        const hook2 = jest.fn((post, msgProps, channel, teamId, args) => ({args}));
        const hook3 = jest.fn((post, msgProps, channel, teamId, args) => ({args}));

        const store = mockStore({
            plugins: {
                components: {
                    DesktopNotificationHooks: [
                        {hook: hook1},
                        {hook: hook2},
                        {hook: hook3},
                    ],
                },
            },
        });
        const post = {id: 'postid01234567890123456789'};
        const teamId = 'teamid01234567890123456789';
        const msgProps = {mentions: ['userid1'], team_id: teamId};
        const channel = {type: General.DM_CHANNEL};
        const args = {
            title: 'Notification title',
            body: 'Notification body',
            silent: false,
            soundName: 'Bing',
            url: 'http://localhost:8065/ad-1/channels/test',
            notify: true,
        };

        const result = await store.dispatch(runDesktopNotificationHooks(post, msgProps, channel, teamId, args));

        expect(result.args).toEqual(args);
        expect(hook1).toHaveBeenCalledWith(post, msgProps, channel, teamId, args);
        expect(hook2).toHaveBeenCalledWith(post, msgProps, channel, teamId, args);
        expect(hook3).toHaveBeenCalledWith(post, msgProps, channel, teamId, args);
    });

    test('should return an error when a hook returns an error', async () => {
        const hook1 = jest.fn((post, msgProps, channel, teamId, args) => ({args}));
        const hook2 = jest.fn(() => ({error: 'an error occurred'}));
        const hook3 = jest.fn((post, msgProps, channel, teamId, args) => ({args}));

        const store = mockStore({
            plugins: {
                components: {
                    DesktopNotificationHooks: [
                        {hook: hook1},
                        {hook: hook2},
                        {hook: hook3},
                    ],
                },
            },
        });
        const post = {id: 'postid01234567890123456789'};
        const teamId = 'teamid01234567890123456789';
        const msgProps = {mentions: ['userid1'], team_id: teamId};
        const channel = {type: General.DM_CHANNEL};
        const args = {
            title: 'Notification title',
            body: 'Notification body',
            silent: false,
            soundName: 'Bing',
            url: 'http://localhost:8065/ad-1/channels/test',
            notify: true,
        };

        const result = await store.dispatch(runDesktopNotificationHooks(post, msgProps, channel, teamId, args));

        expect(result).toEqual({error: 'an error occurred'});
        expect(hook1).toHaveBeenCalledWith(post, msgProps, channel, teamId, args);
        expect(hook2).toHaveBeenCalledWith(post, msgProps, channel, teamId, args);
        expect(hook3).not.toHaveBeenCalled();
    });

    test('should return an error when a hook returns an empty result', async () => {
        const hook1 = jest.fn((post, msgProps, channel, teamId, args) => ({args}));
        const hook2 = jest.fn(() => ({}));
        const hook3 = jest.fn((post, msgProps, channel, teamId, args) => ({args}));

        const store = mockStore({
            plugins: {
                components: {
                    DesktopNotificationHooks: [
                        {hook: hook1},
                        {hook: hook2},
                        {hook: hook3},
                    ],
                },
            },
        });
        const post = {id: 'postid01234567890123456789'};
        const teamId = 'teamid01234567890123456789';
        const msgProps = {mentions: ['userid1'], team_id: teamId};
        const channel = {type: General.DM_CHANNEL};
        const args = {
            title: 'Notification title',
            body: 'Notification body',
            silent: false,
            soundName: 'Bing',
            url: 'http://localhost:8065/ad-1/channels/test',
            notify: true,
        };

        const result = await store.dispatch(runDesktopNotificationHooks(post, msgProps, channel, teamId, args));

        expect(result).toEqual({error: 'returned empty args'});
        expect(hook1).toHaveBeenCalledWith(post, msgProps, channel, teamId, args);
        expect(hook2).toHaveBeenCalledWith(post, msgProps, channel, teamId, args);
        expect(hook3).not.toHaveBeenCalled();
    });

    test('should continue to call next hooks when a hook returns null or undefined', async () => {
        const hook1 = jest.fn(() => (null));
        const hook2 = jest.fn(() => (undefined));
        const hook3 = jest.fn((post, msgProps, channel, teamId, args) => ({args}));

        const store = mockStore({
            plugins: {
                components: {
                    DesktopNotificationHooks: [
                        {hook: hook1},
                        {hook: hook2},
                        {hook: hook3},
                    ],
                },
            },
        });
        const post = {id: 'postid01234567890123456789'};
        const teamId = 'teamid01234567890123456789';
        const msgProps = {mentions: ['userid1'], team_id: teamId};
        const channel = {type: General.DM_CHANNEL};
        const args = {
            title: 'Notification title',
            body: 'Notification body',
            silent: false,
            soundName: 'Bing',
            url: 'http://localhost:8065/ad-1/channels/test',
            notify: true,
        };

        const result = await store.dispatch(runDesktopNotificationHooks(post, msgProps, channel, teamId, args));

        expect(result.args).toEqual(args);
        expect(hook1).toHaveBeenCalledWith(post, msgProps, channel, teamId, args);
        expect(hook2).toHaveBeenCalledWith(post, msgProps, channel, teamId, args);
        expect(hook3).toHaveBeenCalledWith(post, msgProps, channel, teamId, args);
    });

    test('should pass the result of each hook to the next', async () => {
        const hook1 = jest.fn((post, msgProps, channel, teamId, args) => ({args: {...args, title: args.title + 'a'}}));
        const hook2 = jest.fn((post, msgProps, channel, teamId, args) => ({
            args: {
                ...args,
                title: args.title + 'b',
                notify: false,
            },
        }));
        const hook3 = jest.fn((post, msgProps, channel, teamId, args) => ({
            args: {
                ...args,
                title: args.title + 'c',
                notify: true,
            },
        }));

        const store = mockStore({
            plugins: {
                components: {
                    DesktopNotificationHooks: [
                        {hook: hook1},
                        {hook: hook2},
                        {hook: hook3},
                    ],
                },
            },
        });
        const post = {id: 'postid01234567890123456789'};
        const teamId = 'teamid01234567890123456789';
        const msgProps = {mentions: ['userid1'], team_id: teamId};
        const channel = {type: General.DM_CHANNEL};
        const args = {
            title: 'Notification title',
            body: 'Notification body',
            silent: false,
            soundName: 'Bing',
            url: 'http://localhost:8065/ad-1/channels/test',
            notify: true,
        };

        const result = await store.dispatch(runDesktopNotificationHooks(post, msgProps, channel, teamId, args));

        expect(result.args).toEqual({...args, title: 'Notification titleabc', notify: true});
        expect(hook1).toHaveBeenCalledWith(post, msgProps, channel, teamId, args);
        expect(hook2).toHaveBeenCalledWith(post, msgProps, channel, teamId, {...args, title: 'Notification titlea'});
        expect(hook3).toHaveBeenCalledWith(post, msgProps, channel, teamId, {...args, title: 'Notification titleab', notify: false});
    });

    test('should wait for async hooks', async () => {
        jest.useFakeTimers();

        const hook = jest.fn((post, msgProps, channel, teamId, args) => {
            return new Promise((resolve) => {
                setTimeout(() => {
                    resolve({args: {...args, title: args.title + ' async'}});
                }, 100);

                jest.runOnlyPendingTimers();
            });
        });

        const store = mockStore({
            plugins: {
                components: {
                    DesktopNotificationHooks: [
                        {hook},
                    ],
                },
            },
        });
        const post = {id: 'postid01234567890123456789'};
        const teamId = 'teamid01234567890123456789';
        const msgProps = {mentions: ['userid1'], team_id: teamId};
        const channel = {type: General.DM_CHANNEL};
        const args = {
            title: 'Notification title',
            body: 'Notification body',
            silent: false,
            soundName: 'Bing',
            url: 'http://localhost:8065/ad-1/channels/test',
            notify: true,
        };

        const result = await store.dispatch(runDesktopNotificationHooks(post, msgProps, channel, teamId, args));

        expect(result.args).toEqual({...args, title: 'Notification title async'});
        expect(hook).toHaveBeenCalledWith(post, msgProps, channel, teamId, args);
    });
});
