// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useIntl} from 'react-intl';
import {useSelector} from 'react-redux';

import {GenericModal} from '@mattermost/components';

import {getPost} from 'mattermost-redux/selectors/entities/posts';

import PostMessageView from 'components/post_view/post_message_view';
import Tag from 'components/widgets/tag/tag';

import type {GlobalState} from 'types/store';

import './view_translation_modal.scss';

type Props = {
    postId: string;
    onExited?: () => void;
    onHide?: () => void;
}

function ViewTranslationModal({postId, onExited, onHide}: Props) {
    const intl = useIntl();
    const post = useSelector((state: GlobalState) => getPost(state, postId));
    if (!post) {
        return null;
    }

    const originalLanguage = 'en'; //post.metadata?.original_language || 'en';

    const handleHide = () => {
        if (onHide) {
            onHide();
        }
    };

    return (
        <GenericModal
            id='viewTranslationModal'
            className='ViewTranslationModal a11y__modal'
            show={true}
            onHide={handleHide}
            onExited={onExited}
            ariaLabelledby='viewTranslationModalLabel'
            compassDesign={true}
            modalHeaderText={intl.formatMessage({
                id: 'view_translation.modal.title',
                defaultMessage: 'Show Translation',
            })}
        >
            <div className='ViewTranslationModal__body'>
                <div className='ViewTranslationModal__content'>
                    {/* Original Message */}
                    <div className='ViewTranslationModal__messageBlock ViewTranslationModal__messageBlock--original'>
                        <div className='ViewTranslationModal__badgeContainer'>
                            <span className='ViewTranslationModal__languageText'>
                                {intl.formatDisplayName(originalLanguage, {type: 'language'})}
                            </span>
                            <Tag
                                text={intl.formatMessage({
                                    id: 'view_translation.original_badge',
                                    defaultMessage: 'ORIGINAL',
                                })}
                                variant='info'
                                size='sm'
                            />
                        </div>
                        <div className='ViewTranslationModal__postContent'>
                            <PostMessageView
                                post={post}
                                isRHS={false}
                                isChannelAutotranslated={false}
                                userLanguage={intl.locale}
                            />
                        </div>
                    </div>

                    {/* Translated Message */}
                    <div className='ViewTranslationModal__messageBlock ViewTranslationModal__messageBlock--translated'>
                        <div className='ViewTranslationModal__badgeContainer'>
                            <span className='ViewTranslationModal__languageText'>
                                {intl.formatDisplayName(intl.locale, {type: 'language'})}
                            </span>
                            <Tag
                                text={intl.formatMessage({
                                    id: 'view_translation.auto_translated_badge',
                                    defaultMessage: 'AUTO-TRANSLATED',
                                })}
                                variant='default'
                                size='sm'
                            />
                        </div>
                        <div className='ViewTranslationModal__postContent'>
                            <PostMessageView
                                post={post}
                                isRHS={false}
                                isChannelAutotranslated={true}
                                userLanguage={intl.locale}
                            />
                        </div>
                    </div>
                </div>
            </div>
        </GenericModal>
    );
}

export default ViewTranslationModal;

