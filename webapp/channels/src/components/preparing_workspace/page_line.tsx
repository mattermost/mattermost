// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import './page_line.scss';

type Props = {
    style?: Record<string, string>;
    noLeft?: boolean;
}
const PageLine = (props: Props) => {
    let className = 'PageLine';
    if (props.noLeft) {
        className += ' PageLine--no-left';
    }
    const styles: Record<string, string> = {};
    if (props?.style) {
        Object.assign(styles, props.style);
    }
    if (!styles.height) {
        styles.height = '100vh';
    }
    if ((!props.style?.height && styles.height === '100vh') && !styles.marginTop) {
        styles.marginTop = '50px';
    }
    return (
        <div
            className={className}
            style={styles}
        />
    );
};

export default PageLine;
