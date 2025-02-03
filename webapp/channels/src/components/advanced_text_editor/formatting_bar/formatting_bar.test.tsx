// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {screen} from '@testing-library/react';
import React from 'react';

import {renderWithContext, userEvent} from 'tests/react_testing_utils';
import {Locations} from 'utils/constants';

import FormattingBar from './formatting_bar';
import * as Hooks from './hooks';

jest.mock('./hooks');

const {splitFormattingBarControls} = jest.requireActual('./hooks');

describe('FormattingBar', () => {
    const baseProps = {
        getCurrentMessage: jest.fn(() => ''),
        getCurrentSelection: jest.fn(() => ({start: 0, end: 0})),
        applyMarkdown: jest.fn(),
        disableControls: false,
        location: Locations.CENTER,
    };

    test('should render hidden formatting button when screen size is min', () => {
        jest.spyOn(Hooks, 'useFormattingBarControls').mockReturnValue({wideMode: 'min', ...splitFormattingBarControls('min')});

        renderWithContext(
            <FormattingBar {...baseProps}/>,
        );

        expect(screen.getByLabelText('show hidden formatting options')).toBeInTheDocument();
    });

    test('should render hidden formatting button when screen size is narrow', () => {
        jest.spyOn(Hooks, 'useFormattingBarControls').mockReturnValue({wideMode: 'narrow', ...splitFormattingBarControls('narrow')});

        renderWithContext(
            <FormattingBar {...baseProps}/>,
        );

        expect(screen.getByLabelText('show hidden formatting options')).toBeInTheDocument();
    });

    test('should render hidden formatting button when screen size is normal', () => {
        jest.spyOn(Hooks, 'useFormattingBarControls').mockReturnValue({wideMode: 'normal', ...splitFormattingBarControls('normal')});

        renderWithContext(
            <FormattingBar {...baseProps}/>,
        );

        expect(screen.getByLabelText('show hidden formatting options')).toBeInTheDocument();
    });

    test('should not render hidden formatting button when screen size is wide', () => {
        jest.spyOn(Hooks, 'useFormattingBarControls').mockReturnValue({wideMode: 'wide', ...splitFormattingBarControls('wide')});

        renderWithContext(
            <FormattingBar {...baseProps}/>,
        );

        expect(screen.queryByLabelText('show hidden formatting options')).not.toBeInTheDocument();
    });

    test('MM-56705 should not submit form when clicking on hidden formatting button', () => {
        jest.spyOn(Hooks, 'useFormattingBarControls').mockReturnValue({wideMode: 'narrow', ...splitFormattingBarControls('narrow')});

        const onSubmit = jest.fn();

        renderWithContext(
            <form onSubmit={onSubmit}>
                <FormattingBar {...baseProps}/>
            </form>,
        );

        expect(screen.queryByLabelText('heading')).toBe(null);

        userEvent.click(screen.getByLabelText('show hidden formatting options'));

        expect(screen.queryByLabelText('heading')).toBeVisible();
        expect(onSubmit).not.toHaveBeenCalled();
    });
});
