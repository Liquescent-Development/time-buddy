# App Icons

This directory should contain the application icons for different platforms:

- `icon.png` - 512x512 PNG icon for Linux AppImage
- `icon.ico` - Windows ICO format icon  
- `icon.icns` - macOS ICNS format icon

## Icon Requirements

### macOS (icon.icns)
- Should contain multiple sizes: 16x16, 32x32, 128x128, 256x256, 512x512
- Use `iconutil` to create from PNG sources

### Windows (icon.ico)  
- Should contain sizes: 16x16, 32x32, 48x48, 64x64, 128x128, 256x256
- Use tools like ImageMagick or online converters

### Linux (icon.png)
- Single PNG file, recommended 512x512
- Transparent background preferred

## Creating Icons

You can create icons from a single source PNG using:

```bash
# For macOS
mkdir icon.iconset
cp icon.png icon.iconset/icon_512x512.png
# ... create other sizes
iconutil -c icns icon.iconset

# For Windows (using ImageMagick)
convert icon.png -resize 256x256 icon-256.png
convert icon.png -resize 128x128 icon-128.png
# ... create other sizes and combine into ICO
```

## Default Behavior

If icons are missing, Electron will use its default icon. The build process will warn about missing icons but continue successfully.

## Grafana Query IDE Icon Concept

The icon should represent:
- Database/query concepts (graph lines, database symbols)
- Development/coding (brackets, code symbols)  
- Grafana orange color scheme (#f46800)
- Clean, modern design suitable for desktop applications