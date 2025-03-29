// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import useOpenPricingDetails from 'components/common/hooks/useOpenPricingDetails';

type Props = {
    plan: string;
}

function AtPlanMention(props: Props) {
    const openPricingDetails = useOpenPricingDetails();

    const handleClick = (e: React.MouseEvent<HTMLAnchorElement, MouseEvent>) => {
        e.preventDefault();
        openPricingDetails({trackingLocation: 'notify_admin_message_view'});
    };
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
