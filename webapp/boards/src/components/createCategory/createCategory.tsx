// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState, KeyboardEvent} from 'react'

import {useIntl} from 'react-intl'

import {IUser} from 'src/user'
import {Category} from 'src/store/sidebar'
import {getCurrentTeam} from 'src/store/teams'
import mutator from 'src/mutator'
import {useAppSelector} from 'src/store/hooks'
import {getMe} from 'src/store/users'

import {Utils} from 'src/utils'

import Dialog from 'src/components/dialog'
import Button from 'src/widgets/buttons/button'

import './createCategory.scss'
import CloseCircle from 'src/widgets/icons/closeCircle'

type Props = {
    boardCategoryId?: string
    renameModal?: boolean
    initialValue?: string
    onClose: () => void
    title: JSX.Element
}

const CreateCategory = (props: Props): JSX.Element => {
    const intl = useIntl()
    const me = useAppSelector<IUser|null>(getMe)
    const team = useAppSelector(getCurrentTeam)
    const teamID = team?.id || ''
    const placeholder = intl.formatMessage({id: 'Categories.CreateCategoryDialog.Placeholder', defaultMessage: 'Name your category'})
    const cancelText = intl.formatMessage({id: 'Categories.CreateCategoryDialog.CancelText', defaultMessage: 'Cancel'})
    const createText = intl.formatMessage({id: 'Categories.CreateCategoryDialog.CreateText', defaultMessage: 'Create'})
    const updateText = intl.formatMessage({id: 'Categories.CreateCategoryDialog.UpdateText', defaultMessage: 'Update'})

    const [name, setName] = useState(props.initialValue || '')

    const handleKeypress = (e: KeyboardEvent) => {
        if (e.key === 'Enter') {
            onCreate(name)
        }
    }

    const onCreate = async (categoryName: string) => {
        if (!me) {
            Utils.logError('me not initialized')
            return
        }

        if (props.renameModal) {
            const category: Category = {
                name: categoryName,
                id: props.boardCategoryId,
                userID: me.id,
                teamID,
            } as Category

            await mutator.updateCategory(category)
        } else {
            const category: Category = {
                name: categoryName,
                userID: me.id,
                teamID,
            } as Category

            await mutator.createCategory(category)
        }

        props.onClose()
    }

    return (
        <Dialog
            title={props.title}
            className='CreateCategoryModal'
            onClose={props.onClose}
        >
            <div className='CreateCategory'>
                <div className='inputWrapper'>
                    <input
                        className='categoryNameInput'
                        type='text'
                        placeholder={placeholder}
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        autoFocus={true}
                        maxLength={100}
                        onKeyUp={handleKeypress}
                    />
                    {
                        Boolean(name) &&
                        <div
                            className='clearBtn inputWrapper__close-wrapper'
                            onClick={() => setName('')}
                        >
                            <CloseCircle/>
                        </div>
                    }
                </div>
                <div className='createCategoryActions'>
                    <Button
                        size={'medium'}
                        danger={true}
                        onClick={props.onClose}
                    >
                        {cancelText}
                    </Button>
                    <Button
                        size={'medium'}
                        filled={Boolean(name.trim())}
                        onClick={() => onCreate(name.trim())}
                        disabled={!(name.trim())}
                    >
                        {props.initialValue ? updateText : createText}
                    </Button>
                </div>
            </div>
        </Dialog>
    )
}

export default CreateCategory
