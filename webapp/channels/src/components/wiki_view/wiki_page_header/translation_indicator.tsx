// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState, useCallback, useMemo, useRef, useEffect} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import {useSelector} from 'react-redux';

import GlobeIcon from '@mattermost/compass-icons/components/globe';

import {getPost} from 'mattermost-redux/selectors/entities/posts';

import {PagePropsKeys} from 'utils/constants';

import type {GlobalState} from 'types/store';

import type {Language} from '../wiki_page_editor/ai';
import {COMMON_LANGUAGES} from '../wiki_page_editor/ai';

import './translation_indicator.scss';

type TranslationReference = {
    page_id: string;
    language_code: string;
};

type Props = {
    pageId: string;
    onNavigateToPage?: (pageId: string) => void;
};

const TranslationIndicator = ({pageId, onNavigateToPage}: Props) => {
    const {formatMessage} = useIntl();
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    const page = useSelector((state: GlobalState) => getPost(state, pageId));

    // Get translation metadata
    const translatedFrom = page?.props?.[PagePropsKeys.TRANSLATED_FROM] as string | undefined;
    const translationLanguage = page?.props?.[PagePropsKeys.TRANSLATION_LANGUAGE] as string | undefined;
    const translations = (page?.props?.[PagePropsKeys.TRANSLATIONS] || []) as TranslationReference[];

    // Get source page if this is a translation
    const sourcePage = useSelector((state: GlobalState) =>
        (translatedFrom ? getPost(state, translatedFrom) : null),
    );

    // Map language codes to language names
    const languageMap = useMemo(() => {
        const map: Record<string, string> = {};
        COMMON_LANGUAGES.forEach((lang: Language) => {
            map[lang.code] = lang.nativeName;
        });
        return map;
    }, []);

    const getLanguageName = useCallback((code: string): string => {
        return languageMap[code] || code;
    }, [languageMap]);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen]);

    const handleToggle = useCallback(() => {
        setIsOpen((prev) => !prev);
    }, []);

    const handleNavigate = useCallback((targetPageId: string) => {
        setIsOpen(false);
        onNavigateToPage?.(targetPageId);
    }, [onNavigateToPage]);

    // Don't show indicator if there are no translations and this isn't a translation
    const hasTranslations = translations.length > 0;
    const isTranslation = Boolean(translatedFrom);

    if (!hasTranslations && !isTranslation) {
        return null;
    }

    return (
        <div
            className='translation-indicator'
            ref={dropdownRef}
        >
            <button
                type='button'
                className='translation-indicator__trigger'
                onClick={handleToggle}
                aria-expanded={isOpen}
                aria-haspopup='true'
                title={formatMessage({
                    id: 'translation_indicator.title',
                    defaultMessage: 'Page translations',
                })}
                data-testid='translation-indicator-trigger'
            >
                <GlobeIcon size={16}/>
                {isTranslation && translationLanguage ? (
                    <span className='translation-indicator__current-language'>
                        {getLanguageName(translationLanguage)}
                    </span>
                ) : (
                    <span className='translation-indicator__count'>
                        {translations.length}
                    </span>
                )}
                <i className={`icon ${isOpen ? 'icon-chevron-up' : 'icon-chevron-down'}`}/>
            </button>

            {isOpen && (
                <div className='translation-indicator__dropdown'>
                    {isTranslation && translatedFrom && (
                        <div className='translation-indicator__section'>
                            <div className='translation-indicator__section-header'>
                                <FormattedMessage
                                    id='translation_indicator.translated_from'
                                    defaultMessage='Translated from'
                                />
                            </div>
                            <button
                                type='button'
                                className='translation-indicator__option'
                                onClick={() => handleNavigate(translatedFrom)}
                                data-testid='translation-indicator-source'
                            >
                                <GlobeIcon size={14}/>
                                <span>
                                    {(sourcePage?.props?.title as string) || formatMessage({
                                        id: 'translation_indicator.original',
                                        defaultMessage: 'Original page',
                                    })}
                                </span>
                            </button>
                        </div>
                    )}

                    {hasTranslations && (
                        <div className='translation-indicator__section'>
                            <div className='translation-indicator__section-header'>
                                <FormattedMessage
                                    id='translation_indicator.available_in'
                                    defaultMessage='Available in'
                                />
                            </div>
                            {translations.map((translation) => (
                                <button
                                    key={translation.page_id}
                                    type='button'
                                    className='translation-indicator__option'
                                    onClick={() => handleNavigate(translation.page_id)}
                                    data-testid={`translation-indicator-${translation.language_code}`}
                                >
                                    <GlobeIcon size={14}/>
                                    <span>{getLanguageName(translation.language_code)}</span>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default TranslationIndicator;
