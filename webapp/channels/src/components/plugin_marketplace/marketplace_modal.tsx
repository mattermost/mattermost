// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React, {useCallback, useEffect, useRef, useState} from 'react';
import type {ReactNode} from 'react';
import {useIntl} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';
import {Link} from 'react-router-dom';

import {FooterPagination, GenericModal} from '@mattermost/components';

import {getPluginStatuses} from 'mattermost-redux/actions/admin';
import {setFirstAdminVisitMarketplaceStatus} from 'mattermost-redux/actions/general';
import {getFirstAdminVisitMarketplaceStatus, getLicense} from 'mattermost-redux/selectors/entities/general';

import {fetchListing} from 'actions/marketplace';
import {closeModal} from 'actions/views/modals';
import {getListing} from 'selectors/views/marketplace';
import {isModalOpen} from 'selectors/views/modals';

import usePluginStatusesSync from 'components/common/hooks/usePluginStatusesSync';
import LoadingScreen from 'components/loading_screen';

import {ModalIdentifiers} from 'utils/constants';
import {isCloudLicense} from 'utils/license_utils';

import type {GlobalState} from 'types/store';

import MarketplaceList, {ITEMS_PER_PAGE} from './marketplace_list/marketplace_list';
import WebMarketplaceBanner from './web_marketplace_banner';

import './marketplace_modal.scss';

const linkConsole = (msg: ReactNode[]): ReactNode => (
    <Link to='/admin_console/plugins/plugin_management'>
        {msg}
    </Link>
);

const MarketplaceModal = () => {
    const dispatch = useDispatch();
    const {formatMessage} = useIntl();
    const listRef = useRef<HTMLDivElement>(null);

    const show = useSelector((state: GlobalState) => isModalOpen(state, ModalIdentifiers.PLUGIN_MARKETPLACE));
    const listing = useSelector(getListing);

    // Refetch plugin statuses while the modal is open whenever the server signals a change.
    const pluginStatuses = usePluginStatusesSync();
    const hasFirstAdminVisitedMarketplace = useSelector(getFirstAdminVisitMarketplaceStatus);
    const license = useSelector(getLicense);
    const isCloud = isCloudLicense(license);

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

    useEffect(() => {
        async function doFetch() {
            await dispatch(getPluginStatuses());
            await doFetchListing();
            setHasLoaded(true);
        }

        if (!hasFirstAdminVisitedMarketplace) {
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
        const maxPage = Math.max(0, Math.ceil(listing.length / ITEMS_PER_PAGE) - 1);
        if (page > maxPage) {
            setPage(maxPage);
        }
    }, [listing.length, page]);

    const scrollListToTop = useCallback(() => {
        if (listRef.current) {
            listRef.current.scrollTop = 0;
        }
    }, []);

    const handleOnClose = () => {
        dispatch(closeModal(ModalIdentifiers.PLUGIN_MARKETPLACE));
    };

    const handleOnNextPage = useCallback(() => {
        setPage(page + 1);
        scrollListToTop();
    }, [page, scrollListToTop]);

    const handleOnPreviousPage = useCallback(() => {
        setPage(page - 1);
        scrollListToTop();
    }, [page, scrollListToTop]);

    const getFooterContent = useCallback(() => {
        if (listing.length <= ITEMS_PER_PAGE) {
            return null;
        }

        return (
            <FooterPagination
                page={page}
                total={listing.length}
                itemsPerPage={ITEMS_PER_PAGE}
                onNextPage={handleOnNextPage}
                onPreviousPage={handleOnPreviousPage}
            />
        );
    }, [listing.length, page, handleOnNextPage, handleOnPreviousPage]);

    const getAppendedContent = useCallback(() => {
        if (isCloud) {
            return null;
        }

        return <WebMarketplaceBanner/>;
    }, [isCloud]);

    return (
        <GenericModal
            id='marketplace-modal'
            className={classNames('marketplace-modal', 'streamlined-marketplace', {
                'with-web-marketplace-link': !isCloud,
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
            bodyDivider={true}
            footerDivider={true}
            onExited={handleOnClose}
            footerContent={getFooterContent()}
            appendedContent={getAppendedContent()}
        >
            {loading ? (
                <LoadingScreen className='loading'/>
            ) : (
                <MarketplaceList
                    listRef={listRef}
                    listing={listing}
                    page={page}
                    noResultsMessage={formatMessage({id: 'marketplace_modal.no_plugins', defaultMessage: 'No plugins found'})}
                />
            )}
        </GenericModal>
    );
};

export default MarketplaceModal;
