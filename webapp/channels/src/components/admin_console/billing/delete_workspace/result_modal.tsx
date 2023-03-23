// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';

import IconMessage from 'components/purchase_modal/icon_message';
import FullScreenModal from 'components/widgets/modals/full_screen_modal';

import {closeModal} from 'actions/views/modals';
import {isModalOpen} from 'selectors/views/modals';
import {GlobalState} from 'types/store';

import './result_modal.scss';

import useOpenSalesLink from 'components/common/hooks/useOpenSalesLink';
import {InquiryType} from 'selectors/cloud';

type Props = {
    onHide?: () => void;
    icon: JSX.Element;
    title: JSX.Element;
    subtitle: JSX.Element;
    primaryButtonText: JSX.Element;
    primaryButtonHandler: () => void;
    identifier: string;
    contactSupportButtonVisible?: boolean;
    resultType: string;
    ignoreExit: boolean;
};

export default function ResultModal(props: Props) {
    const dispatch = useDispatch();

    const openContactUs = useOpenSalesLink(undefined, InquiryType.Technical);

    const isResultModalOpen = useSelector((state: GlobalState) =>
        isModalOpen(state, props.identifier),
    );

    const onHide = () => {
        dispatch(closeModal(props.identifier));
        if (typeof props.onHide === 'function') {
            props.onHide();
        }
    };

    const modalType = `delete-workspace-result_modal__${props.resultType}`;

    return (
        <FullScreenModal
            show={isResultModalOpen}
            onClose={onHide}
            ignoreExit={props.ignoreExit}
        >
            <div className={modalType}>
                <IconMessage
                    formattedTitle={props.title}
                    formattedSubtitle={props.subtitle}
                    error={false}
                    icon={props.icon}
                    formattedButtonText={props.primaryButtonText}
                    buttonHandler={props.primaryButtonHandler}
                    className={'success'}
                    formattedTertiaryButonText={
                        props.contactSupportButtonVisible ?
                            <FormattedMessage
                                id={'admin.billing.deleteWorkspace.resultModal.ContactSupport'}
                                defaultMessage={'Contact Support'}
                            /> :
                            undefined
                    }
                    tertiaryButtonHandler={props.contactSupportButtonVisible ? openContactUs : undefined}
                />
            </div>
        </FullScreenModal>
    );
}
