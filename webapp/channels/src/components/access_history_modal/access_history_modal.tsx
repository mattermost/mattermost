// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect} from 'react';
import {FormattedMessage} from 'react-intl';

import {GenericModal} from '@mattermost/components';
import type {Audit} from '@mattermost/types/audits';

import AuditTable from 'components/audit_table';
import LoadingScreen from 'components/loading_screen';

import './access_history_modal.scss';

type Props = {
    onHide: () => void;
    actions: {
        getUserAudits: (userId: string, page?: number, perPage?: number) => void;
    };
    userAudits: Audit[];
    currentUserId: string;
}

const AccessHistoryModal = ({
    actions: {
        getUserAudits,
    },
    currentUserId,
    onHide,
    userAudits,
}: Props) => {
    useEffect(() => {
        getUserAudits(currentUserId, 0, 200);
    }, [currentUserId, getUserAudits]);

    let content;
    if (userAudits.length === 0) {
        content = (<LoadingScreen/>);
    } else {
        content = (
            <AuditTable
                audits={userAudits}
                showIp={true}
                showSession={true}
            />
        );
    }

    return (
        <GenericModal
            id='accessHistoryModal'
            className='a11y__modal access-history-modal modal--scroll'
            modalHeaderText={
                <FormattedMessage
                    id='access_history.title'
                    defaultMessage='Access History'
                />
            }
            modalHeaderTextId='accessHistoryModalLabel'
            show={true}
            onHide={onHide}
            modalLocation='top'
            isStacked={true}
            compassDesign={true}
            ariaLabelledby='accessHistoryModalLabel'
        >
            <div className='access-history-modal__body'>
                {content}
            </div>
        </GenericModal>
    );
};

export default React.memo(AccessHistoryModal);
