// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {fireEvent, render, screen} from '@testing-library/react';
import React from 'react';

import PropertyChipPopover from './property_chip_popover';

describe('components/property_value_editor/PropertyChipPopover', () => {
    test('renders the trigger and keeps the popover closed by default', () => {
        render(
            <PropertyChipPopover trigger={<button type='button'>{'open me'}</button>}>
                {() => <div>{'popover body'}</div>}
            </PropertyChipPopover>,
        );
        expect(screen.getByText('open me')).toBeInTheDocument();
        expect(screen.queryByText('popover body')).not.toBeInTheDocument();
    });

    test('opens the popover when the trigger is clicked', () => {
        render(
            <PropertyChipPopover trigger={<button type='button'>{'open me'}</button>}>
                {() => <div>{'popover body'}</div>}
            </PropertyChipPopover>,
        );
        fireEvent.click(screen.getByText('open me'));
        expect(screen.getByText('popover body')).toBeInTheDocument();
    });

    test('closes the popover on outside click', () => {
        render(
            <div>
                <PropertyChipPopover trigger={<button type='button'>{'open me'}</button>}>
                    {() => <div>{'popover body'}</div>}
                </PropertyChipPopover>
                <span data-testid='outside'>{'outside region'}</span>
            </div>,
        );
        fireEvent.click(screen.getByText('open me'));
        expect(screen.getByText('popover body')).toBeInTheDocument();

        fireEvent.pointerDown(screen.getByTestId('outside'));
        expect(screen.queryByText('popover body')).not.toBeInTheDocument();
    });

    test('closes the popover on Escape', () => {
        render(
            <PropertyChipPopover trigger={<button type='button'>{'open me'}</button>}>
                {() => <div>{'popover body'}</div>}
            </PropertyChipPopover>,
        );
        fireEvent.click(screen.getByText('open me'));
        expect(screen.getByText('popover body')).toBeInTheDocument();

        fireEvent.keyDown(document.body, {key: 'Escape'});
        expect(screen.queryByText('popover body')).not.toBeInTheDocument();
    });

    test('exposes a close callback to the children render prop', () => {
        render(
            <PropertyChipPopover trigger={<button type='button'>{'open me'}</button>}>
                {(close) => (
                    <button
                        type='button'
                        onClick={close}
                    >
                        {'close me'}
                    </button>
                )}
            </PropertyChipPopover>,
        );
        fireEvent.click(screen.getByText('open me'));
        fireEvent.click(screen.getByText('close me'));
        expect(screen.queryByText('close me')).not.toBeInTheDocument();
    });

    test('survives an overflow:hidden ancestor by rendering via a portal', () => {
        render(
            <div style={{overflow: 'hidden', width: 10, height: 10}}>
                <PropertyChipPopover trigger={<button type='button'>{'open me'}</button>}>
                    {() => <div data-testid='popover-body'>{'popover body'}</div>}
                </PropertyChipPopover>
            </div>,
        );
        fireEvent.click(screen.getByText('open me'));
        const body = screen.getByTestId('popover-body');

        // Portaled content should not be a descendant of the overflow:hidden wrapper
        const overflowAncestor = body.closest('[style*="overflow"]');
        expect(overflowAncestor).toBeNull();
    });
});
