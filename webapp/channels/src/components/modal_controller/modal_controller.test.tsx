// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {Modal} from 'react-bootstrap';

import {closeModal} from 'actions/views/modals';

import {renderWithContext, act, userEvent} from 'tests/react_testing_utils';

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

    test('component should match snapshot without any modals', () => {
        const state = {
            views: {
                modals: {
                    modalState: {},
                },
            },
        };

        const {container} = renderWithContext(
            <ModalController/>,
            state,
            {useMockedStore: true},
        );

        expect(container).toMatchSnapshot();
        expect(container.childElementCount).toBe(0);
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

        renderWithContext(
            <ModalController/>,
            state,
            {useMockedStore: true},
        );

        expect(document.getElementsByClassName('modal-dialog').length).toBe(1);
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

        const {store} = renderWithContext(
            <ModalController/>,
            state,
            {useMockedStore: true},
        );

        // Verify the modal is rendered
        expect(document.getElementsByClassName('modal-dialog').length).toBe(1);

        // Click the close button to trigger modal close flow (onHide -> setState show:false -> onExited)
        const closeButton = document.querySelector('.close') as HTMLElement;
        await userEvent.click(closeButton);

        // Wait for the modal's exit transition to complete and fire onExited
        await act(async () => {
            await new Promise((resolve) => setTimeout(resolve, 500));
        });

        expect((store as unknown as {getActions: () => unknown[]}).getActions()).toEqual([
            closeModal(modalId),
        ]);
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

        renderWithContext(
            <ModalController/>,
            state,
            {useMockedStore: true},
        );

        // Verify the modal is rendered
        expect(document.getElementsByClassName('modal-dialog').length).toBe(1);

        expect(onExited).not.toHaveBeenCalled();

        // Click the close button to trigger modal close flow (onHide -> setState show:false -> onExited)
        const closeButton = document.querySelector('.close') as HTMLElement;
        await userEvent.click(closeButton);

        // Wait for the modal's exit transition to complete and fire onExited
        await act(async () => {
            await new Promise((resolve) => setTimeout(resolve, 500));
        });

        expect(onExited).toHaveBeenCalled();
    });
});
