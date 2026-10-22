// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen, userEvent} from 'tests/react_testing_utils';

import MarkdownViewToggle from './markdown_view_toggle';

describe('components/MarkdownViewToggle', () => {
    test('should expose a named group with a rendered and a raw button', () => {
        renderWithContext(
            <MarkdownViewToggle
                view='rendered'
                onChange={jest.fn()}
            />,
        );

        expect(screen.getByRole('group', {name: 'Markdown view'})).toBeInTheDocument();
        expect(screen.getAllByRole('button')).toHaveLength(2);
        expect(screen.getByRole('button', {name: 'Rendered'})).toHaveAttribute('aria-pressed', 'true');
        expect(screen.getByRole('button', {name: 'Raw'})).toHaveAttribute('aria-pressed', 'false');
    });

    test('should mark the raw button pressed and slide the thumb when view is raw', () => {
        renderWithContext(
            <MarkdownViewToggle
                view='raw'
                onChange={jest.fn()}
            />,
        );

        expect(screen.getByRole('button', {name: 'Raw'})).toHaveAttribute('aria-pressed', 'true');
        expect(screen.getByRole('button', {name: 'Rendered'})).toHaveAttribute('aria-pressed', 'false');
        expect(screen.getByRole('group')).toHaveClass('raw');
    });

    test('should keep the accessible names fixed when the view changes', () => {
        const {rerender} = renderWithContext(
            <MarkdownViewToggle
                view='rendered'
                onChange={jest.fn()}
            />,
        );

        rerender(
            <MarkdownViewToggle
                view='raw'
                onChange={jest.fn()}
            />,
        );

        expect(screen.getByRole('button', {name: 'Rendered'})).toBeInTheDocument();
        expect(screen.getByRole('button', {name: 'Raw'})).toBeInTheDocument();
    });

    test('should call onChange with the clicked view and not for the current one', async () => {
        const onChange = jest.fn();
        renderWithContext(
            <MarkdownViewToggle
                view='rendered'
                onChange={onChange}
            />,
        );

        await userEvent.click(screen.getByRole('button', {name: 'Rendered'}));
        expect(onChange).not.toHaveBeenCalled();

        await userEvent.click(screen.getByRole('button', {name: 'Raw'}));
        expect(onChange).toHaveBeenCalledWith('raw');
    });

    test('should be operable with the keyboard', async () => {
        const onChange = jest.fn();
        renderWithContext(
            <MarkdownViewToggle
                view='rendered'
                onChange={onChange}
            />,
        );

        await userEvent.tab();
        await userEvent.tab();
        expect(screen.getByRole('button', {name: 'Raw'})).toHaveFocus();

        await userEvent.keyboard('{Enter}');
        expect(onChange).toHaveBeenCalledWith('raw');
    });

    test('should apply the appearance, size and custom class', () => {
        renderWithContext(
            <MarkdownViewToggle
                view='raw'
                onChange={jest.fn()}
                appearance='onDark'
                size='compact'
                className='custom'
            />,
        );

        expect(screen.getByRole('group')).toHaveClass('MarkdownViewToggle', 'onDark', 'compact', 'custom');
    });
});
