// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {Modal} from 'react-bootstrap';
import {FormattedMessage} from 'react-intl';

import {mountWithIntl} from 'tests/helpers/intl-test-helper';
import {ModalIdentifiers} from 'utils/constants';

import ToggleModalButton from './toggle_modal_button';

jest.mock('react-redux', () => ({
    ...jest.requireActual('react-redux') as typeof import('react-redux'),
    useDispatch: () => jest.fn(),
}));

const TestModal = () => (
    <Modal
        show={true}
        onHide={jest.fn()}
    >
        <Modal.Header closeButton={true}/>
        <Modal.Body/>
    </Modal>
);

describe('components/ToggleModalButton', () => {
    test('component should match snapshot', () => {
        const wrapper = mountWithIntl(
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

        expect(wrapper).toMatchSnapshot();
        expect(wrapper.find('button span').first().html()).toBe('<span>Delete Channel</span>');
    });
});
