// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback} from 'react';
import {FormattedMessage} from 'react-intl';
import {useSelector} from 'react-redux';
import styled from 'styled-components';

import {getConfig} from 'mattermost-redux/selectors/entities/general';

import {getPrimarySearchButtons, getSecondarySearchButtons} from 'selectors/plugins';

import ErrorBoundary from 'plugins/pluggable/error_boundary';
import {canSearchFiles} from 'utils/file_utils';

import type {GlobalState} from 'types/store';
import type {SearchButtonsComponent} from 'types/store/plugins';

const SearchTypeSelectorContainer = styled.div`
    margin: 20px 20px 0px 20px;
    display: flex;
    align-items: center;
    padding: 3px;
    background-color: var(--center-channel-bg);
    border-radius: var(--radius-m);
    border: var(--border-default);
    width: fit-content;
    gap: 3px;
`;

type SearchTypeItemProps = {
    selected: boolean;
};

const SearchTypeItem = styled.button<SearchTypeItemProps>`
    display: flex;
    cursor: pointer;
    padding: 4px 10px;
    background-color: ${(props) => (props.selected ? 'rgba(var(--button-bg-rgb), 0.08)' : 'transparent')};
    color: ${(props) => (props.selected ? 'var(--button-bg)' : 'rgba(var(--center-channel-color-rgb), 0.75)')};
    border-radius: 4px;
    font-size: 12px;
    line-height: 16px;
    font-weight: 600;
    border: none;
    &:hover {
        color: rgba(var(--center-channel-color-rgb), 0.88);
        background: rgba(var(--center-channel-color-rgb), 0.08);
    }
`;

type Props = {
    searchType: string;
    setSearchType: (searchType: string) => void;
};

const SearchTypeSelector = ({searchType, setSearchType}: Props) => {
    const setMessagesSearchType = useCallback(() => setSearchType('messages'), [setSearchType]);
    const setFilesSearchType = useCallback(() => setSearchType('files'), [setSearchType]);

    const primaryPluginButtons = useSelector(getPrimarySearchButtons);
    const secondaryPluginButtons = useSelector(getSecondarySearchButtons);
    const showFiles = useSelector((state: GlobalState) => canSearchFiles(getConfig(state)));

    const renderPluginButton = ({component, pluginId}: SearchButtonsComponent) => {
        const Component = component as React.ComponentType;
        return (
            <SearchTypeItem
                key={pluginId}
                selected={searchType === pluginId}
                onClick={() => setSearchType(pluginId)}
                role='radio'
                aria-checked={searchType === pluginId}
            >
                <ErrorBoundary pluginId={pluginId}>
                    <Component/>
                </ErrorBoundary>
            </SearchTypeItem>
        );
    };

    return (
        <SearchTypeSelectorContainer
            role='radiogroup'
        >
            {primaryPluginButtons.map(renderPluginButton)}
            <SearchTypeItem
                selected={searchType === 'messages'}
                onClick={setMessagesSearchType}
                role='radio'
                aria-checked={searchType === 'messages'}
            >
                <FormattedMessage
                    id='search_bar.usage.search_type_messages'
                    defaultMessage='Messages'
                />
            </SearchTypeItem>
            {showFiles && (
                <SearchTypeItem
                    selected={searchType === 'files'}
                    onClick={setFilesSearchType}
                    role='radio'
                    aria-checked={searchType === 'files'}
                >
                    <FormattedMessage
                        id='search_bar.usage.search_type_files'
                        defaultMessage='Files'
                    />
                </SearchTypeItem>
            )}
            {secondaryPluginButtons.map(renderPluginButton)}
        </SearchTypeSelectorContainer>
    );
};

export default SearchTypeSelector;
