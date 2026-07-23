# 公司目录 Banner V2 资产

| 文件 | 用途 | 尺寸 / 特性 |
| --- | --- | --- |
| `vessel-primary.svg` | Banner 下中部的主船 | 透明背景、独立线稿、`viewBox 800 × 220`，底部含波浪安全区 |
| `vessel-secondary.svg` | Banner 右上部的次级船 | 透明背景、独立线稿、`viewBox 600 × 190`，底部含波浪安全区 |
| `vessel-primary.png` | 主船 PNG 兜底 | 1400 × 480px、透明背景 |
| `vessel-secondary.png` | 次级船 PNG 兜底 | 1000 × 360px、透明背景 |
| `company-directory-banner-v2-static@2x.png` | 单张图片兜底 | 2400 × 376px，对应 1200 × 188px 显示 |

## 替换步骤

1. 先编辑独立 SVG；不要将标题、背景、第三艘船或外部资源合并进文件。
2. 确保主船和次船的波浪均完整落在各自 `viewBox` 内，且下方仍保留透明安全区。
3. 按表格尺寸导出透明 PNG，并在 1200 × 188px 画布中重新导出静态 Banner 的 2 倍图。
4. 替换后检查桌面端波浪距离 Banner 底边至少 22px，移动端只显示主船。

页面优先加载两个 SVG；PNG 与静态 Banner 仅用于不支持 SVG 或 HTML 的简道云组件。
