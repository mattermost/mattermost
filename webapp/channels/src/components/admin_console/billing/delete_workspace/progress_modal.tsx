// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect, useRef, useState} from 'react';
import {injectIntl, WrappedComponentProps} from 'react-intl';
import {useDispatch} from 'react-redux';

import {closeModal} from 'actions/views/modals';

import BackgroundSvg from 'components/common/svg_images_components/background_svg';
import CreditCardSvg from 'components/common/svg_images_components/credit_card_svg';
import IconMessage from 'components/purchase_modal/icon_message';
import RootPortal from 'components/root_portal';
import FullScreenModal from 'components/widgets/modals/full_screen_modal';

import {ModalIdentifiers} from 'utils/constants';

import './progress_modal.scss';
const MIN_PROCESSING_MILLISECONDS = 5000;
const MAX_FAKE_PROGRESS = 95;

type Props = WrappedComponentProps

const DeleteWorkspaceProgressModal = (props: Props) => {
    const modal = React.createRef();
    const mounted = useRef(false);
    const dispatch = useDispatch();
    const [progress, setProgress] = useState(0);

    const progressBar: JSX.Element | null = (
        <div className='ProcessPayment-progress'>
            <div
                className='ProcessPayment-progress-fill'
                style={{width: `${progress}%`}}
            />
        </div>
    );

    useEffect(() => {
        const updateProgress = () => {
            if (mounted.current) {
                setProgress(progress + 1);
            }
        };
        if (progress < MAX_FAKE_PROGRESS) {
            setTimeout(updateProgress, MIN_PROCESSING_MILLISECONDS / MAX_FAKE_PROGRESS);
        }
    }, [progress]);

    useEffect(() => {
        mounted.current = true;

        return () => {
            mounted.current = false;
        };
    }, []);

    return (
        <RootPortal>
            <FullScreenModal
                show={true}
                onClose={() => dispatch(closeModal(ModalIdentifiers.DELETE_WORKSPACE_PROGRESS))}
                ref={modal}
                ariaLabelledBy='delete_workspace_modal_title'
                overrideTargetEvent={false}
            >
                <div className='DeleteWorkspaceProgressModal'>
                    <IconMessage
                        title={
                            props.intl.formatMessage({
                                id: 'admin.billing.deleteWorkspace.progressModal.title',
                                defaultMessage: 'Deleting your workspace',
                            })
                        }
                        icon={
                            <CreditCardSvg
                                width={444}
                                height={313}
                            />
                        }
                        footer={progressBar}
                        className={'processing'}
                    />
                    <div className='background-svg'>
                        <BackgroundSvg/>
                    </div>
                </div>
            </FullScreenModal>
        </RootPortal>
    );
};

export default injectIntl(DeleteWorkspaceProgressModal);
