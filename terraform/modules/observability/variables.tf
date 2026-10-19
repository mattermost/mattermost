variable "name_prefix" { type = string }
variable "alert_email" {
  type    = string
  default = ""
}
variable "budget_limit_usd" {
  type    = number
  default = 80
}
