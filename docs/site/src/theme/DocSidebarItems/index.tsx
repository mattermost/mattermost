import React from 'react';
import DocSidebarItems from '@theme-original/DocSidebarItems';
import type DocSidebarItemsType from '@theme/DocSidebarItems';
import type {WrapperProps} from '@docusaurus/types';
import {useActivePlugin} from '@docusaurus/plugin-content-docs/client';
import ApiSearch from '@site/src/components/ApiSearch';

type Props = WrapperProps<typeof DocSidebarItemsType>;

/**
 * Puts the endpoint search box at the top of the API sidebar.
 *
 * `DocSidebarItems` is the one theme component both the desktop sidebar and
 * the mobile navbar panel render their items through, so wrapping it covers
 * both surfaces with a single override. It's also rendered once per nesting
 * level, hence the `level === 1` guard — otherwise every tag group would
 * grow its own search box.
 *
 * Only the `api` docs instance gets it (see docusaurus.config.ts for the
 * three instances); the Documentation and Developers sidebars are prose and
 * are served by site search.
 */
export default function DocSidebarItemsWrapper(props: Props): React.ReactElement {
  const activePlugin = useActivePlugin();
  const isApiRoot = props.level === 1 && activePlugin?.pluginId === 'api';

  if (!isApiRoot) {
    return <DocSidebarItems {...props} />;
  }

  return (
    <ApiSearch variant="sidebar">
      <DocSidebarItems {...props} />
    </ApiSearch>
  );
}
