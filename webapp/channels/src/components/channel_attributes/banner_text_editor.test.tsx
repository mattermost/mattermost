// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {fireEvent, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

import type {PropertyField} from '@mattermost/types/properties';

import type {ResolvedChannelAttribute} from 'mattermost-redux/selectors/entities/properties';

import {renderWithContext} from 'tests/react_testing_utils';

import BannerTextEditor from './banner_text_editor';

function attribute(name: string, displayValue: string, displayName?: string): ResolvedChannelAttribute {
    const field = {
        id: `field_${name}`,
        group_id: 'group1',
        name,
        type: 'select',
        target_id: '',
        target_type: 'system',
        object_type: 'channel',
        attrs: displayName ? {display_name: displayName} : {},
        create_at: 1,
        update_at: 1,
        delete_at: 0,
        created_by: '',
        updated_by: '',
    } as PropertyField;

    return {field, displayValue};
}

const ATTRIBUTES = [
    attribute('classification', 'TOP SECRET', 'Classification'),
    attribute('program', 'AURORA', 'Program'),
];

describe('BannerTextEditor', () => {
    test('renders a token as a chip labelled with the display name, not the machine name', () => {
        renderWithContext(
            <BannerTextEditor
                value='{{classification}} - Team'
                attributes={ATTRIBUTES}
                onChange={jest.fn()}
            />,
        );

        const chip = screen.getByTestId('bannerTextEditorChip-classification');
        expect(chip).toHaveTextContent('Classification');
        expect(screen.getByTestId('bannerTextEditor')).toHaveTextContent('- Team');
        expect(screen.getByTestId('bannerTextEditor')).not.toHaveTextContent('{{classification}}');
    });

    test('labels a token whose attribute is gone with its machine name rather than blank', () => {
        renderWithContext(
            <BannerTextEditor
                value='{{deleted_field}}'
                attributes={ATTRIBUTES}
                onChange={jest.fn()}
            />,
        );

        expect(screen.getByTestId('bannerTextEditorChip-deleted_field')).toHaveTextContent('deleted_field');
    });

    test('serializes typed text back into the template, chips included', () => {
        const onChange = jest.fn();
        renderWithContext(
            <BannerTextEditor
                value='{{classification}}'
                attributes={ATTRIBUTES}
                onChange={onChange}
            />,
        );

        const editor = screen.getByTestId('bannerTextEditor');
        editor.appendChild(document.createTextNode(' - Team'));
        fireEvent.input(editor);

        expect(onChange).toHaveBeenCalledWith('{{classification}} - Team');
    });

    test('leaves the editor DOM alone while typing, so the caret keeps its place', () => {
        const onChange = jest.fn();
        const {rerender} = renderWithContext(
            <BannerTextEditor
                value='this is my tex'
                attributes={ATTRIBUTES}
                onChange={onChange}
            />,
        );

        const editor = screen.getByTestId('bannerTextEditor');
        const textNode = editor.firstChild as Text;

        // What the browser does when a character is typed mid-string.
        textNode.nodeValue = 'this is my texT';
        fireEvent.input(editor);
        expect(onChange).toHaveBeenCalledWith('this is my texT');

        // The parent echoes the value straight back. React must not touch the node the
        // caret lives in: replacing it collapses the selection to the start.
        rerender(
            <BannerTextEditor
                value='this is my texT'
                attributes={ATTRIBUTES}
                onChange={onChange}
            />,
        );

        expect(screen.getByTestId('bannerTextEditor').firstChild).toBe(textNode);
        expect(textNode.nodeValue).toBe('this is my texT');
    });

    test('rebuilds when the value changes from outside', () => {
        const onChange = jest.fn();
        const {rerender} = renderWithContext(
            <BannerTextEditor
                value='original'
                attributes={ATTRIBUTES}
                onChange={onChange}
            />,
        );

        const editor = screen.getByTestId('bannerTextEditor');
        expect(editor).toHaveTextContent('original');

        rerender(
            <BannerTextEditor
                value='reset elsewhere'
                attributes={ATTRIBUTES}
                onChange={onChange}
            />,
        );

        expect(screen.getByTestId('bannerTextEditor')).toHaveTextContent('reset elsewhere');
    });

    test('removes a token when its chip is dismissed, keeping the surrounding text', async () => {
        const onChange = jest.fn();
        renderWithContext(
            <BannerTextEditor
                value='{{classification}} - {{program}} Team'
                attributes={ATTRIBUTES}
                onChange={onChange}
            />,
        );

        await userEvent.click(screen.getByTestId('bannerTextEditorChipRemove-program'));

        expect(onChange).toHaveBeenCalledWith('{{classification}} -  Team');
    });

    test('keeps focus in the editor when a rebuild remounts it', () => {
        const onChange = jest.fn();
        const {rerender} = renderWithContext(
            <BannerTextEditor
                value='keep focus here'
                attributes={ATTRIBUTES}
                onChange={onChange}
            />,
        );

        const editor = screen.getByTestId('bannerTextEditor');
        editor.focus();
        expect(editor).toHaveFocus();

        // An external change remounts the editor. Without restoration, focus lands on
        // the body and the app's type-anywhere handler diverts typing to the message box.
        rerender(
            <BannerTextEditor
                value='changed elsewhere'
                attributes={ATTRIBUTES}
                onChange={onChange}
            />,
        );

        expect(screen.getByTestId('bannerTextEditor')).toHaveFocus();
    });

    test('does not steal focus when the editor was not focused', () => {
        const onChange = jest.fn();
        const {rerender} = renderWithContext(
            <BannerTextEditor
                value='untouched'
                attributes={ATTRIBUTES}
                onChange={onChange}
            />,
        );

        rerender(
            <BannerTextEditor
                value='changed elsewhere'
                attributes={ATTRIBUTES}
                onChange={onChange}
            />,
        );

        expect(screen.getByTestId('bannerTextEditor')).not.toHaveFocus();
    });

    test('offers no remove control while disabled', () => {
        renderWithContext(
            <BannerTextEditor
                value='{{program}}'
                attributes={ATTRIBUTES}
                onChange={jest.fn()}
                disabled={true}
            />,
        );

        expect(screen.queryByTestId('bannerTextEditorChipRemove-program')).not.toBeInTheDocument();
        expect(screen.getByTestId('bannerTextEditor')).toHaveAttribute('contenteditable', 'false');
    });

    test('keeps the banner to one line', () => {
        const onChange = jest.fn();
        renderWithContext(
            <BannerTextEditor
                value='SECRET'
                attributes={ATTRIBUTES}
                onChange={onChange}
            />,
        );

        const editor = screen.getByTestId('bannerTextEditor');
        const prevented = !fireEvent.keyDown(editor, {key: 'Enter'});

        expect(prevented).toBe(true);
    });

    test('stops typing past the maximum length', () => {
        renderWithContext(
            <BannerTextEditor
                value='SECRET'
                attributes={ATTRIBUTES}
                onChange={jest.fn()}
                maxLength={6}
            />,
        );

        const editor = screen.getByTestId('bannerTextEditor');
        expect(!fireEvent.keyDown(editor, {key: 'a'})).toBe(true);

        // Editing keys stay live, or the field could not be corrected once full.
        expect(!fireEvent.keyDown(editor, {key: 'Backspace'})).toBe(false);
    });
});
