// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useEffect, useState} from 'react';
import {useDispatch} from 'react-redux';

import type {PreviewModalContentData} from '@mattermost/types/cloud';

import {getCloudPreviewModalData} from 'actions/cloud';

export type UseGetCloudPreviewModalContentResult = {
    data: PreviewModalContentData[] | null;
    loading: boolean;
    error: boolean;
};

export const useGetCloudPreviewModalContent = (): UseGetCloudPreviewModalContentResult => {
    const dispatch = useDispatch();
    const [data, setData] = useState<PreviewModalContentData[] | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            setError(false);

            try {
                const result = await dispatch(getCloudPreviewModalData());
                if (result.data) {
                    setData(result.data);
                } else {
                    setError(true);
                }
            } catch (err) {
                setError(true);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [dispatch]);

    return {data, loading, error};
};
