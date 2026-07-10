# 行业公司概览 Banner 维护与发布 SOP

## 1. 页面信息

- 源文件：`industry-company-overview-banner.html`
- GitHub 仓库：`Hank-Hee/Hank`
- 默认分支：`main`
- 正式链接：`https://hank-hee.github.io/Hank/industry-company-overview-banner.html`
- 简道云配置：电脑端，宽度 `60/60`，高度 `31格`
- 技术结构：单文件 HTML，内嵌 SVG 与 CSS；无 JavaScript、外部字体、图片、CDN 或动画库。

## 2. 不可破坏的设计规则

1. 只有标题中的“概览”使用红色；其余区域不使用红色点、红色线或红色装饰。
2. 背景保持近白至淡蓝灰渐变，不添加格子、通栏曲线、Banner 水印或装饰光点。
3. `FPSO`、`FLNG`、`FSRU` 直接排版，不增加矩形标签框或引导线。
4. 三种船型必须依靠结构即可辨认：
   - FPSO：长船体、错落的生产处理模块、较大的生活楼。
   - FLNG：高而密集的切角液化处理列车。
   - FSRU：连续圆肩储罐和紧凑的再气化模块。
5. FPSO 与 FSRU 的船底和波浪位于同一海平面；FLNG 使用独立的上层波浪。
6. 船上不添加装饰性天线、高塔、彩色圆点或无功能的细长线。
7. 动画仅使用 CSS `transform`；FLNG 波浪略快，但不得产生快速闪动或明显抖动。

## 3. 常用修改位置

在 `industry-company-overview-banner.html` 中按以下标识查找：

| 修改内容 | 查找标识 |
| --- | --- |
| 页面颜色 | `:root` 中的 CSS 变量 |
| 中文和英文标题 | `.copy-panel` |
| 标题字号和位置 | `h1`、`.copy-panel` |
| 船名位置 | `.label-fpso`、`.label-flng`、`.label-fsru` |
| FPSO 结构 | `<g id="fpso">` |
| FLNG 结构 | `<g id="flng">` |
| FSRU 结构 | `<g id="fsru">` |
| 波浪速度 | `.fpso-front` 至 `.fsru-rear` |
| 船体浮动 | `lower-float`、`upper-float` |
| 简道云短高度适配 | `@media (max-height: 220px)` |

颜色修改应优先调整 CSS 变量，不要在单个 SVG 路径中散落新的颜色值。

## 4. 本地预览

在仓库根目录打开 PowerShell，执行：

```powershell
py -m http.server 8000 --bind 127.0.0.1
```

如果电脑没有 `py` 命令，可使用：

```powershell
python -m http.server 8000 --bind 127.0.0.1
```

浏览器打开：

```text
http://127.0.0.1:8000/industry-company-overview-banner.html
```

不要只双击 HTML 验收。通过本地 HTTP 访问更接近 GitHub Pages 和简道云 iframe 的加载方式。

## 5. 发布前验收

### 视觉检查

- 完整标题可见，只有“概览”为红色。
- 背景无格子、长曲线、Banner 水印、红点或蓝点。
- 三个船名没有文本框，也没有压住船体设备。
- 不看标签也能区分三种船型。
- FPSO 与 FSRU 看起来处于同一海平面。
- 三组波浪均短于船体；FLNG 波浪独立且速度略快。
- 进入页面后动画稳定，无跳帧、抖动或快速闪烁。

### 尺寸检查

至少在 Edge 或 Chrome 中检查：

- `1366px` 宽、Banner 高度 `380px`，浏览器缩放 `100%`。
- `1920px` 宽、Banner 高度 `380px`，浏览器缩放 `100%`。
- 模拟简道云宽横幅：页面宽度占满，高度约为 `31格`，完整标题与三艘船均可见。
- 页面无横向滚动条、无船体裁切、无大块无效留白。
- 直接打开页面时，Banner 设计高度上限约为 `380px`；整页 `1366×768` 或 `1920×1080` 的剩余空白不属于 Banner 内容。

### 性能检查

- HTML 文件建议保持在 `25 KB` 内。
- 页面中不应出现 `<script src>`、外部样式、外部字体或图片请求。
- 浏览器控制台无报错。
- Network 面板禁用缓存后刷新，核心内容原则上只请求一个 HTML 文件。
- 系统启用“减少动画”后，船体和波浪动画应停止。

## 6. 更新 GitHub 默认分支

发布前记录当前提交，作为回滚点：

```powershell
Get-Command git
git switch main
git status
git branch --show-current
git rev-parse HEAD
git pull --ff-only
```

确认只包含本次 Banner 和 SOP 改动后执行：

```powershell
git add industry-company-overview-banner.html docs/industry-company-overview-banner-SOP.md
git commit -m "Refine industry company overview banner"
git push origin HEAD:main
```

也可以在 GitHub 网页中编辑目标文件，并选择直接提交到 `main`。提交前必须检查 Diff，避免覆盖其他人的同期修改。

## 7. GitHub Pages 与缓存检查

1. 推送完成后打开正式链接。
2. 使用 `Ctrl + F5` 强制刷新。
3. 再用无痕窗口确认页面已更新。
4. GitHub Pages 当前缓存可能保留约 10 分钟；若简道云仍显示旧版，可暂时等待后再检查。
5. 简道云需要立即切换版本时，可使用稳定版本参数：

```text
https://hank-hee.github.io/Hank/industry-company-overview-banner.html?v=20260710-1
```

每次正式发布只更新一次版本号，不要使用随机参数，以免降低缓存效率。

## 8. 简道云嵌入

1. 在简道云仪表盘添加“外部链接”组件。
2. 填入正式 GitHub Pages 链接。
3. 宽度设置为 `60/60`，高度设置为 `31格`。
4. 仅按电脑端布局验收。
5. 点击“预览”，确认完整标题、三种船型及波浪都在组件范围内。
6. 退出预览后重新进入一次，确认链接加载稳定且没有长时间空白。

## 9. 回滚

不要重置或强推共享的 `main`。使用 `git revert` 创建可追踪的回滚提交：

```powershell
git switch main
git log --oneline -5
git revert <需要回滚的提交SHA>
git push origin HEAD:main
```

等待 GitHub Pages 重新部署后，强制刷新正式链接并再次完成简道云验收。

## 10. 发布记录模板

每次发布记录以下信息：

- 修改摘要：
- 发布提交 SHA：
- 回滚基准 SHA：
- 正式链接及版本参数：
- 电脑端验收尺寸：
- 简道云验收结果：
- 已知限制：
- 操作人和发布时间：
