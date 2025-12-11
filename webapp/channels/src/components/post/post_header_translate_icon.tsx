// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback} from 'react';
import {useIntl} from 'react-intl';
import {useDispatch} from 'react-redux';

import {TranslateIcon} from '@mattermost/compass-icons/components';
import type {PostTranslation} from '@mattermost/types/posts';

import {openModal} from 'actions/views/modals';

import ViewTranslationModal from 'components/view_translation_modal';
import LoadingSpinner from 'components/widgets/loading/loading_spinner';
import WithTooltip from 'components/with_tooltip';

import {ModalIdentifiers} from 'utils/constants';

type Props = {
    postId: string;
    translationState: PostTranslation['state'] | undefined;
}
function PostHeaderTranslateIcon({
    postId,
    translationState,
}: Props) {
    const dispatch = useDispatch();
    const {formatMessage} = useIntl();

    const handleTranslationClick = useCallback(() => {
        dispatch(openModal({
            modalId: ModalIdentifiers.VIEW_TRANSLATION,
            dialogType: ViewTranslationModal,
            dialogProps: {postId},
        }));
    }, [dispatch, postId]);

    if (translationState === 'ready') {
        return (
            <WithTooltip
                title={formatMessage({id: 'post_info.translation_icon', defaultMessage: 'Auto-translated'})}
                hint={formatMessage({id: 'post_info.translation_icon', defaultMessage: 'Click to view original'})}
            >
                <button
                    className='btn btn-icon btn-xs'
                    onClick={handleTranslationClick}
                    aria-label={formatMessage({id: 'post_info.translation_icon', defaultMessage: 'This post has been translated'})}
                >
                    <TranslateIcon
                        size={12}
                        className='icon icon--small'
                        aria-label={formatMessage({
                            id: 'post_info.translation_icon',
                            defaultMessage: 'This post has been translated',
                        })}
                    />
                </button>
            </WithTooltip>
        );
    }

    if (translationState === 'processing') {
        return (
            <i className='post__translation-icon-processing'>
                <LoadingSpinner text={formatMessage({id: 'post_info.translation_icon_processing', defaultMessage: 'Translating...'})}/>
            </i>
        );
    }

    return null;
}

export default PostHeaderTranslateIcon;
