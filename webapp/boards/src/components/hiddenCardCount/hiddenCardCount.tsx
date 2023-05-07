// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react'
import {useIntl} from 'react-intl'

import Button from 'src/widgets/buttons/button'

import './hiddenCardCount.scss'

type Props = {
    hiddenCardsCount: number
    showHiddenCardNotification: (show: boolean) => void
}

const HiddenCardCount = (props: Props): JSX.Element => {
    const intl = useIntl()

    const onClickHandler = () => {
        props.showHiddenCardNotification(true)
    }

    return (
        <div
            className='HiddenCardCount'
            onClick={onClickHandler}
        >
            <div className='hidden-card-title'>{intl.formatMessage({id: 'limitedCard.title', defaultMessage: 'Cards hidden'})}</div>
            <Button title='hidden-card-count'>{props.hiddenCardsCount}</Button>
        </div>
    )
}

export default HiddenCardCount
