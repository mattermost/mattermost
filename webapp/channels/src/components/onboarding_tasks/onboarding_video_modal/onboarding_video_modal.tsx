// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useState} from 'react';
import {Modal} from 'react-bootstrap';
import {useDispatch, useSelector} from 'react-redux';

import {getCurrentUserId} from 'mattermost-redux/selectors/entities/common';
import {savePreferences} from 'mattermost-redux/actions/preferences';

import {OnboardingTaskCategory, OnboardingTaskList} from '../constants';
import './onboarding_video_modal.scss';

type Props = {
    onExited: () => void;
}

const OnBoardingVideoModal = ({onExited}: Props) => {
    const [show, setShow] = useState(true);
    const dispatch = useDispatch();
    const currentUserId = useSelector(getCurrentUserId);

    const handleHide = useCallback(() => {
        setShow(false);
        const preferences = [{
            user_id: currentUserId,
            category: OnboardingTaskCategory,
            name: OnboardingTaskList.ONBOARDING_TASK_LIST_OPEN,
            value: 'true',
        }];
        dispatch(savePreferences(currentUserId, preferences));
    }, [currentUserId]);

    return (
        <Modal
            id={OnboardingTaskList.ONBOARDING_VIDEO_MODAL}
            dialogClassName='a11y__modal on-boarding-video_modal'
            show={show}
            onHide={handleHide}
            onExited={onExited}
            enforceFocus={false}
            role='dialog'
            aria-labelledby='onBoardingVideoModal'
        >
            <Modal.Header
                closeButton={true}
            />
            <Modal.Body>
                <iframe
                    src='//fast.wistia.net/embed/iframe/y4jbcyd7ej'
                    // eslint-disable-next-line react/no-unknown-property
                    allowTransparency={true}
                    frameBorder='0'
                    scrolling='no'
                    className='wistia_embed'
                    name='wistia_embed'
                    allowFullScreen={true}
                />
            </Modal.Body>
        </Modal>
    );
};

export default OnBoardingVideoModal;
