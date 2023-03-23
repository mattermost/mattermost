// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import React, {useState, useMemo} from 'react'

import {Constants} from 'src/constants'

import './calculationRow.scss'
import {Board, IPropertyTemplate} from 'src/blocks/board'

import mutator from 'src/mutator'
import Calculation from 'src/components/calculations/calculation'
import {BoardView} from 'src/blocks/boardView'
import {Card} from 'src/blocks/card'
import {Options} from 'src/components/calculations/options'

import {TableCalculationOptions} from './tableCalculationOptions'

type Props = {
    board: Board
    cards: Card[]
    activeView: BoardView
    readonly: boolean
}

const CalculationRow = (props: Props): JSX.Element => {
    const {board, cards, activeView, readonly} = props
    const toggleOptions = (templateId: string, show: boolean) => {
        const newShowOptions = new Map<string, boolean>(showOptions)
        newShowOptions.set(templateId, show)
        setShowOptions(newShowOptions)
    }

    const [showOptions, setShowOptions] = useState<Map<string, boolean>>(new Map<string, boolean>())
    const titleTemplate: IPropertyTemplate = {
        id: Constants.titleColumnId,
    } as IPropertyTemplate

    const visiblePropertyTemplates = useMemo(() => ([
        titleTemplate,
        ...activeView.fields.visiblePropertyIds.map((id) => board.cardProperties.find((t) => t.id === id)).filter((i) => i) as IPropertyTemplate[],
    ]), [board.cardProperties, activeView.fields.visiblePropertyIds])

    const selectedCalculations = activeView.fields.columnCalculations || []

    const [hovered, setHovered] = useState(false)

    return (
        <div
            className={'CalculationRow octo-table-row'}
            onMouseEnter={() => setHovered(!readonly)}
            onMouseLeave={() => setHovered(false)}
        >
            {
                visiblePropertyTemplates.map((template) => {
                    const defaultValue = template.id === Constants.titleColumnId ? Options.count.value : Options.none.value
                    const value = selectedCalculations[template.id] || defaultValue

                    return (
                        <Calculation
                            key={template.id}
                            class={`octo-table-cell ${readonly ? 'disabled' : ''}`}
                            value={value}
                            menuOpen={Boolean(readonly ? false : showOptions.get(template.id))}
                            onMenuClose={() => toggleOptions(template.id, false)}
                            onMenuOpen={() => toggleOptions(template.id, true)}
                            onChange={(v: string) => {
                                const calculations = {...selectedCalculations}
                                calculations[template.id] = v
                                mutator.changeViewColumnCalculations(board.id, activeView.id, selectedCalculations, calculations, 'change column calculation')
                                setHovered(false)
                            }}
                            cards={cards}
                            property={template}
                            hovered={hovered}
                            optionsComponent={TableCalculationOptions}
                        />
                    )
                })
            }
        </div>
    )
}

export default CalculationRow
