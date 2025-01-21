// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import MattermostLogoDarkBlueSvg from 'components/common/svg_images_components/logo_dark_blue_svg';

export default function ProductBrandingTeamEdition() {
    return (
        <>
            <MattermostLogoDarkBlueSvg
                className='logo_dark_blue'
                width={116}
                height={20}
            />
            <div className='free_edition_badge'>{'FREE EDITION'}</div>
        </>
    );
}
