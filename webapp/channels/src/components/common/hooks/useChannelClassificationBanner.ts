// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useEffect, useMemo} from 'react';
import {useDispatch, useSelector} from 'react-redux';

import type {ChannelBanner} from '@mattermost/types/channels';
import type {PropertyValue} from '@mattermost/types/properties';
import type {GlobalState} from '@mattermost/types/store';

import {PropertyTypes} from 'mattermost-redux/action_types';
import {Client4} from 'mattermost-redux/client';
import {getPropertyValueForTargetField} from 'mattermost-redux/selectors/entities/properties';

import useClassificationMarkings from './useClassificationMarkings';

export type ChannelClassificationValue = {
    classification_id: string;
    banner_text: string;
};

export type ChannelClassificationBannerState = {
    hasClassification: boolean;
    classificationBanner: ChannelBanner | undefined;
    classificationId: string | undefined;
    bannerText: string | undefined;
};

/**
 * Resolves the effective banner display for a channel by checking whether a
 * classification property value exists. If one does, its color and text take
 * priority over the channel's native banner_info.
 *
 * Returns:
 * - hasClassification: true when a classification property value is stored for this channel
 * - classificationBanner: a ChannelBanner-compatible object derived from the classification
 * - classificationId: the selected classification level ID
 * - bannerText: the banner text from the classification property value
 */
export default function useChannelClassificationBanner(channelId: string): ChannelClassificationBannerState {
    const dispatch = useDispatch();
    const classification = useClassificationMarkings();

    const fieldId = classification.channelField?.id ?? '';

    const propertyValue = useSelector((state: GlobalState) => {
        if (!fieldId || !channelId) {
            return undefined;
        }
        return getPropertyValueForTargetField(state, channelId, fieldId) as PropertyValue<ChannelClassificationValue> | undefined;
    });

    useEffect(() => {
        if (!channelId || !classification.available || !classification.channelField) {
            return;
        }

        if (!propertyValue) {
            Client4.getPropertyValues(
                'classification_markings',
                'channel',
                channelId,
            ).then((values) => {
                if (values && values.length > 0) {
                    dispatch({
                        type: PropertyTypes.RECEIVED_PROPERTY_VALUES,
                        data: {values},
                    });
                }
            }).catch(() => {
                // Silently ignore - channel may not have a classification set
            });
        }
    }, [channelId, classification.available, classification.channelField, propertyValue, dispatch]);

    return useMemo((): ChannelClassificationBannerState => {
        const noClassification: ChannelClassificationBannerState = {
            hasClassification: false,
            classificationBanner: undefined,
            classificationId: undefined,
            bannerText: undefined,
        };

        if (!propertyValue || !propertyValue.value) {
            return noClassification;
        }

        const val = propertyValue.value as ChannelClassificationValue;
        const classificationId = val.classification_id;
        const bannerText = val.banner_text;

        const level = classification.levels.find((l) => l.id === classificationId);
        if (!level) {
            return noClassification;
        }

        return {
            hasClassification: true,
            classificationBanner: {
                enabled: true,
                text: bannerText,
                background_color: level.color,
            },
            classificationId,
            bannerText,
        };
    }, [propertyValue, classification.levels]);
}
