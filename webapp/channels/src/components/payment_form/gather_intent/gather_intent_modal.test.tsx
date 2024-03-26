// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {fireEvent, renderWithContext, screen} from 'tests/react_testing_utils';

import {GatherIntentModal} from './gather_intent_modal';
import type {GatherIntentModalProps} from './gather_intent_modal';

describe('components/gather_intent/gather_intent_modal.tsx', () => {
    const baseProps: GatherIntentModalProps = {
        onClose: jest.fn(),
        onSave: jest.fn(),
        isSubmitting: false,
        showError: false,
    };

    it('shouldn\'t be able to save the feedback if the user don\'t click on any option', () => {
        renderWithContext(<GatherIntentModal {...baseProps}/>);

        expect(screen.queryByText('Save')).toBeDisabled();
    });

    it('shouldn\'t be able to save the feedback if the user only click in other and leave the input empty', () => {
        renderWithContext(<GatherIntentModal {...baseProps}/>);

        fireEvent.click(screen.getByText('Other'));

        expect(screen.queryByText('Save')).toBeDisabled();
    });

    it('shouldn\'t be able to save the feedback if the user only click in other and write only white spaces in the input', () => {
        renderWithContext(<GatherIntentModal {...baseProps}/>);

        fireEvent.click(screen.getByText('Other'));
        fireEvent.change(screen.getByPlaceholderText('Enter payment option here'), {target: {value: '       \n\t'}});

        expect(screen.queryByText('Save')).toBeDisabled();
    });

    it('should be able to save the feedback if the user only click in other, leave the input empty and press other option', () => {
        renderWithContext(<GatherIntentModal {...baseProps}/>);

        fireEvent.click(screen.getByText('Other'));
        fireEvent.click(screen.getByText('Wire'));

        expect(screen.queryByText('Save')).not.toHaveAttribute('disabled');
    });

    it('should be able save the feedback if the user click in Wire option', () => {
        renderWithContext(<GatherIntentModal {...baseProps}/>);

        fireEvent.click(screen.getByText('Wire'));

        expect(screen.queryByText('Save')).not.toHaveAttribute('disabled');
    });

    it('should be able save the feedback if the user click in ACH option', () => {
        renderWithContext(<GatherIntentModal {...baseProps}/>);

        fireEvent.click(screen.getByText('ACH'));

        expect(screen.queryByText('Save')).not.toHaveAttribute('disabled');
    });

    it('should be able save the feedback if the user click in other option and fill the option', () => {
        renderWithContext(<GatherIntentModal {...baseProps}/>);

        fireEvent.click(screen.getByText('Other'));
        fireEvent.change(screen.getByPlaceholderText('Enter payment option here'), {target: {value: 'Test'}});

        expect(screen.queryByText('Save')).not.toBeDisabled();
    });
});
