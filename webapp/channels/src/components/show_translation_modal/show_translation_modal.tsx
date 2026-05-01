// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useIntl} from 'react-intl';
import {useSelector} from 'react-redux';

import {GenericModal} from '@mattermost/components';

import {getPost} from 'mattermost-redux/selectors/entities/posts';

import Post from 'components/post';
import Tag from 'components/widgets/tag/tag';

import {Locations} from 'utils/constants';
import {getPostTranslation} from 'utils/post_utils';

import type {GlobalState} from 'types/store';

import './show_translation_modal.scss';

type Props = {
    postId: string;
    onExited?: () => void;
    onHide?: () => void;
}

function ShowTranslationModal({postId, onExited, onHide}: Props) {
    const intl = useIntl();
    const post = useSelector((state: GlobalState) => getPost(state, postId));
    if (!post) {
        return null;
    }

    const translation = getPostTranslation(post, intl.locale);
    const originalLanguage = translation?.source_lang || 'unknown';

    const handleHide = () => {
        if (onHide) {
            onHide();
        }
    };

    return (
        <GenericModal
            id='showTranslationModal'
            className='ShowTranslationModal a11y__modal'
            show={true}
            onHide={handleHide}
            onExited={onExited}
            ariaLabelledby='showTranslationModalLabel'
            compassDesign={true}
            modalHeaderText={intl.formatMessage({
                id: 'show_translation.modal.title',
                defaultMessage: 'Show Translation',
            })}
        >
            <div className='ShowTranslationModal__content'>
                {/* Original Message */}
                <div className='ShowTranslationModal__messageBlock ShowTranslationModal__messageBlock--original'>
                    <div className='ShowTranslationModal__badgeContainer'>
                        <span className='ShowTranslationModal__languageText'>
                            {originalLanguage === 'unknown' ? intl.formatMessage({
                                id: 'show_translation.unknown_language',
                                defaultMessage: 'Unknown',
                            }) : intl.formatDisplayName(originalLanguage, {type: 'language'})}
                        </span>
                        <Tag
                            text={intl.formatMessage({
                                id: 'show_translation.original_badge',
                                defaultMessage: 'ORIGINAL',
                            })}
                            variant='info'
                            size='xs'
                        />
                    </div>
                    <div className='ShowTranslationModal__postContent'>
                        <Post
                            post={post}
                            isChannelAutotranslated={false}
                            location={Locations.MODAL}
                            preventClickInteraction={true}
                        />
                    </div>
                </div>

                {/* Translated Message */}
                <div className='ShowTranslationModal__messageBlock ShowTranslationModal__messageBlock--translated'>
                    <div className='ShowTranslationModal__badgeContainer'>
                        <span className='ShowTranslationModal__languageText'>
                            {intl.formatDisplayName(intl.locale, {type: 'language'})}
                        </span>
                        <Tag
                            text={intl.formatMessage({
                                id: 'show_translation.auto_translated_badge',
                                defaultMessage: 'AUTO-TRANSLATED',
                            })}
                            variant='default'
                            size='xs'
                        />
                    </div>
                    <div className='ShowTranslationModal__postContent'>
                        <Post
                            post={post}
                            isChannelAutotranslated={true}
                            location={Locations.MODAL}
                            preventClickInteraction={true}
                        />
                    </div>
                </div>
            </div>
        </GenericModal>
    );
}

export default ShowTranslationModal;

