// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import {useHotkeys} from 'react-hotkeys-hook'
import {useIntl} from 'react-intl'

import {sendFlashMessage} from 'src/components/flashMessages'
import mutator from 'src/mutator'
import {Utils} from 'src/utils'

const UndoRedoHotKeys = (): null => {
    const intl = useIntl()

    useHotkeys('ctrl+z,cmd+z', () => {
        Utils.log('Undo')
        if (mutator.canUndo) {
            const description = mutator.undoDescription
            mutator.undo().then(() => {
                if (description) {
                    sendFlashMessage({
                        content: intl.formatMessage({id: 'UndoRedoHotKeys.canUndo-with-description', defaultMessage: 'Undo {description}'}, {description}),
                        severity: 'low',
                    })
                } else {
                    sendFlashMessage({
                        content: intl.formatMessage({id: 'UndoRedoHotKeys.canUndo', defaultMessage: 'Undo'}),
                        severity: 'low'})
                }
            })
        } else {
            sendFlashMessage({
                content: intl.formatMessage({id: 'UndoRedoHotKeys.cannotUndo', defaultMessage: 'Nothing to Undo'}),
                severity: 'low',
            })
        }
    })

    useHotkeys('shift+ctrl+z,shift+cmd+z', () => {
        Utils.log('Redo')
        if (mutator.canRedo) {
            const description = mutator.redoDescription
            mutator.redo().then(() => {
                if (description) {
                    sendFlashMessage({
                        content: intl.formatMessage({id: 'UndoRedoHotKeys.canRedo-with-description', defaultMessage: 'Redo {description}'}, {description}),
                        severity: 'low',
                    })
                } else {
                    sendFlashMessage({
                        content: intl.formatMessage({id: 'UndoRedoHotKeys.canRedo', defaultMessage: 'Redo'}),
                        severity: 'low',
                    })
                }
            })
        } else {
            sendFlashMessage({
                content: intl.formatMessage({id: 'UndoRedoHotKeys.cannotRedo', defaultMessage: 'Nothing to Redo'}),
                severity: 'low',
            })
        }
    })
    return null
}

export default UndoRedoHotKeys
