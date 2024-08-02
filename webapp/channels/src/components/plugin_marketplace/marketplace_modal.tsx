// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import debounce from 'lodash/debounce';
import React, {useCallback, useEffect, useRef, useState} from 'react';
import type {ReactNode} from 'react';
import {Tabs, Tab} from 'react-bootstrap';
import type {SelectCallback} from 'react-bootstrap';
import {useIntl} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';
import {Link} from 'react-router-dom';

import {MagnifyIcon} from '@mattermost/compass-icons/components';
import {FooterPagination, GenericModal} from '@mattermost/components';

import {getPluginStatuses} from 'mattermost-redux/actions/admin';
import {setFirstAdminVisitMarketplaceStatus} from 'mattermost-redux/actions/general';
import {getFirstAdminVisitMarketplaceStatus, getLicense} from 'mattermost-redux/selectors/entities/general';
import {streamlinedMarketplaceEnabled} from 'mattermost-redux/selectors/entities/preferences';

import {fetchListing, filterListing} from 'actions/marketplace';
import {trackEvent} from 'actions/telemetry_actions.jsx';
import {closeModal} from 'actions/views/modals';
import {getListing, getInstalledListing} from 'selectors/views/marketplace';
import {isModalOpen} from 'selectors/views/modals';

import LoadingScreen from 'components/loading_screen';
import Input, {SIZE} from 'components/widgets/inputs/input/input';

import {ModalIdentifiers} from 'utils/constants';
import {isCloudLicense} from 'utils/license_utils';

import type {GlobalState} from 'types/store';

import MarketplaceList, {ITEMS_PER_PAGE} from './marketplace_list/marketplace_list';
import WebMarketplaceBanner from './web_marketplace_banner';

import './marketplace_modal.scss';

const MarketplaceTabs = {
    ALL_LISTING: 'all',
    INSTALLED_LISTING: 'installed',
};

const SEARCH_TIMEOUT_MILLISECONDS = 200;

const linkConsole = (msg: string): ReactNode => (
    <Link to='/admin_console/plugins/plugin_management'>
        {msg}
    </Link>
);

export type OpenedFromType = 'actions_menu' | 'app_bar' | 'channel_header' | 'command' | 'open_plugin_install_post' | 'product_menu';

type MarketplaceModalProps = {
    openedFrom: OpenedFromType;
}

const MarketplaceModal = ({
    openedFrom,
}: MarketplaceModalProps) => {
    const dispatch = useDispatch();
    const {formatMessage} = useIntl();
    const listRef = useRef<HTMLDivElement>(null);

    const show = useSelector((state: GlobalState) => isModalOpen(state, ModalIdentifiers.PLUGIN_MARKETPLACE));
    const listing = useSelector(getListing);
    const installedListing = useSelector(getInstalledListing);
    const pluginStatuses = useSelector((state: GlobalState) => state.entities.admin.pluginStatuses);
    const hasFirstAdminVisitedMarketplace = useSelector(getFirstAdminVisitMarketplaceStatus);
    const isStreamlinedMarketplaceEnabled = useSelector(streamlinedMarketplaceEnabled);
    const license = useSelector(getLicense);
    const isCloud = isCloudLicense(license);

    const [tabKey, setTabKey] = useState(MarketplaceTabs.ALL_LISTING);
    const [filter, setFilter] = useState('');
    const [page, setPage] = useState(0);
    const [hasLoaded, setHasLoaded] = useState(false);
    const [loading, setLoading] = React.useState(true);
    const [serverError, setServerError] = React.useState(false);

    const doFetchListing = useCallback(async () => {
        const {error} = await dispatch(fetchListing());

        if (error) {
            setServerError(true);
        }

        setLoading(false);
    }, []);

    const doSearch = useCallback(async () => {
        trackEvent('plugins', 'ui_marketplace_search', {filter});

        const {error} = await dispatch(filterListing(filter));

        if (error) {
            setServerError(true);
        }
    }, [filter]);

    const debouncedSearch = debounce(doSearch, SEARCH_TIMEOUT_MILLISECONDS);

    useEffect(() => {
        async function doFetch() {
            await dispatch(getPluginStatuses());
            await doFetchListing();
            setHasLoaded(true);
        }

        trackEvent('plugins', 'ui_marketplace_opened', {from: openedFrom});

        if (!hasFirstAdminVisitedMarketplace) {
            trackEvent('plugins', 'ui_first_admin_visit_marketplace_status');
            dispatch(setFirstAdminVisitMarketplaceStatus());
        }

        doFetch();
    }, []);

    useEffect(() => {
        if (hasLoaded) {
            doFetchListing();
        }
    }, [pluginStatuses]);

    useEffect(() => {
        if (hasLoaded) {
            debouncedSearch();
            setPage(0);
        }
    }, [filter]);

    const scrollListToTop = useCallback(() => {
        if (listRef.current) {
            listRef.current.scrollTop = 0;
        }
    }, []);

    const handleOnClose = () => {
        trackEvent('plugins', 'ui_marketplace_closed');
        dispatch(closeModal(ModalIdentifiers.PLUGIN_MARKETPLACE));
    };

    const handleChangeTab: SelectCallback = useCallback((tabKey) => {
        setTabKey(tabKey);
        setPage(0);
        scrollListToTop();
    }, [scrollListToTop]);

    const handleOnChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
        setFilter(event.target.value);
    }, []);

    const handleOnClear = useCallback(() => {
        setFilter('');
    }, []);

    const handleOnNextPage = useCallback(() => {
        setPage(page + 1);
        scrollListToTop();
    }, [page, scrollListToTop]);

    const handleOnPreviousPage = useCallback(() => {
        setPage(page - 1);
        scrollListToTop();
    }, [page, scrollListToTop]);

    const handleNoResultsButtonClick = useCallback(() => {
        handleChangeTab(MarketplaceTabs.ALL_LISTING);
    }, [handleChangeTab]);

    const getHeaderInput = useCallback(() => {
        if (isStreamlinedMarketplaceEnabled) {
            return null;
        }

        return (
            <Input
                id='searchMarketplaceTextbox'
                name='searchMarketplaceTextbox'
                containerClassName='marketplace-modal-search'
                inputClassName='search_input'
                type='text'
                inputSize={SIZE.LARGE}
                inputPrefix={<MagnifyIcon size={24}/>}
                placeholder={formatMessage({id: 'marketplace_modal.search', defaultMessage: 'Search marketplace'})}
                useLegend={false}
                autoFocus={true}
                clearable={true}
                value={filter}
                onChange={handleOnChange}
                onClear={handleOnClear}
            />
        );
    }, [filter, handleOnChange, handleOnClear]);

    const getFooterContent = useCallback(() => {
        if (isStreamlinedMarketplaceEnabled && listing.length <= ITEMS_PER_PAGE) {
            return null;
        }

        return (
            <FooterPagination
                page={page}
                total={tabKey === MarketplaceTabs.ALL_LISTING ? listing.length : installedListing.length}
                itemsPerPage={ITEMS_PER_PAGE}
                onNextPage={handleOnNextPage}
                onPreviousPage={handleOnPreviousPage}
            />
        );
    }, [installedListing.length, listing.length, page, handleOnNextPage, handleOnPreviousPage, tabKey, isStreamlinedMarketplaceEnabled]);

    const getAppendedContent = useCallback(() => {
        if (!isStreamlinedMarketplaceEnabled || isCloud) {
            return null;
        }

        return <WebMarketplaceBanner/>;
    }, [isStreamlinedMarketplaceEnabled, isCloud]);

    return (
        <GenericModal
            id='marketplace-modal'
            className={classNames('marketplace-modal', {
                'streamlined-marketplace': isStreamlinedMarketplaceEnabled,
                'with-web-marketplace-link': isStreamlinedMarketplaceEnabled && !isCloud,
            })}
            modalHeaderText={formatMessage({id: 'marketplace_modal.title', defaultMessage: 'App Marketplace'})}
            ariaLabel={formatMessage({id: 'marketplace_modal.title', defaultMessage: 'App Marketplace'})}
            errorText={serverError ? (
                formatMessage(
                    {
                        id: 'marketplace_modal.app_error',
                        defaultMessage: 'Error connecting to the marketplace server. Please check your settings in the <linkConsole>System Console</linkConsole>.',
                    },
                    {linkConsole},
                )
            ) : undefined}
            show={show}
            compassDesign={true}
            bodyPadding={false}
            bodyDivider={isStreamlinedMarketplaceEnabled}
            footerDivider={true}
            onExited={handleOnClose}
            footerContent={getFooterContent()}
            appendedContent={getAppendedContent()}
            headerInput={getHeaderInput()}
        >
            {isStreamlinedMarketplaceEnabled ? (
                <>
                    {loading ? (
                        <LoadingScreen className='loading'/>
                    ) : (
                        <MarketplaceList
                            listRef={listRef}
                            listing={listing}
                            page={page}
                            filter={filter}
                            noResultsMessage={formatMessage({id: 'marketplace_modal.no_plugins', defaultMessage: 'No plugins found'})}
                        />
                    )}
                </>
            ) : (
                <Tabs
                    id='marketplaceTabs'
                    className='tabs'
                    defaultActiveKey={MarketplaceTabs.ALL_LISTING}
                    activeKey={tabKey}
                    onSelect={handleChangeTab}
                    unmountOnExit={true}
                >
                    <Tab
                        eventKey={MarketplaceTabs.ALL_LISTING}
                        title={formatMessage({id: 'marketplace_modal.tabs.all_listing', defaultMessage: 'All'})}
                    >
                        {loading ? (
                            <LoadingScreen className='loading'/>
                        ) : (
                            <MarketplaceList
                                listRef={listRef}
                                listing={listing}
                                page={page}
                                filter={filter}
                                noResultsMessage={formatMessage({id: 'marketplace_modal.no_plugins', defaultMessage: 'No plugins found'})}
                            />
                        )}
                    </Tab>
                    <Tab
                        eventKey={MarketplaceTabs.INSTALLED_LISTING}
                        title={formatMessage(
                            {id: 'marketplace_modal.tabs.installed_listing', defaultMessage: 'Installed ({count})'},
                            {count: installedListing.length},
                        )}
                    >
                        <MarketplaceList
                            listRef={listRef}
                            listing={installedListing}
                            page={page}
                            filter={filter}
                            noResultsMessage={formatMessage({
                                id: 'marketplace_modal.no_plugins_installed',
                                defaultMessage: 'No plugins installed found',
                            })}
                            noResultsAction={{
                                label: formatMessage({id: 'marketplace_modal.install_plugins', defaultMessage: 'Install plugins'}),
                                onClick: handleNoResultsButtonClick,
                            }}
                        />
                    </Tab>
                </Tabs>
            )}
        </GenericModal>
    );
};

export default MarketplaceModal;
