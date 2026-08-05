(function () {
  const companies = {
    adnoc: { name: "ADNOC", data: "adnoc-net-production-by-region.json" },
    bp: { name: "bp", data: "bp-net-production-by-region.json" },
    chevron: { name: "Chevron", data: "chevron-net-production-by-region.json" },
    eni: { name: "Eni", data: "eni-net-production-by-region.json" },
    exxonmobil: { name: "ExxonMobil", data: "exxon-net-production-by-region.json" },
    petronas: { name: "Petronas", data: "petronas-net-production-by-region.json", axisLabels: "endpoints" },
    shell: { name: "Shell", data: "shell-net-production-by-region.json" },
    totalenergies: { name: "TotalEnergies", data: "totalenergies-net-production-by-region.json" }
  };

  const aliases = {
    adnoc: "adnoc",
    bp: "bp",
    chevron: "chevron",
    eni: "eni",
    exxon: "exxonmobil",
    exxonmobil: "exxonmobil",
    petronas: "petronas",
    shell: "shell",
    total: "totalenergies",
    totalenergies: "totalenergies"
  };

  const palette = {
    "Australasia": "#7b739d",
    "East Asia": "#9e7c6b",
    "South East Asia": "#b2876b",
    "Middle East": "#16847a",
    "North Africa": "#9bae63",
    "East Africa": "#d5b46a",
    "South Africa": "#8f9f73",
    "West Africa": "#a9bbc9",
    "South America": "#d5b46a",
    "North America": "#244e70",
    "Western Europe": "#7896aa",
    "Southern Europe": "#6f8294",
    "Russia": "#4f7f87",
    "Central Asia": "#c6a6a0",
    "Melanesia, Micronesia & Polynesia": "#d8e0e6"
  };

  const scriptUrl = new URL(document.currentScript.src);
  const dataBaseUrl = new URL("../data/", scriptUrl);
  const params = new URLSearchParams(window.location.search);
  const isEnglish = params.get("lang") === "en";
  const tr = (chinese, english) => isEnglish ? english : chinese;
  document.documentElement.lang = isEnglish ? "en" : "zh-CN";
  const requestedCompany = document.body.dataset.company
    || params.get("company")
    || params.get("operator")
    || "exxonmobil";
  const normalizedCompany = requestedCompany.toLowerCase().replace(/[^a-z0-9]+/g, "");
  const companyKey = aliases[normalizedCompany];
  const config = companies[companyKey];

  const chartElement = document.getElementById("production-chart");
  const loadingElement = document.getElementById("chart-loading");
  const legendElement = document.getElementById("region-legend");
  const titleElement = document.getElementById("page-title");
  const descriptionElement = document.querySelector('meta[name="description"]');
  loadingElement.textContent = tr("正在加载生产数据…", "Loading production data…");
  legendElement.setAttribute("aria-label", tr("地区图例；点击可显示或隐藏地区", "Region legend; select to show or hide a region"));
  let chart;
  let axisPointerElement;
  let tooltipElement;
  const selected = new Set();

  const formatNumber = (value, digits = 1) => new Intl.NumberFormat("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  }).format(value);

  const rankedRegions = (data) => [...data.regions].sort((left, right) => {
    const total = region => data.data.reduce((sum, row) => sum + (row.values[region] || 0), 0);
    return total(right) - total(left);
  });

  const renderLegend = (regions) => {
    legendElement.replaceChildren();
    regions.forEach((region) => {
      const item = document.createElement("button");
      const swatch = document.createElement("span");
      const label = document.createElement("span");
      item.type = "button";
      item.className = "legend-item";
      item.dataset.region = region;
      swatch.className = "legend-swatch";
      swatch.style.background = palette[region] || "#a9bbc9";
      label.textContent = region;
      item.append(swatch, label);
      item.addEventListener("click", () => {
        if (selected.has(region)) selected.delete(region); else selected.add(region);
        item.classList.toggle("is-muted", !selected.has(region));
        chart.dispatchAction({ type: "legendToggleSelect", name: region });
      });
      legendElement.appendChild(item);
    });
  };

  const hideCustomTooltip = () => {
    if (axisPointerElement) axisPointerElement.style.display = "none";
    if (tooltipElement) tooltipElement.style.display = "none";
  };

  const tooltipContent = (data, row) => {
    const active = data.regions
      .filter(region => selected.has(region) && row.values[region] > 0)
      .sort((left, right) => row.values[right] - row.values[left])
      .map(region => `<tr><td style="padding:3px 16px 3px 0;color:#475467;white-space:nowrap"><span style="display:inline-block;width:8px;height:8px;border-radius:1px;background:${palette[region] || '#a9bbc9'};margin-right:6px"></span>${region}</td><td style="padding:3px 0;text-align:right;color:#344054;font-weight:600;white-space:nowrap">${formatNumber(row.values[region])} kbbl/d</td></tr>`)
      .join("");
    return `<div style="min-width:276px"><div style="padding:10px 12px 8px;border-bottom:1px solid #e9edf1;font-weight:700;color:#17324d">${row.year}</div><table style="width:100%;border-collapse:collapse;padding:8px 12px"><tbody>${active || '<tr><td style="padding:9px 0;color:#8a94a3">No region selected</td></tr>'}</tbody></table><div style="display:flex;justify-content:space-between;gap:16px;padding:8px 12px;background:#f8fafb;border-top:1px solid #e9edf1;color:#475467"><span>Total</span><strong style="color:#344054;font-weight:700;white-space:nowrap">${formatNumber(row.total)} kbbl/d</strong></div></div>`;
  };

  const installCustomTooltip = (data) => {
    const stage = chartElement.parentElement;
    axisPointerElement?.remove();
    tooltipElement?.remove();
    axisPointerElement = document.createElement("div");
    axisPointerElement.className = "production-axis-pointer";
    tooltipElement = document.createElement("div");
    tooltipElement.className = "production-tooltip";
    stage.append(axisPointerElement, tooltipElement);

    chart.getZr().on("mousemove", (event) => {
      const viewWidth = chartElement.clientWidth;
      const viewHeight = chartElement.clientHeight;
      const plotLeft = 62;
      const plotRight = viewWidth - 30;
      const plotTop = 40;
      const plotBottom = viewHeight - 54;
      if (event.offsetX < plotLeft || event.offsetX > plotRight || event.offsetY < plotTop || event.offsetY > plotBottom) {
        hideCustomTooltip();
        return;
      }

      const ratio = (event.offsetX - plotLeft) / (plotRight - plotLeft);
      const dataIndex = Math.max(0, Math.min(data.data.length - 1, Math.round(ratio * (data.data.length - 1))));
      const pointerX = plotLeft + (dataIndex / (data.data.length - 1)) * (plotRight - plotLeft);
      tooltipElement.innerHTML = tooltipContent(data, data.data[dataIndex]);
      tooltipElement.style.display = "block";
      axisPointerElement.style.left = `${pointerX}px`;
      axisPointerElement.style.display = "block";

      const contentWidth = tooltipElement.offsetWidth;
      const contentHeight = tooltipElement.offsetHeight;
      const left = event.offsetX > viewWidth * .62
        ? Math.max(16, event.offsetX - contentWidth - 18)
        : Math.min(viewWidth - contentWidth - 16, event.offsetX + 18);
      const top = Math.min(Math.max(16, event.offsetY - contentHeight / 2), viewHeight - contentHeight - 16);
      tooltipElement.style.left = `${left}px`;
      tooltipElement.style.top = `${top}px`;
    });
    chart.getZr().on("globalout", hideCustomTooltip);
  };

  const compactAxisInterval = (index, years) => {
    if (config.axisLabels === "endpoints") {
      return index === 0 || index === years.length - 1 || index % 2 === 0;
    }
    return index !== years.length - 1 && index % 2 === 1;
  };

  const chartOption = (data) => {
    const years = data.data.map(item => item.year);
    const compactYearAxis = chartElement.clientWidth < 1500;
    return {
      animationDuration: 520,
      animationEasing: "cubicOut",
      color: data.regions.map(region => palette[region] || "#a9bbc9"),
      grid: { left: 62, right: 30, top: 40, bottom: 54, containLabel: false },
      tooltip: {
        trigger: "axis",
        axisPointer: { type: "line", lineStyle: { color: "#8a94a3", width: 1, type: "dashed" } },
        position(point, params, dom, rect, size) {
          const [viewWidth, viewHeight] = size.viewSize;
          const [contentWidth, contentHeight] = size.contentSize;
          const left = point[0] > viewWidth * .62
            ? Math.max(16, point[0] - contentWidth - 18)
            : Math.min(viewWidth - contentWidth - 16, point[0] + 18);
          const top = Math.min(Math.max(16, point[1] - contentHeight / 2), viewHeight - contentHeight - 16);
          return [left, top];
        },
        backgroundColor: "#ffffff",
        borderColor: "#d9e1e8",
        borderWidth: 1,
        padding: 0,
        textStyle: { color: "#344054", fontSize: 12 },
        extraCssText: "min-width:300px; padding:0 10px; box-shadow:0 8px 24px rgba(16,24,40,.10); border-radius:6px; overflow:hidden;",
        formatter(params) {
          const row = data.data[params[0].dataIndex];
          const forecast = "";
          const active = params
            .filter(item => selected.has(item.seriesName) && item.value > 0)
            .sort((a, b) => b.value - a.value)
            .map(item => `<tr><td style="padding:3px 16px 3px 0;color:#475467;white-space:nowrap"><span style="display:inline-block;width:8px;height:8px;border-radius:1px;background:${item.color};margin-right:6px"></span>${item.seriesName}</td><td style="padding:3px 0;text-align:right;color:#344054;font-weight:600;white-space:nowrap">${formatNumber(item.value)} kbbl/d</td></tr>`)
            .join("");
          return `<div style="min-width:276px"><div style="padding:10px 12px 8px;border-bottom:1px solid #e9edf1;font-weight:700;color:#17324d">${row.year}${forecast}</div><table style="width:100%;border-collapse:collapse;padding:8px 12px"><tbody>${active || '<tr><td style="padding:9px 0;color:#8a94a3">No region selected</td></tr>'}</tbody></table><div style="display:flex;justify-content:space-between;gap:16px;padding:8px 12px;background:#f8fafb;border-top:1px solid #e9edf1;color:#475467"><span>Total</span><strong style="color:#344054;font-weight:700;white-space:nowrap">${formatNumber(row.total)} kbbl/d</strong></div></div>`;
        }
      },
      legend: { show: false },
      xAxis: {
        type: "category",
        boundaryGap: false,
        data: years,
        axisLine: { lineStyle: { color: "#d9e1e8" } },
        axisTick: { show: false },
        axisLabel: {
          color: "#667085",
          fontSize: 11,
          margin: 17,
          interval: compactYearAxis ? (index => compactAxisInterval(index, years)) : 0
        }
      },
      yAxis: {
        type: "value",
        name: "Production (kbbl/d)",
        nameLocation: "end",
        nameGap: 16,
        nameTextStyle: { color: "#526570", fontSize: 12, fontWeight: 600, align: "left" },
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { color: "#667085", fontSize: 11, formatter: value => new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value) },
        splitLine: { show: true, lineStyle: { color: "#e7edf2", width: 1 } }
      },
      series: data.regions.map((region) => ({
        name: region,
        type: "line",
        stack: "production",
        smooth: 0.13,
        showSymbol: false,
        symbol: "circle",
        symbolSize: 5,
        lineStyle: { width: 1, color: palette[region] },
        areaStyle: { color: palette[region], opacity: .86 },
        emphasis: { focus: "series", lineStyle: { width: 1.6 }, areaStyle: { opacity: 1 } },
        data: data.data.map(item => item.values[region])
      }))
    };
  };

  const renderChart = (data) => {
    const previouslySelected = new Set(selected);
    selected.clear();
    data.regions.forEach(region => {
      if (previouslySelected.size === 0 || previouslySelected.has(region)) selected.add(region);
    });
    if (chart) chart.dispose();
    chart = echarts.init(chartElement, null, { renderer: "canvas" });
    chart.setOption(chartOption(data));
    installCustomTooltip(data);
    renderLegend(rankedRegions(data));
    loadingElement.hidden = true;
  };

  const scheduleRender = (data) => {
    if ("requestIdleCallback" in window) {
      window.requestIdleCallback(() => renderChart(data), { timeout: 400 });
    } else {
      window.setTimeout(() => renderChart(data), 0);
    }
  };

  const setPageIdentity = () => {
    const title = tr(`${config.name} 地区净产量`, `${config.name} Net Production by Region`);
    document.title = title;
    titleElement.textContent = title;
    chartElement.setAttribute("aria-label", tr(`按地区展示 ${config.name} 净产量`, `${config.name} net production by region`));
    if (descriptionElement) {
      descriptionElement.setAttribute("content", tr(`${config.name} 按 Region 展示的净产量分析看板`, `${config.name} net production analysis by region`));
    }
  };

  const showError = (message) => {
    loadingElement.textContent = message;
    loadingElement.hidden = false;
  };

  const init = async () => {
    if (!config) {
      showError(tr("未找到对应公司的生产数据", "Production data was not found for this company"));
      return;
    }
    setPageIdentity();
    try {
      const response = await fetch(new URL(config.data, dataBaseUrl), { cache: "no-cache" });
      if (!response.ok) throw new Error(`Production data request failed: ${response.status}`);
      const data = await response.json();
      scheduleRender(data);
    } catch (error) {
      console.error(error);
      showError(tr("生产数据加载失败，请刷新重试", "Production data failed to load. Refresh to retry."));
    }
  };

  window.addEventListener("resize", () => chart && chart.resize());
  init();
}());
