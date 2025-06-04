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
  // f.getBaseName() = "other_file.go"
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
 * Checks if a function calls the validator.Struct() method
 */
predicate callsValidatorStruct(Function f) {
  exists(CallExpr call |
    call.getEnclosingFunction() = f and
    (
      // Direct call to validate.Struct()
      (call.getTarget().getName() = "Struct" and
       call.getAnArgument().getTarget().getName() = "validate") or
      // Method call on validator instance
      (call.getTarget().hasName("Struct") and
       call.getReceiver().getType().getName().matches("%validator%"))
    )
  )
}

/**
 * Checks if a function calls custom validation functions
 */
predicate callsCustomValidation(Function f) {
  exists(CallExpr call |
    call.getEnclosingFunction() = f and
    (
      call.getTarget().getName().matches("validate%Custom") or
      call.getTarget().getName().matches("Validate%") 
    )
  )
}

/**
 * Checks if the function uses any form of validation
 */
predicate usesValidation(Function f) {
  callsValidatorStruct(f) or callsCustomValidation(f)
}

from Function f
where isAPIHandler(f) and not usesValidation(f)
select f, "HTTP handler does not validate input using the validation framework (missing validate.Struct() or custom validation calls)" 