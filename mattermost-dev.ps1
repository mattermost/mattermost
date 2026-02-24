<#
.SYNOPSIS
    Script quản lý môi trường Mattermost local development

.DESCRIPTION
    Cung cấp các lệnh để khởi động, dừng, và kiểm tra trạng thái Mattermost local

.EXAMPLE
    .\mattermost-dev.ps1 start    # Khởi động Mattermost
    .\mattermost-dev.ps1 stop     # Dừng Mattermost
    .\mattermost-dev.ps1 status   # Kiểm tra trạng thái
    .\mattermost-dev.ps1 logs     # Xem logs
    .\mattermost-dev.ps1 clean    # Xóa toàn bộ dữ liệu (cẩn thận!)
#>

param(
    [Parameter(Mandatory=$false)]
    [ValidateSet("start", "stop", "restart", "status", "logs", "clean", "help")]
    [string]$Action = "help"
)

$ComposeFile = Join-Path $PSScriptRoot "docker-compose.dev.yml"

function Check-Docker {
    try {
        docker info 2>&1 | Out-Null
        if ($LASTEXITCODE -ne 0) {
            Write-Host "❌ Docker không chạy. Hãy mở Docker Desktop trước." -ForegroundColor Red
            exit 1
        }
    } catch {
        Write-Host "❌ Docker chưa được cài đặt." -ForegroundColor Red
        Write-Host "   Tải Docker Desktop tại: https://www.docker.com/products/docker-desktop/" -ForegroundColor Yellow
        exit 1
    }
}

switch ($Action) {
    "start" {
        Check-Docker
        Write-Host "🚀 Khởi động Mattermost..." -ForegroundColor Cyan
        docker compose -f $ComposeFile up -d
        if ($LASTEXITCODE -eq 0) {
            Write-Host ""
            Write-Host "✅ Mattermost đang khởi động!" -ForegroundColor Green
            Write-Host "   ⏳ Chờ 30-60 giây để server sẵn sàng..." -ForegroundColor Yellow
            Write-Host ""
            Write-Host "   🌐 Mattermost:      http://localhost:8065" -ForegroundColor Cyan
            Write-Host "   📧 Email (Inbucket): http://localhost:9001" -ForegroundColor Cyan
            Write-Host ""
            Write-Host "   Lần đầu truy cập sẽ được hướng dẫn tạo tài khoản admin." -ForegroundColor Gray
        }
    }

    "stop" {
        Check-Docker
        Write-Host "⏹  Dừng Mattermost..." -ForegroundColor Yellow
        docker compose -f $ComposeFile stop
        Write-Host "✅ Đã dừng Mattermost." -ForegroundColor Green
    }

    "restart" {
        Check-Docker
        Write-Host "🔄 Restart Mattermost..." -ForegroundColor Yellow
        docker compose -f $ComposeFile restart
        Write-Host "✅ Đã restart." -ForegroundColor Green
    }

    "status" {
        Check-Docker
        Write-Host "📊 Trạng thái services:" -ForegroundColor Cyan
        docker compose -f $ComposeFile ps
    }

    "logs" {
        Check-Docker
        Write-Host "📋 Logs Mattermost (Ctrl+C để thoát):" -ForegroundColor Cyan
        docker compose -f $ComposeFile logs -f mattermost
    }

    "clean" {
        Check-Docker
        Write-Host "⚠️  Cảnh báo: Thao tác này sẽ XÓA toàn bộ dữ liệu Mattermost!" -ForegroundColor Red
        $confirm = Read-Host "Nhập 'YES' để xác nhận"
        if ($confirm -eq "YES") {
            docker compose -f $ComposeFile down -v
            Write-Host "✅ Đã xóa toàn bộ containers và volumes." -ForegroundColor Green
        } else {
            Write-Host "Đã hủy." -ForegroundColor Gray
        }
    }

    "help" {
        Write-Host ""
        Write-Host "🔧 Mattermost Local Dev - Các lệnh:" -ForegroundColor Cyan
        Write-Host ""
        Write-Host "  .\mattermost-dev.ps1 start    Khởi động Mattermost"
        Write-Host "  .\mattermost-dev.ps1 stop     Dừng Mattermost"
        Write-Host "  .\mattermost-dev.ps1 restart  Restart Mattermost"
        Write-Host "  .\mattermost-dev.ps1 status   Xem trạng thái containers"
        Write-Host "  .\mattermost-dev.ps1 logs     Xem logs realtime"
        Write-Host "  .\mattermost-dev.ps1 clean    Xóa toàn bộ dữ liệu"
        Write-Host ""
        Write-Host "  🌐 URL sau khi start: http://localhost:8065" -ForegroundColor Green
        Write-Host ""
    }
}
