// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useHistory} from 'react-router-dom';

import './dashboard.scss';

type CtaButtonsProps = {
    learnMoreLink?: string;
    learnMoreText?: string;
    actionLink?: string;
    actionText?: React.ReactNode;
    actionButtonCallback?: () => void;
};

const CtaButtons = ({
    learnMoreLink,
    learnMoreText,
    actionLink,
    actionText,
    actionButtonCallback,
}: CtaButtonsProps): JSX.Element => {
    const history = useHistory();

    const getClickHandler = (id: string, link?: string) => () => {
        if (id === 'cta' && typeof actionButtonCallback === 'function') {
            actionButtonCallback();
        } else if (link?.startsWith('/')) {
            history.push(link);
        } else if (link?.startsWith('http')) {
            window.open(link, '_blank');
        }
    };

    return (
        <div className='ctaButtons'>
            {(actionLink || actionButtonCallback) && actionText && (
                <button
                    className='btn btn-primary btn-sm actionButton annnouncementBar__purchaseNow'
                    onClick={getClickHandler('cta', actionLink)}
                >
                    {actionText}
                </button>
            )}
            {learnMoreLink && learnMoreText && (
                <button
                    className='btn btn-tertiary btn-sm learnMoreButton'
                    onClick={getClickHandler('learn-more', learnMoreLink)}
                >
                    {learnMoreText}
                </button>
            )}
        </div>
    );
};

export default CtaButtons;
