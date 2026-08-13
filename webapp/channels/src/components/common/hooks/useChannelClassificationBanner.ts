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

export type ChannelClassificationBannerState = {

    // Named for classification because that was the only attribute that could
    // drive a banner when this shape was introduced. It now means "some
    // attribute designates a banner on this channel".
    hasClassification: boolean;
    classificationBanner: ChannelBanner | undefined;

    // The resolved option id of the banner-designating attribute.
    classificationId: string | undefined;
    bannerText: string | undefined;

    // Where the designation asks for the banner. Optional so callers that build
    // this shape by hand keep compiling; absent reads as top, which is where
    // every existing classification banner already renders.
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
 * Resolves the effective banner display for a channel from whichever attribute
 * designates one. Its colour and text take priority over the channel's native
 * banner_info.
 *
 * The PropertyValue stores only the option id (a plain string). The banner text
 * lives in channel.banner_info.text so that the property value stays a single
 * scalar.
 *
 * Two resolution paths, deliberately:
 *
 *  - A designated attribute (attrs.actions carries display_banner_top or
 *    _bottom) resolves its colour and name from the field's own options. This is
 *    the generic path, and Classification is just one instance of it once an
 *    administrator designates it.
 *  - With nothing designated, it falls back to the classification field and
 *    reads colours from useClassificationMarkings' levels. That fallback is what
 *    keeps channels that already have a classification — and no actions on the
 *    field — rendering exactly as they do today.
 *
 * Field definitions are not fetched here. The channel header mounts the label
 * component for the same channel, which loads them; adding a second fetch would
 * duplicate a request on every channel switch.
 */
export default function useChannelClassificationBanner(channelId: string): ChannelClassificationBannerState {
    const dispatch = useDispatch();
    const classification = useClassificationMarkings();

    const attributesEnabled = useSelector((state: GlobalState) => getFeatureFlagValue(state, 'ChannelAttributes') === 'true');
    const hasEnterpriseLicense = isEnterpriseLicense(useSelector(getLicense));
    const channelFields = useSelector(getChannelAttributeFields);

    // First by sort_order, so which attribute wins is a configuration decision
    // rather than an accident of field creation order.
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

    // The manual banner text is a template, so the values it references have to
    // be resolved here — rendering it only in the composer's preview would show
    // the author "TOP SECRET" while every member saw "{{classification}}".
    const getResolvedChannelAttributes = useMemo(() => makeGetResolvedChannelAttributes(), []);
    const resolvedAttributes = useSelector((state: GlobalState) => getResolvedChannelAttributes(state, channelId));

    // Field definitions, so the banner works on surfaces that do not also render
    // the header chips — a popout window, or a channel where the label component
    // is not mounted. Dispatched without chaining: the result is read from the
    // store, and awaiting it here would duplicate useChannelAttributes' own
    // bookkeeping for no gain.
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

    // This one request returns every access_control value on the channel, not just
    // the banner's, so it is also what populates the values the header chips and
    // Channel Info read. It therefore has to fire when channel attributes are on
    // even if Classification Markings is off, or those surfaces stay empty.
    // Deliberately not gated on fields having loaded: the two are independent
    // requests, and gating values on fields would deadlock a surface where
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

        // Classification's levels are optionsToLevels(field.attrs.options), so both
        // branches read the same definition; the level lookup is kept for the
        // fallback path because that is where the shipped banner's colours and
        // ranks come from today.
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

        // An option that no longer exists renders nothing rather than a banner
        // with an unresolvable value in it.
        if (!name) {
            return noBanner;
        }

        // A literal with no tokens passes through untouched, which is what keeps
        // every banner written before this feature byte-identical.
        const bannerText = channelBannerInfo?.text ?
            renderBannerTemplate(channelBannerInfo.text, resolvedAttributes) :
            `**${name}**`;

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
