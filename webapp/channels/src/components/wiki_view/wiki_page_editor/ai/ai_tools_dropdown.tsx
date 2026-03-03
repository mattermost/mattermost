// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useMemo} from 'react';
import {useIntl} from 'react-intl';

import CheckCircleOutlineIcon from '@mattermost/compass-icons/components/check-circle-outline';
import ChevronDownIcon from '@mattermost/compass-icons/components/chevron-down';
import CreationOutlineIcon from '@mattermost/compass-icons/components/creation-outline';
import GlobeIcon from '@mattermost/compass-icons/components/globe';

import * as Menu from 'components/menu';

import './ai_tools_dropdown.scss';

type Props = {
    onProofread: () => void;
    onTranslatePage?: () => void;
    isProcessing?: boolean;
    disabled?: boolean;
};

/**
 * AI Tools dropdown for page-level AI operations.
 * Appears in the page header/toolbar when AI is available.
 */
const AIToolsDropdown = ({
    onProofread,
    onTranslatePage,
    isProcessing = false,
    disabled = false,
}: Props) => {
    const {formatMessage} = useIntl();

    const handleProofreadClick = useCallback(() => {
        if (!isProcessing && !disabled) {
            onProofread();
        }
    }, [onProofread, isProcessing, disabled]);

    const handleTranslatePageClick = useCallback(() => {
        if (!isProcessing && !disabled && onTranslatePage) {
            onTranslatePage();
        }
    }, [onTranslatePage, isProcessing, disabled]);

    const menuConfig = useMemo(() => ({
        id: 'ai-tools-dropdown-menu',
        'aria-label': formatMessage({id: 'ai_tools.menu_aria_label', defaultMessage: 'AI tools'}),
        width: '220px',
    }), [formatMessage]);

    const menuButtonConfig = useMemo(() => ({
        id: 'ai-tools-dropdown-button',
        'aria-label': formatMessage({id: 'ai_tools.button_aria_label', defaultMessage: 'AI tools'}),
        disabled: disabled || isProcessing,
        class: 'ai-tools-dropdown-button',
        children: (
            <>
                <CreationOutlineIcon size={16}/>
                <span className='ai-tools-dropdown-button-text'>
                    {isProcessing ?
                        formatMessage({id: 'ai_tools.processing', defaultMessage: 'Processing...'}) :
                        formatMessage({id: 'ai_tools.button_label', defaultMessage: 'AI'})
                    }
                </span>
                <ChevronDownIcon size={12}/>
            </>
        ),
    }), [formatMessage, disabled, isProcessing]);

    const menuHeaderElement = useMemo(() => (
        <div className='ai-tools-dropdown-menu-header'>
            {formatMessage({id: 'ai_tools.header', defaultMessage: 'AI TOOLS'})}
        </div>
    ), [formatMessage]);

    return (
        <div
            className='ai-tools-dropdown'
            data-testid='tiptap-ai-toolbar'
        >
            <Menu.Container
                menu={menuConfig}
                menuButton={menuButtonConfig}
                menuHeader={menuHeaderElement}
            >
                <Menu.Item
                    id='ai-proofread-page'
                    data-testid='ai-proofread-page'
                    leadingElement={<CheckCircleOutlineIcon size={18}/>}
                    labels={
                        <span>
                            {formatMessage({id: 'ai_tools.proofread_page', defaultMessage: 'Proofread page'})}
                        </span>
                    }
                    onClick={handleProofreadClick}
                    disabled={isProcessing || disabled}
                />
                {onTranslatePage && (
                    <Menu.Item
                        id='ai-translate-page'
                        data-testid='ai-translate-page'
                        leadingElement={<GlobeIcon size={18}/>}
                        labels={
                            <span>
                                {formatMessage({id: 'ai_tools.translate_page', defaultMessage: 'Translate page...'})}
                            </span>
                        }
                        onClick={handleTranslatePageClick}
                        disabled={isProcessing || disabled}
                    />
                )}
            </Menu.Container>
        </div>
    );
};

export default AIToolsDropdown;
