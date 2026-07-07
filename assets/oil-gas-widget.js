(function () {
  const DATA_URL = "data/oil-gas-prices.json";
  const charts = [];
  const priceFormat = new Intl.NumberFormat("zh-CN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
  const compactPriceFormat = new Intl.NumberFormat("zh-CN", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 4
  });

  function formatPrice(value) {
    return value >= 10 ? priceFormat.format(value) : compactPriceFormat.format(value);
  }

  function formatPct(change) {
    if (!change || change.pct === null || Number.isNaN(change.pct)) return "--";
    const sign = change.pct > 0 ? "+" : "";
    return `${sign}${change.pct.toFixed(2)}%`;
  }

  function changeClass(change) {
    if (!change || change.pct === null) return "";
    if (change.pct > 0) return "up";
    if (change.pct < 0) return "down";
    return "";
  }

  function formatDateTime(isoText) {
    return new Date(isoText).toLocaleString("zh-CN", {
      timeZone: "Asia/Shanghai",
      hour12: false,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit"
    });
  }

  function setState(widget, message) {
    const state = widget.querySelector("[data-role='state']");
    const content = widget.querySelector("[data-role='content']");
    state.textContent = message;
    state.hidden = false;
    content.hidden = true;
  }

  function showContent(widget) {
    widget.querySelector("[data-role='state']").hidden = true;
    widget.querySelector("[data-role='content']").hidden = false;
  }

  function renderMetrics(widget, series) {
    const metrics = widget.querySelector("[data-role='metrics']");
    metrics.innerHTML = series.map((item) => `
      <article class="og-metric" style="--series-color:${item.color}">
        <div class="og-metric-head">
          <strong>${item.nameZh}</strong>
          <span>${item.nameEn}</span>
        </div>
        <div class="og-metric-value">
          <strong>${formatPrice(item.latest.price)}</strong>
          <span>${item.unit}</span>
        </div>
        <div class="og-metric-changes">
          <span class="og-change">日涨跌 <b class="${changeClass(item.latest.day)}">${formatPct(item.latest.day)}</b></span>
          <span class="og-change">周涨跌 <b class="${changeClass(item.latest.week)}">${formatPct(item.latest.week)}</b></span>
        </div>
      </article>
    `).join("");
  }

  function makeChartOption(items, yName) {
    const lookup = Object.fromEntries(items.map((item) => [item.nameZh, item]));
    return {
      color: items.map((item) => item.color),
      animationDuration: 500,
      legend: {
        top: 8,
        right: 8,
        itemWidth: 10,
        itemHeight: 10,
        textStyle: { color: "#34445b", fontSize: 11 }
      },
      tooltip: {
        trigger: "axis",
        appendToBody: true,
        confine: true,
        axisPointer: { type: "cross", label: { backgroundColor: "#405166" } },
        backgroundColor: "rgba(255, 255, 255, .97)",
        borderColor: "#dbe4ef",
        borderWidth: 1,
        textStyle: { color: "#0a2540" },
        formatter(params) {
          const date = params[0]?.value?.[0] || "";
          const rows = params.map((param) => {
            const item = lookup[param.seriesName];
            const value = Array.isArray(param.value) ? param.value[1] : param.value;
            return `<div style="display:flex;gap:16px;align-items:center;justify-content:space-between;min-width:210px;margin-top:5px;">
              <span>${param.marker}${param.seriesName}</span>
              <strong>${formatPrice(value)} ${item.unit}</strong>
            </div>`;
          }).join("");
          return `<strong>${date}</strong>${rows}`;
        }
      },
      grid: { left: 50, right: 16, top: 46, bottom: 30 },
      xAxis: {
        type: "time",
        boundaryGap: false,
        axisLine: { lineStyle: { color: "#aab8ca" } },
        axisLabel: { color: "#53637a", hideOverlap: true, fontSize: 11 },
        splitLine: { lineStyle: { color: "#e8eef5" } }
      },
      yAxis: {
        type: "value",
        name: yName,
        nameGap: 32,
        nameLocation: "middle",
        axisLabel: { color: "#53637a", fontSize: 11 },
        splitLine: { lineStyle: { color: "#e8eef5", type: "dashed" } }
      },
      dataZoom: [{ type: "inside", throttle: 60 }],
      series: items.map((item) => ({
        name: item.nameZh,
        type: "line",
        data: item.data,
        showSymbol: false,
        smooth: false,
        connectNulls: true,
        lineStyle: { width: 2.5 },
        emphasis: { focus: "series" }
      }))
    };
  }

  function renderChart(widget, series) {
    const chartNode = widget.querySelector("[data-role='chart']");
    const yName = widget.dataset.unitLabel || series[0]?.unit || "";
    const chart = echarts.init(chartNode, null, { renderer: "canvas" });
    chart.setOption(makeChartOption(series, yName));
    charts.push(chart);
  }

  function renderWidget(widget, data) {
    const group = widget.dataset.group;
    const series = data.series.filter((item) => item.group === group);
    if (!series.length) {
      setState(widget, "暂无可展示的数据");
      return;
    }

    const rangeNode = widget.querySelector("[data-role='range']");
    if (rangeNode) rangeNode.textContent = `${data.startDate} 至 ${data.endDate}`;
    widget.querySelector("[data-role='updated']").textContent = formatDateTime(data.generatedAt);
    widget.querySelector("[data-role='source']").href = data.source.url;
    renderMetrics(widget, series);
    showContent(widget);
    renderChart(widget, series);
    requestAnimationFrame(() => charts.forEach((chart) => chart.resize()));
  }

  async function boot() {
    const widgets = Array.from(document.querySelectorAll(".og-widget[data-group]"));
    if (!widgets.length) return;
    if (!window.echarts) {
      widgets.forEach((widget) => setState(widget, "图表库加载失败，请稍后刷新"));
      return;
    }

    try {
      const response = await fetch(`${DATA_URL}?v=${Date.now()}`, { cache: "no-store" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      widgets.forEach((widget) => renderWidget(widget, data));
    } catch (error) {
      widgets.forEach((widget) => setState(widget, `数据加载失败：${error.message}`));
    }
  }

  window.addEventListener("resize", () => charts.forEach((chart) => chart.resize()));
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
