// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {mountWithIntl} from 'tests/helpers/intl-test-helper';

import KeyboardShortcutsSequence from './keyboard_shortcuts_sequence';

import KeyboardShortcutSequence, {KEYBOARD_SHORTCUTS} from './index';

describe('components/shortcuts/KeyboardShortcutsSequence', () => {
    test('should match snapshot when used for modal with description', () => {
        const wrapper = mountWithIntl(
            <KeyboardShortcutsSequence
                shortcut={{
                    id: 'test',
                    defaultMessage: 'Keyboard shortcuts\t⌘|/',
                }}
            />,
        );

        const tag = <span>{'Keyboard shortcuts'}</span>;
        expect(wrapper.contains(tag)).toEqual(true);
        expect(wrapper).toMatchSnapshot();
        expect(wrapper.find('.shortcut-key--tooltip')).toHaveLength(0);
        expect(wrapper.find('.shortcut-key--shortcut-modal')).toHaveLength(2);
    });

    test('should render sequence without description', () => {
        const wrapper = mountWithIntl(
            <KeyboardShortcutsSequence
                shortcut={{
                    id: 'test',
                    defaultMessage: 'Keyboard shortcuts\t⌘|/',
                }}
                hideDescription={true}
            />,
        );

        const tag = <span>{'Keyboard shortcuts'}</span>;
        expect(wrapper.contains(tag)).toEqual(false);
        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot with alternative shortcut', () => {
        const wrapper = mountWithIntl(
            <KeyboardShortcutsSequence
                shortcut={{
                    id: 'test',
                    defaultMessage: 'Keyboard shortcuts\t⌘||P\tCtrl|P',
                }}
            />,
        );

        const tag = <span>{'Keyboard shortcuts'}</span>;
        expect(wrapper.contains(tag)).toEqual(true);
        expect(wrapper).toMatchSnapshot();
        expect(wrapper.find('.shortcut-key--tooltip')).toHaveLength(0);
        expect(wrapper.find('.shortcut-key--shortcut-modal')).toHaveLength(5);
    });

    test('should render sequence without description', () => {
        const wrapper = mountWithIntl(
            <KeyboardShortcutsSequence
                shortcut={{
                    id: 'test',
                    defaultMessage: 'Keyboard shortcuts\t⌘|/',
                }}
                isInsideTooltip={true}
            />,
        );

        const tag = <span>{'Keyboard shortcuts'}</span>;
        expect(wrapper.contains(tag)).toEqual(true);
        expect(wrapper).toMatchSnapshot();
        expect(wrapper.find('.shortcut-key--tooltip')).toHaveLength(2);
        expect(wrapper.find('.shortcut-key--shortcut-modal')).toHaveLength(0);
    });
    test('should render sequence hoisting description', () => {
        const wrapper = mountWithIntl(
            <KeyboardShortcutsSequence
                shortcut={{
                    id: 'test',
                    defaultMessage: 'Keyboard shortcuts\t⌘|/',
                }}
                isInsideTooltip={true}
                hoistDescription={true}
            />,
        );

        const tag = <span>{'Keyboard shortcuts'}</span>;
        expect(wrapper.contains(tag)).toEqual(false);
        expect(wrapper).toMatchSnapshot();
        expect(wrapper.find('.shortcut-key--tooltip')).toHaveLength(2);
        expect(wrapper.find('.shortcut-key--shortcut-modal')).toHaveLength(0);
    });

    test('should create sequence with order', () => {
        const order = 3;
        const wrapper = mountWithIntl(
            <KeyboardShortcutSequence
                shortcut={KEYBOARD_SHORTCUTS.teamNavigation}
                values={{order}}
                hideDescription={true}
                isInsideTooltip={true}
            />,
        );
        expect(wrapper).toMatchSnapshot();
        const tag = <span>{'Keyboard shortcuts'}</span>;
        expect(wrapper.contains(tag)).toEqual(false);
        expect(wrapper.find('.shortcut-key--tooltip')).toHaveLength(3);
        expect(wrapper.find('.shortcut-key--shortcut-modal')).toHaveLength(0);
    });
});
