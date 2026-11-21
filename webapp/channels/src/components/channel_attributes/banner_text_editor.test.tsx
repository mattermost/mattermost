// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {fireEvent, screen, within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React, {useState} from 'react';

import type {PropertyField} from '@mattermost/types/properties';

import type {ResolvedChannelAttribute} from 'mattermost-redux/selectors/entities/properties';

import {renderWithContext} from 'tests/react_testing_utils';

import BannerTextEditor from './banner_text_editor';

// The real control is a MUI menu, which jsdom cannot open: it has no layout, so the
// popover rejects its anchor. Only the editor's own insertion path is under test.
jest.mock('./banner_token_controls', () => ({
    __esModule: true,
    default: ({onInsertToken}: {onInsertToken: (token: string) => void}) => (
        <>
            <button
                data-testid='insertClassification'
                onClick={() => onInsertToken('{{classification}}')}
            />
            <button
                data-testid='insertProgram'
                onClick={() => onInsertToken('{{program}}')}
            />
        </>
    ),
}));

// Mirrors the configuration tab, which owns the value and echoes every change back.
const Host = ({onChange}: {onChange: (next: string) => void}) => {
    const [value, setValue] = useState('');

    return (
        <BannerTextEditor
            testId='fixture.banner_editor'
            value={value}
            attributes={ATTRIBUTES}
            onChange={(next) => {
                onChange(next);
                setValue(next);
            }}
        />
    );
};

function putCaretAtEnd(editor: HTMLElement) {
    const range = document.createRange();
    range.selectNodeContents(editor);
    range.collapse(false);

    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
}

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

    return {field, displayValue, displayValues: [displayValue]};
}

const ATTRIBUTES = [
    attribute('classification', 'TOP SECRET', 'Classification'),
    attribute('program', 'AURORA', 'Program'),
];

describe('BannerTextEditor', () => {
    test('tints a chip whose attribute has no value on this channel, and only that one', () => {
        renderWithContext(
            <BannerTextEditor
                testId='fixture.banner_editor'
                value='{{classification}} · {{program}} · {{deleted}}'
                attributes={[attribute('classification', '', 'Classification'), attribute('program', 'AURORA', 'Program')]}
                onChange={jest.fn()}
            />,
        );

        expect(screen.getByTestId('fixture.banner_editor.token:0')).toHaveClass('BannerTextEditor__chip--unset');
        expect(screen.getByTestId('fixture.banner_editor.token:1')).not.toHaveClass('BannerTextEditor__chip--unset');

        // An attribute that no longer exists can never get a value, so it is not flagged.
        expect(screen.getByTestId('fixture.banner_editor.token:2')).not.toHaveClass('BannerTextEditor__chip--unset');
    });

    test('explains an unset chip on hover without changing the text it saves', async () => {
        const onChange = jest.fn();
        renderWithContext(
            <BannerTextEditor
                testId='fixture.banner_editor'
                value='{{classification}}'
                attributes={[attribute('classification', '', 'Classification')]}
                onChange={onChange}
            />,
        );

        await userEvent.hover(screen.getByTestId('fixture.banner_editor.token:0'));
        expect(await screen.findByText(/has no value set and won't render in the banner/)).toBeInTheDocument();

        const editor = screen.getByTestId('fixture.banner_editor--textbox');
        editor.appendChild(document.createTextNode(' - Team'));
        fireEvent.input(editor);

        expect(onChange).toHaveBeenLastCalledWith('{{classification}} - Team');
    });

    test('renders a token as a chip labelled with the display name, not the machine name', () => {
        renderWithContext(
            <BannerTextEditor
                testId='fixture.banner_editor'
                value='{{classification}} - Team'
                attributes={ATTRIBUTES}
                onChange={jest.fn()}
            />,
        );

        const chip = screen.getByTestId('fixture.banner_editor.token:0');
        expect(chip).toHaveTextContent('Classification');
        expect(screen.getByTestId('fixture.banner_editor--textbox')).toHaveTextContent('- Team');
        expect(screen.getByTestId('fixture.banner_editor--textbox')).not.toHaveTextContent('{{classification}}');
    });

    test('labels a token whose attribute is gone with its machine name rather than blank', () => {
        renderWithContext(
            <BannerTextEditor
                testId='fixture.banner_editor'
                value='{{deleted_field}}'
                attributes={ATTRIBUTES}
                onChange={jest.fn()}
            />,
        );

        expect(screen.getByTestId('fixture.banner_editor.token:0')).toHaveTextContent('deleted_field');
    });

    test('serializes typed text back into the template, chips included', () => {
        const onChange = jest.fn();
        renderWithContext(
            <BannerTextEditor
                testId='fixture.banner_editor'
                value='{{classification}}'
                attributes={ATTRIBUTES}
                onChange={onChange}
            />,
        );

        const editor = screen.getByTestId('fixture.banner_editor--textbox');
        editor.appendChild(document.createTextNode(' - Team'));
        fireEvent.input(editor);

        expect(onChange).toHaveBeenCalledWith('{{classification}} - Team');
    });

    test('leaves the editor DOM alone while typing, so the caret keeps its place', () => {
        const onChange = jest.fn();
        const {rerender} = renderWithContext(
            <BannerTextEditor
                testId='fixture.banner_editor'
                value='this is my tex'
                attributes={ATTRIBUTES}
                onChange={onChange}
            />,
        );

        const editor = screen.getByTestId('fixture.banner_editor--textbox');
        const textNode = editor.firstChild as Text;

        // What the browser does when a character is typed mid-string.
        textNode.nodeValue = 'this is my texT';
        fireEvent.input(editor);
        expect(onChange).toHaveBeenCalledWith('this is my texT');

        // The parent echoes the value straight back. React must not touch the node the
        // caret lives in: replacing it collapses the selection to the start.
        rerender(
            <BannerTextEditor
                testId='fixture.banner_editor'
                value='this is my texT'
                attributes={ATTRIBUTES}
                onChange={onChange}
            />,
        );

        expect(screen.getByTestId('fixture.banner_editor--textbox').firstChild).toBe(textNode);
        expect(textNode.nodeValue).toBe('this is my texT');
    });

    test('rebuilds when the value changes from outside', () => {
        const onChange = jest.fn();
        const {rerender} = renderWithContext(
            <BannerTextEditor
                testId='fixture.banner_editor'
                value='original'
                attributes={ATTRIBUTES}
                onChange={onChange}
            />,
        );

        const editor = screen.getByTestId('fixture.banner_editor--textbox');
        expect(editor).toHaveTextContent('original');

        rerender(
            <BannerTextEditor
                testId='fixture.banner_editor'
                value='reset elsewhere'
                attributes={ATTRIBUTES}
                onChange={onChange}
            />,
        );

        expect(screen.getByTestId('fixture.banner_editor--textbox')).toHaveTextContent('reset elsewhere');
    });

    test('removes a token when its chip is dismissed, keeping the surrounding text', async () => {
        const onChange = jest.fn();
        renderWithContext(
            <BannerTextEditor
                testId='fixture.banner_editor'
                value='{{classification}} - {{program}} Team'
                attributes={ATTRIBUTES}
                onChange={onChange}
            />,
        );

        await userEvent.click(within(screen.getByTestId('fixture.banner_editor.token:1')).getByTestId('fixture.banner_editor.token.remove--button'));

        expect(onChange).toHaveBeenCalledWith('{{classification}} -  Team');
    });

    test('keeps focus in the editor when a rebuild remounts it', () => {
        const onChange = jest.fn();
        const {rerender} = renderWithContext(
            <BannerTextEditor
                testId='fixture.banner_editor'
                value='keep focus here'
                attributes={ATTRIBUTES}
                onChange={onChange}
            />,
        );

        const editor = screen.getByTestId('fixture.banner_editor--textbox');
        editor.focus();
        expect(editor).toHaveFocus();

        // An external change remounts the editor. Without restoration, focus lands on
        // the body and the app's type-anywhere handler diverts typing to the message box.
        rerender(
            <BannerTextEditor
                testId='fixture.banner_editor'
                value='changed elsewhere'
                attributes={ATTRIBUTES}
                onChange={onChange}
            />,
        );

        expect(screen.getByTestId('fixture.banner_editor--textbox')).toHaveFocus();
    });

    test('does not steal focus when the editor was not focused', () => {
        const onChange = jest.fn();
        const {rerender} = renderWithContext(
            <BannerTextEditor
                testId='fixture.banner_editor'
                value='untouched'
                attributes={ATTRIBUTES}
                onChange={onChange}
            />,
        );

        rerender(
            <BannerTextEditor
                testId='fixture.banner_editor'
                value='changed elsewhere'
                attributes={ATTRIBUTES}
                onChange={onChange}
            />,
        );

        expect(screen.getByTestId('fixture.banner_editor--textbox')).not.toHaveFocus();
    });

    test('offers no remove control while disabled', () => {
        renderWithContext(
            <BannerTextEditor
                testId='fixture.banner_editor'
                value='{{program}}'
                attributes={ATTRIBUTES}
                onChange={jest.fn()}
                disabled={true}
            />,
        );

        expect(within(screen.getByTestId('fixture.banner_editor.token:0')).queryByTestId('fixture.banner_editor.token.remove--button')).not.toBeInTheDocument();
        expect(screen.getByTestId('fixture.banner_editor--textbox')).toHaveAttribute('contenteditable', 'false');
    });

    test('offers a remove control on every chip', () => {
        renderWithContext(
            <BannerTextEditor
                testId='fixture.banner_editor'
                value='{{classification}} · {{program}}'
                attributes={ATTRIBUTES}
                onChange={jest.fn()}
            />,
        );

        expect(within(screen.getByTestId('fixture.banner_editor.token:0')).getByTestId('fixture.banner_editor.token.remove--button')).toBeInTheDocument();
        expect(within(screen.getByTestId('fixture.banner_editor.token:1')).getByTestId('fixture.banner_editor.token.remove--button')).toBeInTheDocument();
    });

    test('keeps the banner to one line', () => {
        const onChange = jest.fn();
        renderWithContext(
            <BannerTextEditor
                testId='fixture.banner_editor'
                value='SECRET'
                attributes={ATTRIBUTES}
                onChange={onChange}
            />,
        );

        const editor = screen.getByTestId('fixture.banner_editor--textbox');
        const prevented = !fireEvent.keyDown(editor, {key: 'Enter'});

        expect(prevented).toBe(true);
    });

    test('stops typing past the maximum length', () => {
        renderWithContext(
            <BannerTextEditor
                testId='fixture.banner_editor'
                value='SECRET'
                attributes={ATTRIBUTES}
                onChange={jest.fn()}
                maxLength={6}
            />,
        );

        const editor = screen.getByTestId('fixture.banner_editor--textbox');
        expect(!fireEvent.keyDown(editor, {key: 'a'})).toBe(true);

        // Editing keys stay live, or the field could not be corrected once full.
        expect(!fireEvent.keyDown(editor, {key: 'Backspace'})).toBe(false);
    });

    // A Range does not survive the remount each insert performs, so an insert that
    // reused a saved one spliced against a stale position: the second chip landed at
    // the start of the banner, or vanished.
    test('inserts a second token at the caret, after the first chip and the typed text', async () => {
        const onChange = jest.fn();
        renderWithContext(<Host onChange={onChange}/>);

        await userEvent.click(screen.getByTestId('insertClassification'));
        expect(onChange).toHaveBeenLastCalledWith('{{classification}}');

        const editor = screen.getByTestId('fixture.banner_editor--textbox');
        editor.appendChild(document.createTextNode(' \u00b7 '));
        putCaretAtEnd(editor);
        fireEvent.input(editor);
        expect(onChange).toHaveBeenLastCalledWith('{{classification}} \u00b7 ');

        await userEvent.click(screen.getByTestId('insertProgram'));

        expect(onChange).toHaveBeenLastCalledWith('{{classification}} \u00b7 {{program}}');
        expect(screen.getAllByTestId(/^fixture\.banner_editor\.token:\d+$/)).toHaveLength(2);
    });

    test('inserts at the caret rather than the end when the caret sits mid-text', async () => {
        const onChange = jest.fn();
        renderWithContext(<Host onChange={onChange}/>);

        const editor = screen.getByTestId('fixture.banner_editor--textbox');
        editor.appendChild(document.createTextNode('AB'));

        const range = document.createRange();
        range.setStart(editor.firstChild as Text, 1);
        range.collapse(true);
        window.getSelection()?.removeAllRanges();
        window.getSelection()?.addRange(range);
        fireEvent.input(editor);

        await userEvent.click(screen.getByTestId('insertProgram'));

        expect(onChange).toHaveBeenLastCalledWith('A {{program}} B');
    });

    test('appends when the caret was never placed in the editor', async () => {
        const onChange = jest.fn();
        renderWithContext(<Host onChange={onChange}/>);

        await userEvent.click(screen.getByTestId('insertClassification'));
        await userEvent.click(screen.getByTestId('insertProgram'));

        expect(onChange).toHaveBeenLastCalledWith('{{classification}} {{program}}');
    });
});
