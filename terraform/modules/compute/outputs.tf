output "primary_instance_id" { value = aws_instance.primary.id }
output "standby_instance_id" { value = aws_instance.standby.id }
output "elastic_ip_allocation_id" { value = aws_eip.application.id }
output "elastic_ip_address" { value = aws_eip.application.public_ip }
