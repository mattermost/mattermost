// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {createSuggestionRenderer} from './suggestion_renderer';
import type {SuggestionRendererConfig} from './suggestion_renderer';

// Mock ReactDOM to avoid React 18 deprecation warnings
jest.mock('react-dom', () => ({
    ...jest.requireActual('react-dom'),
    render: jest.fn(),
    unmountComponentAtNode: jest.fn(() => true),
}));

// Mock scrollIntoView for JSDOM
Element.prototype.scrollIntoView = jest.fn();

type TestItem = {
    id: string;
    name: string;
};

const TestListComponent: React.FC<{
    items: TestItem[];
    selectedIndex: number;
    selectItem: (index: number) => void;
}> = ({items, selectedIndex, selectItem}) => (
    <ul>
        {items.map((item, index) => (
            <li
                key={item.id}
                id={`test-item-${item.id}-${index}`}
                className={index === selectedIndex ? 'selected' : ''}
                onClick={() => selectItem(index)}
            >
                {item.name}
            </li>
        ))}
    </ul>
);

describe('createSuggestionRenderer', () => {
    const getDefaultConfig = (): SuggestionRendererConfig<TestItem> => ({
        popupClassName: 'test-popup',
        getItemId: (item, index) => `test-item-${item.id}-${index}`,
        ListComponent: TestListComponent,
        getCommandAttrs: (item) => ({id: item.id, label: item.name}),
    });

    const mockItems: TestItem[] = [
        {id: '1', name: 'Item One'},
        {id: '2', name: 'Item Two'},
        {id: '3', name: 'Item Three'},
    ];

    const createMockProps = (items: TestItem[], command = jest.fn()) => ({
        items,
        command,
        clientRect: () => ({bottom: 100, left: 50}) as DOMRect,
    } as any);

    beforeEach(() => {
        jest.clearAllMocks();
        document.body.innerHTML = '';
    });

    describe('createSuggestionRenderer function', () => {
        it('should return object with render property', () => {
            const result = createSuggestionRenderer(getDefaultConfig());

            expect(result).toHaveProperty('render');
            expect(typeof result.render).toBe('function');
        });

        it('should return render function that returns lifecycle methods', () => {
            const result = createSuggestionRenderer(getDefaultConfig());
            const lifecycle = result.render!();

            expect(lifecycle).toHaveProperty('onStart');
            expect(lifecycle).toHaveProperty('onUpdate');
            expect(lifecycle).toHaveProperty('onKeyDown');
            expect(lifecycle).toHaveProperty('onExit');
            expect(typeof lifecycle.onStart).toBe('function');
            expect(typeof lifecycle.onUpdate).toBe('function');
            expect(typeof lifecycle.onKeyDown).toBe('function');
            expect(typeof lifecycle.onExit).toBe('function');
        });
    });

    describe('onStart lifecycle', () => {
        it('should create popup element in document body', () => {
            const result = createSuggestionRenderer(getDefaultConfig());
            const lifecycle = result.render!();

            lifecycle.onStart!(createMockProps(mockItems));

            const popup = document.querySelector('.test-popup');
            expect(popup).not.toBeNull();
        });

        it('should position popup based on clientRect', () => {
            const result = createSuggestionRenderer(getDefaultConfig());
            const lifecycle = result.render!();

            lifecycle.onStart!(createMockProps(mockItems));

            const popup = document.querySelector('.test-popup') as HTMLElement;
            expect(popup.style.top).toContain('100');
            expect(popup.style.left).toContain('50');
        });
    });

    describe('onKeyDown lifecycle', () => {
        it('should return false for Escape key', () => {
            const result = createSuggestionRenderer(getDefaultConfig());
            const lifecycle = result.render!();

            lifecycle.onStart!(createMockProps(mockItems));

            const handled = lifecycle.onKeyDown!({event: {key: 'Escape'}} as any);

            expect(handled).toBe(false);
        });

        it('should return true for ArrowDown key with items', () => {
            const result = createSuggestionRenderer(getDefaultConfig());
            const lifecycle = result.render!();

            lifecycle.onStart!(createMockProps(mockItems));

            const handled = lifecycle.onKeyDown!({event: {key: 'ArrowDown'}} as any);

            expect(handled).toBe(true);
        });

        it('should return true for ArrowUp key with items', () => {
            const result = createSuggestionRenderer(getDefaultConfig());
            const lifecycle = result.render!();

            lifecycle.onStart!(createMockProps(mockItems));

            const handled = lifecycle.onKeyDown!({event: {key: 'ArrowUp'}} as any);

            expect(handled).toBe(true);
        });

        it('should return true for Enter key with items', () => {
            const mockCommand = jest.fn();
            const result = createSuggestionRenderer(getDefaultConfig());
            const lifecycle = result.render!();

            lifecycle.onStart!(createMockProps(mockItems, mockCommand));

            const handled = lifecycle.onKeyDown!({event: {key: 'Enter'}} as any);

            expect(handled).toBe(true);
            expect(mockCommand).toHaveBeenCalledWith({id: '1', label: 'Item One'});
        });

        it('should return true for Tab key with items', () => {
            const mockCommand = jest.fn();
            const result = createSuggestionRenderer(getDefaultConfig());
            const lifecycle = result.render!();

            lifecycle.onStart!(createMockProps(mockItems, mockCommand));

            const handled = lifecycle.onKeyDown!({event: {key: 'Tab'}} as any);

            expect(handled).toBe(true);
            expect(mockCommand).toHaveBeenCalled();
        });

        it('should return false for empty items', () => {
            const result = createSuggestionRenderer(getDefaultConfig());
            const lifecycle = result.render!();

            lifecycle.onStart!(createMockProps([]));

            const handled = lifecycle.onKeyDown!({event: {key: 'ArrowDown'}} as any);

            expect(handled).toBe(false);
        });

        it('should return false for other keys', () => {
            const result = createSuggestionRenderer(getDefaultConfig());
            const lifecycle = result.render!();

            lifecycle.onStart!(createMockProps(mockItems));

            const handled = lifecycle.onKeyDown!({event: {key: 'a'}} as any);

            expect(handled).toBe(false);
        });
    });

    describe('onUpdate lifecycle', () => {
        it('should update items', () => {
            const result = createSuggestionRenderer(getDefaultConfig());
            const lifecycle = result.render!();

            lifecycle.onStart!(createMockProps(mockItems));

            const newItems = [{id: '4', name: 'Item Four'}];
            lifecycle.onUpdate!({
                items: newItems,
                clientRect: () => ({bottom: 100, left: 50}) as DOMRect,
            } as any);

            // Verify popup still exists after update
            const popup = document.querySelector('.test-popup');
            expect(popup).not.toBeNull();
        });
    });

    describe('onExit lifecycle', () => {
        it('should remove popup after minimum display time', async () => {
            const result = createSuggestionRenderer(getDefaultConfig());
            const lifecycle = result.render!();

            lifecycle.onStart!(createMockProps(mockItems));

            // Wait for minimum display time
            await new Promise((resolve) => setTimeout(resolve, 150));

            lifecycle.onExit!({} as any);

            const popup = document.querySelector('.test-popup');
            expect(popup).toBeNull();
        });

        it('should call onPopupExit callback when provided', async () => {
            const onPopupExit = jest.fn();
            const customConfig = {
                ...getDefaultConfig(),
                onPopupExit,
            };
            const result = createSuggestionRenderer(customConfig);
            const lifecycle = result.render!();

            lifecycle.onStart!(createMockProps(mockItems));

            // Wait for minimum display time
            await new Promise((resolve) => setTimeout(resolve, 150));

            lifecycle.onExit!({} as any);

            expect(onPopupExit).toHaveBeenCalledTimes(1);
        });
    });

    describe('config options', () => {
        it('should use custom popupClassName', () => {
            const customConfig = {
                ...getDefaultConfig(),
                popupClassName: 'custom-popup-class',
            };
            const result = createSuggestionRenderer(customConfig);
            const lifecycle = result.render!();

            lifecycle.onStart!(createMockProps(mockItems));

            const popup = document.querySelector('.custom-popup-class');
            expect(popup).not.toBeNull();
        });

        it('should use custom getCommandAttrs', () => {
            const mockCommand = jest.fn();
            const customConfig = {
                ...getDefaultConfig(),
                getCommandAttrs: (item: TestItem) => ({customId: item.id, customLabel: item.name}),
            };
            const result = createSuggestionRenderer(customConfig);
            const lifecycle = result.render!();

            lifecycle.onStart!(createMockProps(mockItems, mockCommand));

            lifecycle.onKeyDown!({event: {key: 'Enter'}} as any);

            expect(mockCommand).toHaveBeenCalledWith({customId: '1', customLabel: 'Item One'});
        });

        it('should support ariaLabel option', () => {
            const customConfig = {
                ...getDefaultConfig(),
                ariaLabel: 'Test suggestions',
            };
            const result = createSuggestionRenderer(customConfig);
            const lifecycle = result.render!();

            lifecycle.onStart!(createMockProps(mockItems));

            const popup = document.querySelector('.test-popup');
            expect(popup?.getAttribute('role')).toBe('dialog');
            expect(popup?.getAttribute('aria-label')).toBe('Test suggestions');
        });
    });
});
