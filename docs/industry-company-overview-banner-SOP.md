# 行业公司概览 Banner 维护与发布 SOP

## 1. 交付入口

- 嵌入式 HTML：`industry-company-overview-banner.html`
- 透明船舶插画：`assets/company-directory-banner/company-directory-vessels.svg`
- 透明 PNG 兜底：`assets/company-directory-banner/company-directory-vessels.png`
- 静态整图兜底：`assets/company-directory-banner/company-directory-banner-static@2x.png`
- GitHub Pages：`https://hank-hee.github.io/Hank/industry-company-overview-banner.html`

该页为轻量、独立的 HTML/CSS Banner：没有 JavaScript、外部字体、CDN、动画或内部滚动条。HTML 正文与船舶插画保持分离，方便分别替换。

## 2. 不可破坏的设计规则

1. Banner 是“行业数据库页头”，不是宣传 Hero；桌面端高度保持 `184–200px`，默认 `196px`。
2. 页面主标题固定为“行业公司概览”，仅“概览”使用 `#C9363E`；不要新增第二个大面积红色元素。
3. 英文副标题为 `INDUSTRY COMPANY OVERVIEW`，说明为“全球能源、海工与工程企业信息检索平台”。三类文字必须是真实 HTML 文本。
4. 背景仅使用低对比的浅灰蓝渐变 `#F8FBFC → #F5F9FB → #EDF7F8`；不要加入格子、曲线、水印、强阴影、玻璃拟态或明显光斑。
5. 右侧插画只承担行业氛围，透明度为 `55%–70%`，不能与标题重叠。保留三种可区分的结构：长船体处理模块、密集液化模块、圆肩储罐加再气化模块。
6. 波纹为静态线稿，整组最多三条；禁止自动波浪、船体浮动或其他动画。
7. 不增加按钮、KPI、搜索框、轮播、数据更新时间或导航；不修改简道云的筛选、目录、快捷入口和数据逻辑。

## 3. 尺寸与响应式验收

| 视口 | Banner 规则 | 插画规则 |
| --- | --- | --- |
| ≥1200px | `196px` 高；左右内边距 `48–64px` | 三艘船完整显示，主船最大 |
| 768–1199px | `184–188px` 高；左右内边距 `28–32px` | 可裁减为右侧 1–2 组，标题不得低于 32px |
| <768px | 上下布局；总高 `210px` 左右 | 不遮挡文字，展示压缩后的代表性船舶区域 |

HTML 根节点始终为 `width: 100%`，不使用 `100vh`、固定页面宽度或 iframe 内部滚动。

## 4. 本地预览与检查

在仓库根目录的 PowerShell 中运行：

```powershell
py -m http.server 8000 --bind 127.0.0.1
```

然后打开：

```text
http://127.0.0.1:8000/industry-company-overview-banner.html
```

至少检查 `1440px`、`1024px`、`920px`、`375px`：

- 标题、英文副标题与说明文本完整可读；
- 右侧插画不穿过标题，页面无横向滚动；
- 背景没有高对比色块，红色只出现于“概览”；
- 船舶线稿保持可辨识，波纹静态且不超过三条；
- Network 中只存在 HTML 与同仓库 SVG 请求，没有第三方资源。

## 5. 更新资产

1. 先编辑透明的 `company-directory-vessels.svg`，不要将标题、背景或水印绘制进插画。
2. 导出 1600 × 420px 的透明 `company-directory-vessels.png`。
3. 在 1200 × 200px 画布中导出 2 倍的 `company-directory-banner-static@2x.png`（2400 × 400px）。静态图必须按照新排版导出，不能压缩旧版高 Banner。
4. 核对 HTML、SVG、PNG 的颜色与船体结构一致。

资产目录中的 `README.md` 包含文件用途和替换顺序。

## 6. 发布到 GitHub Pages

发布前保留 `main` 上的其他改动，并确认暂存区只包含本次 Banner 文件：

```powershell
git switch main
git fetch origin main
git add industry-company-overview-banner.html assets/company-directory-banner docs/industry-company-overview-banner-SOP.md
git diff --cached --check
git commit -m "Compact company directory banner"
git push origin HEAD:main
```

推送后确认正式链接返回 HTTP 200。为避开简道云或浏览器缓存，可使用稳定版本参数，例如：

```text
https://hank-hee.github.io/Hank/industry-company-overview-banner.html?v=20260723-1
```

## 7. 简道云嵌入

1. 外部链接继续指向 GitHub Pages 正式链接。
2. 宽度保持 `60/60`。
3. 新版推荐将外部链接组件高度从旧版 `31` 格调整到约 `16` 格，使其接近 196px 的紧凑 Banner 高度；组件周围的空白由简道云容器控制，不要在页面内用位移补偿。
4. 若该组件仅支持单张图片，改用 `company-directory-banner-static@2x.png`；若不支持 SVG，使用 `company-directory-vessels.png` 作为右栏插画。

## 8. 回滚

不要重置或强推共享分支。若需恢复，执行：

```powershell
git log --oneline -5
git revert <需要回滚的提交SHA>
git push origin HEAD:main
```
