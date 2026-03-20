// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useState} from 'react';
import {Modal} from 'react-bootstrap';
import {FormattedMessage} from 'react-intl';
import {useDispatch} from 'react-redux';

import {PrimaryButton, PrimaryButtonDestructive, TertiaryButton} from 'src/components/assets/buttons';
import {modals} from 'src/webapp_globals';

import {
    Buttons,
    DefaultFooterContainer,
    ModalHeading,
    StyledModal,
} from './generic_modal';

type Props = {

    /*
     * Set to show modal
     */
    show: boolean;

    /*
     * Title to use for the modal
     */
    title?: React.ReactNode;

    /*
     * Message to display in the body of the modal
     */
    message?: React.ReactNode;

    /*
     * The CSS class to apply to the confirm button
     */
    confirmButtonClass?: string;

    /*
     * The CSS class to apply to the modal
     */
    modalClass?: string;

    /*
     * Text/jsx element on the confirm button
     */
    confirmButtonText?: React.ReactNode;

    /*
     * Text/jsx element on the cancel button
     */
    cancelButtonText?: React.ReactNode;

    /*
     * Set to show checkbox
     */
    showCheckbox?: boolean;

    /*
     * Text/jsx element to display with the checkbox
     */
    checkboxText?: React.ReactNode;

    /*
     * Function called when the confirm button or ENTER is pressed. Passes `true` if the checkbox is checked
     */
    onConfirm: (checked: boolean) => void;

    /*
     * Function called when the cancel button is pressed or the modal is hidden. Passes `true` if the checkbox is checked
     */
    onCancel?: (checked: boolean) => void;

    /**
     * Function called when modal is dismissed
     */
    onExited?: () => void;

    /*
     * Set to hide the cancel button
     */
    hideCancel?: boolean;

    /*
     * Set to true for destructive actions (uses danger button styling)
     */
    isDestructive?: boolean;

    stopPropagationOnClick?: boolean;
};

type State = {
    checked: boolean;
}

export const makeUncontrolledConfirmModalDefinition = (props: Props) => ({
    modalId: 'confirm',
    dialogType: UncontrolledConfirmModal,
    dialogProps: props,
});

const UncontrolledConfirmModal = (props: Props) => {
    const [show, setShow] = useState(true);

    return (
        <ConfirmModal
            {...props}
            show={show}
            onConfirm={(checked) => {
                setShow(false);
                props.onConfirm(checked);
            }}
            onCancel={(checked) => {
                setShow(false);
                props.onCancel?.(checked);
            }}
        />
    );
};

export default class ConfirmModal extends React.Component<Props, State> {
    static defaultProps = {
        title: '',
        message: '',
        confirmButtonClass: 'btn btn-primary',
        confirmButtonText: '',
        modalClass: '',
    };

    constructor(props: Props) {
        super(props);

        this.state = {
            checked: false,
        };
    }

    componentDidMount() {
        if (this.props.show) {
            document.addEventListener('keydown', this.handleKeypress);
        }
    }

    componentWillUnmount() {
        document.removeEventListener('keydown', this.handleKeypress);
    }

    shouldComponentUpdate(nextProps: Props, nextState: State) {
        return (
            nextProps.show !== this.props.show ||
            nextState.checked !== this.state.checked
        );
    }

    componentDidUpdate(prevProps: Props) {
        if (prevProps.show && !this.props.show) {
            document.removeEventListener('keydown', this.handleKeypress);
        } else if (!prevProps.show && this.props.show) {
            document.addEventListener('keydown', this.handleKeypress);
        }
    }

    handleKeypress = (e: KeyboardEvent) => {
        if (e.key === 'Enter' && this.props.show) {
            const cancelButton = document.getElementById('cancelModalButton');
            if (cancelButton && cancelButton === document.activeElement) {
                this.handleCancel();
            } else {
                this.handleConfirm();
            }
        }
    };

    handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        this.setState({checked: e.target.checked});
    };

    handleConfirm = () => {
        this.props.onConfirm(this.state.checked);
    };

    handleCancel = () => {
        this.props.onCancel?.(this.state.checked);
    };

    render() {
        let checkbox;
        if (this.props.showCheckbox) {
            checkbox = (
                <div className='checkbox text-right mb-0'>
                    <label>
                        <input
                            type='checkbox'
                            onChange={this.handleCheckboxChange}
                            checked={this.state.checked}
                        />
                        {this.props.checkboxText}
                    </label>
                </div>
            );
        }

        let cancelText;
        if (this.props.cancelButtonText) {
            cancelText = this.props.cancelButtonText;
        } else {
            cancelText = <FormattedMessage defaultMessage='Cancel'/>;
        }

        let cancelButton;
        if (!this.props.hideCancel) {
            cancelButton = (
                <TertiaryButton
                    type='button'
                    onClick={(e) => {
                        if (this.props.stopPropagationOnClick) {
                            e.stopPropagation();
                        }
                        this.handleCancel();
                    }}
                    id='cancelModalButton'
                >
                    {cancelText}
                </TertiaryButton>
            );
        }

        return (
            <StyledModal
                dialogClassName={'a11y__modal GenericModal'}
                show={this.props.show}
                onHide={this.props.onCancel}
                onExited={this.props.onExited}
                id='confirmModal'
                role='dialog'
                aria-modal={true}
                aria-labelledby='confirmModalLabel'
                aria-describedby='confirmModalBody'
            >
                <Modal.Header
                    className='GenericModal__header'
                    closeButton={false}
                    placeholder={undefined}
                    onPointerEnterCapture={undefined}
                    onPointerLeaveCapture={undefined}
                >
                    <ModalHeading id={'confirmModalLabel'}>
                        {this.props.title}
                    </ModalHeading>
                </Modal.Header>
                <Modal.Body id='confirmModalBody'>
                    {this.props.message}
                    {checkbox}
                </Modal.Body>
                <Modal.Footer>
                    <DefaultFooterContainer>
                        <Buttons>
                            {cancelButton}
                            {this.props.isDestructive ? (
                                <PrimaryButtonDestructive
                                    autoFocus={true}
                                    type='button'
                                    className={this.props.confirmButtonClass}
                                    onClick={(e) => {
                                        if (this.props.stopPropagationOnClick) {
                                            e.stopPropagation();
                                        }
                                        this.handleConfirm();
                                    }}
                                    id='confirmModalButton'
                                >
                                    {this.props.confirmButtonText}
                                </PrimaryButtonDestructive>
                            ) : (
                                <PrimaryButton
                                    autoFocus={true}
                                    type='button'
                                    className={this.props.confirmButtonClass}
                                    onClick={(e) => {
                                        if (this.props.stopPropagationOnClick) {
                                            e.stopPropagation();
                                        }
                                        this.handleConfirm();
                                    }}
                                    id='confirmModalButton'
                                >
                                    {this.props.confirmButtonText}
                                </PrimaryButton>
                            )}
                        </Buttons>
                    </DefaultFooterContainer>
                </Modal.Footer>
            </StyledModal>
        );
    }
}

interface ConfirmModalOptions {
    title: React.ReactNode;
    message: React.ReactNode;
    confirmButtonText?: React.ReactNode;
    cancelButtonText?: React.ReactNode;
    confirmButtonClass?: string;
    onConfirm: (checked: boolean) => void;
    onCancel?: (checked: boolean) => void;
    showCheckbox?: boolean;
    checkboxText?: React.ReactNode;
    isDestructive?: boolean;
}

/**
 * Hook to open a confirmation modal using dispatch
 *
 * @returns A function that opens the confirmation modal
 *
 * @example
 * const openConfirmModal = useConfirmModal();
 *
 * const handleDelete = () => {
 *   openConfirmModal({
 *     title: 'Delete item?',
 *     message: 'Are you sure you want to delete this item?',
 *     confirmButtonText: 'Delete',
 *     onConfirm: () => {
 *       // Handle delete
 *     },
 *   });
 * };
 */
export const useConfirmModal = () => {
    const dispatch = useDispatch();

    return useCallback((options: ConfirmModalOptions) => {
        dispatch(modals.openModal(makeUncontrolledConfirmModalDefinition({
            show: true,
            title: options.title,
            message: options.message,
            confirmButtonText: options.confirmButtonText,
            cancelButtonText: options.cancelButtonText,
            confirmButtonClass: options.confirmButtonClass,
            onConfirm: options.onConfirm,
            onCancel: options.onCancel,
            showCheckbox: options.showCheckbox,
            checkboxText: options.checkboxText,
            isDestructive: options.isDestructive,
        })));
    }, [dispatch]);
};
