// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useDispatch, useSelector} from 'react-redux';

import {hidePostMenuModal} from 'src/actions';

import {isPostMenuModalVisible} from 'src/selectors';

import UpgradeModal from 'src/components/backstage/upgrade_modal';

import {AdminNotificationType} from 'src/constants';

const PostMenuModal = () => {
    const dispatch = useDispatch();
    const show = useSelector(isPostMenuModalVisible);

    return (
        <UpgradeModal
            messageType={AdminNotificationType.MESSAGE_TO_TIMELINE}
            show={show}
            onHide={() => dispatch(hidePostMenuModal())}
        />
    );
};

export default PostMenuModal;
