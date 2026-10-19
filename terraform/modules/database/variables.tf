variable "name_prefix" { type = string }
variable "private_subnet_ids" { type = list(string) }
variable "database_security_group_id" { type = string }
variable "database_password" {
  type      = string
  sensitive = true
}
variable "db_instance_class" {
  type    = string
  default = "db.t3.micro"
}
