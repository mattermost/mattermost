// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useEffect, useMemo} from 'react';
import {useDispatch, useSelector} from 'react-redux';

import type {ChannelBanner} from '@mattermost/types/channels';
import type {PropertyField, PropertyValue} from '@mattermost/types/properties';
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
import type {ResolvedChannelAttribute} from 'mattermost-redux/selectors/entities/properties';
import {getChannelAttributeFields, getChannelBannerFields, getPropertyValueForTargetField, makeGetResolvedChannelAttributes} from 'mattermost-redux/selectors/entities/properties';

import {CLASSIFICATIONS_CHANNEL_FIELD_NAME, CLASSIFICATIONS_CHANNEL_OBJECT_TYPE} from 'components/admin_console/classification_markings/utils';
import {renderBannerTemplate} from 'components/channel_attributes/banner_template';

import {isMinimumEnterpriseAdvancedLicense} from 'utils/license_utils';

import useClassificationMarkings from './useClassificationMarkings';

export type ChannelBannerPosition = typeof DISPLAY_BANNER_TOP | typeof DISPLAY_BANNER_BOTTOM;

// Text and multiselect attributes have no option to take a colour from, and a
// banner with no background is a strip of unreadable page.
const DEFAULT_BANNER_COLOR = '#DDDDDD';

const EMPTY_FIELDS: PropertyField[] = [];

// The classification* names predate the generic path; they now mean "whichever
// attribute designates a banner".
export type ChannelClassificationBannerState = {
    hasClassification: boolean;
    classificationBanner: ChannelBanner | undefined;
    classificationId: string | undefined;
    bannerText: string | undefined;

    // True when the classification field is among the admin-designated banner fields.
    // The banner color is then locked to the selected level's color and not editable.
    classificationIsBannerDesignated: boolean;

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
    const hasAdvancedLicense = isMinimumEnterpriseAdvancedLicense(useSelector(getLicense));
    const channelFields = useSelector(getChannelAttributeFields);

    // All of them, in sort_order: designation is the admin saying an attribute must
    // be on screen, so several designated attributes share one banner. Order is
    // configuration rather than field creation order.
    const bannerFields = useSelector(getChannelBannerFields);
    const designatedFields = useMemo(() => {
        if (!attributesEnabled || !hasAdvancedLicense) {
            return EMPTY_FIELDS;
        }
        return bannerFields;
    }, [attributesEnabled, hasAdvancedLicense, bannerFields]);

    // Position and any authored colour come from the first, since one banner cannot
    // sit in two places.
    const designated = designatedFields[0];

    // Only while the channel field carries no display locations at all, which is how
    // a field predating any configuration keeps today's banner. Once an admin has
    // chosen locations, an unticked Banner has to mean no banner.
    const classificationFallback = Array.isArray(classification.channelField?.attrs?.actions) ? undefined : classification.channelField;

    const bannerField = designated ?? classificationFallback ?? undefined;
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
        if (!attributesEnabled || !hasAdvancedLicense || channelFields.length > 0) {
            return;
        }
        dispatch(fetchPropertyFields(
            ACCESS_CONTROL_PROPERTY_GROUP,
            CHANNEL_OBJECT_TYPE,
            SYSTEM_TARGET_TYPE,
            SYSTEM_TARGET_ID,
        ));
    }, [attributesEnabled, hasAdvancedLicense, channelFields.length, dispatch]);

    // Returns every access_control value on the channel, so this also feeds the
    // header chips and Channel Info — hence firing with Classification Markings off.
    // Not gated on fields having loaded: that would deadlock a surface where
    // nothing else loads them.
    const shouldLoadValues = Boolean(channelId) && (
        (classification.available && Boolean(classification.channelField)) ||
        (attributesEnabled && hasAdvancedLicense)
    );

    useEffect(() => {
        if (!shouldLoadValues) {
            return;
        }

        if (!propertyValue) {
            Client4.getPropertyValues(
                ACCESS_CONTROL_PROPERTY_GROUP,
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
            classificationIsBannerDesignated: false,
            position,
        };

        // Designated path: every banner attribute that has a value, in field order.
        // Composed plain, because the same values render plain once the channel
        // authors a template out of the chips in Channel Settings.
        if (designatedFields.length > 0) {
            // Classification is special: its selected level carries a colour that must
            // drive and lock the banner colour regardless of how many other attributes
            // share the banner.
            const classificationField = designatedFields.find((f) => f.name === CLASSIFICATIONS_CHANNEL_FIELD_NAME);
            const classificationIsBannerDesignated = Boolean(classificationField);

            const byId = new Map(resolvedAttributes.map((attribute) => [attribute.field.id, attribute]));
            const parts = designatedFields.
                map((field) => byId.get(field.id)).
                filter((attribute) => Boolean(attribute?.displayValue)) as ResolvedChannelAttribute[];

            if (parts.length === 0) {
                return {...noBanner, classificationIsBannerDesignated};
            }

            const composed = parts.map((attribute) => attribute.displayValue).join(' · ');
            const bannerText = channelBannerInfo?.text ? renderBannerTemplate(channelBannerInfo.text, resolvedAttributes) : composed;

            if (!bannerText) {
                return {...noBanner, classificationIsBannerDesignated};
            }

            // Classification colour wins unconditionally: it is locked at the UI level
            // so authored background_color is never written when classification is
            // designated. For all other cases the authored colour takes priority.
            const classificationPart = classificationField ? parts.find((p) => p.field.id === classificationField.id) : undefined;
            const classificationOptionColor = classificationPart?.option?.color;

            const optionColor = classificationOptionColor ?? (parts.length === 1 ? parts[0].option?.color : undefined);
            const authoredColor = classificationIsBannerDesignated ? undefined : channelBannerInfo?.background_color;

            const single = parts.length === 1 ? parts[0].value?.value : undefined;

            return {
                hasClassification: true,
                classificationBanner: {
                    enabled: true,
                    text: bannerText,
                    background_color: authoredColor || optionColor || DEFAULT_BANNER_COLOR,
                },
                classificationId: typeof single === 'string' ? single : undefined,
                classificationIsBannerDesignated,
                bannerText,
                position,
            };
        }

        // Classification fallback: a channel field predating any display configuration.
        // Bold, and coloured from the level, is how it renders today.
        if (!propertyValue || !propertyValue.value) {
            return noBanner;
        }

        const raw = propertyValue.value;
        if (typeof raw !== 'string') {
            return noBanner;
        }

        const level = classification.levels.find((l) => l.id === raw);
        if (!level) {
            return noBanner;
        }

        // A literal with no tokens passes through untouched, keeping pre-existing
        // banners byte-identical.
        const bannerText = channelBannerInfo?.text ? renderBannerTemplate(channelBannerInfo.text, resolvedAttributes) : `**${level.name}**`;

        return {
            hasClassification: true,
            classificationBanner: {
                enabled: true,

                // The level's colour wins over whatever stale value banner_info carries.
                text: bannerText,
                background_color: level.color || DEFAULT_BANNER_COLOR,
            },
            classificationId: raw,
            classificationIsBannerDesignated: false,
            bannerText,
            position,
        };
    }, [propertyValue, classification.levels, channelBannerInfo, designatedFields, position, resolvedAttributes]);
}
