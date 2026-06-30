# 多公司全球项目地图与嵌入体验优化设计

日期：2026-06-30
状态：已获用户口头批准，待书面审阅
目标页面：`maps/`

本设计替代 `2026-06-30-shell-map-embed-polish-design.md`。旧设计中的界面精修要求已经纳入本文；如有冲突，以本文为准。

## 1. 目标

将现有只包含 Shell 东南亚项目的静态地图升级为四家公司共用的全球项目地图。所有公司继续使用同一套 HTML、CSS 和 JavaScript，通过 URL 参数加载各自数据，并可选按统一业务区域筛选。

本轮交付：

- Shell、BP、Eni、ADNOC 四家公司全球项目链接。
- 可选的 `region` URL 参数，用于生成地区级链接。
- 每家公司按需加载独立数据文件，不加载全量 3,101 个 Operator。
- 保留并完成已经批准的简道云中嵌入、宽嵌入体验优化。
- 先提供本地预览；用户确认后再更新 GitHub。

## 2. 数据源事实

唯一数据源为用户提供的：

`Rystad数据表（统一格式及业务区域最新版）.xlsx`

工作簿结构：

- 工作表：`ExportCubeBrowser 1`
- 数据范围：`A1:U81050`
- 数据行：81,049 行，不含表头
- 字段：21 列
- Operator：3,101 个
- 国家：162 个
- 业务区域：16 个
- 按 `Operator + Country + Project` 去重后：31,062 个项目

新数据源中 `Supply Segment Group` 没有 `Tax` 值。生成器仍保留“该字段精确等于 `Tax` 时排除”的兼容性保护，但当前验收数量不受此规则影响。

源 Excel 不提交到 GitHub。GitHub 只保存四家公司所需的聚合数据和可重复执行的数据生成脚本。

## 3. 公司匹配规则

公司清单由显式配置维护，不能使用模糊包含匹配。

| 看板公司 | Excel Operator 匹配值 | 全球项目数 |
| --- | --- | ---: |
| Shell | `Shell` | 552 |
| BP | `BP` | 396 |
| Eni | `Eni` | 437 |
| ADNOC | `ADNOC`、`ADNOC Gas Processing`、`ADNOC Ghasha`、`ADNOC LNG`、`ADNOC Offshore`、`ADNOC Onshore`、`ADNOC Sour Gas` | 49 |

`Petronas/Shell`、`Aker BP`、`BPTT`、`Petrobel (Eni/EGPC JV)` 等名称不会被自动并入，除非以后在配置中明确加入。

MODEC 和 Chiyoda 在本工作簿的 Operator 字段中没有记录，本轮不生成其项目地图数据文件或无效链接。

## 4. 数据聚合规则

### 4.1 项目主键

每家公司按以下键聚合：

`canonical operator + country + project`

项目 ID 使用该键的确定性哈希生成，保证重新生成数据后未变化项目的 ID 稳定。

### 4.2 聚合字段

同一项目的多行记录合并为一条项目对象。以下字段去空、去重并按稳定顺序保存：

- `sourceOperators`：Excel 中的实际 Operator；ADNOC 用它展示运营实体。
- `regions`：英文 `Region`。
- `businessRegions`：中文统一 `Business Region`。
- `supplySegments`：`Supply Segment Group`。
- `fieldTypes`：`Field Type Category`。
- `lifecycleCategories`：`Life Cycle Category`。
- `lifecycleDetails`：`Life Cycle Detail`。
- `facilities`：`Facility Category`。
- `waterDepthCategories`：`Water Depth Category`。
- `discoveryYears`、`approvalYears`、`startupYears`。
- `ownerships`：`Ownership`。

项目名称保持源数据原文。年份保持数值类型。

### 4.3 不发布字段

本轮不发布：

- `Asset`
- P90、P50、Pmean 和未授予远景资源量
- 原始逐行数据

这些字段既不是当前项目地图所需，也会显著增加公开文件体积。

## 5. 发布文件结构

```text
maps/
├── index.html
├── styles.css
├── app.js
├── operators.json
├── data/
│   ├── shell.json
│   ├── bp.json
│   ├── eni.json
│   ├── adnoc.json
│   └── country-centers.json
├── tools/
│   ├── company-config.json
│   └── build_map_data.py
└── tests/
    ├── verify_generated_data.py
    └── verify_ui_contract.mjs
```

现有 `maps/data.js` 在应用完成迁移后删除，避免旧的 51 项 Shell 数据继续被误用。

### 5.1 `operators.json`

运行时清单由生成器根据 `tools/company-config.json` 生成，包含：

- canonical name
- URL 参数别名
- 数据文件路径
- 预期项目数

`tools/company-config.json` 是构建输入，保存 canonical name、URL 别名和 Excel Operator 精确匹配值。运行时页面不读取构建配置。

应用只接受清单中的文件路径，不能把用户传入的 `operator` 直接拼接成请求路径。

### 5.2 公司数据文件

每个公司 JSON 包含：

- 数据源文件名和年份
- 生成时间
- 公司匹配规则
- 项目数和国家数
- 可用业务区域
- 聚合后的 `projects`

### 5.3 国家中心点

`country-centers.json` 只保存四家公司实际涉及国家的国家级代表点、中文显示名、源数据国家名和坐标来源。代表点以 Natural Earth Admin 0 Countries 1:10m 数据为基础，记录数据集版本和来源 URL；10m 国家层用于覆盖 110m 简化层省略的巴林、圣多美和普林西比等小国。Excel 中的 `UAE`、`Turkiye`、`Congo` 等名称通过显式别名映射到标准国家记录。

这些坐标只用于国家级聚合，不代表项目真实位置。构建时必须验证每个项目国家都有唯一配置；缺少配置时构建失败，不能静默丢弃项目。

## 6. URL 与加载流程

### 6.1 URL

全球默认：

- `maps/?operator=Shell`
- `maps/?operator=BP`
- `maps/?operator=Eni`
- `maps/?operator=ADNOC`

地区链接示例：

- `maps/?operator=Shell&region=东南亚`

`operator` 与清单别名进行去空和大小写不敏感匹配。`region` 与公司数据中的统一业务区域进行去空匹配；中文值经过标准 URL 编码。

未传 `operator` 时继续默认 Shell。未传 `region` 时显示全球数据。

### 6.2 数据加载

1. 页面加载 `operators.json` 和 `country-centers.json`。
2. 根据 `operator` 找到清单项。
3. 只请求该公司的 JSON。
4. 如有 `region`，在客户端筛选项目。
5. 按国家聚合筛选后的项目并绘制圆点。

任何阶段失败都进入明确错误状态，不渲染半完整地图。

## 7. 地图与界面行为

### 7.1 标题与状态

标题保持“公司名 + 项目分布”。副标题显示：

- 全球模式：`552 个项目 · 全球展示`
- 地区模式：`58 个项目 · 东南亚`

项目数量来自当前筛选结果。

### 7.2 图例

左下角只保留：

- 圆点符号
- “圆点数字代表项目数量”

删除“点位为国家级聚合，不代表项目坐标”和分隔线。移动端必须继续显示保留的图例文字。

### 7.3 总览视野

- 全球模式适配该公司全部国家点位。
- 地区模式适配该业务区域内的国家点位。
- 单一国家使用配置的国家级缩放。
- 多国家使用点位边界和控件安全间距计算视野。

不再固定以东南亚为默认中心，因为 Shell 已改为全球数据。窗口尺寸变化时只重算当前筛选范围；用户正在查看国家详情时不能被强制跳回总览。

### 7.4 项目抽屉

桌面端继续使用右侧抽屉，中等宽度将最大宽度收敛到约 420px；小屏继续使用底部面板。项目名称和详情字号不缩小。

打开国家项目时，根据抽屉的实际像素尺寸移动地图，使选中圆点位于可见区域；不使用固定经度偏移。

### 7.5 项目详情

详情展示：

- 业务区域
- 生命周期类别和明细
- 油气田类型
- 供应板块
- 设施类别
- 水深类别
- 发现、批准和投产年份
- Ownership
- ADNOC 的实际运营实体

项目名称保持源数据原文。

### 7.6 交互精修

- 操作提示移到靠近底部中央，首次约 4 秒后淡出；点击、拖动或缩放立即隐藏。
- 国家圆点只保留一条点击处理链，避免重复动画。
- 搜索后摘要显示“匹配 X / 总计 Y”。
- `Esc` 关闭抽屉并把焦点返回触发圆点。
- 项目展开状态同步 `aria-expanded`。
- 增加清晰的 `:focus-visible` 样式。

不增加地区下拉框；地区由 URL 控制，避免占用简道云嵌入空间。

## 8. 错误与边界状态

- 未知公司：显示“没有找到该公司的项目”，并提示检查 `operator`。
- 未知地区：显示该公司没有此业务区域，并列出可用区域。
- 公司数据、清单或国家配置加载失败：显示“地图数据未加载”，不显示错误数量。
- Leaflet 未加载：保留“地图资源未加载”提示。
- 地区筛选后只有一个国家：使用单国视野。
- 公司或地区没有项目：不创建空圆点或空抽屉。
- 地图瓦片失败：本轮不切换未经确认的新底图；依赖替换留作后续可靠性优化。
- 动画继续遵循 `prefers-reduced-motion`。

## 9. 生成器设计

`build_map_data.py` 使用 Python 标准库流式读取 XLSX 内部 XML，避免通用工作簿导入在 55MB 工作表 XML 上超时。

命令必须接受显式参数，不能写死用户桌面路径：

```text
python maps/tools/build_map_data.py --input <xlsx> --output maps/data
```

生成器按以下顺序执行：

1. 验证工作表和 21 个必需表头。
2. 读取公司显式匹配配置。
3. 流式处理 81,049 行。
4. 聚合并稳定排序项目。
5. 验证公司数量、必填字段和国家配置覆盖。
6. 写入临时文件并在全部验证通过后替换正式 JSON，避免半成品发布。

## 10. 验证与验收标准

### 10.1 数据验证

- Shell：552 项。
- BP：396 项。
- Eni：437 项。
- ADNOC：49 项。
- 四家公司项目都具有 Operator、Country、Project 和 Business Region。
- 每个项目国家都有国家中心点。
- 同一公司内不存在重复的 `country + project`。
- 生成文件不包含 Asset 或资源量字段。
- `maps/data.js` 不再被页面引用。

### 10.2 URL 验证

- 四个全球链接正确加载对应公司。
- `Shell + 东南亚` 返回 58 项。
- 参数大小写和 URL 编码正确处理。
- 未知公司、未知地区和数据文件加载失败均显示正确错误状态。

### 10.3 浏览器尺寸

至少验证：

- 1920 × 430：用户宽嵌入截图比例。
- 960 × 520：中等嵌入。
- 760 × 520：断点边界。
- 390 × 640：移动端回归。

每个尺寸检查标题、状态、缩放控件、圆点、图例、总览按钮和抽屉无重叠。至少对一家全球分布公司和 ADNOC 单国分布执行完整交互测试。

### 10.4 交互验证

- 点击国家圆点打开正确项目。
- 抽屉打开后圆点不被遮挡。
- 搜索计数、项目展开、关闭和 `Esc` 正常。
- 无重复打开动画或控制台错误。

## 11. 预览与发布

1. 在本地功能分支完成生成器、数据和界面实现。
2. 运行数据验证和 UI 契约测试。
3. 通过本地 HTTP 服务生成四家公司及地区链接预览。
4. 提供宽、中、移动尺寸截图，以及简道云嵌入高度建议；宽嵌入优先从不低于约 520px 开始试验。
5. 用户确认本地预览后，更新缓存版本号并推送 GitHub。
6. 发布后验证 GitHub Pages 四个正式链接，再交付可粘贴到简道云的 URL。

## 12. 明确不在本轮范围

- MODEC、Chiyoda 项目地图。
- 页面内公司或地区下拉选择器。
- 项目级精确坐标。
- 资产列表和资源量分析。
- 全部 3,101 个 Operator 的数据发布。
- Leaflet、CARTO 或地图瓦片架构替换。
