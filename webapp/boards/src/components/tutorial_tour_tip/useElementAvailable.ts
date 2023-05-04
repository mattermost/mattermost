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

            return undefined
        } else if (checkAvailableInterval.current) {
            return undefined
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

        return () => {
            if (checkAvailableInterval.current) {
                clearInterval(checkAvailableInterval.current)
            }
        }
    }, [])

    return available
}
