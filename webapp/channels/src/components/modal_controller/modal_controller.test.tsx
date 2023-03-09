// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {Modal} from 'react-bootstrap';
import {Provider} from 'react-redux';
import {mount} from 'enzyme';

import {closeModal} from 'actions/views/modals';

import mockStore from 'tests/test_store';

import ModalController from '.';

type TestModalProps = {
    onExited: () => void;
}

type TestModalState = {
    show: boolean;
}

class TestModal extends React.PureComponent<TestModalProps, TestModalState> {
    constructor(props: TestModalProps) {
        super(props);

        this.state = {
            show: true,
        };
    }

    hideModal = () => {
        this.setState({show: false});
    }

    render() {
        return (
            <Modal
                show={this.state.show}
                onHide={this.hideModal}
                onExited={this.props.onExited}
            >
                <Modal.Header closeButton={true}/>
                <Modal.Body/>
            </Modal>
        );
    }
}

describe('components/ModalController', () => {
    const modalId = 'test_modal';

    test('component should match snapshot without any modals', () => {
        const state = {
            views: {
                modals: {
                    modalState: {},
                },
            },
        };

        const store = mockStore(state);

        const wrapper = mount(
            <Provider store={store}>
                <ModalController/>
            </Provider>,
        );

        expect(wrapper).toMatchSnapshot();
        expect(wrapper.find('ModalController > *').length).toBe(0);
        expect(document.getElementsByClassName('modal-dialog').length).toBeFalsy();
    });

    test('test model should be open', () => {
        const state = {
            views: {
                modals: {
                    modalState: {
                        [modalId]: {
                            open: true,
                            dialogProps: {},
                            dialogType: TestModal,
                        },
                    },
                },
            },
        };

        const store = mockStore(state);

        mount(
            <Provider store={store}>
                <ModalController/>
            </Provider>,
        );

        expect(document.getElementsByClassName('modal-dialog').length).toBe(1);
    });

    test('should pass onExited to modal to allow a modal to remove itself', () => {
        const state = {
            views: {
                modals: {
                    modalState: {
                        [modalId]: {
                            open: true,
                            dialogProps: {},
                            dialogType: TestModal,
                        },
                    },
                },
            },
        };

        const store = mockStore(state);

        const wrapper = mount(
            <Provider store={store}>
                <ModalController/>
            </Provider>,
        );

        expect(wrapper.find(TestModal).exists()).toBe(true);
        expect(wrapper.find(TestModal).prop('onExited')).toBeDefined();
        expect(wrapper.find(Modal).prop('onExited')).toBeDefined();

        wrapper.find(TestModal).prop('onExited')!();

        expect(store.getActions()).toEqual([
            closeModal(modalId),
        ]);
    });

    test('should call a provided onExited in addition to removing the modal', () => {
        const onExited = jest.fn();

        const state = {
            views: {
                modals: {
                    modalState: {
                        [modalId]: {
                            open: true,
                            dialogProps: {
                                onExited,
                            },
                            dialogType: TestModal,
                        },
                    },
                },
            },
        };

        const store = mockStore(state);

        const wrapper = mount(
            <Provider store={store}>
                <ModalController/>
            </Provider>,
        );

        expect(wrapper.find(TestModal).exists()).toBe(true);
        expect(wrapper.find(TestModal).prop('onExited')).toBeDefined();
        expect(wrapper.find(Modal).prop('onExited')).toBeDefined();

        expect(onExited).not.toBeCalled();

        wrapper.find(TestModal).prop('onExited')!();

        expect(onExited).toBeCalled();
    });
});
