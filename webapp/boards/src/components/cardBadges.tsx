// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import React, {useMemo} from 'react'
import {useIntl} from 'react-intl'

import {Card} from 'src/blocks/card'
import {useAppSelector} from 'src/store/hooks'
import {getCardContents} from 'src/store/contents'
import {getCardComments} from 'src/store/comments'
import {ContentBlock} from 'src/blocks/contentBlock'
import {CommentBlock} from 'src/blocks/commentBlock'
import TextIcon from 'src/widgets/icons/text'
import MessageIcon from 'src/widgets/icons/message'
import CheckIcon from 'src/widgets/icons/check'
import {Utils} from 'src/utils'

import './cardBadges.scss'

type Props = {
    card: Card
    className?: string
}

type Checkboxes = {
    total: number
    checked: number
}

type Badges = {
    description: boolean
    comments: number
    checkboxes: Checkboxes
}

const hasBadges = (badges: Badges): boolean => {
    return badges.description || badges.comments > 0 || badges.checkboxes.total > 0
}

type ContentsType = Array<ContentBlock | ContentBlock[]>

const calculateBadges = (contents: ContentsType, comments: CommentBlock[]): Badges => {
    let text = 0
    let total = 0
    let checked = 0

    const updateCounters = (block: ContentBlock) => {
        if (block.type === 'text') {
            text++
            const checkboxes = Utils.countCheckboxesInMarkdown(block.title)
            total += checkboxes.total
            checked += checkboxes.checked
        } else if (block.type === 'checkbox') {
            total++
            if (block.fields.value) {
                checked++
            }
        }
    }

    for (const content of contents) {
        if (Array.isArray(content)) {
            content.forEach(updateCounters)
        } else {
            updateCounters(content)
        }
    }
    return {
        description: text > 0,
        comments: comments.length,
        checkboxes: {
            total,
            checked,
        },
    }
}

const CardBadges = (props: Props) => {
    const {card, className} = props
    const contents = useAppSelector(getCardContents(card.id))
    const comments = useAppSelector(getCardComments(card.id))
    const badges = useMemo(() => calculateBadges(contents, comments), [contents, comments])
    if (!hasBadges(badges)) {
        return null
    }
    const intl = useIntl()
    const {checkboxes} = badges
    return (
        <div className={`CardBadges ${className || ''}`}>
            {badges.description &&
                <span title={intl.formatMessage({id: 'CardBadges.title-description', defaultMessage: 'This card has a description'})}>
                    <TextIcon/>
                </span>}
            {badges.comments > 0 &&
                <span title={intl.formatMessage({id: 'CardBadges.title-comments', defaultMessage: 'Comments'})}>
                    <MessageIcon/>
                    {badges.comments}
                </span>}
            {checkboxes.total > 0 &&
                <span title={intl.formatMessage({id: 'CardBadges.title-checkboxes', defaultMessage: 'Checkboxes'})}>
                    <CheckIcon/>
                    {`${checkboxes.checked}/${checkboxes.total}`}
                </span>}
        </div>
    )
}

export default React.memo(CardBadges)
