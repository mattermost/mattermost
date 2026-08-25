// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {CSSProp} from 'styled-components';

// Enable styled-component's CSS prop as per https://styled-components.com/docs/api#usage-with-typescript
declare module 'react' {
    interface Attributes {
        css?: CSSProp;
    }
}
