import React from 'react';

import type {Channel} from '../types/channels';

// a key from a display name: an entity field, but not one that tells channels apart or stays the same in every language
export const ChannelLabels = ({channels}: {channels: Channel[]}) => (
    <div>
        {channels.map((c) => (
            <span
                key={c.id}
                data-testid={`values.key_fields.label:${c.display_name}--text`}
            />
        ))}
    </div>
);
