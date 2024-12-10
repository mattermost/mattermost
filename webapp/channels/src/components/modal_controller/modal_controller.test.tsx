// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {Modal} from 'react-bootstrap';

import {closeModal} from 'actions/views/modals';

import {renderWithContext, waitFor} from 'tests/react_testing_utils';
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
    };

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

    test('should render without any modals', () => {
        const state = {
            views: {
                modals: {
                    modalState: {},
                },
            },
        };

        renderWithContext(<ModalController/>, state);

        expect(document.querySelector('.modal-dialog')).not.toBeInTheDocument();
    });

    test('should show modal when open is true', () => {
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

        renderWithContext(<ModalController/>, state);

        expect(document.querySelector('.modal-dialog')).toBeInTheDocument();
    });

    test('should pass onExited to modal to allow a modal to remove itself', async () => {
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
        renderWithContext(<ModalController/>, state, {useMockedStore: true});

        const modal = document.querySelector('.modal') as HTMLElement;
        expect(modal).toBeInTheDocument();

        // Simulate modal closing
        const closeButton = document.querySelector('.modal-header .close') as HTMLElement;
        expect(closeButton).toBeInTheDocument();
        closeButton.click();

        // Wait for modal to be removed from DOM
        await waitFor(() => {
            expect(modal).not.toBeVisible();
        });

        const actions = store.getActions();
        expect(actions).toContainEqual(closeModal(modalId));
    });

    test('should call a provided onExited in addition to removing the modal', async () => {
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
        renderWithContext(<ModalController/>, state, {useMockedStore: true});

        const modal = document.querySelector('.modal') as HTMLElement;
        expect(modal).toBeInTheDocument();

        // Simulate modal closing
        const closeButton = document.querySelector('.modal-header .close') as HTMLElement;
        expect(closeButton).toBeInTheDocument();
        closeButton.click();

        // Wait for modal to be removed from DOM
        await waitFor(() => {
            expect(modal).not.toBeVisible();
        });

        const actions = store.getActions();
        expect(actions).toContainEqual(closeModal(modalId));
        expect(onExited).toHaveBeenCalled();
    });
});
