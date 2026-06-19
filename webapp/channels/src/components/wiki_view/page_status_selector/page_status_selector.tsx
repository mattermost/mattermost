// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useEffect} from 'react';
import {useIntl} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';

import {fetchPageStatusField, updatePageStatus} from 'actions/pages';
import {getPageStatusField, getPageStatus, getPage} from 'selectors/pages';

import {SelectableSelectPropertyRenderer} from 'components/properties_card_view/propertyValueRenderer/select_property_renderer/selectable_select_property_renderer';
import type {SelectPropertyMetadata} from 'components/properties_card_view/propertyValueRenderer/select_property_renderer/selectable_select_property_renderer';

import type {GlobalState} from 'types/store';

import './page_status_selector.scss';

type Props = {
    pageId: string;
    isDraft?: boolean;
    draftStatus?: string;
    onDraftStatusChange?: (status: string) => void;
};

const PageStatusSelector = ({pageId, isDraft, draftStatus, onDraftStatusChange}: Props) => {
    const dispatch = useDispatch();
    const {formatMessage} = useIntl();

    const statusField = useSelector((state: GlobalState) => getPageStatusField(state));
    const publishedPageStatus = useSelector((state: GlobalState) => getPageStatus(state, pageId));
    const pageWikiId = useSelector((state: GlobalState) => getPage(state, pageId)?.wiki_id);

    // Use draftStatus for drafts, publishedPageStatus for published pages
    const currentStatus = isDraft ? draftStatus : publishedPageStatus;

    useEffect(() => {
        if (!statusField) {
            dispatch(fetchPageStatusField());
        }
    }, [dispatch, statusField]);

    const handleStatusChange = useCallback((newStatus: string) => {
        if (isDraft && onDraftStatusChange) {
            onDraftStatusChange(newStatus);
            return;
        }

        // wikiId is required so the reducer's byWiki membership update fires.
        if (!pageWikiId) {
            return;
        }

        dispatch(updatePageStatus(pageId, newStatus, pageWikiId));
    }, [dispatch, isDraft, onDraftStatusChange, pageId, pageWikiId]);

    if (!statusField) {
        return null;
    }

    const metadata: SelectPropertyMetadata = {
        setValue: handleStatusChange,
    };

    return (
        <div className='page-status-selector'>
            <span className='page-status-label'>{formatMessage({id: 'page_status_selector.label', defaultMessage: 'Status'})}</span>
            <SelectableSelectPropertyRenderer
                field={statusField}
                metadata={metadata}
                initialValue={currentStatus}
            />
        </div>
    );
};

export default PageStatusSelector;
