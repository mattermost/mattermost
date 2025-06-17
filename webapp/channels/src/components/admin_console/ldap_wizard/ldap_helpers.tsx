// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage, type MessageDescriptor} from 'react-intl';

import WithTooltip from 'components/with_tooltip';

import type {GeneralSettingProps} from './ldap_wizard';

import SchemaText from '../schema_text';

/**
 * LDAP-specific component for rendering help text with hover tooltip
 */
export const LDAPHelpTextWithHover: React.FC<{
    baseText: string | JSX.Element | MessageDescriptor;
    baseIsMarkdown?: boolean;
    baseTextValues?: {[key: string]: any};
    hoverText: string | JSX.Element | MessageDescriptor;
}> = ({baseText, baseIsMarkdown, baseTextValues, hoverText}) => {
    return (
        <>
            <SchemaText
                isMarkdown={baseIsMarkdown}
                text={baseText}
                textValues={baseTextValues}
            />
            {' '}
            <WithTooltip
                className='ldap-help-text-hover-tooltip'
                title={(
                    <SchemaText text={hoverText}/>
                )}
            >
                <button
                    type='button'
                    className='ldap-help-text-more-info'
                >
                    <FormattedMessage
                        id='admin.ldap.more_info'
                        defaultMessage='More Info'
                    />
                </button>
            </WithTooltip>
        </>
    );
};

/**
 * LDAP-specific help text renderer that supports hover text
 */
export const renderLDAPSettingHelpText = (
    setting: GeneralSettingProps['setting'],
    schema: GeneralSettingProps['schema'],
    isDisabled: boolean,
) => {
    if (!schema || setting.type === 'banner' || !setting.help_text) {
        return <span>{''}</span>;
    }

    let helpText;
    let isMarkdown;
    let helpTextValues;
    if ('disabled_help_text' in setting && setting.disabled_help_text && isDisabled) {
        helpText = setting.disabled_help_text;
        isMarkdown = setting.disabled_help_text_markdown;
        helpTextValues = setting.disabled_help_text_values;
    } else {
        helpText = setting.help_text;
        isMarkdown = setting.help_text_markdown;
        helpTextValues = setting.help_text_values;
    }

    // Check if hover text is available (LDAP-specific extension)
    if (setting.help_text_more_info) {
        return (
            <LDAPHelpTextWithHover
                baseText={helpText}
                baseIsMarkdown={isMarkdown}
                baseTextValues={helpTextValues}
                hoverText={setting.help_text_more_info}
            />
        );
    }

    return (
        <SchemaText
            isMarkdown={isMarkdown}
            text={helpText}
            textValues={helpTextValues}
        />
    );
};
