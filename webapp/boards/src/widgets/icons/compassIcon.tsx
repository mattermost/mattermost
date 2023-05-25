// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react'

type Props = {
    icon: string
    className?: string
}

export default React.forwardRef<HTMLElement, Props>(({icon, className, ...props}, ref) => {
    // All compass icon classes start with icon,
    // so not expecting that prefix in props.
    return (
        <i
            {...props}
            ref={ref}
            className={`CompassIcon icon-${icon}${className === undefined ? '' : ` ${className}`}`}
        />
    )
})
