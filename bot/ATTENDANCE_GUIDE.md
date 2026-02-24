# Hướng dẫn sử dụng Attendance Bot

Bot chấm công nội bộ tích hợp với Mattermost, hỗ trợ check-in/out, nghỉ giải lao và xin nghỉ phép. Sử dụng 2 slash command riêng biệt: `/diemdanh` cho chấm công và `/xinphep` cho xin nghỉ phép.

## Mục lục

1. [Dành cho Admin - Thiết lập channels](#dành-cho-admin---thiết-lập-channels)
2. [Dành cho Nhân viên - Sử dụng hàng ngày](#dành-cho-nhân-viên---sử-dụng-hàng-ngày)
3. [Dành cho Quản lý - Duyệt đơn](#dành-cho-quản-lý---duyệt-đơn)

---

## Dành cho Admin - Thiết lập

### Phần A: Setup một lần cho Team

> Các bước này chỉ cần làm **1 lần** khi bắt đầu sử dụng bot cho team.

#### A1. Add Bot vào Team

1. Vào **Team Settings** (click tên team ở góc trái → **Team Settings**)
2. Chọn tab **Members**
3. Click **Add Members**
4. Tìm kiếm `attendance`
5. Click **Add** để thêm bot vào team

> **Lưu ý**: Bot phải được add vào team trước khi có thể add vào các channels trong team đó.

#### A2. Tạo Slash Command `/diemdanh`

Slash command cho phép nhân viên gõ `/diemdanh` để mở menu chấm công.

1. Vào **Main Menu** (☰) → **Integrations**
2. Chọn **Slash Commands** → **Add Slash Command**
3. Điền thông tin:

| Field | Giá trị |
|-------|---------|
| **Title** | Điểm danh |
| **Description** | Chấm công hàng ngày |
| **Command Trigger Word** | `diemdanh` |
| **Request URL** | `http://bot-service:3000/api/diemdanh` |
| **Request Method** | POST |
| **Autocomplete** | ✓ Bật |
| **Autocomplete Hint** | (để trống) |
| **Autocomplete Description** | Mở menu chấm công |

4. Click **Save**

#### A3. Tạo Slash Command `/xinphep`

Slash command cho phép nhân viên gõ `/xinphep` để mở menu xin nghỉ phép.

1. Vào **Main Menu** (☰) → **Integrations**
2. Chọn **Slash Commands** → **Add Slash Command**
3. Điền thông tin:

| Field | Giá trị |
|-------|---------|
| **Title** | Xin phép |
| **Description** | Xin nghỉ phép, đi muộn, về sớm |
| **Command Trigger Word** | `xinphep` |
| **Request URL** | `http://bot-service:3000/api/xinphep` |
| **Request Method** | POST |
| **Autocomplete** | ✓ Bật |
| **Autocomplete Hint** | (để trống) |
| **Autocomplete Description** | Mở menu xin nghỉ phép |

4. Click **Save**

---

### Phần B: Setup cho từng nhóm

> Lặp lại các bước này cho **mỗi nhóm/phòng ban** trong team cần sử dụng chấm công.

#### B1. Tạo cặp Channels (Private)

Mỗi nhóm cần **2 channels** (tạo dạng **Private Channel**):

1. Click **+** bên cạnh "Channels" ở sidebar
2. Chọn **Create New Channel**
3. Điền thông tin:
   - **Name**: `attendance-{nhóm}` hoặc `attendance-approval-{nhóm}`
   - **Type**: Chọn **Private** (quan trọng!)
4. Click **Create Channel**

| Channel | Mô tả | Thành viên |
|---------|-------|------------|
| `#attendance-{nhóm}` | Channel chính - thông báo check-in/out, xin nghỉ | Tất cả nhân viên trong nhóm |
| `#attendance-approval-{nhóm}` | Channel duyệt - có nút Approve/Reject | Chỉ quản lý/team lead |

> **Tại sao dùng Private Channel?**
> - Nhân viên không thể tự join channel - phải được mời
> - Channel approval chỉ có quản lý mới thấy được
> - Kiểm soát được ai có quyền duyệt đơn

**Ví dụ trong 1 team có nhiều nhóm:**

```
Team Engineering:
├── 🔒 #attendance-frontend        → Frontend developers
├── 🔒 #attendance-approval-frontend → Frontend Lead
├── 🔒 #attendance-backend         → Backend developers
├── 🔒 #attendance-approval-backend  → Backend Lead
├── 🔒 #attendance-devops          → DevOps engineers
└── 🔒 #attendance-approval-devops   → DevOps Lead

Team Sales:
├── 🔒 #attendance-sales-north     → Sales miền Bắc
├── 🔒 #attendance-approval-sales-north → Manager miền Bắc
├── 🔒 #attendance-sales-south     → Sales miền Nam
└── 🔒 #attendance-approval-sales-south → Manager miền Nam
```

#### B2. Add Bot vào Channels

Sau khi tạo channels, add bot vào **cả 2 channels**:

1. Mở channel (ví dụ: `#attendance-frontend`)
2. Click **biểu tượng ⓘ** (Channel Info) ở góc phải
3. Click **Members** → **Add Members**
4. Tìm kiếm `attendance`
5. Click **Add** để thêm bot vào channel

**Lặp lại cho cả 2 channels:**
- `#attendance-{nhóm}` - Bot cần ở đây để gửi thông báo check-in/out
- `#attendance-approval-{nhóm}` - Bot cần ở đây để gửi đơn với nút Approve/Reject

> **Quan trọng**: Nếu bot không được add vào channel, bot sẽ không thể gửi tin nhắn hoặc tạo bài post trong channel đó!

#### B3. Mời thành viên vào Channels

- **Channel chính** (`#attendance-{nhóm}`): Mời tất cả nhân viên trong nhóm
- **Channel approval** (`#attendance-approval-{nhóm}`): Chỉ mời quản lý/người có quyền duyệt

#### B4. Quản lý người duyệt đơn

Việc quản lý người duyệt đơn = quản lý thành viên channel approval:

- **Thêm người duyệt**: Mời họ vào channel `#attendance-approval-{nhóm}`
- **Xóa quyền duyệt**: Kick họ khỏi channel `#attendance-approval-{nhóm}`

Không cần cấu hình gì thêm!

---

## Dành cho Nhân viên - Sử dụng hàng ngày

### `/diemdanh` — Chấm công

Vào channel `#attendance-{team}` của bạn và gõ:

```
/diemdanh
```

Menu chấm công sẽ hiện ra (chỉ bạn thấy):

```
┌────────────────────────────────────────────────────────────────────┐
│ [Đi làm] [Tan ca]                                                 │
│ [Nghỉ ngơi] [Đi ăn] [Tiểu tiện] [Đại tiện] [Hút thuốc]          │
│ [Trở lại chỗ ngồi]                                                │
└────────────────────────────────────────────────────────────────────┘
```

#### Đi làm (Check In)
1. Gõ `/diemdanh`
2. Click nút **[Đi làm]**
3. (Tuỳ chọn) Đính kèm ảnh chụp
4. Hệ thống ghi nhận giờ vào và thông báo cho cả channel

#### Nghỉ giải lao
1. Gõ `/diemdanh`
2. Click nút lý do nghỉ: **[Nghỉ ngơi]**, **[Đi ăn]**, **[Tiểu tiện]**, **[Đại tiện]**, hoặc **[Hút thuốc]**
3. Hệ thống ghi nhận ngay, không cần điền thêm gì
4. Khi quay lại, gõ `/diemdanh` và click **[Trở lại chỗ ngồi]**
5. Hệ thống ghi nhận kèm thời gian đã nghỉ:
   ```
   @username trở lại chỗ ngồi — Đi ăn (25 phút 14 giây)
   ```

> **Lưu ý**: Phải click **[Trở lại chỗ ngồi]** trước khi tan ca. Hệ thống sẽ không cho phép tan ca khi đang nghỉ.

#### Tan ca (Check Out)
1. Gõ `/diemdanh`
2. Click nút **[Tan ca]**
3. Hệ thống ghi nhận giờ ra và hiện tổng kết:
   ```
   @username tan ca

   **Tổng thời gian:** 8 giờ 30 phút
   **Thời gian làm việc thực:** 7 giờ 25 phút
   **Tổng thời gian nghỉ:** 1 giờ 5 phút
   **Số lần nghỉ:** 3
   1. Nghỉ ngơi — 15 phút
   2. Đi ăn — 45 phút 30 giây
   3. Tiểu tiện — 4 phút 30 giây
   ```

---

### `/xinphep` — Xin nghỉ phép

Gõ trong channel `#attendance-{team}`:

```
/xinphep
```

Menu xin phép sẽ hiện ra (chỉ bạn thấy):

```
┌──────────────────────────────────────────┐
│ [Xin nghỉ phép] [Đi muộn] [Về sớm]      │
└──────────────────────────────────────────┘
```

#### Xin nghỉ phép
1. Gõ `/xinphep`
2. Click nút **[Xin nghỉ phép]**
3. Điền form:
   - **Loại**: Nghỉ phép năm / Nghỉ khẩn cấp / Nghỉ ốm
   - **Ngày**: Nhập ngày nghỉ (có thể chọn nhiều ngày)
   - **Lý do**: Nhập lý do
4. Click **[Gửi]**
5. Đơn hiển thị trong channel, quản lý nhận thông báo trong channel `#attendance-approval-{team}` với nút duyệt

#### Đi muộn
1. Gõ `/xinphep`
2. Click nút **[Đi muộn]**
3. Điền form:
   - **Ngày**: Ngày đi muộn
   - **Giờ đến dự kiến**: VD: 10:00
   - **Lý do**: Nhập lý do
4. Click **[Gửi]**

#### Về sớm
1. Gõ `/xinphep`
2. Click nút **[Về sớm]**
3. Điền form:
   - **Ngày**: Ngày về sớm
   - **Giờ về dự kiến**: VD: 15:00
   - **Lý do**: Nhập lý do
4. Click **[Gửi]**

### Theo dõi trạng thái đơn

Khi đơn được duyệt/từ chối, trạng thái sẽ được cập nhật trực tiếp trên bài post trong channel.

---

## Dành cho Quản lý - Duyệt đơn

### Nhận đơn cần duyệt

Khi nhân viên gửi đơn (nghỉ phép, đi muộn, về sớm), bạn sẽ thấy trong channel `#attendance-approval-{team}`:

```
┌─────────────────────────────────────┐
│ YÊU CẦU #LR-2026013001              │
│ Người gửi: @nguyenvana              │
│ Loại: Nghỉ phép năm                 │
│ Ngày: 30/01 → 31/01 (2 ngày)        │
│ Lý do: Việc gia đình                │
│ Trạng thái: ĐANG CHỜ DUYỆT          │
│                                     │
│      [Duyệt]  [Từ chối]             │
└─────────────────────────────────────┘
```

### Duyệt đơn

1. Click nút **[Duyệt]**
2. Hệ thống sẽ:
   - Cập nhật trạng thái đơn thành **ĐÃ DUYỆT**
   - Thông báo cho nhân viên qua channel và DM
   - Xóa nút bấm khỏi message

### Từ chối đơn

1. Click nút **[Từ chối]**
2. Điền lý do từ chối (bắt buộc)
3. Hệ thống sẽ:
   - Cập nhật trạng thái đơn thành **TỪ CHỐI**
   - Thông báo cho nhân viên kèm lý do

### Lưu ý khi duyệt

- **Không thể tự duyệt đơn của chính mình** - Hệ thống sẽ báo lỗi
- **Chỉ duyệt được đơn đang chờ** - Đơn đã duyệt/từ chối không thể thay đổi
- **Mọi hành động được ghi log** - Ai duyệt, lúc nào đều được lưu lại

