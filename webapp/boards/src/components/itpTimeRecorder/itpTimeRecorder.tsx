import React from 'react'
import {Board} from 'src/blocks/board'
import {Card} from 'src/blocks/card'
import {IUser} from 'src/user'
import {getMe} from 'src/store/users'

import {useAppDispatch, useAppSelector} from 'src/store/hooks'

interface Props {
    board: Board,
    card: Card
}

const ItpTimeRecorder = ({ board, card }: Props) => {

    const me = useAppSelector<IUser|null>(getMe);
    
    return (
        <button>Start Recording</button>
    )
}

export default ItpTimeRecorder;