// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import MultiSelect from './multiselect';
import type {Props as MultiSelectProps, Value} from './multiselect';

export type Props<T extends Value> = MultiSelectProps<T> & {
    errorText?: string;
};

export default class MultiSelectWithError<T extends Value> extends React.Component<Props<T>> {
    private multiselect = React.createRef<MultiSelect<T>>();

    public resetPaging = () => {
        this.multiselect.current?.resetPaging();
    };

    render() {
        const {errorText, ...props} = this.props;
        return (
            <>
                <MultiSelect
                    {...props}
                    ref={this.multiselect}
                />
                {errorText && (
                    <div className='error-text'>
                        {errorText}
                    </div>
                )}
            </>
        );
    }
}
