// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';

import {renderWithContext} from 'tests/react_testing_utils';
import {ModalIdentifiers} from 'utils/constants';

import ToggleModalButton from './toggle_modal_button';

jest.mock('react-redux', () => ({
    ...jest.requireActual('react-redux') as typeof import('react-redux'),
    useDispatch: () => jest.fn(),
}));

const TestModal = () => (
    <div data-testid='test-modal'>
        <div>{'Modal Header'}</div>
        <div>{'Modal Body'}</div>
    </div>
);

describe('components/ToggleModalButton', () => {
    test('component should match snapshot', () => {
        const {container} = renderWithContext(
            <ToggleModalButton
                ariaLabel={'Delete Channel'}
                id='channelDelete'
                role='menuitem'
                modalId={ModalIdentifiers.DELETE_CHANNEL}
                dialogType={TestModal}
            >
                <FormattedMessage
                    id='channel_header.delete'
                    defaultMessage='Delete Channel'
                />
            </ToggleModalButton>,
        );

        expect(container).toMatchSnapshot();
        const button = container.querySelector('button');
        expect(button?.textContent).toBe('Delete Channel');
    });
});
