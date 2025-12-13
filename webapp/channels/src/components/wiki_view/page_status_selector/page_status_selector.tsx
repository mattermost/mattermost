// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useEffect} from 'react';
import {useDispatch, useSelector} from 'react-redux';

import {fetchPageStatusField, updatePageStatus} from 'actions/pages';
import {getPageStatusField, getPageStatus} from 'selectors/pages';

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

    const statusField = useSelector((state: GlobalState) => getPageStatusField(state));
    const publishedPageStatus = useSelector((state: GlobalState) => getPageStatus(state, pageId));

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
        } else {
            dispatch(updatePageStatus(pageId, newStatus));
        }
    }, [dispatch, isDraft, onDraftStatusChange, pageId]);

    if (!statusField) {
        return null;
    }

    const metadata: SelectPropertyMetadata = {
        setValue: handleStatusChange,
    };

    return (
        <div className='page-status-selector'>
            <span className='page-status-label'>{'Status'}</span>
            <SelectableSelectPropertyRenderer
                field={statusField}
                metadata={metadata}
                initialValue={currentStatus}
            />
        </div>
    );
};

export default PageStatusSelector;
