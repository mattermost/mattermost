// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useMeasurePunchouts} from '@mattermost/components';
import React from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import {useSelector} from 'react-redux';

import {getIsMobileView} from 'selectors/views/browser';

import {ShortcutKey, ShortcutKeyVariant} from 'components/shortcut_key';

import {GlobalState} from 'types/store';

import CRTTourTip from './crt_tour_tip';

const translate = {x: -6, y: 62};

export const UpShortcut = () => {
    const {formatMessage} = useIntl();
    return (<ShortcutKey variant={ShortcutKeyVariant.TutorialTip}>
        {
            formatMessage({
                id: 'tutorial_threads.list.Up',
                defaultMessage: 'UP',
            })
        }
    </ShortcutKey>);
};

export const DownShortcut = () => {
    const {formatMessage} = useIntl();
    return (<ShortcutKey variant={ShortcutKeyVariant.TutorialTip}>
        {
            formatMessage({
                id: 'tutorial_threads.list.Down',
                defaultMessage: 'Down',
            })
        }
    </ShortcutKey>);
};

const CRTListTutorialTip = () => {
    const {formatMessage} = useIntl();
    const isMobileView = useSelector((state: GlobalState) =>
        getIsMobileView(state),
    );
    const title = (
        <FormattedMessage
            id='tutorial_threads.list.title'
            defaultMessage={'Threads List'}
        />
    );

    const screen = (
        <>
            <p>
                {formatMessage({
                    id: 'tutorial_threads.list.description-p1',
                    defaultMessage: 'Here you’ll see a preview of all threads you’re following or participating in. Clicking on a thread in this list will open the full thread on the right.',
                })}
            </p>
            <p>

                {formatMessage({
                    id: 'tutorial_threads.list.description-p2',
                    defaultMessage: 'Use {upKey} / {downKey} to navigate the thread list.',
                },
                {
                    upKey: <UpShortcut/>,
                    downKey: <DownShortcut/>,
                })
                }
            </p>
        </>
    );

    const punchOutIds = isMobileView ? ['tutorial-threads-mobile-list', 'tutorial-threads-mobile-header'] : ['threads-list-container'];
    const overlayPunchOut = useMeasurePunchouts(punchOutIds, []);

    return (
        <CRTTourTip
            title={title}
            screen={screen}
            overlayPunchOut={overlayPunchOut}
            placement='right-start'
            pulsatingDotPlacement='right-start'
            pulsatingDotTranslate={translate}
        />
    );
};

export default CRTListTutorialTip;
