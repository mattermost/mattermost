// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {render} from 'tests/react_testing_utils';
import EmojiMap from 'utils/emoji_map';

import DialogIntroductionText from './dialog_introduction_text';

describe('components/DialogIntroductionText', () => {
    const emojiMap = new EmojiMap(new Map());

    test('should render message with supported values', () => {
        const descriptor = {
            id: 'testsupported',
            value: '**bold** *italic* [link](https://mattermost.com/) <br/> [link target blank](!https://mattermost.com/)',
            emojiMap,
        };
        const {container} = render(<DialogIntroductionText {...descriptor}/>);
        expect(container).toMatchSnapshot();
    });

    test('should not fail on empty value', () => {
        const descriptor = {
            id: 'testblankvalue',
            value: '',
            emojiMap,
        };
        const {container} = render(<DialogIntroductionText {...descriptor}/>);
        expect(container).toMatchSnapshot();
    });
});
