(function () {
  const DATA_URL = "data/oil-gas-prices.json";
  const SERIES_COLORS = {
    brent: "#244E70",
    wti: "#C68A2B",
    nymex_gas: "#356582",
    jkm_lng: "#D5A93F"
  };
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
    if (change.pct > 0) return "price-change__value--positive";
    if (change.pct < 0) return "price-change__value--negative";
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

  function visualColor(item) {
    return SERIES_COLORS[item.key] || item.color;
  }

  function setState(widget, stateName, message) {
    const state = widget.querySelector("[data-role='state']");
    const content = widget.querySelector("[data-role='content']");
    const spinner = state.querySelector(".energy-price-state__spinner");
    const retry = state.querySelector("[data-role='retry']");
    state.dataset.state = stateName;
    state.querySelector("[data-role='state-message']").textContent = message;
    spinner.hidden = stateName !== "loading";
    retry.hidden = stateName !== "error";
    state.hidden = false;
    content.hidden = true;
  }

  function showContent(widget) {
    widget.querySelector("[data-role='state']").hidden = true;
    widget.querySelector("[data-role='content']").hidden = false;
  }

  function renderMetrics(widget, series) {
    const metrics = widget.querySelector("[data-role='metrics']");
    metrics.innerHTML = series.map((item) => {
      const color = visualColor(item);
      return `
        <article class="price-metric" style="--series-color:${color}">
          <div class="price-metric__identity">
            <span class="price-metric__marker" aria-hidden="true"></span>
            <div class="price-metric__labels">
              <p class="price-metric__name">${item.nameZh}</p>
              <p class="price-metric__name-en">${item.nameEn}</p>
            </div>
          </div>
          <div class="price-metric__price">
            <span class="price-metric__value">${formatPrice(item.latest.price)}</span>
            <span class="price-metric__unit">${item.unit}</span>
          </div>
          <div class="price-metric__changes">
            <span class="price-change">日涨跌 <b class="price-change__value ${changeClass(item.latest.day)}">${formatPct(item.latest.day)}</b></span>
            <span class="price-change">周涨跌 <b class="price-change__value ${changeClass(item.latest.week)}">${formatPct(item.latest.week)}</b></span>
          </div>
        </article>
      `;
    }).join("");
  }

  function makeChartOption(items, yName) {
    const lookup = Object.fromEntries(items.map((item) => [item.nameZh, item]));
    const colors = items.map(visualColor);
    return {
      color: colors,
      animationDuration: 500,
      legend: {
        top: 4,
        right: 8,
        icon: "circle",
        itemWidth: 8,
        itemHeight: 8,
        itemGap: 16,
        textStyle: { color: "#344054", fontSize: 10 }
      },
      tooltip: {
        trigger: "axis",
        appendToBody: true,
        confine: true,
        axisPointer: {
          type: "cross",
          lineStyle: { color: "#98A2B3", width: 1 },
          label: { backgroundColor: "#667085", fontSize: 10 }
        },
        backgroundColor: "#FFFFFF",
        borderColor: "#D9E1E8",
        borderWidth: 1,
        padding: [8, 10],
        textStyle: { color: "#344054", fontSize: 11 },
        extraCssText: "box-shadow:0 6px 18px rgba(16,24,40,.10);border-radius:6px;",
        formatter(params) {
          const date = params[0]?.value?.[0] || "";
          const rows = params.map((param) => {
            const item = lookup[param.seriesName];
            const value = Array.isArray(param.value) ? param.value[1] : param.value;
            return `<div style="display:flex;gap:16px;align-items:center;justify-content:space-between;min-width:210px;margin-top:5px;">
              <span>${param.marker}${param.seriesName}</span>
              <strong style="font-variant-numeric:tabular-nums;">${formatPrice(value)} ${item.unit}</strong>
            </div>`;
          }).join("");
          return `<strong>${date}</strong>${rows}`;
        }
      },
      grid: {
        left: 44,
        right: 14,
        top: 34,
        bottom: 25,
        containLabel: true
      },
      xAxis: {
        type: "time",
        boundaryGap: false,
        axisLine: { show: true, lineStyle: { color: "#D9E1E8", width: 1 } },
        axisTick: { show: false },
        axisLabel: { color: "#667085", fontSize: 9, margin: 8, hideOverlap: true },
        splitLine: { show: false }
      },
      yAxis: {
        type: "value",
        name: yName,
        nameGap: 34,
        nameLocation: "middle",
        nameTextStyle: { color: "#667085", fontSize: 9 },
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { color: "#667085", fontSize: 9, margin: 8 },
        splitLine: {
          show: true,
          lineStyle: { color: "#E7EDF2", width: 1, type: "dashed" }
        }
      },
      dataZoom: [{ type: "inside", throttle: 60 }],
      series: items.map((item) => ({
        name: item.nameZh,
        type: "line",
        data: item.data,
        showSymbol: false,
        symbolSize: 5,
        smooth: false,
        connectNulls: true,
        lineStyle: { width: 2, cap: "round", join: "round" },
        emphasis: { focus: "series", lineStyle: { width: 2.5 } }
      }))
    };
  }

  function renderChart(widget, series) {
    const chartNode = widget.querySelector("[data-role='chart']");
    const yName = widget.dataset.unitLabel || series[0]?.unit || "";
    const chart = echarts.init(chartNode, null, { renderer: "canvas" });
    chart.setOption(makeChartOption(series, yName));
    charts.push(chart);
    if (window.ResizeObserver) {
      const observer = new ResizeObserver(() => chart.resize());
      observer.observe(chartNode);
    }
  }

  function renderWidget(widget, data) {
    const series = data.series.filter((item) => item.group === widget.dataset.group);
    if (!series.length) {
      setState(widget, "empty", "暂无价格数据，请稍后重新加载");
      return;
    }

    widget.querySelector("[data-role='updated']").textContent = formatDateTime(data.generatedAt);
    widget.querySelector("[data-role='source']").href = data.source.url;
    renderMetrics(widget, series);
    showContent(widget);
    renderChart(widget, series);
  }

  async function boot() {
    const widgets = Array.from(document.querySelectorAll(".energy-price-card[data-group]"));
    if (!widgets.length) return;
    widgets.forEach((widget) => setState(widget, "loading", "正在读取价格数据"));

    if (!window.echarts) {
      widgets.forEach((widget) => setState(widget, "error", "图表库加载失败，请重新加载"));
      return;
    }

    try {
      const response = await fetch(DATA_URL, { cache: "no-cache" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      widgets.forEach((widget) => renderWidget(widget, data));
      requestAnimationFrame(() => charts.forEach((chart) => chart.resize()));
    } catch (error) {
      widgets.forEach((widget) => setState(widget, "error", "价格数据加载失败"));
    }
  }

  document.querySelectorAll("[data-role='retry']").forEach((button) => {
    button.addEventListener("click", () => window.location.reload());
  });
  window.addEventListener("resize", () => charts.forEach((chart) => chart.resize()));

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
