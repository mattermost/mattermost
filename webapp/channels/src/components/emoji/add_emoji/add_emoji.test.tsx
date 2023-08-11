// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {shallow} from 'enzyme';

import type {CustomEmoji} from '@mattermost/types/emojis';
import type {Team} from '@mattermost/types/teams';
import type {UserProfile} from '@mattermost/types/users';

import EmojiMap from 'utils/emoji_map';
import {TestHelper} from 'utils/test_helper';

import AddEmoji from './add_emoji';
import type {AddEmojiProps} from './add_emoji';

const context = {router: {}};
const image = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEgAAABICAYAAABV7bNHAAAABmJLR0QA/wD/AP+gvaeTAAAACXBIWXMAABYlAAAWJQFJUiTwAAAAB3R' +
    'JTUUH4AcXEyomBnhW6AAAAm9JREFUeNrtnL9vEmEcxj9cCDUSIVhNgGjaTUppOmjrX1BNajs61n+hC5MMrQNOLE7d27GjPxLs0JmSDk2VYNLBCw0yCA0mOBATHXghVu4wYeHCPc' +
    '94711y30/e732f54Y3sLBbxEUxYAtYA5aB+0yXasAZcAQcAFdON1kuD+eBBvAG2JhCOJiaNkyNDVPzfwGlgBPgJRDCPwqZmk8MA0dAKeAjsIJ/tWIYpJwA7U9pK43Tevv/Asr7f' +
    'Oc47aR8H1AMyIrJkLJAzDKjPCQejh/uLcv4HMlZa5YxgZKzli1NrtETzRKD0RIgARIgARIgARIgAfKrgl54iUwiwrOlOHOzYQDsZof35w0+ffshQJlEhJ3NxWvX7t66waP5WV69' +
    '/TxxSBNvsecP74215htA83fCrmv9lvM1oJsh9y4PzwQFqFJvj7XmG0AfzhtjrfkGUMlusXd8gd3sDK7ZzQ57xxeU7NbEAQUWdou/ZQflpAVIgPycxR7P3WbdZLHwTJBKvc3h6aU' +
    'nspjlBTjZpw9IJ6MDY5hORtnZXCSTiAjQ+lJcWWyU0smostjYJi2gKTYyb3393hGgUXnr8PRSgEp2i0LxC5V6m5/dX4Nd5YW/iZ7xQSW75YlgKictQAKkLKYspiymLKYspiymLK' +
    'YspiymLCYnraghQAIkCZAACZAACZDHAdWEwVU1i94RMZKzzix65+dIzjqy6B0u1BWLIXWBA4veyUsF8RhSAbjqT7EcUBaTgcqGybUx/0ITrTe5DIshH1QFnvh8J5UNg6qbUawCq' +
    '8Brn324u6bm1b/hjHLSOSAObAPvprT1aqa2bVNrzummPw4OwJf+E7QCAAAAAElFTkSuQmCC';

describe('components/emoji/components/AddEmoji', () => {
    const baseProps: AddEmojiProps = {
        emojiMap: new EmojiMap(new Map([['mycustomemoji', TestHelper.getCustomEmojiMock({name: 'mycustomemoji'})]])),
        team: {
            id: 'team-id',
        } as Team,
        user: {
            id: 'current-user-id',

        } as UserProfile,
        actions: {
            createCustomEmoji: jest.fn().mockImplementation((emoji: CustomEmoji) => ({data: {name: emoji.name}})),
        },
    };

    const assertErrorIsElementWithMatchingId = (error: React.ReactNode, expectedId: string) => {
        const errorElement = error as JSX.Element;
        expect(errorElement).not.toBeUndefined();
        expect(errorElement.props.id).toEqual(expectedId);
    };

    test('should match snapshot', () => {
        const wrapper = shallow(
            <AddEmoji {...baseProps}/>,
            {context},
        );

        expect(wrapper).toMatchSnapshot();
        expect(wrapper.state('image')).toBeNull();
        expect(wrapper.state('imageUrl')).toEqual('');
        expect(wrapper.state('name')).toEqual('');
    });

    test('should update emoji name and match snapshot', () => {
        const wrapper = shallow(
            <AddEmoji {...baseProps}/>,
            {context},
        );

        const nameInput = wrapper.find('#name');
        nameInput.simulate('change', {target: {name: 'name', value: 'emojiName'}});
        expect(wrapper.state('name')).toEqual('emojiName');
        expect(wrapper).toMatchSnapshot();
    });

    test('should select a file and match snapshot', () => {
        const wrapper = shallow(
            <AddEmoji {...baseProps}/>,
            {context},
        );

        const file = new Blob([image], {type: 'image/png'});
        const onload = jest.fn(() => {
            wrapper.setState({image: file, imageUrl: image});
        });
        const readAsDataURL = jest.fn(() => onload());

        Object.defineProperty(global, 'FileReader', {
            writable: true,
            value: jest.fn().mockImplementation(() => ({
                readAsDataURL,
                onload,
            })),
        });

        const fileInput = wrapper.find('#select-emoji');
        fileInput.simulate('change', {target: {files: []}});
        expect(FileReader).not.toBeCalled();
        expect(wrapper.state('image')).toEqual(null);
        expect(wrapper.state('imageUrl')).toEqual('');

        fileInput.simulate('change', {target: {files: [file]}});
        expect(FileReader).toBeCalled();
        expect(readAsDataURL).toHaveBeenCalledWith(file);
        expect(onload).toHaveBeenCalledTimes(1);
        expect(wrapper.state('image')).toEqual(file);
        expect(wrapper.state('imageUrl')).toEqual(image);
        expect(wrapper).toMatchSnapshot();
    });

    test('should submit the new added emoji', () => {
        const wrapper = shallow<AddEmoji>(
            <AddEmoji {...baseProps}/>,
            {context},
        );

        const file = new Blob([image], {type: 'image/png'});
        const onload = jest.fn(() => {
            wrapper.setState({image: file as File, imageUrl: image});
        });
        const readAsDataURL = jest.fn(() => onload());
        const form = wrapper.find('form').first();
        const nameInput = wrapper.find('#name');
        const fileInput = wrapper.find('#select-emoji');

        Object.defineProperty(global, 'FileReader', {
            writable: true,
            value: jest.fn().mockImplementation(() => ({
                readAsDataURL,
                onload,
                result: image,
            })),
        });

        nameInput.simulate('change', {target: {name: 'name', value: 'emojiName'}});
        fileInput.simulate('change', {target: {files: [file]}});
        form.simulate('submit', {preventDefault: jest.fn()});
        Promise.resolve();

        expect(wrapper.state('saving')).toEqual(true);
        expect(baseProps.actions.createCustomEmoji).toBeCalled();
        expect(wrapper.state().error).toBeNull();
    });

    test('should not submit when already saving', () => {
        const wrapper = shallow<AddEmoji>(
            <AddEmoji {...baseProps}/>,
            {context},
        );

        wrapper.setState({saving: true});
        const form = wrapper.find('form').first();

        form.simulate('submit', {preventDefault: jest.fn()});
        Promise.resolve();

        expect(wrapper.state('saving')).toEqual(true);
        expect(baseProps.actions.createCustomEmoji).not.toBeCalled();
        expect(wrapper.state().error).toBeNull();
    });

    test('should show error if emoji name unset', () => {
        const wrapper = shallow<AddEmoji>(
            <AddEmoji {...baseProps}/>,
            {context},
        );

        const form = wrapper.find('form').first();

        form.simulate('submit', {preventDefault: jest.fn()});

        expect(wrapper.state('saving')).toEqual(false);
        expect(baseProps.actions.createCustomEmoji).not.toBeCalled();
        expect(wrapper.state().error).not.toBeNull();
        assertErrorIsElementWithMatchingId(wrapper.state().error, 'add_emoji.nameRequired');
    });

    test('should show error if image unset', () => {
        const wrapper = shallow<AddEmoji>(
            <AddEmoji {...baseProps}/>,
            {context},
        );

        const form = wrapper.find('form').first();
        const nameInput = wrapper.find('#name');

        nameInput.simulate('change', {target: {name: 'name', value: 'emojiName'}});
        form.simulate('submit', {preventDefault: jest.fn()});

        expect(wrapper.state('saving')).toEqual(false);
        expect(baseProps.actions.createCustomEmoji).not.toBeCalled();
        expect(wrapper.state().error).not.toBeNull();
        assertErrorIsElementWithMatchingId(wrapper.state().error, 'add_emoji.imageRequired');
    });

    test.each([
        'hyphens-are-allowed',
        'underscores_are_allowed',
        'numb3rsar3all0w3d',
    ])('%s should be a valid emoji name', (emojiName) => {
        const wrapper = shallow<AddEmoji>(
            <AddEmoji {...baseProps}/>,
            {context},
        );

        const file = new Blob([image], {type: 'image/png'});
        wrapper.setState({image: file as File, imageUrl: image});

        const saveButton = wrapper.find('SpinnerButton').first();
        const nameInput = wrapper.find('#name');
        nameInput.simulate('change', {target: {name: 'name', value: emojiName}});

        saveButton.simulate('click', {preventDefault: jest.fn()});

        expect(wrapper.state().saving).toEqual(true);
        expect(baseProps.actions.createCustomEmoji).toBeCalled();
        expect(wrapper.state().error).toBeNull();
    });

    test.each([
        '$ymbolsnotallowed',
        'symbolsnot@llowed',
        'symbolsnot&llowed',
        'symbolsnota|lowed',
        'symbolsnota()owed',
        'symbolsnot^llowed',
        'symbols notallowed',
        'symbols"notallowed',
        "symbols'notallowed",
        'symbols.not.allowed',
    ])("'%s' should not be a valid emoji name", (emojiName) => {
        const wrapper = shallow<AddEmoji>(
            <AddEmoji {...baseProps}/>,
            {context},
        );

        const file = new Blob([image], {type: 'image/png'});
        wrapper.setState({image: file as File, imageUrl: image});

        const form = wrapper.find('form').first();
        const nameInput = wrapper.find('#name');
        nameInput.simulate('change', {target: {name: 'name', value: emojiName}});

        form.simulate('submit', {preventDefault: jest.fn()});

        expect(wrapper.state().saving).toEqual(false);
        expect(baseProps.actions.createCustomEmoji).not.toBeCalled();
        expect(wrapper.state().error).not.toBeNull();
        assertErrorIsElementWithMatchingId(wrapper.state().error, 'add_emoji.nameInvalid');
    });

    test.each([
        ['UPPERCASE', 'uppercase'],
        [' trimmed ', 'trimmed'],
        [':colonstrimmed:', 'colonstrimmed'],
    ])("emoji name '%s' should be corrected as '%s'", (emojiName, expectedName) => {
        const wrapper = shallow<AddEmoji>(
            <AddEmoji {...baseProps}/>,
            {context},
        );

        const file = new Blob([image], {type: 'image/png'});
        wrapper.setState({image: file as File, imageUrl: image});

        const form = wrapper.find('form').first();
        const nameInput = wrapper.find('#name');
        nameInput.simulate('change', {target: {name: 'name', value: emojiName}});

        form.simulate('submit', {preventDefault: jest.fn()});

        expect(wrapper.state().saving).toEqual(true);
        expect(baseProps.actions.createCustomEmoji).toHaveBeenCalledWith({creator_id: baseProps.user.id, name: expectedName}, file);
        expect(wrapper.state().error).toBeNull();
    });

    test('should show an error when emoji name is taken by a system emoji', () => {
        const wrapper = shallow<AddEmoji>(
            <AddEmoji {...baseProps}/>,
            {context},
        );

        const file = new Blob([image], {type: 'image/png'});
        wrapper.setState({image: file as File, imageUrl: image});

        const form = wrapper.find('form').first();
        const nameInput = wrapper.find('#name');

        nameInput.simulate('change', {target: {name: 'name', value: 'smiley'}});
        form.simulate('submit', {preventDefault: jest.fn()});

        expect(wrapper.state().saving).toEqual(false);
        expect(baseProps.actions.createCustomEmoji).not.toBeCalled();
        expect(wrapper.state().error).not.toBeNull();
        assertErrorIsElementWithMatchingId(wrapper.state().error, 'add_emoji.nameTaken');
    });

    test('should show error when emoji name is taken by an existing custom emoji', () => {
        const wrapper = shallow<AddEmoji>(
            <AddEmoji {...baseProps}/>,
            {context},
        );

        const file = new Blob([image], {type: 'image/png'});
        wrapper.setState({image: file as File, imageUrl: image});

        const form = wrapper.find('form').first();
        const nameInput = wrapper.find('#name');

        nameInput.simulate('change', {target: {name: 'name', value: 'mycustomemoji'}});
        form.simulate('submit', {preventDefault: jest.fn()});

        expect(wrapper.state().saving).toEqual(false);
        expect(baseProps.actions.createCustomEmoji).not.toBeCalled();
        expect(wrapper.state().error).not.toBeNull();
        assertErrorIsElementWithMatchingId(wrapper.state().error, 'add_emoji.customNameTaken');
    });

    test('should show error when image is too large', () => {
        const wrapper = shallow<AddEmoji>(
            <AddEmoji {...baseProps}/>,
            {context},
        );

        const file = {
            type: 'image/png',
            size: (1024 * 1024) + 1,
        } as Blob;

        wrapper.setState({image: file as File, imageUrl: image});

        const form = wrapper.find('form').first();
        const nameInput = wrapper.find('#name');

        nameInput.simulate('change', {target: {name: 'name', value: 'newcustomemoji'}});
        form.simulate('submit', {preventDefault: jest.fn()});

        expect(wrapper.state().saving).toEqual(false);
        expect(baseProps.actions.createCustomEmoji).not.toBeCalled();
        expect(wrapper.state().error).not.toBeNull();
        assertErrorIsElementWithMatchingId(wrapper.state().error, 'add_emoji.imageTooLarge');
    });

    test('should show generic error when action response cannot be parsed', async () => {
        const props = {...baseProps};
        props.actions = {
            createCustomEmoji: jest.fn().mockImplementation(async (): Promise<unknown> => ({})),
        };

        const wrapper = shallow<AddEmoji>(
            <AddEmoji {...props}/>,
            {context},
        );

        const file = new Blob([image], {type: 'image/png'});
        wrapper.setState({image: file as File, imageUrl: image});

        const form = wrapper.find('form').first();
        const nameInput = wrapper.find('#name');

        nameInput.simulate('change', {target: {name: 'name', value: 'newemoji'}});
        form.simulate('submit', {preventDefault: jest.fn()});
        await Promise.resolve();

        expect(wrapper.state().error).not.toBeNull();
        assertErrorIsElementWithMatchingId(wrapper.state().error, 'add_emoji.failedToAdd');
        expect(wrapper.state().saving).toEqual(false);
        expect(baseProps.actions.createCustomEmoji).not.toBeCalled();
    });

    test('should show response error message when action response is error', async () => {
        const props = {...baseProps};
        const serverError = 'The server does not like the emoji.';
        props.actions = {
            createCustomEmoji: jest.fn().mockImplementation(async (): Promise<unknown> => ({error: {message: serverError}})),
        };

        const wrapper = shallow<AddEmoji>(
            <AddEmoji {...props}/>,
            {context},
        );

        const file = new Blob([image], {type: 'image/png'});
        wrapper.setState({image: file as File, imageUrl: image});

        const form = wrapper.find('form').first();
        const nameInput = wrapper.find('#name');

        nameInput.simulate('change', {target: {name: 'name', value: 'newemoji'}});
        form.simulate('submit', {preventDefault: jest.fn()});
        await Promise.resolve();

        expect(wrapper.state().error).not.toBeNull();
        expect(wrapper.state().error).toEqual(serverError);
        expect(wrapper.state().saving).toEqual(false);
        expect(baseProps.actions.createCustomEmoji).not.toBeCalled();
    });
});
