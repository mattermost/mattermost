// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {screen} from '@testing-library/react';
import React from 'react';

import ModalController from 'components/modal_controller';

import {renderWithContext, userEvent} from 'tests/react_testing_utils';

import {useGlobalAttributeDuplicatePrompt} from './global_attribute_duplicate_modal';

function PromptButton({onConfirm}: {onConfirm: (selected: Array<'user' | 'channel' | 'post'>) => void}) {
    const prompt = useGlobalAttributeDuplicatePrompt();
    return (
        <button
            type='button'
            onClick={() => prompt('Department', ['user', 'channel'], onConfirm)}
        >
            {'Open'}
        </button>
    );
}

describe('GlobalAttributeDuplicateModal', () => {
    it('lists resources checked by default and returns the selection on confirm', async () => {
        const onConfirm = jest.fn();

        renderWithContext(
            <>
                <PromptButton onConfirm={onConfirm}/>
                <ModalController/>
            </>,
        );

        await userEvent.click(screen.getByRole('button', {name: 'Open'}));

        expect(await screen.findByRole('dialog')).toHaveTextContent('Duplicate Department');
        expect(screen.getByTestId('global-attribute-duplicate-user')).toBeChecked();
        expect(screen.getByTestId('global-attribute-duplicate-channel')).toBeChecked();

        await userEvent.click(screen.getByTestId('global-attribute-duplicate-channel'));
        await userEvent.click(screen.getByRole('button', {name: 'Duplicate'}));

        expect(onConfirm).toHaveBeenCalledWith(['user']);
    });
});
