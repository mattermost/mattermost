// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {MarketplaceApp, MarketplacePlugin} from '@mattermost/types/marketplace';
import {isPlugin, getName} from 'mattermost-redux/utils/marketplace';

import MarketplaceItemPlugin from '../marketplace_item/marketplace_item_plugin';
import MarketplaceItemApp from '../marketplace_item/marketplace_item_app';

import NavigationRow from './navigation_row';

const ITEMS_PER_PAGE = 15;

type MarketplaceListProps = {
    listing: Array<MarketplacePlugin | MarketplaceApp>;
};

type MarketplaceListState = {
    page: number;
};

export default class MarketplaceList extends React.PureComponent <MarketplaceListProps, MarketplaceListState> {
    static getDerivedStateFromProps(props: MarketplaceListProps, state: MarketplaceListState): MarketplaceListState | null {
        if (state.page > 0 && props.listing.length < ITEMS_PER_PAGE) {
            return {page: 0};
        }

        return null;
    }

    constructor(props: MarketplaceListProps) {
        super(props);

        this.state = {
            page: 0,
        };
    }

    nextPage = (): void => {
        this.setState((state) => ({
            page: state.page + 1,
        }));
    };

    previousPage = (): void => {
        this.setState((state) => ({
            page: state.page - 1,
        }));
    };

    render(): JSX.Element {
        const pageStart = this.state.page * ITEMS_PER_PAGE;
        const pageEnd = pageStart + ITEMS_PER_PAGE;

        this.props.listing.sort((a, b) => {
            return getName(a).localeCompare(getName(b));
        });

        const itemsToDisplay = this.props.listing.slice(pageStart, pageEnd);

        return (
            <div className='more-modal__list'>
                {itemsToDisplay.map((i) => {
                    if (isPlugin(i)) {
                        return (
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
                        );
                    }

                    return (
                        <MarketplaceItemApp
                            key={i.manifest.app_id}
                            id={i.manifest.app_id}
                            name={i.manifest.display_name}
                            description={i.manifest.description}
                            homepageUrl={i.manifest.homepage_url}
                            iconURL={i.icon_url}
                            installed={i.installed}
                            labels={i.labels}
                        />
                    );
                })
                }
                <NavigationRow
                    page={this.state.page}
                    total={this.props.listing.length}
                    maximumPerPage={ITEMS_PER_PAGE}
                    onNextPageButtonClick={this.nextPage}
                    onPreviousPageButtonClick={this.previousPage}
                />
            </div>
        );
    }
}
