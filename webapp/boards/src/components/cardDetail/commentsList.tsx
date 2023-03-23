// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import React, {useState} from 'react'
import {FormattedMessage, useIntl} from 'react-intl'

import {CommentBlock, createCommentBlock} from 'src/blocks/commentBlock'
import mutator from 'src/mutator'
import {useAppSelector} from 'src/store/hooks'
import {Utils} from 'src/utils'
import Button from 'src/widgets/buttons/button'

import {MarkdownEditor} from 'src/components/markdownEditor'

import {IUser} from 'src/user'
import {getMe} from 'src/store/users'
import {useHasCurrentBoardPermissions} from 'src/hooks/permissions'
import {Permission} from 'src/constants'

import AddCommentTourStep from 'src/components/onboardingTour/addComments/addComments'

import Comment from './comment'

import './commentsList.scss'

type Props = {
    comments: readonly CommentBlock[]
    boardId: string
    cardId: string
    readonly: boolean
}

const CommentsList = (props: Props) => {
    const [newComment, setNewComment] = useState('')
    const me = useAppSelector<IUser|null>(getMe)
    const canDeleteOthersComments = useHasCurrentBoardPermissions([Permission.DeleteOthersComments])

    const onSendClicked = () => {
        const commentText = newComment
        if (commentText) {
            const {cardId, boardId} = props
            Utils.log(`Send comment: ${commentText}`)
            Utils.assertValue(cardId)

            const comment = createCommentBlock()
            comment.parentId = cardId
            comment.boardId = boardId
            comment.title = commentText
            mutator.insertBlock(boardId, comment, 'add comment')
            setNewComment('')
        }
    }

    const {comments} = props
    const intl = useIntl()

    const newCommentComponent = (
        <div className='CommentsList__new'>
            <img
                className='comment-avatar'
                src={Utils.getProfilePicture(me?.id)}
            />
            <MarkdownEditor
                className='newcomment'
                text={newComment}
                placeholderText={intl.formatMessage({id: 'CardDetail.new-comment-placeholder', defaultMessage: 'Add a comment...'})}
                onChange={(value: string) => {
                    if (newComment !== value) {
                        setNewComment(value)
                    }
                }}
            />

            {newComment &&
            <Button
                filled={true}
                onClick={onSendClicked}
            >
                <FormattedMessage
                    id='CommentsList.send'
                    defaultMessage='Send'
                />
            </Button>
            }

            <AddCommentTourStep/>
        </div>
    )

    return (
        <div className='CommentsList'>
            {/* New comment */}
            {!props.readonly && newCommentComponent}

            {comments.slice(0).reverse().map((comment) => {
                // Only modify _own_ comments, EXCEPT for Admins, which can delete _any_ comment
                // NOTE: editing comments will exist in the future (in addition to deleting)
                const canDeleteComment: boolean = canDeleteOthersComments || me?.id === comment.modifiedBy
                return (
                    <Comment
                        key={comment.id}
                        comment={comment}
                        userImageUrl={Utils.getProfilePicture(comment.modifiedBy)}
                        userId={comment.modifiedBy}
                        readonly={props.readonly || !canDeleteComment}
                    />
                )
            })}

            {/* horizontal divider below comments */}
            {!(comments.length === 0 && props.readonly) && <hr className='CommentsList__divider'/>}
        </div>
    )
}

export default React.memo(CommentsList)
