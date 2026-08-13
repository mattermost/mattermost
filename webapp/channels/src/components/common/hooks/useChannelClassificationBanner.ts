// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useEffect, useMemo} from 'react';
import {useDispatch, useSelector} from 'react-redux';

import type {ChannelBanner} from '@mattermost/types/channels';
import type {PropertyField, PropertyFieldOption, PropertyValue} from '@mattermost/types/properties';
import type {GlobalState} from '@mattermost/types/store';

import {PropertyTypes} from 'mattermost-redux/action_types';
import {fetchPropertyFields} from 'mattermost-redux/actions/properties';
import {Client4} from 'mattermost-redux/client';
import {
    ACCESS_CONTROL_PROPERTY_GROUP,
    CHANNEL_OBJECT_TYPE,
    DISPLAY_BANNER_BOTTOM,
    DISPLAY_BANNER_TOP,
    SYSTEM_TARGET_ID,
    SYSTEM_TARGET_TYPE,
} from 'mattermost-redux/constants/properties';
import {getChannelBanner} from 'mattermost-redux/selectors/entities/channels';
import {getFeatureFlagValue, getLicense} from 'mattermost-redux/selectors/entities/general';
import {getChannelAttributeFields, getPropertyValueForTargetField, makeGetResolvedChannelAttributes} from 'mattermost-redux/selectors/entities/properties';

import {
    CLASSIFICATIONS_CHANNEL_OBJECT_TYPE,
    CLASSIFICATIONS_GROUP_NAME,
} from 'components/admin_console/classification_markings/utils';
import {renderBannerTemplate} from 'components/channel_attributes/banner_template';

import {isEnterpriseLicense} from 'utils/license_utils';

import useClassificationMarkings from './useClassificationMarkings';

export type ChannelBannerPosition = typeof DISPLAY_BANNER_TOP | typeof DISPLAY_BANNER_BOTTOM;

// The classification* names predate the generic path; they now mean "whichever
// attribute designates a banner".
export type ChannelClassificationBannerState = {
    hasClassification: boolean;
    classificationBanner: ChannelBanner | undefined;
    classificationId: string | undefined;
    bannerText: string | undefined;

    // Absent reads as top. Optional so callers building this shape by hand keep compiling.
    position?: ChannelBannerPosition;
};

function bannerAction(field: PropertyField): ChannelBannerPosition | undefined {
    const actions = field.attrs?.actions;
    if (!Array.isArray(actions)) {
        return undefined;
    }
    if (actions.includes(DISPLAY_BANNER_TOP)) {
        return DISPLAY_BANNER_TOP;
    }
    if (actions.includes(DISPLAY_BANNER_BOTTOM)) {
        return DISPLAY_BANNER_BOTTOM;
    }
    return undefined;
}

/**
 * Resolves the channel banner from whichever attribute designates one, taking
 * priority over the channel's native banner_info. The value holds only an option
 * id; the text lives in banner_info.text.
 *
 * Falls back to the classification field when nothing is designated, reading its
 * colours from useClassificationMarkings — that is what keeps channels with an
 * existing classification rendering exactly as they do today.
 */
export default function useChannelClassificationBanner(channelId: string): ChannelClassificationBannerState {
    const dispatch = useDispatch();
    const classification = useClassificationMarkings();

    const attributesEnabled = useSelector((state: GlobalState) => getFeatureFlagValue(state, 'ChannelAttributes') === 'true');
    const hasEnterpriseLicense = isEnterpriseLicense(useSelector(getLicense));
    const channelFields = useSelector(getChannelAttributeFields);

    // First by sort_order, so which attribute wins is configuration rather than
    // field creation order.
    const designated = useMemo(() => {
        if (!attributesEnabled || !hasEnterpriseLicense) {
            return undefined;
        }
        return channelFields.find((field) => bannerAction(field) !== undefined);
    }, [attributesEnabled, hasEnterpriseLicense, channelFields]);

    const bannerField = designated ?? classification.channelField ?? undefined;
    const position = (designated && bannerAction(designated)) || DISPLAY_BANNER_TOP;

    const fieldId = bannerField?.id ?? '';

    const propertyValue = useSelector((state: GlobalState) => {
        if (!fieldId || !channelId) {
            return undefined;
        }
        return getPropertyValueForTargetField(state, channelId, fieldId) as PropertyValue<string> | undefined;
    });

    const channelBannerInfo = useSelector((state: GlobalState) => getChannelBanner(state, channelId));

    // banner_info.text is a template. Resolving it only in the composer's preview
    // would show the author "TOP SECRET" while members saw "{{classification}}".
    const getResolvedChannelAttributes = useMemo(() => makeGetResolvedChannelAttributes(), []);
    const resolvedAttributes = useSelector((state: GlobalState) => getResolvedChannelAttributes(state, channelId));

    // Loaded here too, so the banner works on surfaces that never mount the header
    // chips — a popout, or a channel where the label component is absent.
    useEffect(() => {
        if (!attributesEnabled || !hasEnterpriseLicense || channelFields.length > 0) {
            return;
        }
        dispatch(fetchPropertyFields(
            ACCESS_CONTROL_PROPERTY_GROUP,
            CHANNEL_OBJECT_TYPE,
            SYSTEM_TARGET_TYPE,
            SYSTEM_TARGET_ID,
        ));
    }, [attributesEnabled, hasEnterpriseLicense, channelFields.length, dispatch]);

    // Returns every access_control value on the channel, so this also feeds the
    // header chips and Channel Info — hence firing with Classification Markings off.
    // Not gated on fields having loaded: that would deadlock a surface where
    // nothing else loads them.
    const shouldLoadValues = Boolean(channelId) && (
        (classification.available && Boolean(classification.channelField)) ||
        (attributesEnabled && hasEnterpriseLicense)
    );

    useEffect(() => {
        if (!shouldLoadValues) {
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
    }, [channelId, shouldLoadValues, propertyValue, dispatch]);

    return useMemo((): ChannelClassificationBannerState => {
        const noBanner: ChannelClassificationBannerState = {
            hasClassification: false,
            classificationBanner: undefined,
            classificationId: undefined,
            bannerText: undefined,
            position,
        };

        if (!propertyValue || !propertyValue.value) {
            return noBanner;
        }

        const optionId = propertyValue.value;
        if (typeof optionId !== 'string') {
            return noBanner;
        }

        // Both branches read the same definition — levels are
        // optionsToLevels(field.attrs.options) — but the level lookup stays because
        // that is where the shipped banner's colours come from today.
        let name: string | undefined;
        let color: string | undefined;

        const level = classification.levels.find((l) => l.id === optionId);
        if (level) {
            name = level.name;
            color = level.color;
        } else if (designated) {
            const options = (designated.attrs?.options as PropertyFieldOption[] | undefined) ?? [];
            const option = options.find((candidate) => candidate.id === optionId);
            if (option) {
                name = option.name;
                color = option.color;
            }
        }

        // A deleted option renders nothing rather than an unresolvable banner.
        if (!name) {
            return noBanner;
        }

        // A literal with no tokens passes through untouched, keeping pre-existing
        // banners byte-identical.
        const bannerText = channelBannerInfo?.text ? renderBannerTemplate(channelBannerInfo.text, resolvedAttributes) : `**${name}**`;

        return {
            hasClassification: true,
            classificationBanner: {
                enabled: true,
                text: bannerText,
                background_color: color ?? '',
            },
            classificationId: optionId,
            bannerText,
            position,
        };
    }, [propertyValue, classification.levels, channelBannerInfo, designated, position, resolvedAttributes]);
}
