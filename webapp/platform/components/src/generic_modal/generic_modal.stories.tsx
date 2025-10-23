// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Meta, StoryObj} from '@storybook/react';
import React, {useState} from 'react';

import GenericModal from './generic_modal';

const meta: Meta<typeof GenericModal> = {
    title: 'Components/GenericModal',
    component: GenericModal,
    tags: ['autodocs'],
    argTypes: {
        modalHeaderText: {
            control: 'text',
            description: 'Header text displayed at the top of the modal',
        },
        modalSubheaderText: {
            control: 'text',
            description: 'Subheader text displayed below the header',
        },
        modalLocation: {
            control: 'select',
            options: ['top', 'center', 'bottom'],
            description: 'Vertical position of the modal',
        },
        compassDesign: {
            control: 'boolean',
            description: 'Use Compass design system styling',
        },
        isDeleteModal: {
            control: 'boolean',
            description: 'Style as a delete/destructive modal',
        },
        preventClose: {
            control: 'boolean',
            description: 'Prevent modal from closing',
        },
    },
    parameters: {
        layout: 'centered',
    },
};

export default meta;
type Story = StoryObj<typeof GenericModal>;

export const Default: Story = {
    args: {
        show: true,
        modalHeaderText: 'Modal Title',
        children: <p>This is the modal body content</p>,
        // eslint-disable-next-line no-alert
        handleCancel: () => alert('Cancel clicked'),
        // eslint-disable-next-line no-alert
        handleConfirm: () => alert('Confirm clicked'),
    },
};

export const WithSubheader: Story = {
    args: {
        show: true,
        modalHeaderText: 'Confirm Action',
        modalSubheaderText: 'This action cannot be undone. Please confirm you want to proceed.',
        children: <p>Are you sure you want to continue?</p>,
        handleCancel: () => {},
        handleConfirm: () => {},
    },
};

export const DeleteModal: Story = {
    args: {
        show: true,
        modalHeaderText: 'Delete Item',
        isDeleteModal: true,
        children: (
            <div>
                <p>This action is permanent and cannot be undone.</p>
                <p><strong>Type DELETE to confirm</strong></p>
            </div>
        ),
        confirmButtonText: 'Delete',
        cancelButtonText: 'Cancel',
        handleCancel: () => {},
        handleConfirm: () => {},
    },
};

export const CompassDesign: Story = {
    args: {
        show: true,
        modalHeaderText: 'Compass Modal',
        compassDesign: true,
        children: <p>Modal using Compass design system styling</p>,
        handleCancel: () => {},
        handleConfirm: () => {},
    },
};

export const TopPosition: Story = {
    args: {
        show: true,
        modalHeaderText: 'Top Modal',
        modalLocation: 'top',
        children: <p>This modal appears at the top of the screen</p>,
        handleCancel: () => {},
        handleConfirm: () => {},
    },
};

export const BottomPosition: Story = {
    args: {
        show: true,
        modalHeaderText: 'Bottom Modal',
        modalLocation: 'bottom',
        children: <p>This modal appears at the bottom of the screen</p>,
        handleCancel: () => {},
        handleConfirm: () => {},
    },
};

export const CustomButtons: Story = {
    args: {
        show: true,
        modalHeaderText: 'Custom Button Labels',
        children: <p>Modal with custom button text</p>,
        confirmButtonText: 'Yes, I agree',
        cancelButtonText: 'No, cancel',
        handleCancel: () => {},
        handleConfirm: () => {},
    },
};

export const ConfirmDisabled: Story = {
    args: {
        show: true,
        modalHeaderText: 'Disabled Confirm',
        children: <p>The confirm button is disabled until a condition is met</p>,
        isConfirmDisabled: true,
        handleCancel: () => {},
        handleConfirm: () => {},
    },
};

export const NoButtons: Story = {
    args: {
        show: true,
        modalHeaderText: 'Information Only',
        children: <p>This modal has no action buttons, only a close button</p>,
    },
};

export const WithErrorText: Story = {
    args: {
        show: true,
        modalHeaderText: 'Form with Error',
        compassDesign: true,
        errorText: 'Please fix the errors before continuing',
        children: (
            <div>
                <p>Please enter required information:</p>
                <input type='text' placeholder='Required field' style={{width: '100%', padding: '8px'}}/>
            </div>
        ),
        handleCancel: () => {},
        handleConfirm: () => {},
    },
};

export const WithFooterContent: Story = {
    args: {
        show: true,
        modalHeaderText: 'Custom Footer',
        children: <p>This modal has custom footer content instead of buttons</p>,
        footerContent: (
            <div style={{display: 'flex', justifyContent: 'space-between', width: '100%'}}>
                <button className='btn btn-link'>Learn More</button>
                <button className='btn btn-primary'>Got it</button>
            </div>
        ),
    },
};

export const LongContent: Story = {
    args: {
        show: true,
        modalHeaderText: 'Long Content Modal',
        children: (
            <div>
                {Array.from({length: 20}, (_, i) => (
                    <p key={i}>
                        This is paragraph {i + 1}. The modal body should scroll when content exceeds the viewport height.
                    </p>
                ))}
            </div>
        ),
        handleCancel: () => {},
        handleConfirm: () => {},
    },
};

export const Interactive: Story = {
    render: () => {
        const [isOpen, setIsOpen] = useState(false);

        return (
            <>
                <button
                    className='btn btn-primary'
                    onClick={() => setIsOpen(true)}
                >
                    Open Modal
                </button>
                <GenericModal
                    show={isOpen}
                    modalHeaderText='Interactive Modal'
                    onHide={() => setIsOpen(false)}
                    handleCancel={() => setIsOpen(false)}
                    handleConfirm={() => {
                        // eslint-disable-next-line no-alert
                        alert('Confirmed!');
                        setIsOpen(false);
                    }}
                >
                    <p>This modal can be opened and closed interactively</p>
                </GenericModal>
            </>
        );
    },
};

