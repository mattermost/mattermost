// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import {useEffect, useRef, useState} from 'react'

export default function useElementAvailable(
    elementIds: string[],
): boolean {
    const checkAvailableInterval = useRef<NodeJS.Timeout | null>(null)
    const [available, setAvailable] = useState(false)
    useEffect(() => {
        if (available) {
            if (checkAvailableInterval.current) {
                clearInterval(checkAvailableInterval.current)
                checkAvailableInterval.current = null
            }
            return
        } else if (checkAvailableInterval.current) {
            return
        }
        checkAvailableInterval.current = setInterval(() => {
            if (elementIds.every((x) => document.querySelector(x))) {
                setAvailable(true)
                if (checkAvailableInterval.current) {
                    clearInterval(checkAvailableInterval.current)
                    checkAvailableInterval.current = null
                }
            }
        }, 500)
    }, [])

    return available
}
