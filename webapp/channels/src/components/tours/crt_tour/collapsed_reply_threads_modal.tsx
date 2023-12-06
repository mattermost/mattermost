// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useEffect} from 'react';
import {FormattedMessage} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';

import {GenericModal} from '@mattermost/components';

import {savePreferences} from 'mattermost-redux/actions/preferences';
import {getCurrentUserId} from 'mattermost-redux/selectors/entities/users';

import {closeModal} from 'actions/views/modals';

import FormattedMarkdownMessage from 'components/formatted_markdown_message';
import NextIcon from 'components/widgets/icons/fa_next_icon';

import crtInProductImg from 'images/crt-in-product.gif';
import {Constants, ModalIdentifiers, Preferences} from 'utils/constants';
import * as Keyboard from 'utils/keyboard';

import './collapsed_reply_threads_modal.scss';
import {AutoTourStatus, TTNameMapToATStatusKey, TutorialTourName} from '../constant';

type Props = {
    onExited: () => void;
}

function CollapsedReplyThreadsModal(props: Props) {
    const dispatch = useDispatch();
    const currentUserId = useSelector(getCurrentUserId);
    const handleKeyDown = useCallback((e: KeyboardEvent) => {
        if (Keyboard.isKeyPressed(e, Constants.KeyCodes.ENTER)) {
            onNext();
        }
    }, []);

    useEffect(() => {
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [handleKeyDown]);

    const onHide = useCallback((skipTour: boolean) => {
        dispatch(closeModal(ModalIdentifiers.COLLAPSED_REPLY_THREADS_MODAL));
        if (skipTour) {
            const preferences = [{
                user_id: currentUserId,
                category: Preferences.CRT_TUTORIAL_TRIGGERED,
                name: currentUserId,
                value: (Constants.CrtTutorialTriggerSteps.FINISHED).toString(),
            }];
            dispatch(savePreferences(currentUserId, preferences));
        }
    }, [currentUserId]);

    const onNext = useCallback(() => {
        const preferences = [{
            user_id: currentUserId,
            category: Preferences.CRT_TUTORIAL_TRIGGERED,
            name: currentUserId,
            value: (Constants.CrtTutorialTriggerSteps.STARTED).toString(),
        }, {
            user_id: currentUserId,
            category: TutorialTourName.CRT_TUTORIAL_STEP,
            name: TTNameMapToATStatusKey[TutorialTourName.CRT_TUTORIAL_STEP],
            value: AutoTourStatus.ENABLED.toString(),
        }];
        dispatch(savePreferences(currentUserId, preferences));
        onHide(false);
    }, [currentUserId]);

    return (
        <GenericModal
            className='CollapsedReplyThreadsModal productNotices'
            id={ModalIdentifiers.COLLAPSED_REPLY_THREADS_MODAL}
            onExited={props.onExited}
            handleConfirm={onNext}
            autoCloseOnConfirmButton={true}
            handleCancel={() => onHide(true)}
            modalHeaderText={(
                <FormattedMessage
                    id='collapsed_reply_threads_modal.title'
                    defaultMessage={'A new way to view and follow threads'}
                />
            )}
            confirmButtonText={(
                <>
                    <FormattedMessage
                        id={'collapsed_reply_threads_modal.take_the_tour'}
                        defaultMessage='Take the Tour'
                    />
                    <NextIcon/>
                </>
            )}
            cancelButtonText={
                <FormattedMessage
                    id={'collapsed_reply_threads_modal.skip_tour'}
                    defaultMessage='Skip Tour'
                />
            }
        >
            <div>
                <p className='productNotices__helpText'>
                    <FormattedMarkdownMessage
                        id={'collapsed_reply_threads_modal.description'}
                        defaultMessage={'Threads have been revamped to help you create organized conversation around specific messages. Now, channels will appear less cluttered as replies are collapsed under the original message, and all the conversations you\'re following are available in your **Threads** view. Take the tour to see what\'s new.'}
                    />
                </p>
                <img
                    src={crtInProductImg}
                    className='CollapsedReplyThreadsModal__img'
                />
            </div>
        </GenericModal>
    );
}

export default CollapsedReplyThreadsModal;
