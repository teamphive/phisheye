output "vpc_id" {
  description = "ID der VPC"
  value       = aws_vpc.main.id
}

output "public_subnet_ids" {
  description = "IDs der öffentlichen Subnets"
  value       = values(aws_subnet.public)[*].id
}

output "private_subnet_ids" {
  description = "IDs der privaten Subnets"
  value       = values(aws_subnet.private)[*].id
}

output "public_route_table_id" {
  description = "ID der öffentlichen Route Table"
  value       = aws_route_table.public.id
}

output "private_route_table_id" {
  description = "ID der privaten Route Table"
  value       = aws_route_table.private.id
}

output "nat_gateway_id" {
  description = "ID des NAT Gateways"
  value       = aws_nat_gateway.main.id
}

output "internet_gateway_id" {
  description = "ID des Internet Gateways"
  value       = aws_internet_gateway.main.id
}