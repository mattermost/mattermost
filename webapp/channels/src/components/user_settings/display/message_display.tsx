// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback} from 'react';
import {FormattedMessage} from 'react-intl';

import {Preferences} from 'utils/constants';

import {renderHelpText, useUserSetting, type InputRenderProps} from '../user_setting';
import {onRadioChange, renderRadioInputs, type UserSettingRadioProps} from '../user_setting_radio';

const messageDisplayOptions = [
    Preferences.MESSAGE_DISPLAY_CLEAN,
    Preferences.MESSAGE_DISPLAY_COMPACT,
];

export interface MessageDisplayProps extends Pick<UserSettingRadioProps, 'activeSection' | 'currentValue' | 'onSubmit' | 'updateSection'> {}

/*

Notes:
1. I probably shouldn't have started this whole thing since I've spent a ton of my time last night and then most of my
    work time today refactoring all of this. It's been fun but arguably mildly pointless as a work task, and if I'm
    coding something because I want to, I arguably should be doing it for something for my own benefit rather than
    the company's. I could spend eons pontificating about that though, and I assume anyone close to me would just tell
    me I could do whatever. I also definitely don't need to write all this out, but I similarly just want to :P. Anyway...
2. Making MessageDisplay work has been a pain. I'm not the happiest with having to take helpText out of useUserSetting,
    but unless I split that hook up between state and rendering (which is starting to seem appealing actually), it's
    not the worst thing ever. I kind of like the approach of exposing some of the inner functions of useRadioSetting,
    but I'm not fully sold on it. Regardless, the current state of things might let me render this component how I want
    while still using the exported parts of useRadioSetting.
3. The place where I'm currently stuck is that I can't track the colorize state separately because this code doesn't
    know if the section is active. I started down a rabbit hole of either making it so you could provide an ID to
    useUserSettings, and that made me realize that I really would've saved myself a crapton of snapshot headaches if
    I had just done that to begin with. useId is cool, but I've definitely pushed too hard to use it here.
        a. I'm currently thinking that I should allow the caller to pass IDs and provide an optional one if not.
            Part of me still wants to make it optional for the sake of 1 less prop in most cases, but that seems like
            a pointless stand to make when it makes these snapshots change constantly as a tradeoff. Even making it
            optional doesn't seem worth the extra complexity if I'm leaving it as-is for snapshots.
        b. This is less of an issue if I split up useUserSetting, but at this moment, I think the snapshot stability
            may be more than worth it.
        c. Also, changing those IDs are probably going to break some E2E tests that depend on the wrong thing :P.
        d. Live and learn, I guess. I should stop ruminating on this since I'm going in circles.
        e. Also, I wouldn't even need to be considering snapshots if we didn't have a load of them here :P.

TODO:
1. Go back and make section IDs mandatory again.
2. Finish MessageDisplay
3. Stop worrying about helpText right now.
4. Do something that's not this, dummy.

*/

export default function MessageDisplay({activeSection, ...otherProps}: MessageDisplayProps) {
    const renderInputs = useCallback((inputProps: InputRenderProps<string>) => {
        return (
            <>
                {renderRadioInputs(messageDisplayOptions, renderMessageDisplayLabel, inputProps)}
                {renderHelpText(
                    <FormattedMessage
                        id='user.settings.display.teammateNameDisplayDescription'
                        defaultMessage={'Set how to display other user\'s names in posts and the Direct Messages list.'}
                    />,
                )}
            </>
        );
    }, []);

    const {component} = useUserSetting({
        ...otherProps,
        ...sectionProps,
        onChange: onRadioChange,
        renderInputs,
        renderMinDescription: renderMessageDisplayLabel,
        title: (
            <FormattedMessage
                id='user.settings.display.teammateNameDisplayTitle'
                defaultMessage='Teammate Name Display'
            />
        ),
    });

    const [colorizeUsernames] = useSettingState(active, false);

    return component;

    // secondOption: {
    //     childOption: {
    //         label: defineMessage({
    //             id: 'user.settings.display.colorize',
    //             defaultMessage: 'Colorize usernames',
    //         }),
    //         value: this.state.colorizeUsernames,
    //         display: 'colorizeUsernames',
    //         more: defineMessage({
    //             id: 'user.settings.display.colorizeDes',
    //             defaultMessage: 'Use colors to distinguish users in compact mode',
    //         }),
    //     },
    // },
}

function renderMessageDisplayLabel(value: string) {
    if (value === Preferences.MESSAGE_DISPLAY_CLEAN) {
        return (
            <>
                <FormattedMessage
                    id='user.settings.display.messageDisplayClean'
                    defaultMessage='Standard'
                />
                {': '}
                <FormattedMessage
                    id='user.settings.display.messageDisplayCleanDes'
                    defaultMessage='Easy to scan and read.'
                />
            </>
        );
    }

    return (
        <>
            <FormattedMessage
                id='user.settings.display.messageDisplayCompact'
                defaultMessage='Compact'
            />
            {': '}
            <FormattedMessage
                id='user.settings.display.messageDisplayCompactDes'
                defaultMessage='Fit as many messages on the screen as we can.'
            />
        </>
    );
}
