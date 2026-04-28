// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback} from 'react';
import {useIntl} from 'react-intl';
import {useDispatch} from 'react-redux';

import {TranslateIcon} from '@mattermost/compass-icons/components';
import type {PostTranslation, PostType} from '@mattermost/types/posts';

import {openModal} from 'actions/views/modals';

import LoadingSpinner from 'components/widgets/loading/loading_spinner';
import WithTooltip from 'components/with_tooltip';

import {ModalIdentifiers} from 'utils/constants';

type Props = {
    postId: string;
    translationState: PostTranslation['state'] | undefined;
    postType: PostType;
}
function PostHeaderTranslateIcon({
    postId,
    translationState,
    postType,
}: Props) {
    const dispatch = useDispatch();
    const {formatMessage} = useIntl();

    const handleTranslationClick = useCallback(async () => {
        // Use dynamic import to avoid circular dependency
        // This breaks the cycle because the import only happens at runtime, not at module load time
        const {default: ShowTranslationModal} = await import('components/show_translation_modal');
        dispatch(openModal({
            modalId: ModalIdentifiers.SHOW_TRANSLATION,
            dialogType: ShowTranslationModal,
            dialogProps: {postId},
        }));
    }, [dispatch, postId]);

    if (postType !== '') {
        return null;
    }

    if (translationState === 'ready') {
        return (
            <WithTooltip
                title={formatMessage({id: 'post_info.translation_icon.title', defaultMessage: 'Auto-translated'})}
                hint={formatMessage({id: 'post_info.translation_icon.hint', defaultMessage: 'Click to view original'})}
            >
                <button
                    className='btn btn-icon btn-xs btn-compact'
                    onClick={handleTranslationClick}
                    aria-label={formatMessage({id: 'post_info.translation_icon', defaultMessage: 'This post has been translated'})}
                >
                    <TranslateIcon
                        size={12}
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
            <div>
                <i className='post__translation-icon-processing'>
                    <LoadingSpinner text={formatMessage({id: 'post_info.translation_icon_processing', defaultMessage: 'Translating...'})}/>
                </i>
            </div>
        );
    }

    if (translationState === 'unavailable') {
        return (
            <WithTooltip
                title={formatMessage({id: 'post_info.translation_icon_unavailable', defaultMessage: 'Translation unavailable'})}
            >
                <div className='post__translation-icon-unavailable'>
                    <TranslateIcon
                        size={12}
                        aria-label={formatMessage({
                            id: 'post_info.translation_icon_unavailable',
                            defaultMessage: 'Translation unavailable',
                        })}
                    />
                </div>
            </WithTooltip>
        );
    }

    return null;
}

export default PostHeaderTranslateIcon;
