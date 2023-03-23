// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';
import debounce from 'lodash/debounce';
import {Tabs, Tab, SelectCallback} from 'react-bootstrap';

import {PluginStatusRedux} from '@mattermost/types/plugins';
import type {MarketplaceApp, MarketplacePlugin} from '@mattermost/types/marketplace';

import FullScreenModal from 'components/widgets/modals/full_screen_modal';
import RootPortal from 'components/root_portal';
import QuickInput from 'components/quick_input';
import LocalizedInput from 'components/localized_input/localized_input';
import PluginIcon from 'components/widgets/icons/plugin_icon';
import LoadingScreen from 'components/loading_screen';
import FormattedMarkdownMessage from 'components/formatted_markdown_message';

import {trackEvent} from 'actions/telemetry_actions.jsx';
import {t} from 'utils/i18n';
import {localizeMessage} from 'utils/utils';

import './marketplace_modal.scss';
import MarketplaceList from './marketplace_list/marketplace_list';

const MarketplaceTabs = {
    ALL_LISTING: 'allListing',
    INSTALLED_LISTING: 'installed',
};

const SEARCH_TIMEOUT_MILLISECONDS = 200;

type AllListingProps = {
    listing: Array<MarketplacePlugin | MarketplaceApp>;
};

// AllListing renders the contents of the all listing tab.
export const AllListing = ({listing}: AllListingProps): JSX.Element => {
    if (listing.length === 0) {
        return (
            <div className='no_plugins_div'>
                <br/>
                <PluginIcon className='icon__plugin'/>
                <div className='mt-3 light'>
                    <FormattedMessage
                        id='marketplace_modal.no_plugins'
                        defaultMessage='There are no plugins available at this time.'
                    />
                </div>
            </div>
        );
    }

    return <MarketplaceList listing={listing}/>;
};

type InstalledListingProps = {
    installedItems: Array<MarketplacePlugin | MarketplaceApp>;
    changeTab: SelectCallback;
};

// InstalledListing renders the contents of the installed listing tab.
export const InstalledListing = ({installedItems, changeTab}: InstalledListingProps): JSX.Element => {
    if (installedItems.length === 0) {
        return (
            <div className='no_plugins_div'>
                <br/>
                <PluginIcon className='icon__plugin'/>
                <div className='mt-3 light'>
                    <FormattedMessage
                        id='marketplace_modal.no_plugins_installed'
                        defaultMessage='You do not have any plugins installed.'
                    />
                </div>
                <button
                    className='mt-5 style--none color--link'
                    onClick={() => changeTab(MarketplaceTabs.ALL_LISTING)}
                    data-testid='Install-Plugins-button'
                >
                    <FormattedMessage
                        id='marketplace_modal.install_plugins'
                        defaultMessage='Install Plugins'
                    />
                </button>
            </div>
        );
    }

    return <MarketplaceList listing={installedItems}/>;
};

export type MarketplaceModalProps = {
    show: boolean;
    listing: Array<MarketplacePlugin | MarketplaceApp>;
    installedListing: Array<MarketplacePlugin | MarketplaceApp>;
    siteURL: string;
    pluginStatuses?: Record<string, PluginStatusRedux>;
    firstAdminVisitMarketplaceStatus: boolean;
    actions: {
        closeModal: () => void;
        fetchListing(localOnly?: boolean): Promise<{error?: Error}>;
        filterListing(filter: string): Promise<{error?: Error}>;
        setFirstAdminVisitMarketplaceStatus(): Promise<void>;
        getPluginStatuses(): Promise<void>;
    };
};

type MarketplaceModalState = {
    tabKey: unknown;
    loading: boolean;
    serverError?: Error;
    filter: string;
};

// MarketplaceModal is the marketplace modal.
export default class MarketplaceModal extends React.PureComponent<MarketplaceModalProps, MarketplaceModalState> {
    private filterRef: React.RefObject<HTMLInputElement>;

    constructor(props: MarketplaceModalProps) {
        super(props);

        this.state = {
            tabKey: MarketplaceTabs.ALL_LISTING,
            loading: true,
            serverError: undefined,
            filter: '',
        };

        this.filterRef = React.createRef();
    }

    componentDidMount(): void {
        trackEvent('plugins', 'ui_marketplace_opened');

        this.fetchListing();
        this.props.actions.getPluginStatuses();
        if (!this.props.firstAdminVisitMarketplaceStatus) {
            trackEvent('plugins', 'ui_first_admin_visit_marketplace_status');

            this.props.actions.setFirstAdminVisitMarketplaceStatus();
        }

        this.filterRef.current?.focus();
    }

    componentDidUpdate(prevProps: MarketplaceModalProps): void {
        // Automatically refresh the component when a plugin is installed or uninstalled.
        if (this.props.pluginStatuses !== prevProps.pluginStatuses) {
            this.fetchListing();
        }
    }

    fetchListing = async (): Promise<void> => {
        const {error} = await this.props.actions.fetchListing();
        this.setState({loading: false, serverError: error});
    }

    close = (): void => {
        trackEvent('plugins', 'ui_marketplace_closed');
        this.props.actions.closeModal();
    }

    changeTab: SelectCallback = (tabKey: any): void => {
        this.setState({tabKey});
    }

    onInput = (): void => {
        if (this.filterRef.current) {
            this.setState({filter: this.filterRef.current.value});

            this.debouncedSearch();
        }
    }

    handleClearSearch = (): void => {
        if (this.filterRef.current) {
            this.filterRef.current.value = '';
            this.setState({filter: this.filterRef.current.value}, this.doSearch);
        }
    }

    doSearch = async (): Promise<void> => {
        trackEvent('plugins', 'ui_marketplace_search', {filter: this.state.filter});

        const {error} = await this.props.actions.filterListing(this.state.filter);

        this.setState({serverError: error});
    }

    debouncedSearch = debounce(this.doSearch, SEARCH_TIMEOUT_MILLISECONDS);

    render(): JSX.Element {
        const input = (
            <div className='filter-row filter-row--full'>
                <div className='col-sm-12'>
                    <QuickInput
                        id='searchMarketplaceTextbox'
                        ref={this.filterRef}
                        className='form-control filter-textbox search_input'
                        placeholder={{id: t('marketplace_modal.search'), defaultMessage: 'Search Marketplace'}}
                        inputComponent={LocalizedInput}
                        onInput={this.onInput}
                        value={this.state.filter}
                        clearable={true}
                        onClear={this.handleClearSearch}
                    />
                </div>
            </div>
        );

        let errorBanner = null;
        if (this.state.serverError) {
            errorBanner = (
                <div
                    className='error-bar'
                    id='error_bar'
                >
                    <div className='error-bar__content'>
                        <FormattedMarkdownMessage
                            id='app.plugin.marketplace_plugins.app_error'
                            defaultMessage='Error connecting to the marketplace server. Please check your settings in the [System Console]({siteURL}/admin_console/plugins/plugin_management).'
                            values={{siteURL: this.props.siteURL}}
                        />
                    </div>
                </div>
            );
        }

        return (
            <RootPortal>
                <FullScreenModal
                    show={this.props.show}
                    onClose={this.close}
                    ariaLabel={localizeMessage('marketplace_modal.title', 'Marketplace')}
                >
                    {errorBanner}
                    <div
                        className='modal-marketplace'
                        id='modal_marketplace'
                    >
                        <h1>
                            <strong>
                                <FormattedMessage
                                    id='marketplace_modal.title'
                                    defaultMessage='Marketplace'
                                />
                            </strong>
                        </h1>
                        {input}
                        <Tabs
                            id='marketplaceTabs'
                            className='tabs'
                            defaultActiveKey={MarketplaceTabs.ALL_LISTING}
                            activeKey={this.state.tabKey}
                            onSelect={this.changeTab}
                            unmountOnExit={true}
                        >
                            <Tab
                                eventKey={MarketplaceTabs.ALL_LISTING}
                                title={localizeMessage('marketplace_modal.tabs.all_listing', 'All')}
                            >
                                {this.state.loading ? <LoadingScreen/> : <AllListing listing={this.props.listing}/>}
                            </Tab>
                            <Tab
                                eventKey={MarketplaceTabs.INSTALLED_LISTING}
                                title={localizeMessage('marketplace_modal.tabs.installed_listing', 'Installed') + ` (${this.props.installedListing.length})`}
                            >
                                <InstalledListing
                                    installedItems={this.props.installedListing}
                                    changeTab={this.changeTab}
                                />
                            </Tab>
                        </Tabs>
                    </div>
                </FullScreenModal>
            </RootPortal>
        );
    }
}
