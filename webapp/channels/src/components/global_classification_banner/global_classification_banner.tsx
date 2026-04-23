// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect, useMemo, useRef} from 'react';
import {useSelector} from 'react-redux';

import type {GlobalState} from '@mattermost/types/store';

import {getConfig, getFeatureFlagValue} from 'mattermost-redux/selectors/entities/general';
import {getContrastingSimpleColor} from 'mattermost-redux/utils/theme_utils';

import './global_classification_banner.scss';

const BOTTOM_BANNER_CLASS = 'global-classification-banner-bottom-visible';

type Props = {
    position: 'top' | 'bottom';
};

export default function GlobalClassificationBanner({position}: Props) {
    const featureEnabled = useSelector((state: GlobalState) => getFeatureFlagValue(state, 'ClassificationMarkings') === 'true');
    const config = useSelector((state: GlobalState) => getConfig(state));
    const bannerRef = useRef<HTMLDivElement>(null);

    const enabled = featureEnabled && config.ClassificationMarkingsGlobalBannerEnabled === 'true';
    const placement = config.ClassificationMarkingsGlobalBannerPlacement;
    const levelName = config.ClassificationMarkingsGlobalBannerLevelName;
    const color = config.ClassificationMarkingsGlobalBannerColor;

    const shouldRender = enabled && Boolean(levelName) && (position === 'top' || placement === 'top_and_bottom');
    const textColor = useMemo(() => (color ? getContrastingSimpleColor(color) : ''), [color]);

    useEffect(() => {
        if (position !== 'bottom' || !shouldRender) {
            return undefined;
        }

        const root = document.getElementById('root');
        if (!root) {
            return undefined;
        }

        const refKey = 'banner-bottom-ref-count';
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
