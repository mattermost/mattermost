// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {Modal} from 'react-bootstrap';

import {renderWithContext, screen, fireEvent, waitFor} from 'tests/vitest_react_testing_utils';

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
                <Modal.Body>
                    <div data-testid='test-modal-body'>{'Test Modal Content'}</div>
                </Modal.Body>
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
        );

        expect(container).toMatchSnapshot();
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

        renderWithContext(
            <ModalController/>,
            state,
        );

        // Modal should be rendered with onExited prop
        expect(screen.getByTestId('test-modal-body')).toBeInTheDocument();

        // Close the modal by clicking the close button
        const closeButton = document.querySelector('.close');
        if (closeButton) {
            fireEvent.click(closeButton);
        }

        // Modal should start closing (the onExited will be called by Bootstrap Modal)
        await waitFor(() => {
            // Modal dialog should be hidden after closing
            expect(document.querySelector('.modal.in')).not.toBeInTheDocument();
        });
    });

    test('should call a provided onExited in addition to removing the modal', async () => {
        const onExited = vi.fn();

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
        );

        // Modal should be rendered
        expect(screen.getByTestId('test-modal-body')).toBeInTheDocument();

        // onExited should not be called yet
        expect(onExited).not.toHaveBeenCalled();

        // Close the modal by clicking the close button
        const closeButton = document.querySelector('.close');
        if (closeButton) {
            fireEvent.click(closeButton);
        }

        // Wait for onExited to be called
        await waitFor(() => {
            expect(onExited).toHaveBeenCalled();
        });
    });
});
