# 行业公司概览 Banner V2 维护与发布 SOP

## 1. 当前交付入口

- 嵌入式 HTML：`industry-company-overview-banner.html`
- 主船 SVG：`assets/company-directory-banner-v2/vessel-primary.svg`
- 次级船 SVG：`assets/company-directory-banner-v2/vessel-secondary.svg`
- 主船 PNG：`assets/company-directory-banner-v2/vessel-primary.png`
- 次级船 PNG：`assets/company-directory-banner-v2/vessel-secondary.png`
- 静态 Banner：`assets/company-directory-banner-v2/company-directory-banner-v2-static@2x.png`
- GitHub Pages：`https://hank-hee.github.io/Hank/industry-company-overview-banner.html`

V2 页面保持轻量：没有 JavaScript、外部字体、CDN、动画、背景图或 iframe 内部滚动。正文使用真实 HTML 文本，船舶是两张独立透明 SVG。

## 2. V2 设计规则

1. Banner 是企业数据库页头，桌面端固定 `188px` 高，允许范围 `184–192px`；不得通过增加高度解决对齐问题。
2. 只保留标题、英文副标题和一句说明；仅“概览”使用红色 `#D23842`。
3. 左侧文字组以 Grid 居中后光学上移 `5px`；右侧插画舞台光学上移 `6px`。
4. 右侧仅有两艘船：下中部主船与右上次级船。主船为次级船的约 `1.4` 倍，二者形成对角层级。
5. SVG 必须使用 `preserveAspectRatio="xMidYMid meet"`，并在波浪下方保留透明安全区。主船波浪最低点距 Banner 内边界至少 `22px`。
6. 每艘船最多两条主波浪线；不使用第三艘船、动画、`cover`、`slice`、裁切式显示、阴影或发光。
7. 背景仅使用 `#F8FBFC → #F5FAFC → #EDF7F8` 的低对比渐变，视觉权重低于插画；插画权重低于标题。

## 3. 关键样式与尺寸

| 部分 | 桌面规范 |
| --- | --- |
| Grid | `minmax(360px, .82fr) minmax(520px, 1.18fr)` |
| Banner | `height: 188px; padding: 24px 48–56px` |
| 标题 | `38–42px`，700，单行 |
| 英文副标题 | `11px`，600，`0.20em` 字距 |
| 中文说明 | `13px`，400 |
| 插画舞台 | 高 `146px`，`overflow: visible` |
| 主船 | `right: 37%; bottom: 6px; width: min(57%, 520px)` |
| 次级船 | `right: 1%; top: 4px; width: min(41%, 370px)` |

移动端（小于 768px）改为上下布局，只显示主船，组件最小高度 `196px`。

## 4. 本地预览与验收

在仓库根目录的 PowerShell 中运行：

```powershell
py -m http.server 8000 --bind 127.0.0.1
```

访问：

```text
http://127.0.0.1:8000/industry-company-overview-banner.html
```

必须检查 `1920px`、`1440px`、`1024px`、`768px` 和 `375px`：

- 1920/1440：两艘船不分散、不与文字竞争；
- 1024：船舶不重叠，波浪完整；
- 768：标题不小于 32px，左右布局仍清晰；
- 375：只显示主船，文字与插画不重叠；
- 所有尺寸：无横向溢出、无 iframe 二次滚动、无波浪裁切。

同时确认 HTML 无 `<script>`、`@keyframes`、`animation:`、`object-fit: cover`、远程资源或第三艘船引用。

## 5. 更新 V2 资产

1. 分别编辑 `vessel-primary.svg` 与 `vessel-secondary.svg`；不要把标题、背景或第三艘船写入 SVG。
2. 保留完整波浪与透明底部安全区后，导出透明 PNG：主船 `1400 × 480px`，次级船 `1000 × 360px`。
3. 在 `1200 × 188px` 画布中从 HTML 重新导出 2 倍静态图 `2400 × 376px`；不得压缩旧版三船 Banner。
4. 资产用途与替换顺序见 `assets/company-directory-banner-v2/README.md`。

## 6. 发布到 GitHub Pages

```powershell
git switch main
git fetch origin main
git add industry-company-overview-banner.html assets/company-directory-banner-v2 docs/industry-company-overview-banner-SOP.md
git diff --cached --check
git commit -m "Refine company directory banner V2"
git push origin HEAD:main
```

发布后检查正式 URL 返回 HTTP 200，且页面引用两个 V2 SVG。为绕过缓存，可使用稳定版本参数：

```text
https://hank-hee.github.io/Hank/industry-company-overview-banner.html?v=20260723-2
```

## 7. 简道云替换方式

1. 外部链接保持原地址，仅更新为最新版本参数。
2. 宽度保持 `60/60`；外部链接组件高度建议约 `16` 格，匹配 188px Banner。
3. 如果组件支持 HTML，继续使用正式 GitHub Pages URL。
4. 如果只支持图片，改用 V2 静态 Banner；如果右栏不支持 SVG，按主、次船的 PNG 分别替换。
5. 页面上下空白属于简道云容器，不要在 HTML 内使用位移或 `100vh` 补偿。

## 8. 回滚

不要重置或强推共享分支。需要恢复时：

```powershell
git log --oneline -5
git revert <需要回滚的提交SHA>
git push origin HEAD:main
```
