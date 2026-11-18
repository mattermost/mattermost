import React from 'react';

import type {PluginManifest} from '../types/plugins';

export const SLOTS = {
    header_button: 'checks.plugins.action:{plugin}--button',
    gone: 'checks.plugins.removed:{plugin}--button',
    unkeyed: 'checks.plugins.by_name:{plugin}--button',
} as const;

export function PluginButtons({plugs}: {plugs: PluginManifest[]}) {
    return (
        <div>
            {plugs.map((p) => (
                <React.Fragment key={p.id}>
                    <button data-testid={`checks.plugins.action:${p.id}--button`}/>
                    <button data-testid={`checks.plugins.by_name:${p.name}--button`}/>
                    <button data-testid={`checks.plugins.extra:${p.id}--button`}/>
                </React.Fragment>
            ))}
        </div>
    );
}
