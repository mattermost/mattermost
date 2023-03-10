// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import React, {
    useState,
    useRef,
    useEffect,
    useMemo
} from 'react'
import {useRouteMatch} from 'react-router-dom'
import {useIntl} from 'react-intl'
import {useHotkeys} from 'react-hotkeys-hook'
import {debounce} from 'lodash'

import CompassIcon from 'src/widgets/icons/compassIcon'
import Editable from 'src/widgets/editable'

import {useAppSelector, useAppDispatch} from 'src/store/hooks'
import {getSearchText, setSearchText} from 'src/store/searchText'

const ViewHeaderSearch = (): JSX.Element => {
    const searchText = useAppSelector<string>(getSearchText)
    const dispatch = useAppDispatch()
    const intl = useIntl()
    const match = useRouteMatch<{viewId?: string}>()

    const searchFieldRef = useRef<{focus(selectAll?: boolean): void}>(null)
    const [searchValue, setSearchValue] = useState(searchText)
    const [currentView, setCurrentView] = useState(match.params?.viewId)

    const dispatchSearchText = (value: string) => {
        dispatch(setSearchText(value))
    }

    const debouncedDispatchSearchText = useMemo(
        () => debounce(dispatchSearchText, 200), [])

    useEffect(() => {
        const viewId = match.params?.viewId
        if (viewId !== currentView) {
            setCurrentView(viewId)
            setSearchValue('')

            // Previously debounced calls to change the search text should be cancelled
            // to avoid resetting the search text.
            debouncedDispatchSearchText.cancel()
            dispatchSearchText('')
        }
    }, [match.url])

    useEffect(() => {
        return () => {
            debouncedDispatchSearchText.cancel()
        }
    }, [])

    useHotkeys('ctrl+shift+f,cmd+shift+f', () => {
        searchFieldRef.current?.focus(true)
    })

    return (
        <div className='board-search-field'>
            <CompassIcon
                icon='magnify'
                className='board-search-icon'
            />
            <Editable
                ref={searchFieldRef}
                value={searchValue}
                placeholderText={intl.formatMessage({id: 'ViewHeader.search-text', defaultMessage: 'Search cards'})}
                onChange={(value) => {
                    setSearchValue(value)
                    debouncedDispatchSearchText(value)
                }}
                onCancel={() => {
                    setSearchValue('')
                    debouncedDispatchSearchText('')
                }}
                onSave={() => {
                    debouncedDispatchSearchText(searchValue)
                }}
            />
        </div>
    )
}

export default ViewHeaderSearch
