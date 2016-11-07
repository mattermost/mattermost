import propName from './propName';

const DEFAULT_OPTIONS = {
  ignoreCase: true,
};

/**
 * Returns the JSXAttribute itself or undefined, indicating the prop
 * is not present on the JSXOpeningElement.
 *
 */
export default function getProp(props = [], prop = '', options = DEFAULT_OPTIONS) {
  let nodeProp;
  const propToFind = options.ignoreCase ? prop.toUpperCase() : prop;

  const hasProp = props.some((attribute) => {
    // If the props contain a spread prop, then skip.
    if (attribute.type === 'JSXSpreadAttribute') {
      return false;
    }

    const currentProp = options.ignoreCase ?
      propName(attribute).toUpperCase() :
      propName(attribute);

    if (propToFind === currentProp) {
      nodeProp = attribute;
      return true;
    }

    return false;
  });

  return hasProp ? nodeProp : undefined;
}
