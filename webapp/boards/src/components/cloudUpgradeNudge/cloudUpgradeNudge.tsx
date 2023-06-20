// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react'
import {Post} from '@mattermost/types/posts'

const PostTypeCloudUpgradeNudge = (props: {post: Post}): JSX.Element => {
    const ctaHandler = (e: React.MouseEvent) => {
        e.preventDefault()
        const windowAny = (window as any)
        windowAny?.openPricingModal()({trackingLocation: 'boards > click_view_upgrade_options_nudge'})
    }

    // custom post type doesn't support styling via CSS  stylesheet.
    // Only styled components or react styles work there.
    const ctaContainerStyle = {
        padding: '12px',
        borderRadius: '0 4px 4px 0',
        border: '1px solid rgba(63, 67, 80, 0.16)',
        borderLeft: '6px solid var(--link-color)',
        width: 'max-content',
        margin: '10px 0',
    }

    const ctaBtnStyle = {
        background: 'var(--link-color)',
        color: 'var(--center-channel-bg)',
        border: 'none',
        borderRadius: '4px',
        padding: '8px 20px',
        fontWeight: 600,
    }

    return (
        <div className='PostTypeCloudUpgradeNudge'>
            <span>{props.post.message}</span>
            <div
                style={ctaContainerStyle}
            >
                <button
                    onClick={ctaHandler}
                    style={ctaBtnStyle}
                >
                    {'View upgrade options'}
                </button>
            </div>
        </div>
    )
}

export default PostTypeCloudUpgradeNudge
