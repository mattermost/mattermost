// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useIntl} from 'react-intl';

import {useFloatingPortalNode} from '@floating-ui/react-dom-interactions';

import {usePlaybook, usePlaybooksCrud} from 'src/hooks';

import MarkdownTextbox from 'src/components/markdown_textbox';
import {StyledSelect} from 'src/components/backstage/styles';
import CategorySelector from 'src/components/backstage/category_selector';
import ClearIndicator from 'src/components/backstage/playbook_edit/automation/clear_indicator';

interface WelcomeProps {
    message: string;
    onUpdate: (newMessage: string) => void;
    editable: boolean;
}

export const WelcomeActionChildren = ({message, onUpdate, editable}: WelcomeProps) => {
    const {formatMessage} = useIntl();

    return (
        <MarkdownTextbox
            placeholder={formatMessage({defaultMessage: 'Define a message to welcome users joining the channel.'})}
            value={message}
            setValue={onUpdate}
            id={'channel-actions-modal_welcome-msg'}
            hideHelpText={true}
            previewByDefault={!editable}
            disabled={!editable}
        />
    );
};

interface RunPlaybookProps {
    playbookId: string;
    onUpdate: (newPlaybookId: string) => void;
    editable: boolean;
}

interface OptionType {
    id: string;
    value: string;
    label: string;
}

export const RunPlaybookChildren = ({playbookId, onUpdate, editable}: RunPlaybookProps) => {
    const {formatMessage} = useIntl();
    const portalEl = useFloatingPortalNode();
    const [playbook] = usePlaybook(playbookId);
    const {playbooks, params, setSearchTerm} = usePlaybooksCrud({sort: 'title'}, {infinitePaging: false});

    // Format the playbooks for use with StyledSelect.
    const playbookOptions = playbooks?.map((p) => ({value: p.title, label: p.title, id: p.id})) || [];

    // Add the currently selected playbook, unless we're filtering.
    const playbookOptionsWithSelected = playbookOptions;
    if (playbook && params.search_term?.length === 0 && playbookOptions.findIndex((p) => p.id === playbook.id) === -1) {
        playbookOptionsWithSelected.unshift({
            value: playbook.title,
            label: playbook.title,
            id: playbook.id,
        });
    }

    return (
        <StyledSelect
            placeholder={formatMessage({defaultMessage: 'Select a playbook'})}
            onInputChange={setSearchTerm}
            filterOption={() => true}
            onChange={(option: OptionType) => onUpdate(option.id)}
            options={playbookOptionsWithSelected}
            value={playbookOptions?.find((p) => p.id === playbookId)}
            isClearable={false}
            maxMenuHeight={250}
            styles={{indicatorSeparator: () => null}}
            isDisabled={!editable}
            captureMenuScroll={false}
            menuPlacement={'auto'}
        />
    );
};

interface CategorizeChannelProps {
    categoryName: string;
    onUpdate: (newCategoryName: string) => void;
    editable: boolean;
}

export const CategorizeChannelChildren = ({categoryName, onUpdate, editable}: CategorizeChannelProps) => {
    const {formatMessage} = useIntl();

    return (
        <CategorySelector
            id='channel-actions-categorize-playbook-run'
            onCategorySelected={onUpdate}
            categoryName={categoryName}
            isClearable={true}
            selectComponents={{ClearIndicator, IndicatorSeparator: () => null}}
            isDisabled={!editable}
            captureMenuScroll={false}
            shouldRenderValue={true}
            placeholder={formatMessage({defaultMessage: 'Enter category name'})}
        />
    );
};
