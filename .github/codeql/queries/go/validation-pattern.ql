/**
 * @name API Handler Validation Pattern
 * @description Ensures that API handlers use the validation package for input validation
 * @kind problem
 * @problem.severity warning
 * @precision high
 * @id go/validation-pattern
 */

import go

/**
 * List of files that should use the new validation pattern
 */
predicate isTargetedFile(File f) {
  // Add files as they are migrated to the new pattern
  f.getBaseName() = "metrics.go"
  // Add more files as needed
}

/**
 * Find all HTTP handler functions in the api4 package in targeted files
 */
predicate isAPIHandler(Function f) {
  f.getPackage().getName() = "api4" and
  isTargetedFile(f.getFile()) and
  f.getParameter(0).getType().getName() = "Context" and
  f.getParameter(1).getType().getName() = "http.ResponseWriter" and
  f.getParameter(2).getType().getName() = "*http.Request"
}

/**
 * Checks if a function name follows our validation naming pattern
 */
predicate isValidationFunction(string name) {
  name.matches("Validate%")
}

/**
 * Find validation function calls
 */
predicate callsValidation(Function f) {
  exists(CallExpr call |
    isValidationFunction(call.getTarget().getName()) and
    call.getEnclosingFunction() = f
  )
}

from Function f
where isAPIHandler(f) and not callsValidation(f)
select f, "HTTP handler does not validate input using the validation framework" 