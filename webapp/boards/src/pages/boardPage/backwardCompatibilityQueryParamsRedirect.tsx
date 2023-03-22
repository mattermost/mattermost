// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

const BackwardCompatibilityQueryParamsRedirect = (): null => {
    // useEffect(() => {
    //     // Backward compatibility: This can be removed in the future, this is for
    //     // transform the old query params into routes
    //     const queryBoardId = queryString.get('id')
    //     const params = {...match.params}
    //     let needsRedirect = false
    //     if (queryBoardId) {
    //         params.boardId = queryBoardId
    //         needsRedirect = true
    //     }
    //     const queryViewId = queryString.get('v')
    //     if (queryViewId) {
    //         params.viewId = queryViewId
    //         needsRedirect = true
    //     }
    //     const queryCardId = queryString.get('c')
    //     if (queryCardId) {
    //         params.cardId = queryCardId
    //         needsRedirect = true
    //     }
    //     if (needsRedirect) {
    //         const newPath = generatePath(match.path, params)
    //         history.replace(newPath)
    //         return
    //     }
    //
    //     // Backward compatibility end
    //     const boardId = match.params.boardId
    //     const viewId = match.params.viewId === '0' ? '' : match.params.viewId
    //
    //     // TODO use actual team ID here
    //     const teamID = 'atjjg8ofqb8kjnwy15yhezdgoh'
    //
    //     if (!boardId) {
    //         // Load last viewed boardView
    //         const lastBoardId = UserSettings.lastBoardId[teamID] || undefined
    //         const lastViewId = lastBoardId ? UserSettings.lastViewId[lastBoardId] : undefined
    //         if (lastBoardId) {
    //             let newPath = generatePath(match.path, {...match.params, boardId: lastBoardId})
    //             if (lastViewId) {
    //                 newPath = generatePath(match.path, {...match.params, boardId: lastBoardId, viewId: lastViewId})
    //             }
    //             history.replace(newPath)
    //             return
    //         }
    //         return
    //     }
    //
    //     Utils.log(`attachToBoard: ${boardId}`)
    //
    //     // Ensure boardViews is for our boardId before redirecting
    //     const isCorrectBoardView = boardViews.length > 0 && boardViews[0].parentId === boardId
    //     if (!viewId && isCorrectBoardView) {
    //         const newPath = generatePath(match.path, {...match.params, boardId, viewId: boardViews[0].id})
    //         history.replace(newPath)
    //         return
    //     }
    //
    //     UserSettings.setLastBoardID(teamId, boardId || '')
    //     if (boardId !== '') {
    //         UserSettings.setLastViewId(boardId, viewId)
    //     }
    //
    //     dispatch(setCurrentBoard(boardId || ''))
    //     dispatch(setCurrentView(viewId || ''))
    // }, [match.params.boardId, match.params.viewId, boardViews])
    return null
}

export default BackwardCompatibilityQueryParamsRedirect
