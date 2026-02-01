# Screenshot Assets

This directory contains images for the documentation.

## Required Screenshots

Please capture the following screenshots and save them with the specified filenames:

### Main README Screenshots

| Filename | Description | Dimensions |
|----------|-------------|------------|
| `logo-placeholder.png` | Mattermost Extended logo (create or use Mattermost logo with "Extended" text) | 400x100 |
| `screenshot-main-placeholder.png` | Main chat interface showing encrypted messages with purple styling | 800x500 |
| `screenshot-encryption-placeholder.png` | Close-up of encrypted message with purple border and lock icon | 600x200 |
| `screenshot-icons-placeholder.png` | Sidebar showing channels with custom icons (rocket, code, bug, etc.) | 300x400 |
| `screenshot-threads-placeholder.png` | Thread view with custom name and edit pencil icon | 500x300 |
| `screenshot-sidebar-threads-placeholder.png` | Sidebar with threads nested under channels | 300x400 |
| `screenshot-admin-placeholder.png` | Admin console Mattermost Extended Features page with toggles | 700x400 |

### Tips for Screenshots

1. **Use a clean test instance** with sample data
2. **Enable all features** to showcase them
3. **Use dark theme** for consistency (or light if preferred)
4. **Crop to focus** on the relevant UI elements
5. **Save as PNG** for best quality

### Creating a Logo

Options for the logo:
- Use the Mattermost logo with "Extended" text added
- Create a simple text-based logo
- Use a purple-themed variation to match encryption styling

### Image Optimization

Before committing, optimize images:
```bash
# Using ImageMagick
mogrify -strip -quality 85 *.png

# Or use online tools like TinyPNG
```

---

*Replace `-placeholder` in filenames with final versions when ready.*
