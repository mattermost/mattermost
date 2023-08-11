// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import type {ReactNode, RefObject} from 'react';

import SettingItemMin from 'components/setting_item_min';
import type SettingItemMinComponent from 'components/setting_item_min/setting_item_min';

type Props = {

    /**
     * Whether this setting item is currently open
     */
    active: boolean;

    /**
     * Whether all sections in the panel are currently closed
     */
    areAllSectionsInactive: boolean;

    /**
     * The identifier of this section
     */
    section: string;

    /**
     * The setting UI when it is maximized (open)
     */
    max: ReactNode | null;

    // Props to pass through for SettingItemMin
    updateSection: (section: string) => void;
    title?: ReactNode;
    disableOpen?: boolean;
    describe?: ReactNode;
}
export default class SettingItem extends React.PureComponent<Props> {
    minRef: RefObject<SettingItemMinComponent>;

    static defaultProps = {
        infoPosition: 'bottom',
        saving: false,
        section: '',
        containerStyle: '',
    };

    constructor(props: Props) {
        super(props);
        this.minRef = React.createRef();
    }

    focusEditButton(): void {
        this.minRef.current?.focus();
    }

    componentDidUpdate(prevProps: Props) {
        if (prevProps.active && !this.props.active && this.props.areAllSectionsInactive) {
            this.focusEditButton();
        }
    }

    render() {
        if (this.props.active) {
            return this.props.max;
        }

        return (
            <SettingItemMin
                title={this.props.title}
                updateSection={this.props.updateSection}
                describe={this.props.describe}
                section={this.props.section}
                disableOpen={this.props.disableOpen}
                ref={this.minRef}
            />
        );
    }
}
