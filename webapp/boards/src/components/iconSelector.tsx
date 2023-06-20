// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import React from 'react'
import {useIntl} from 'react-intl'

import RandomIcon from 'src/widgets/icons/random'
import EmojiPicker from 'src/widgets/emojiPicker'
import DeleteIcon from 'src/widgets/icons/delete'
import EmojiIcon from 'src/widgets/icons/emoji'
import Menu from 'src/widgets/menu'
import MenuWrapper from 'src/widgets/menuWrapper'
import './iconSelector.scss'

type Props = {
    readonly?: boolean
    iconElement: any
    onAddRandomIcon: any
    onSelectEmoji: any
    onRemoveIcon: any
}

const IconSelector = (props: Props) => {
    const intl = useIntl()

    return (
        <div className='IconSelector'>
            {props.readonly && props.iconElement}
            {!props.readonly &&
                <MenuWrapper>
                    {props.iconElement}
                    <Menu>
                        <Menu.Text
                            id='random'
                            icon={<RandomIcon/>}
                            name={intl.formatMessage({id: 'ViewTitle.random-icon', defaultMessage: 'Random'})}
                            onClick={props.onAddRandomIcon}
                        />
                        <Menu.SubMenu
                            id='pick'
                            icon={<EmojiIcon/>}
                            name={intl.formatMessage({id: 'ViewTitle.pick-icon', defaultMessage: 'Pick icon'})}
                        >
                            <EmojiPicker onSelect={props.onSelectEmoji}/>
                        </Menu.SubMenu>
                        <Menu.Text
                            id='remove'
                            icon={<DeleteIcon/>}
                            name={intl.formatMessage({id: 'ViewTitle.remove-icon', defaultMessage: 'Remove icon'})}
                            onClick={props.onRemoveIcon}
                        />
                    </Menu>
                </MenuWrapper>
            }
        </div>
    )
}

export default React.memo(IconSelector)
