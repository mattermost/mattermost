// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect, useMemo, useRef} from 'react';
import {useDispatch, useSelector} from 'react-redux';

import type {PropertyField, PropertyFieldOption} from '@mattermost/types/properties';
import type {GlobalState} from '@mattermost/types/store';

import {fetchPropertyFields} from 'mattermost-redux/actions/properties';
import {getFeatureFlagValue} from 'mattermost-redux/selectors/entities/general';
import {getContrastingSimpleColor} from 'mattermost-redux/utils/theme_utils';

import {GROUP_NAME, FIELD_NAME, OBJECT_TYPE, TARGET_TYPE, TARGET_ID, readGlobalBannerFromField} from 'components/admin_console/classification_markings/utils';

import './global_classification_banner.scss';

const BOTTOM_BANNER_CLASS = 'global-classification-banner-bottom-visible';

type Props = {
    position: 'top' | 'bottom';
};

function selectClassificationTemplateField(state: GlobalState): PropertyField | undefined {
    const byId = state.entities.properties?.fields?.byId;
    if (!byId) {
        return undefined;
    }
    return Object.values(byId).find(
        (f) => f.object_type === OBJECT_TYPE && f.name === FIELD_NAME && f.delete_at === 0,
    );
}

export default function GlobalClassificationBanner({position}: Props) {
    const dispatch = useDispatch();
    const featureEnabled = useSelector((state: GlobalState) => getFeatureFlagValue(state, 'ClassificationMarkings') === 'true');
    const classificationField = useSelector(selectClassificationTemplateField);
    const bannerRef = useRef<HTMLDivElement>(null);

    // Bootstrap: fetch the classification field once when the feature is enabled and
    // the field is not yet in the store. WebSocket events keep it up to date after that.
    useEffect(() => {
        if (featureEnabled && !classificationField) {
            dispatch(fetchPropertyFields(GROUP_NAME, OBJECT_TYPE, TARGET_TYPE, TARGET_ID));
        }
    }, [featureEnabled]); // eslint-disable-line react-hooks/exhaustive-deps

    const bannerConfig = classificationField ? readGlobalBannerFromField(classificationField) : undefined;
    const bannerEnabled = bannerConfig?.enabled ?? false;
    const placement = bannerConfig?.placement ?? 'top';
    const levelName = bannerConfig?.level_name ?? '';

    const color = useMemo(() => {
        if (!levelName || !classificationField) {
            return '';
        }
        const options = classificationField.attrs?.options as PropertyFieldOption[] | undefined;
        return options?.find((o) => o.name === levelName)?.color ?? '';
    }, [classificationField, levelName]);

    const shouldRender = featureEnabled && bannerEnabled && Boolean(levelName) && (position === 'top' || placement === 'top_and_bottom');
    const textColor = useMemo(() => (color ? getContrastingSimpleColor(color) : ''), [color]);

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
            ref={bannerRef}
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
