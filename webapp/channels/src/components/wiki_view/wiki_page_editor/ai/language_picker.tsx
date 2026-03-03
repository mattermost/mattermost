// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {defineMessage, FormattedMessage, useIntl} from 'react-intl';

import {GlobeIcon} from '@mattermost/compass-icons/components';

import * as Menu from 'components/menu';

export interface Language {
    code: string;
    name: string;
    nativeName: string;
}

// Common languages ordered by global usage
export const COMMON_LANGUAGES: Language[] = [
    {code: 'en', name: 'English', nativeName: 'English'},
    {code: 'es', name: 'Spanish', nativeName: 'Espa\u00f1ol'},
    {code: 'zh', name: 'Chinese', nativeName: '\u4e2d\u6587'},
    {code: 'hi', name: 'Hindi', nativeName: '\u0939\u093f\u0928\u094d\u0926\u0940'},
    {code: 'ar', name: 'Arabic', nativeName: '\u0627\u0644\u0639\u0631\u0628\u064a\u0629'},
    {code: 'pt', name: 'Portuguese', nativeName: 'Portugu\u00eas'},
    {code: 'fr', name: 'French', nativeName: 'Fran\u00e7ais'},
    {code: 'de', name: 'German', nativeName: 'Deutsch'},
    {code: 'ja', name: 'Japanese', nativeName: '\u65e5\u672c\u8a9e'},
    {code: 'ru', name: 'Russian', nativeName: '\u0420\u0443\u0441\u0441\u043a\u0438\u0439'},
    {code: 'ko', name: 'Korean', nativeName: '\ud55c\uad6d\uc5b4'},
    {code: 'it', name: 'Italian', nativeName: 'Italiano'},
    {code: 'nl', name: 'Dutch', nativeName: 'Nederlands'},
    {code: 'pl', name: 'Polish', nativeName: 'Polski'},
    {code: 'tr', name: 'Turkish', nativeName: 'T\u00fcrk\u00e7e'},
    {code: 'vi', name: 'Vietnamese', nativeName: 'Ti\u1ebfng Vi\u1ec7t'},
    {code: 'th', name: 'Thai', nativeName: '\u0e44\u0e17\u0e22'},
    {code: 'uk', name: 'Ukrainian', nativeName: '\u0423\u043a\u0440\u0430\u0457\u043d\u0441\u044c\u043a\u0430'},
    {code: 'he', name: 'Hebrew', nativeName: '\u05e2\u05d1\u05e8\u05d9\u05ea'},
    {code: 'sv', name: 'Swedish', nativeName: 'Svenska'},
];

// Languages shown in the quick-access list (first 6)
export const QUICK_ACCESS_LANGUAGES = COMMON_LANGUAGES.slice(0, 6);

export interface LanguagePickerProps {
    onSelectLanguage: (language: Language) => void;
    disabled?: boolean;
}

const translateLabel = defineMessage({
    id: 'wiki.ai.translate',
    defaultMessage: 'Translate to...',
});

export function LanguagePickerSubmenu({onSelectLanguage}: LanguagePickerProps) {
    const {formatMessage} = useIntl();

    return (
        <Menu.SubMenu
            id='translate-submenu'
            labels={<FormattedMessage {...translateLabel}/>}
            leadingElement={<GlobeIcon size={18}/>}
            menuId='translate-language-menu'
            menuAriaLabel={formatMessage({
                id: 'wiki.ai.translate.menu',
                defaultMessage: 'Select language',
            })}
        >
            {QUICK_ACCESS_LANGUAGES.map((lang) => (
                <Menu.Item
                    key={`translate-${lang.code}`}
                    labels={<span>{`${lang.name} (${lang.nativeName})`}</span>}
                    onClick={() => onSelectLanguage(lang)}
                    data-testid={`translate-to-${lang.code}`}
                />
            ))}
            <Menu.Separator/>
            <Menu.SubMenu
                id='translate-more-submenu'
                labels={(
                    <FormattedMessage
                        id='wiki.ai.translate.more'
                        defaultMessage='More languages...'
                    />
                )}
                menuId='translate-more-languages-menu'
                menuAriaLabel={formatMessage({
                    id: 'wiki.ai.translate.more.menu',
                    defaultMessage: 'More languages',
                })}
            >
                {COMMON_LANGUAGES.slice(6).map((lang) => (
                    <Menu.Item
                        key={`translate-more-${lang.code}`}
                        labels={<span>{`${lang.name} (${lang.nativeName})`}</span>}
                        onClick={() => onSelectLanguage(lang)}
                        data-testid={`translate-to-${lang.code}`}
                    />
                ))}
            </Menu.SubMenu>
        </Menu.SubMenu>
    );
}

export default LanguagePickerSubmenu;
