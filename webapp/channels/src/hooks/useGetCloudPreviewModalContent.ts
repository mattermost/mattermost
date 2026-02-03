// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useEffect, useState} from 'react';
import {useDispatch, useSelector} from 'react-redux';

import type {PreviewModalContentData} from '@mattermost/types/cloud';

import {getCloudSubscription} from 'mattermost-redux/selectors/entities/cloud';
import {getLicense} from 'mattermost-redux/selectors/entities/general';

import {getCloudPreviewModalData} from 'actions/cloud';

export type UseGetCloudPreviewModalContentResult = {
    data: PreviewModalContentData[] | null;
    loading: boolean;
    error: boolean;
};

export const useGetCloudPreviewModalContent = (): UseGetCloudPreviewModalContentResult => {
    const dispatch = useDispatch();
    const subscription = useSelector(getCloudSubscription);
    const license = useSelector(getLicense);
    const [data, setData] = useState<PreviewModalContentData[] | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);

    const isCloud = license?.Cloud === 'true';
    const isCloudPreview = subscription?.is_cloud_preview === true;

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            setError(false);

            try {
                const result = await dispatch(getCloudPreviewModalData());
                if (result && typeof result === 'object' && 'data' in result) {
                    setData(result.data as PreviewModalContentData[]);
                } else {
                    setError(true);
                }
            } catch (err) {
                setError(true);
            } finally {
                setLoading(false);
            }
        };

        // Only fetch data if this is a cloud preview workspace
        if (isCloud && isCloudPreview) {
            fetchData();
        } else {
            // Not a cloud preview workspace, set loading to false and data to null
            setLoading(false);
            setData(null);
            setError(false);
        }
    }, [dispatch, isCloud, isCloudPreview]);

    return {data, loading, error};
};
