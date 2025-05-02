// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import type {MouseEvent, KeyboardEvent} from 'react';

import CustomStatusEmoji from 'components/custom_status/custom_status_emoji';
import CustomStatusModal from 'components/custom_status/custom_status_modal';

import {ModalIdentifiers} from 'utils/constants';

import type {PropsFromRedux} from './index';
import './mobile_sidebar_header.scss';

type Props = PropsFromRedux;

export default function MobileSidebarHeader(props: Props) {
    if (!props.username) {
        return null;
    }

    function handleCustomStatusEmojiClick(event: MouseEvent<HTMLSpanElement> | KeyboardEvent<HTMLSpanElement>) {
        event.stopPropagation();

        const customStatusInputModalData = {
            modalId: ModalIdentifiers.CUSTOM_STATUS,
            dialogType: CustomStatusModal,
        };
        props.openModal(customStatusInputModalData);
    }

    return (
        <div className='mobileSidebarHeader'>
            <h1>{props.teamDisplayName}</h1>
            <div className='mobileSidebarHeader__username'>
                <span>{'@' + props.username}</span>
                <CustomStatusEmoji
                    showTooltip={false}
                    emojiStyle={{
                        verticalAlign: 'top',
                    }}
                    onClick={handleCustomStatusEmojiClick}
                />
            </div>
        </div>
    );
}
