// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useMemo} from 'react';
import {useIntl} from 'react-intl';

import type {MarketplacePlugin} from '@mattermost/types/marketplace';

import {getName} from 'mattermost-redux/utils/marketplace';

import PluginIcon from 'components/widgets/icons/plugin_icon';

import MarketplaceItemPlugin from '../marketplace_item/marketplace_item_plugin';

export const ITEMS_PER_PAGE = 15;

type MarketplaceListProps = {
    listing: MarketplacePlugin[];
    page: number;
    noResultsMessage: string;
    noResultsAction?: {
        label: string;
        onClick: () => void;
    };
    filter?: string;
    listRef?: React.RefObject<HTMLDivElement>;
};

const MarketplaceList = ({
    listing,
    page,
    noResultsMessage,
    noResultsAction,
    filter,
    listRef,
}: MarketplaceListProps) => {
    const {formatMessage} = useIntl();

    const pageItems = useMemo(() => {
        if (listing.length === 0) {
            return [];
        }

        const pageStart = page * ITEMS_PER_PAGE;
        const pageEnd = pageStart + ITEMS_PER_PAGE;

        return [...listing].
            sort((a, b) => getName(a).localeCompare(getName(b))).
            slice(pageStart, pageEnd).
            map((i) => (
                <MarketplaceItemPlugin
                    key={i.manifest.id}
                    id={i.manifest.id}
                    name={i.manifest.name}
                    description={i.manifest.description}
                    version={i.manifest.version}
                    homepageUrl={i.homepage_url}
                    releaseNotesUrl={i.release_notes_url}
                    labels={i.labels}
                    iconData={i.icon_data}
                    installedVersion={i.installed_version}
                />
            ));
    }, [listing, page]);

    const getNoResultsMessage = useCallback(() => (
        filter ? (
            formatMessage(
                {id: 'marketplace_modal_list.no_plugins_filter', defaultMessage: 'No results for "{filter}"'},
                {filter},
            )
        ) : (
            noResultsMessage
        )
    ), [filter, noResultsMessage]);

    return (listing.length === 0 ? (
        <div className='no_plugins'>
            <PluginIcon className='icon__plugin'/>
            <div className='no_plugins__message'>
                {getNoResultsMessage()}
            </div>
            {noResultsAction && (
                <button
                    className='no_plugins__action'
                    onClick={noResultsAction.onClick}
                    data-testid='Install-Plugins-button'
                >
                    {noResultsAction.label}
                </button>
            )}
        </div>
    ) : (
        <div
            ref={listRef}
            className='more-modal__list'
        >
            {pageItems}
        </div>
    ));
};

export default MarketplaceList;
