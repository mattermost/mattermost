// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {Modal} from 'react-bootstrap';
import {FormattedMessage} from 'react-intl';

import {renderWithContext} from 'tests/vitest_react_testing_utils';
import {ModalIdentifiers} from 'utils/constants';

import ToggleModalButton from './toggle_modal_button';

vi.mock('react-redux', async () => {
    const actual = await vi.importActual<typeof import('react-redux')>('react-redux');
    return {
        ...actual,
        useDispatch: () => vi.fn(),
    };
});

const TestModal = () => (
    <Modal
        show={true}
        onHide={vi.fn()}
    >
        <Modal.Header closeButton={true}/>
        <Modal.Body/>
    </Modal>
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
