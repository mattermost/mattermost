# Techzen Brand Assets

Thư mục này chứa tài nguyên thiết kế chính thức của Techzen để dùng trong Mattermost UI.

## Màu sắc chính thức

| Tên | Hex | Dùng cho |
|-----|-----|----------|
| Techzen Red | `#c62828` | Icon planet, accent |
| Techzen Navy | `#1a237e` | Text, sidebar, primary |
| Techzen Blue | `#137fec` | Buttons, links, highlights |
| White | `#ffffff` | Background, reversed logo |

## Files

| File | Mô tả | Dùng khi |
|------|-------|----------|
| `techzen-logo-horizontal.svg` | Logo ngang (icon + text bên phải) | Header, navbar |
| `techzen-logo-square.svg` | Logo vuông (icon trên + text dưới) | Favicon, sidebar, app icon |
| `techzen-logo-white.svg` | Logo trắng (cho nền tối) | Dark sidebar, email header |

## Hướng dẫn sử dụng (React)

```tsx
import TechzenLogoHorizontal from 'images/brand/techzen-logo-horizontal.svg';
import TechzenLogoSquare from 'images/brand/techzen-logo-square.svg';

// Horizontal - trong navbar/header
<TechzenLogoHorizontal className="brand-logo" height={40} />

// Square - trong sidebar
<TechzenLogoSquare className="sidebar-logo" height={60} />
```

## Nguồn gốc

Logo Techzen chính thức từ [techzen.vn](https://techzen.vn)
- Màu đỏ: `#c62828` (crimson)
- Màu navy: `#1a237e` (dark navy blue)
- Biểu tượng: Hành tinh với quỹ đạo + chữ Z
