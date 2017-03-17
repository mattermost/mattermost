import deprecate from './deprecate'
import useQueries from './useQueries'

export default deprecate(
  useQueries,
  'enableQueries is deprecated, use useQueries instead'
)
