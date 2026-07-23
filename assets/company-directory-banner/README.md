# 公司目录 Banner 资产

| 文件 | 用途 | 尺寸 / 特性 |
| --- | --- | --- |
| `company-directory-vessels.svg` | HTML Banner 右侧船舶线稿 | 透明背景、矢量、无文字、无外部依赖 |
| `company-directory-vessels.png` | SVG 不被容器支持时的插画兜底 | 1600 × 420px、透明背景 |
| `company-directory-banner-static@2x.png` | 仅能放单张图片时的完整 Banner 兜底 | 2400 × 400px，对应 1200 × 200px 显示 |

## 替换流程

1. 先编辑 `company-directory-vessels.svg`，只保留船舶、平台和最多三条静态波纹；不要将标题或背景合并进插画。
2. 重新导出透明背景的 `company-directory-vessels.png`，保持 1600 × 420px。
3. 在 1200 × 200px 画布中从 `industry-company-overview-banner.html` 导出 `company-directory-banner-static@2x.png` 的 2 倍图；不要将旧版高 Banner 等比压缩。
4. 检查 SVG、PNG 与 HTML 的船体结构和配色一致后再发布。

HTML 页面优先使用 SVG。PNG 与静态 Banner 仅用于外部链接组件不支持 SVG 或 HTML 的场景。
