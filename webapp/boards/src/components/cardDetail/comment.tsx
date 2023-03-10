// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import React, {FC} from 'react'
import {useIntl} from 'react-intl'

import {Block} from 'src/blocks/block'
import mutator from 'src/mutator'
import {Utils} from 'src/utils'
import IconButton from 'src/widgets/buttons/iconButton'
import DeleteIcon from 'src/widgets/icons/delete'
import OptionsIcon from 'src/widgets/icons/options'
import Menu from 'src/widgets/menu'
import MenuWrapper from 'src/widgets/menuWrapper'
import {getUser} from 'src/store/users'
import {useAppSelector} from 'src/store/hooks'
import Tooltip from 'src/widgets/tooltip'
import GuestBadge from 'src/widgets/guestBadge'

import './comment.scss'

type Props = {
    comment: Block
    userId: string
    userImageUrl: string
    readonly: boolean
}

const Comment: FC<Props> = (props: Props) => {
    const {comment, userId, userImageUrl} = props
    const intl = useIntl()
    const html = Utils.htmlFromMarkdown(comment.title)
    const user = useAppSelector(getUser(userId))
    const date = new Date(comment.createAt)

    return (
        <div
            key={comment.id}
            className='Comment comment'
        >
            <div className='comment-header'>
                <img
                    className='comment-avatar'
                    src={userImageUrl}
                />
                <div className='comment-username'>{user?.username}</div>
                <GuestBadge show={user?.is_guest}/>

                <Tooltip title={Utils.displayDateTime(date, intl)}>
                    <div className='comment-date'>
                        {Utils.relativeDisplayDateTime(date, intl)}
                    </div>
                </Tooltip>

                {!props.readonly && (
                    <MenuWrapper>
                        <IconButton icon={<OptionsIcon/>}/>
                        <Menu position='left'>
                            <Menu.Text
                                icon={<DeleteIcon/>}
                                id='delete'
                                name={intl.formatMessage({id: 'Comment.delete', defaultMessage: 'Delete'})}
                                onClick={() => mutator.deleteBlock(comment)}
                            />
                        </Menu>
                    </MenuWrapper>
                )}
            </div>
            <div
                className='comment-text'
                dangerouslySetInnerHTML={{__html: html}}
            />
        </div>
    )
}

export default Comment
