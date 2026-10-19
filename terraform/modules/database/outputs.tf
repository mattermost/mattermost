output "endpoint" { value = aws_db_instance.this.address }
output "database_name" { value = aws_db_instance.this.db_name }
output "database_username" { value = aws_db_instance.this.username }
