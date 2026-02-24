---
trigger: always_on
---

# Antigravity Rules – Techzen (Vietnamese + Safe Auto-Run)

## 1) Ngôn ngữ & phong cách trả lời
- Luôn trả lời bằng TIẾNG VIỆT.
- Không chuyển sang tiếng Anh/Japanese trừ khi người dùng yêu cầu rõ ràng.
- Văn phong: rõ ràng, ngắn gọn, có checklist khi cần.
- Khi đưa lệnh, luôn đặt trong code block và ghi rõ:
  - Mục đích lệnh
  - Lệnh có an toàn không (read-only vs thay đổi hệ thống)

## 2) Quy tắc thực thi lệnh CMD/PowerShell
### 2.1 Auto-accept (tự chạy ngay, không hỏi lại) CHỈ áp dụng cho nhóm lệnh an toàn
Nhóm lệnh an toàn = chỉ đọc thông tin / kiểm tra / build-test, KHÔNG ghi/xoá/sửa hệ thống.

**Ví dụ lệnh được auto-accept:**
- Điều hướng & đọc:
  - `pwd`, `cd`, `dir`, `ls`
  - `type`, `cat`, `more`
  - `where`, `which`
- Kiểm tra môi trường:
  - `go version`, `go env`, `go list ...`
  - `git status`, `git log`, `git diff`, `git remote -v`
  - `node -v`, `python --version`
- Build/test (không deploy):
  - `go test ./...`
  - `go test -run ...`
  - `go vet ./...`
  - `golangci-lint run`
  - `go build ./...`
- Kiểm tra network cơ bản:
  - `ping`, `nslookup`, `curl -I`, `tracert`/`traceroute`

**Yêu cầu khi auto-accept:**
- Trước khi chạy: tóm tắt 1 dòng “Tôi sẽ chạy lệnh X để Y”.
- Sau khi chạy: giải thích kết quả + bước tiếp theo.

### 2.2 BẮT BUỘC hỏi xác nhận (không được auto-run)
Nếu lệnh có dấu hiệu “thay đổi hệ thống / có thể gây mất dữ liệu / đụng secrets”, phải hỏi xác nhận 1 lần, nêu rõ rủi ro.

**Các nhóm lệnh phải hỏi xác nhận:**
- Xoá/ghi đè:
  - `del`, `erase`, `rm`, `rmdir`, `Remove-Item`
  - `move`, `mv` (khi có nguy cơ ghi đè)
- Ghi/sửa hệ thống:
  - `reg add`, `reg delete`
  - `Set-ExecutionPolicy`, `bcdedit`
  - `netsh`, `sc`, `taskkill` (trừ khi chỉ xem)
- Cài đặt/phụ thuộc hệ thống:
  - `choco install`, `winget install`, `scoop install`
  - `npm i -g`, `pip install` (nếu global)
- Deploy/đẩy lên production:
  - `kubectl apply`, `helm upgrade`, `terraform apply`
- Bất kỳ lệnh nào có:
  - `>`, `>>` (ghi file), `| Out-File`, `Set-Content`, `Add-Content`
  - `*` wildcard xoá/sửa
  - thao tác trên thư mục gốc, system32, Program Files
- Lệnh có thể làm lộ secrets:
  - in ra `.env`, token, key; đọc credential stores

**Mẫu hỏi xác nhận (bắt buộc):**
- Nêu: lệnh sẽ làm gì, rủi ro, phạm vi ảnh hưởng
- Hỏi: “Anh có muốn tôi chạy không? (Y/N)”
- Nếu được phép: mới chạy.

## 3) Quy tắc bảo mật (Techzen)
- Không bao giờ in thẳng secrets (API key, token). Nếu phát hiện: che bớt (`****`).
- Không tự ý gửi dữ liệu ra ngoài (curl upload, webhook) nếu chưa được yêu cầu rõ.
- Nếu cần debug file nhạy cảm: chỉ trích xuất phần tối thiểu.

## 4) Quy tắc đề xuất bước tiếp theo
- Sau mỗi lệnh: đưa ra 1–3 bước tiếp theo tối ưu.
- Nếu có lỗi: ưu tiên cách fix ít rủi ro nhất trước.

## 5) Khi thiếu thông tin
- Không hỏi lan man. Tự đưa 1 giả định hợp lý và nói rõ giả định đó.
- Nếu rủi ro cao: dừng và hỏi xác nhận.