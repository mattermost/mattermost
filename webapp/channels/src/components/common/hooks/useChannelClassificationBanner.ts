// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useEffect, useMemo} from 'react';
import {useDispatch, useSelector} from 'react-redux';

import type {ChannelBanner} from '@mattermost/types/channels';
import type {PropertyValue} from '@mattermost/types/properties';
import type {GlobalState} from '@mattermost/types/store';

import {PropertyTypes} from 'mattermost-redux/action_types';
import {Client4} from 'mattermost-redux/client';
import {getChannelBanner} from 'mattermost-redux/selectors/entities/channels';
import {getPropertyValueForTargetField} from 'mattermost-redux/selectors/entities/properties';

import {
    CLASSIFICATIONS_CHANNEL_OBJECT_TYPE,
    CLASSIFICATIONS_GROUP_NAME,
    DISPLAY_BANNER_TOP,
} from 'components/admin_console/classification_markings/utils';

import useClassificationMarkings from './useClassificationMarkings';

export type ChannelClassificationBannerState = {
    hasClassification: boolean;
    classificationBanner: ChannelBanner | undefined;
    classificationId: string | undefined;
    bannerText: string | undefined;
};

/**
 * Resolves the effective banner display for a channel by checking whether a
 * classification property value exists. If one does, its color (from the level
 * definition) and text (from the channel's banner_info) take priority over
 * the channel's native banner_info.
 *
 * The PropertyValue stores only the classification_id (a plain string).
 * The banner text lives in channel.banner_info.text so that the property
 * value stays a single scalar.
 */
export default function useChannelClassificationBanner(channelId: string): ChannelClassificationBannerState {
    const dispatch = useDispatch();
    const classification = useClassificationMarkings();

    const fieldId = classification.channelField?.id ?? '';

    const propertyValue = useSelector((state: GlobalState) => {
        if (!fieldId || !channelId) {
            return undefined;
        }
        return getPropertyValueForTargetField(state, channelId, fieldId) as PropertyValue<string> | undefined;
    });

    const channelBannerInfo = useSelector((state: GlobalState) => getChannelBanner(state, channelId));

    useEffect(() => {
        if (!channelId || !classification.available || !classification.channelField) {
            return;
        }

        if (!propertyValue) {
            Client4.getPropertyValues(
                CLASSIFICATIONS_GROUP_NAME,
                CLASSIFICATIONS_CHANNEL_OBJECT_TYPE,
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

        // Per-channel banner placement lives on the value's attrs.actions.
        // A value with no attrs.actions defaults to showing the top banner; an
        // explicit empty actions set hides it.
        const actions = (propertyValue.attrs?.actions as string[] | undefined) ?? [DISPLAY_BANNER_TOP];
        if (!actions.includes(DISPLAY_BANNER_TOP)) {
            return noClassification;
        }

        const classificationId = propertyValue.value;
        if (typeof classificationId !== 'string') {
            return noClassification;
        }

        const level = classification.levels.find((l) => l.id === classificationId);
        if (!level) {
            return noClassification;
        }

        const bannerText = channelBannerInfo?.text ?? `**${level.name}**`;

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
    }, [propertyValue, classification.levels, channelBannerInfo]);
}
