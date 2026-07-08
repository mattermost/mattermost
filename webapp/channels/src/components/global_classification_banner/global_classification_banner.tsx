// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect, useMemo} from 'react';
import {useDispatch, useSelector} from 'react-redux';

import type {PropertyField, PropertyFieldOption, PropertyValue} from '@mattermost/types/properties';
import type {GlobalState} from '@mattermost/types/store';

import {fetchPropertyFields, fetchSystemPropertyValues} from 'mattermost-redux/actions/properties';
import {getFeatureFlagValue} from 'mattermost-redux/selectors/entities/general';
import {getPropertyValueForTargetField} from 'mattermost-redux/selectors/entities/properties';
import {getContrastingSimpleColor} from 'mattermost-redux/utils/theme_utils';

import {
    CLASSIFICATIONS_FIELD_TARGET_ID,
    CLASSIFICATIONS_FIELD_TARGET_TYPE,
    CLASSIFICATIONS_GROUP_NAME,
    CLASSIFICATIONS_SYSTEM_FIELD_NAME,
    CLASSIFICATIONS_SYSTEM_OBJECT_TYPE,
    CLASSIFICATIONS_SYSTEM_VALUE_TARGET_ID,
    DISPLAY_BANNER_BOTTOM,
    DISPLAY_BANNER_TOP,
    findOptionById,
} from 'components/admin_console/classification_markings/utils';

import './global_classification_banner.scss';

const BOTTOM_BANNER_CLASS = 'global-classification-banner-bottom-visible';

type Props = {
    position: 'top' | 'bottom';
};

function selectLinkedSystemField(state: GlobalState): PropertyField | undefined {
    const byId = state.entities.properties?.fields?.byId;
    if (!byId) {
        return undefined;
    }

    // The linked system field has object_type 'system' and a linked_field_id set.
    return Object.values(byId).find(
        (f) => f.object_type === CLASSIFICATIONS_SYSTEM_OBJECT_TYPE && f.name === CLASSIFICATIONS_SYSTEM_FIELD_NAME && f.linked_field_id && f.delete_at === 0,
    );
}

export default function GlobalClassificationBanner({position}: Props) {
    const dispatch = useDispatch();
    const featureEnabled = useSelector((state: GlobalState) => getFeatureFlagValue(state, 'ClassificationMarkings') === 'true');
    const linkedField = useSelector(selectLinkedSystemField);
    const systemValue = useSelector((state: GlobalState) => {
        if (!linkedField) {
            return undefined;
        }
        return getPropertyValueForTargetField(state, CLASSIFICATIONS_SYSTEM_VALUE_TARGET_ID, linkedField.id) as PropertyValue<string> | undefined;
    });

    // Bootstrap: fetch the linked system field and system property values.
    // WebSocket events (property_field_created/updated and property_values_updated) keep
    // the store current after the initial load.
    //
    // The effect must re-run when linkedField arrives in the store so the values
    // fetch can proceed (it depends on linkedField being present).
    useEffect(() => {
        if (!featureEnabled) {
            return;
        }
        if (!linkedField) {
            dispatch(fetchPropertyFields(
                CLASSIFICATIONS_GROUP_NAME,
                CLASSIFICATIONS_SYSTEM_OBJECT_TYPE,
                CLASSIFICATIONS_FIELD_TARGET_TYPE,
                CLASSIFICATIONS_FIELD_TARGET_ID,
            ));
        }
        if (linkedField && !systemValue) {
            dispatch(fetchSystemPropertyValues(CLASSIFICATIONS_GROUP_NAME));
        }
    }, [featureEnabled, linkedField, systemValue, dispatch]);

    // Display conditions are encoded in attrs.actions. Prefer the system value's
    // actions; fall back to the linked field's actions — the field also carries
    // the actions (mobile reads them there), and this covers a value that has
    // none of its own.
    const actions = (systemValue?.attrs?.actions as string[] | undefined) ??
        (linkedField?.attrs?.actions as string[] | undefined) ?? [];
    const shouldRenderTop = actions.includes(DISPLAY_BANNER_TOP);
    const shouldRenderBottom = actions.includes(DISPLAY_BANNER_BOTTOM);

    // Resolve the selected level from the linked field's inherited options.
    // Linked fields inherit attrs.options from the template, and unlike the
    // template (which is treated as PSAv1 and skipped by the reducer), linked
    // field updates propagate to all clients via WebSocket.
    const optionId = systemValue?.value ?? '';
    const levelOption = useMemo((): PropertyFieldOption | undefined => {
        if (!optionId || !linkedField) {
            return undefined;
        }
        const options = linkedField.attrs?.options as PropertyFieldOption[] | undefined;
        return findOptionById(options ?? [], optionId);
    }, [linkedField, optionId]);

    const levelName = levelOption?.name ?? '';
    const color = levelOption?.color ?? '';
    const textColor = useMemo(() => (color ? getContrastingSimpleColor(color) : ''), [color]);

    const shouldRender = featureEnabled && Boolean(levelName) && (
        position === 'top' ? shouldRenderTop : shouldRenderBottom
    );

    useEffect(() => {
        if (position !== 'bottom' || !shouldRender) {
            return undefined;
        }

        const root = document.getElementById('root');
        if (!root) {
            return undefined;
        }

        const refKey = 'bannerBottomRefCount';
        const count = parseInt(root.dataset[refKey] || '0', 10) + 1;
        root.dataset[refKey] = String(count);
        root.classList.add(BOTTOM_BANNER_CLASS);

        return () => {
            const next = parseInt(root.dataset[refKey] || '1', 10) - 1;
            root.dataset[refKey] = String(next);
            if (next <= 0) {
                delete root.dataset[refKey];
                root.classList.remove(BOTTOM_BANNER_CLASS);
            }
        };
    }, [position, shouldRender]);

    if (!shouldRender) {
        return null;
    }

    return (
        <div
            className={`global-classification-banner global-classification-banner--${position}`}
            style={{backgroundColor: color || undefined, color: textColor || undefined}}
            data-testid={`global-classification-banner-${position}`}
        >
            <span className='global-classification-banner__text'>
                {levelName}
            </span>
        </div>
    );
}
