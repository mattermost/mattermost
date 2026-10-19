resource "aws_db_subnet_group" "this" {
  name       = "${var.name_prefix}-db-subnets"
  subnet_ids = var.private_subnet_ids
  tags       = { Name = "${var.name_prefix}-db-subnets" }
}

resource "aws_db_parameter_group" "this" {
  name   = "${var.name_prefix}-postgres-params"
  family = "postgres16"

  # Enable DDL statement logging and slow-query logging without logging every DML statement.
  parameter {
    name         = "log_statement"
    value        = "ddl"
    apply_method = "immediate"
  }

  parameter {
    name         = "log_min_duration_statement"
    value        = "1000"
    apply_method = "immediate"
  }

  tags = { Name = "${var.name_prefix}-postgres-params" }
  parameter {
    name         = "rds.force_ssl"
    value        = "1"
    apply_method = "pending-reboot"
  }
}

resource "aws_db_instance" "this" {
  #checkov:skip=CKV_AWS_353:Performance Insights is omitted to control cost in the academic demo.
  #checkov:skip=CKV_AWS_161:Mattermost uses a generated password delivered through SSM SecureString; IAM DB authentication is not used by this application configuration.
  #checkov:skip=CKV_AWS_157:Single-AZ RDS is a deliberate cost trade-off for a short-lived academic demo; production should use Multi-AZ.
  #checkov:skip=CKV_AWS_293:Deletion protection is disabled so the academic environment can be destroyed after evaluation; enable it for production.
  #checkov:skip=CKV_AWS_118:Enhanced Monitoring is omitted to control cost in the academic demo.
  identifier                      = "${var.name_prefix}-postgres"
  engine                          = "postgres"
  engine_version                  = "16"
  instance_class                  = var.db_instance_class
  allocated_storage               = 20
  max_allocated_storage           = 25
  storage_type                    = "gp3"
  storage_encrypted               = true
  db_name                         = "mattermost"
  username                        = "mmuser"
  password                        = var.database_password
  port                            = 5432
  db_subnet_group_name            = aws_db_subnet_group.this.name
  parameter_group_name            = aws_db_parameter_group.this.name
  vpc_security_group_ids          = [var.database_security_group_id]
  publicly_accessible             = false
  multi_az                        = false
  backup_retention_period         = 1
  auto_minor_version_upgrade      = true
  deletion_protection             = false
  skip_final_snapshot             = true
  apply_immediately               = true
  performance_insights_enabled    = false
  enabled_cloudwatch_logs_exports = ["postgresql"]
  copy_tags_to_snapshot           = true
  tags                            = { Name = "${var.name_prefix}-postgres" }
}
