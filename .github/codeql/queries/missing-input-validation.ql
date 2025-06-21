/**
 * @name Missing Input Validation
 * @description HTTP handlers should validate input using the validation framework
 * @kind problem
 * @problem.severity error
 * @precision high
 */
import go
// List of files that should use the new validation pattern
predicate isTargetedFile(File f) {
  // Add files as they are migrated to the new pattern
  f.getBaseName() = "brand.go"
  // Add more files as needed
}
// Find all HTTP handler functions in the api4 package in targeted files
predicate isAPIHandler(Function f) {
  f.getPackage().getName() = "api4" and
  isTargetedFile(f.getFile()) and
  f.getParameter(0).getType().getName() = "Context" and
  f.getParameter(1).getType().getName() = "http.ResponseWriter" and
  f.getParameter(2).getType().getName() = "*http.Request"
}
// Find validation function calls
predicate callsValidation(Function f) {
  exists(CallExpr call |
    call.getTarget().getName() = "ValidateRequest" and
    call.getEnclosingFunction() = f
  )
}
from Function f
where isAPIHandler(f) and not callsValidation(f)
select f, "HTTP handler does not validate input using the validation framework"