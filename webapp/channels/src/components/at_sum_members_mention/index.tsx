// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useDispatch} from 'react-redux';

import {openModal} from 'actions/views/modals';
import {ModalIdentifiers} from 'utils/constants';

import NotificationFromMembersModal from './notification_from_members_modal';

type Props = {
    postId: string;
    text: string;
    userIds: string[];
    messageMetadata: Record<string, string>;
}

function AtSumOfMembersMention(props: Props) {
    const dispatch = useDispatch();
    const handleOpen = (e: React.MouseEvent<HTMLAnchorElement, MouseEvent>) => {
        e.preventDefault();
        dispatch(openModal({
            modalId: ModalIdentifiers.SUM_OF_MEMBERS_MODAL,
            dialogType: NotificationFromMembersModal,
            dialogProps: {
                userIds: props.userIds,
                feature: props.messageMetadata.requestedFeature,
            },
        }));
    };

    return (
        <>
            <a
                id={`${props.postId}_at_sum_of_members_mention`}
                onClick={handleOpen}
            >
                {props.text}
            </a>
        </>

    );
}

export default AtSumOfMembersMention;
