// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {memo, useMemo} from 'react';

import Code from './code';

type Props = {
    query: string;
    args?: string[];
    inline?: boolean;
}

function Sql({query, args, inline}: Props) {
    const code = useMemo(() => {
        return query.replace(
            /\$\b\d\b/gm,
            (pl: string) => {
                const index = Number(pl.replace('$', ''));
                if (args?.length && args[index - 1] !== undefined) {
                    const val = args[index - 1];
                    if (typeof val === 'number') {
                        return val;
                    }
                    if (typeof val === 'boolean') {
                        if (val) {
                            return 'true';
                        }
                        return 'false';
                    }
                    if (typeof val === 'string') {
                        return `"${val}"`;
                    }
                    return val;
                }
                return pl;
            },
        );
    }, [query, args]);

    return (
        <Code
            code={code}
            language='sql'
            inline={inline}
        />
    );
}

export default memo(Sql);
