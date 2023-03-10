// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import Editor from '@draft-js-plugins/editor'
import createEmojiPlugin from '@draft-js-plugins/emoji'
import '@draft-js-plugins/emoji/lib/plugin.css'
import createMentionPlugin from '@draft-js-plugins/mention'
import '@draft-js-plugins/mention/lib/plugin.css'
import {
    ContentState,
    DraftHandleValue,
    EditorState,
    getDefaultKeyBinding
} from 'draft-js'
import React, {
    ReactElement,
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState
} from 'react'

import {debounce} from 'lodash'

import {useAppSelector} from 'src/store/hooks'
import {IUser} from 'src/user'
import {getBoardUsersList, getMe} from 'src/store/users'
import createLiveMarkdownPlugin from 'src/components/live-markdown-plugin/liveMarkdownPlugin'
import {useHasPermissions} from 'src/hooks/permissions'
import {Permission} from 'src/constants'
import {BoardMember, BoardTypeOpen, MemberRole} from 'src/blocks/board'
import mutator from 'src/mutator'
import ConfirmAddUserForNotifications from 'src/components/confirmAddUserForNotifications'
import RootPortal from 'src/components/rootPortal'

import './markdownEditorInput.scss'

import {getCurrentBoard} from 'src/store/boards'
import octoClient from 'src/octoClient'

import {Utils} from 'src/utils'
import {ClientConfig} from 'src/config/clientConfig'
import {getClientConfig} from 'src/store/clientConfig'

import Entry from './entryComponent/entryComponent'

const imageURLForUser = (window as any).Components?.imageURLForUser

type MentionUser = {
    user: IUser
    name: string
    avatar: string
    is_bot: boolean
    is_guest: boolean
    displayName: string
    isBoardMember: boolean
}

type Props = {
    onChange?: (text: string) => void
    onFocus?: () => void
    onBlur?: (text: string) => void
    onEditorCancel?: () => void
    initialText?: string
    id?: string
    isEditing: boolean
    saveOnEnter?: boolean
}

const MarkdownEditorInput = (props: Props): ReactElement => {
    const {onChange, onFocus, onBlur, initialText, id} = props
    const boardUsers = useAppSelector<IUser[]>(getBoardUsersList)
    const board = useAppSelector(getCurrentBoard)
    const clientConfig = useAppSelector<ClientConfig>(getClientConfig)
    const ref = useRef<Editor>(null)
    const allowManageBoardRoles = useHasPermissions(board.teamId, board.id, [Permission.ManageBoardRoles])
    const [confirmAddUser, setConfirmAddUser] = useState<IUser|null>(null)
    const me = useAppSelector<IUser|null>(getMe)

    const [suggestions, setSuggestions] = useState<MentionUser[]>([])

    const loadSuggestions = async (term: string) => {
        let users: IUser[]

        if (!me?.is_guest && (allowManageBoardRoles || (board && board.type === BoardTypeOpen))) {
            const excludeBots = true
            users = await octoClient.searchTeamUsers(term, excludeBots)
        } else {
            users = boardUsers.
                filter((user) => {
                    // no search term
                    if (!term) {
                        return true
                    }

                    // does the search term occur anywhere in the display name?
                    return Utils.getUserDisplayName(user, clientConfig.teammateNameDisplay).includes(term)
                }).

                // first 10 results
                slice(0, 10)
        }

        const mentions: MentionUser[] = users.map(
            (user: IUser): MentionUser => ({
                name: user.username,
                avatar: `${imageURLForUser ? imageURLForUser(user.id) : ''}`,
                is_bot: user.is_bot,
                is_guest: user.is_guest,
                displayName: Utils.getUserDisplayName(user, clientConfig.teammateNameDisplay),
                isBoardMember: Boolean(boardUsers.find((u) => u.id === user.id)),
                user,
            }))
        setSuggestions(mentions)
    }

    const debouncedLoadSuggestion = useMemo(() => debounce(loadSuggestions, 200), [])

    useEffect(() => {
        // Get the ball rolling. Searching for empty string
        // returns first 10 users in alphabetical order.
        loadSuggestions('')
    }, [])

    const generateEditorState = (text?: string) => {
        const state = EditorState.createWithContent(ContentState.createFromText(text || ''))
        return EditorState.moveSelectionToEnd(state)
    }

    const [editorState, setEditorState] = useState(() => generateEditorState(initialText))

    const addUser = useCallback(async (userId: string, role: string) => {
        const newRole = role || MemberRole.Viewer
        const newMember = {
            boardId: board.id,
            userId,
            roles: role,
            schemeAdmin: newRole === MemberRole.Admin,
            schemeEditor: newRole === MemberRole.Admin || newRole === MemberRole.Editor,
            schemeCommenter: newRole === MemberRole.Admin || newRole === MemberRole.Editor || newRole === MemberRole.Commenter,
            schemeViewer: newRole === MemberRole.Admin || newRole === MemberRole.Editor || newRole === MemberRole.Commenter || newRole === MemberRole.Viewer,
        } as BoardMember

        setConfirmAddUser(null)
        setEditorState(EditorState.moveSelectionToEnd(editorState))
        ref.current?.focus()
        await mutator.createBoardMember(newMember)
    }, [board, editorState])

    const [initialTextCache, setInitialTextCache] = useState<string | undefined>(initialText)
    const [initialTextUsed, setInitialTextUsed] = useState<boolean>(false)

    // avoiding stale closure
    useEffect(() => {
        // only change editor state when initialText actually changes from one defined value to another.
        // This is needed to make the mentions plugin work. For some reason, if we don't check
        // for this if condition here, mentions don't work. I suspect it's because without
        // the in condition, we're changing editor state twice during component initialization
        // and for some reason it causes mentions to not show up.

        // initial text should only be used once, i'e', initially
        // `initialTextUsed` flag records if the initialText prop has been used
        // to se the editor state once as a truthy value.
        // Once used, we don't react to its changing value

        if (!initialTextUsed && initialText && initialText !== initialTextCache) {
            setEditorState(generateEditorState(initialText || ''))
            setInitialTextCache(initialText)
            setInitialTextUsed(true)
        }
    }, [initialText])

    const [isMentionPopoverOpen, setIsMentionPopoverOpen] = useState(false)
    const [isEmojiPopoverOpen, setIsEmojiPopoverOpen] = useState(false)

    const {MentionSuggestions, plugins, EmojiSuggestions} = useMemo(() => {
        const mentionPlugin = createMentionPlugin({mentionPrefix: '@'})
        const emojiPlugin = createEmojiPlugin()
        const markdownPlugin = createLiveMarkdownPlugin()

        // eslint-disable-next-line @typescript-eslint/no-shadow
        const {EmojiSuggestions} = emojiPlugin
        // eslint-disable-next-line @typescript-eslint/no-shadow
        const {MentionSuggestions} = mentionPlugin
        // eslint-disable-next-line @typescript-eslint/no-shadow
        const plugins = [
            mentionPlugin,
            emojiPlugin,
            markdownPlugin,
        ]
        return {plugins, MentionSuggestions, EmojiSuggestions}
    }, [])

    const onEditorStateChange = useCallback((newEditorState: EditorState) => {
        // newEditorState.
        const newText = newEditorState.getCurrentContent().getPlainText()

        onChange && onChange(newText)
        setEditorState(newEditorState)
    }, [onChange])

    const customKeyBindingFn = useCallback((e: React.KeyboardEvent) => {
        if (isMentionPopoverOpen || isEmojiPopoverOpen) {
            return undefined
        }

        if (e.key === 'Escape') {
            return 'editor-blur'
        }

        if (e.key === 'Backspace') {
            return 'backspace'
        }

        if (getDefaultKeyBinding(e) === 'undo') {
            return 'editor-undo'
        }

        if (getDefaultKeyBinding(e) === 'redo') {
            return 'editor-redo'
        }

        return getDefaultKeyBinding(e as any)
    }, [isEmojiPopoverOpen, isMentionPopoverOpen])

    const handleKeyCommand = useCallback((command: string, currentState: EditorState): DraftHandleValue => {
        if (command === 'editor-blur') {
            ref.current?.blur()
            return 'handled'
        }

        if (command === 'editor-redo') {
            const selectionRemovedState = EditorState.redo(currentState)
            onEditorStateChange(EditorState.redo(selectionRemovedState))

            return 'handled'
        }

        if (command === 'editor-undo') {
            const selectionRemovedState = EditorState.undo(currentState)
            onEditorStateChange(EditorState.undo(selectionRemovedState))

            return 'handled'
        }

        if (command === 'backspace') {
            if (props.onEditorCancel && editorState.getCurrentContent().getPlainText().length === 0) {
                props.onEditorCancel()
                return 'handled'
            }
        }

        return 'not-handled'
    }, [props.onEditorCancel, editorState])

    const onEditorStateBlur = useCallback(() => {
        if (confirmAddUser) {
            return
        }
        const text = editorState.getCurrentContent().getPlainText()
        onBlur && onBlur(text)
    }, [editorState.getCurrentContent().getPlainText(), onBlur, confirmAddUser])

    const onMentionPopoverOpenChange = useCallback((open: boolean) => {
        setIsMentionPopoverOpen(open)
    }, [])

    const onEmojiPopoverOpen = useCallback(() => {
        setIsEmojiPopoverOpen(true)
    }, [])

    const onEmojiPopoverClose = useCallback(() => {
        setIsEmojiPopoverOpen(false)
    }, [])

    const onSearchChange = useCallback(({value}: { value: string }) => {
        debouncedLoadSuggestion(value)
    }, [suggestions])

    const className = 'MarkdownEditorInput'

    const handleReturn = (e: any, state: EditorState): DraftHandleValue => {
        if (!e.shiftKey) {
            const text = state.getCurrentContent().getPlainText()
            onBlur && onBlur(text)
            return 'handled'
        }
        return 'not-handled'
    }

    return (
        <div
            className={className}
            onKeyDown={(e: React.KeyboardEvent) => {
                if (isMentionPopoverOpen || isEmojiPopoverOpen) {
                    e.stopPropagation()
                }
            }}
        >
            <Editor
                editorKey={id}
                editorState={editorState}
                onChange={onEditorStateChange}
                plugins={plugins}
                ref={ref}
                onBlur={onEditorStateBlur}
                onFocus={onFocus}
                keyBindingFn={customKeyBindingFn}
                handleKeyCommand={handleKeyCommand}
                handleReturn={props.saveOnEnter ? handleReturn : undefined}
            />
            <MentionSuggestions
                open={isMentionPopoverOpen}
                onOpenChange={onMentionPopoverOpenChange}
                suggestions={suggestions}
                onSearchChange={onSearchChange}
                entryComponent={Entry}
                onAddMention={(mention) => {
                    if (mention.isBoardMember) {
                        return
                    }
                    setConfirmAddUser(mention.user)
                }}
            />
            <EmojiSuggestions
                onOpen={onEmojiPopoverOpen}
                onClose={onEmojiPopoverClose}
            />
            {confirmAddUser &&
                <RootPortal>
                    <ConfirmAddUserForNotifications
                        allowManageBoardRoles={allowManageBoardRoles}
                        minimumRole={board.minimumRole}
                        user={confirmAddUser}
                        onConfirm={addUser}
                        onClose={() => {
                            setConfirmAddUser(null)
                            setEditorState(EditorState.moveSelectionToEnd(editorState))
                            ref.current?.focus()
                        }}
                    />
                </RootPortal>}
        </div>
    )
}

export default MarkdownEditorInput
