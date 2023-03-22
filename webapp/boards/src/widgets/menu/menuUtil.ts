// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import React, {CSSProperties} from 'react'

/**
 * Calculates the position where the menu should be open, aligning it with the
 * `anchorRef` and positioning it down or up around the ref.
 * This should be used to make sure the menues are always aligned regardless of
 * the scroll position and fullly visible in cases when opening them close to
 * the edges of screen.
 * @param anchorRef ref of the element with respect to which the menu position is to be calculated.
 * @param forceBottom forces the element to be aligned at the bottom of the ref
 * @param menuMargin a safe margin value to be ensured around the menu in the calculations.
 *  this ensures the menu stick to the edges of the screen ans has some space around for ease of use.
 */
function openUp(anchorRef: React.RefObject<HTMLElement>, forceBottom = false, menuMargin = 40): {openUp: boolean, style: CSSProperties} {
    const ret = {
        openUp: false,
        style: {} as CSSProperties,
    }
    if (!anchorRef.current) {
        return ret
    }

    const boundingRect = anchorRef.current.getBoundingClientRect()
    const y = typeof boundingRect?.y === 'undefined' ? boundingRect?.top : boundingRect.y
    const windowHeight = window.innerHeight
    const totalSpace = windowHeight - menuMargin
    const spaceOnTop = y || 0
    const spaceOnBottom = totalSpace - spaceOnTop
    ret.openUp = spaceOnTop > spaceOnBottom
    if (!forceBottom && ret.openUp) {
        ret.style.bottom = spaceOnBottom + menuMargin
    } else {
        ret.style.top = spaceOnTop + menuMargin
    }

    return ret
}

export default {
    openUp,
}
