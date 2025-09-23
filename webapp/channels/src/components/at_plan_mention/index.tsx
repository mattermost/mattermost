// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import useOpenPricingModal from 'components/common/hooks/useOpenPricingModal';

type Props = {
    plan: string;
}

function AtPlanMention(props: Props) {
    const {openPricingModal, isAirGapped} = useOpenPricingModal();

    const handleClick = (e: React.MouseEvent<HTMLAnchorElement, MouseEvent>) => {
        e.preventDefault();
        openPricingModal();
    };

    if (isAirGapped) {
        return <span id='at_plan_mention'>{props.plan}</span>;
    }

    return (
        <a
            id='at_plan_mention'
            onClick={handleClick}
        >
            {props.plan}
        </a>

    );
}

export default AtPlanMention;
