// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {Modal} from 'react-bootstrap';
import {FormattedMessage} from 'react-intl';

import {GatherIntentSubmittedModal} from './gather_intent_submitted_modal';
import {useGatherIntent} from './useGatherIntent';

import type {GatherIntentModalProps} from './gather_intent_modal';
import type {TypePurchases} from '@mattermost/types/cloud';
import type {JSXElementConstructor} from 'react';
import './gather_intent.scss';

interface GatherIntentProps {
    typeGatherIntent: keyof typeof TypePurchases;
    gatherIntentText: React.ReactNode;
    modalComponent: JSXElementConstructor<GatherIntentModalProps>;
}

export const GatherIntent = ({gatherIntentText, typeGatherIntent, modalComponent: ModalComponent}: GatherIntentProps) => {
    const {
        feedbackSaved,
        handleSaveFeedback,
        showModal,
        handleOpenModal,
        handleCloseModal,
        submittingFeedback,
        showError,
    } = useGatherIntent({typeGatherIntent});

    return (
        <div className='gatherIntent'>
            <FormattedMessage
                id={'payment_form.gather_wire_transfer_intent_title'}
                defaultMessage='Alternate Payment Options'
            >
                {(text) => (
                    <h3 className='gatherIntent__title'>
                        {text}
                    </h3>)
                }
            </FormattedMessage>
            <button
                className={'gatherIntent__button'}
                id={typeGatherIntent}
                onClick={handleOpenModal}
                type='button'
            >
                {gatherIntentText}
            </button>
            {showModal &&
                <Modal
                    className='AltPaymentsModal'
                    dialogClassName='a11y__modal'
                    show={showModal}
                    onHide={handleCloseModal}
                    onExited={handleCloseModal}
                    role='dialog'
                    id='AltPaymentsModal'
                    aria-modal='true'
                >
                    {!feedbackSaved &&
                        <ModalComponent
                            onSave={handleSaveFeedback}
                            onClose={handleCloseModal}
                            isSubmitting={submittingFeedback}
                            showError={showError}
                        />}
                    {feedbackSaved &&
                        <GatherIntentSubmittedModal onClose={handleCloseModal}/>}
                </Modal>}
        </div>);
};
