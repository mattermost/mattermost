// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import PostFlagIcon from 'components/post_view/post_flag_icon/post_flag_icon';

import {renderWithContext, screen, userEvent} from 'tests/react_testing_utils';

describe('components/post_view/PostFlagIcon', () => {
    const baseProps = {
        postId: 'post_id',
        isFlagged: false,
        actions: {
            flagPost: jest.fn(),
            unflagPost: jest.fn(),
        },
    };

    test('should match snapshot', async () => {
        const {container, rerender} = renderWithContext(<PostFlagIcon {...baseProps}/>);

        // for unflagged icon
        expect(container).toMatchSnapshot();
        const user = userEvent.setup();
        await user.click(screen.getByRole('button', {name: /save message/i}));
        expect(baseProps.actions.flagPost).toHaveBeenCalledTimes(1);
        expect(baseProps.actions.flagPost).toHaveBeenCalledWith('post_id');
        expect(baseProps.actions.unflagPost).not.toHaveBeenCalled();

        // for flagged icon
        rerender(
            <PostFlagIcon
                {...baseProps}
                isFlagged={true}
            />,
        );
        expect(container).toMatchSnapshot();
        await user.click(screen.getByRole('button', {name: /remove from saved/i}));
        expect(baseProps.actions.flagPost).toHaveBeenCalledTimes(1);
        expect(baseProps.actions.unflagPost).toHaveBeenCalledTimes(1);
        expect(baseProps.actions.unflagPost).toHaveBeenCalledWith('post_id');
    });
});
