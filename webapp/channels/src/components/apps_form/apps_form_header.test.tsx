// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {act, screen, within} from '@testing-library/react';
import React from 'react';

import {renderWithContext} from 'tests/react_testing_utils';

import AppsFormHeader from './apps_form_header';

describe('components/apps_form/AppsFormHeader', () => {
    let resize: ResizeObserverCallback;
    let observe: jest.Mock;
    let disconnect: jest.Mock;

    beforeEach(() => {
        observe = jest.fn();
        disconnect = jest.fn();
        jest.spyOn(global, 'ResizeObserver').mockImplementation((callback) => {
            resize = callback;
            return {observe, disconnect, unobserve: jest.fn()};
        });
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    test('should render message with supported values', () => {
        const props = {
            id: 'testsupported',
            value: '**bold** *italic* [link](https://mattermost.com/) <br/> [link target blank](!https://mattermost.com/)',
        };
        renderWithContext(<AppsFormHeader {...props}/>);
        expect(screen.getByText('bold').tagName).toBe('STRONG');
        expect(screen.getByText('italic').tagName).toBe('EM');
        expect(screen.getByRole('link', {name: 'link'})).toHaveAttribute('href', 'https://mattermost.com/');
        expect(screen.queryByText('Scroll horizontally to see more columns.')).not.toBeInTheDocument();
    });

    test('should not fail on empty value', () => {
        const props = {
            id: 'testblankvalue',
            value: '',
        };
        const {container} = renderWithContext(<AppsFormHeader {...props}/>);
        expect(container.querySelector('.AppsFormHeader span')).toBeEmptyDOMElement();
    });

    test('renders tables and indicates overflow only when needed', () => {
        const value = [
            'Introduction **text**',
            '',
            '| One | Two | Three | Four | Five | Six |',
            '| --- | --- | --- | --- | --- | --- |',
            '| a | b | c | d | e | f |',
            '',
            '| Small | Table |',
            '| --- | --- |',
            '| g | h |',
        ].join('\n');
        const {container, unmount} = renderWithContext(<AppsFormHeader value={value}/>);
        const header = container.querySelector('.AppsFormHeader')!;
        const tables = header.querySelectorAll<HTMLDivElement>('.table-responsive');
        expect(tables).toHaveLength(2);
        expect(within(header as HTMLElement).getByText('text')).toBeInTheDocument();
        expect(within(tables[0]).getAllByRole('columnheader')).toHaveLength(6);
        expect(observe).toHaveBeenCalledTimes(4);
        expect(screen.queryByText('Scroll horizontally to see more columns.')).not.toBeInTheDocument();

        Object.defineProperties(tables[0], {
            scrollWidth: {configurable: true, value: 900},
            clientWidth: {configurable: true, value: 500},
            scrollHeight: {configurable: true, value: 700},
            clientHeight: {configurable: true, value: 300},
        });
        act(() => resize([], {} as ResizeObserver));

        const hint = screen.getByText('Scroll horizontally to see more columns.');
        expect(tables[0]).toHaveAttribute('tabindex', '0');
        expect(tables[0]).toHaveAttribute('role', 'region');
        expect(tables[0]).toHaveAttribute('aria-label', 'Scrollable table');
        expect(tables[0]).toHaveAttribute('aria-describedby', hint.id);
        expect(tables[1]).not.toHaveAttribute('tabindex');

        Object.defineProperty(tables[0], 'scrollWidth', {configurable: true, value: 500});
        act(() => resize([], {} as ResizeObserver));
        expect(screen.queryByText('Scroll horizontally to see more columns.')).not.toBeInTheDocument();
        expect(tables[0]).toHaveAttribute('tabindex', '0');
        expect(tables[0]).not.toHaveAttribute('aria-describedby');

        Object.defineProperty(tables[0], 'scrollHeight', {configurable: true, value: 300});
        act(() => resize([], {} as ResizeObserver));
        expect(tables[0]).not.toHaveAttribute('tabindex');
        expect(tables[0]).not.toHaveAttribute('role');

        unmount();
        expect(disconnect).toHaveBeenCalled();
    });
});
