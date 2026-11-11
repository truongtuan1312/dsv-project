// Shared dashboard framework. Every view uses this file, so data loading,
// colours, layout, the tooltip and the section skeleton are identical everywhere.
// A view only has to call Dash.register({...}) — see views/_template.js and STYLEGUIDE.md.

const Dash = (() => {
  const css = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();

  // ---- design tokens (same values as dashboard.css) ----
  const COLORS = {
    brake: css("--brake"),     // H1 / sleepiness only
    gas: css("--gas"),         // SERT / sleeplessness only
    neutral: css("--neutral"),
    ink: css("--ink"),
    muted: css("--muted"),
    grid: css("--grid"),
  };
  // Every chart uses this width and margin scheme, so axes line up as you scroll.
  const LAYOUT = { width: 1000, margin: { top: 60, right: 170, bottom: 44, left: 120 } };

  const fmt = {
    pKi: d3.format(".1f"),
    pct: (v) => d3.format(".1f")(v) + "%",
    signed: d3.format("+.2f"),
    rho: d3.format(".2f"),
  };

  const DATA_URL = "../data/processed/drug_sleep_profile.csv";
  const views = [];

  // ---- data: loaded ONCE, cleaned ONCE, given to every view ----
  function clean(raw) {
    const num = (v) => (v === "" || v == null ? NaN : +v);
    return raw.map((d) => ({
      drug: d.drug,
      h1: num(d.pKi_H1), sert: num(d.pKi_SERT), m1: num(d.pKi_M1),
      ht2a: num(d["pKi_5-HT2A"]), d2: num(d.pKi_D2), alpha1: num(d.pKi_alpha1),
      balance: num(d.h1_minus_sert),
      sedation: num(d.sedation_pct), insomnia: num(d.insomnia_pct),
      sedN: num(d.sedation_n), insN: num(d.insomnia_n),
    }));
  }
  // Helper so each view states exactly which fields it needs, and reports what it dropped.
  function complete(data, fields, viewId) {
    const kept = data.filter((d) => fields.every((f) => Number.isFinite(d[f])));
    console.log(`[${viewId}] ${kept.length} of ${data.length} drugs have ${fields.join(", ")}`);
    return kept;
  }

  // ---- stats ----
  function spearman(xs, ys) {
    const rank = (a) => {
      const idx = a.map((v, i) => [v, i]).sort((p, q) => p[0] - q[0]);
      const r = new Array(a.length);
      for (let i = 0; i < idx.length;) {
        let j = i;
        while (j + 1 < idx.length && idx[j + 1][0] === idx[i][0]) j++;
        for (let k = i; k <= j; k++) r[idx[k][1]] = (i + j) / 2 + 1;
        i = j + 1;
      }
      return r;
    };
    const rx = rank(xs), ry = rank(ys);
    const mx = d3.mean(rx), my = d3.mean(ry);
    const cov = d3.sum(rx, (v, i) => (v - mx) * (ry[i] - my));
    return cov / Math.sqrt(d3.sum(rx, (v) => (v - mx) ** 2) * d3.sum(ry, (v) => (v - my) ** 2));
  }

  // ---- chart scaffold: same SVG size + margin convention in every view ----
  function svg(container, innerH, ariaLabel) {
    const { width, margin } = LAYOUT;
    const innerW = width - margin.left - margin.right;
    const root = container.append("svg")
      .attr("viewBox", [0, 0, width, innerH + margin.top + margin.bottom])
      .attr("width", width)
      .attr("role", "img").attr("aria-label", ariaLabel);
    const g = root.append("g").attr("transform", `translate(${margin.left},${margin.top})`);
    return { root, g, innerW, innerH };
  }

  // ---- one tooltip, one interaction pattern: hover shows, click pins, Esc unpins ----
  const tip = () => d3.select("#tooltip");
  let pinned = null, pinnedSel = null;
  function hoverPin(selection, html) {
    let hovered = null;
    const refresh = (event) => {
      selection.classed("is-hover", (d) => d === hovered)
        .classed("is-pinned", (d) => d === pinned)
        .classed("is-dim", (d) => pinnedSel === selection && pinned && d !== pinned && d !== hovered);
      const show = (pinnedSel === selection && pinned) || hovered;
      if (!show) { if (!pinned) tip().attr("hidden", true); return; }
      const isPinned = show === pinned;
      tip().attr("hidden", null).classed("pinned", isPinned)
        .html(html(show) + (isPinned ? `<div class="hint">Pinned · click again or press Esc</div>` : ""));
      if (event && (!pinned || pinned === hovered)) {
        tip().style("left", event.clientX + 14 + "px").style("top", event.clientY + 14 + "px");
      }
    };
    selection.classed("hoverable", true)
      .on("pointerenter", (e, d) => { hovered = d; refresh(e); })
      .on("pointermove", (e) => refresh(e))
      .on("pointerleave", (e) => { hovered = null; refresh(e); })
      .on("click", (e, d) => {
        if (pinnedSel && pinnedSel !== selection) pinnedSel.classed("is-pinned is-dim", false);
        pinned = pinned === d ? null : d; pinnedSel = pinned ? selection : null; refresh(e);
      });
    selection.node()?.ownerDocument.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && pinnedSel === selection) {
        pinned = null; pinnedSel = null; hovered = null; refresh(); tip().attr("hidden", true);
      }
    });
  }

  // The tooltip is position: fixed, so a pinned one would float over other content
  // while scrolling. Scrolling therefore unpins and hides it.
  window.addEventListener("scroll", () => {
    if (pinnedSel) pinnedSel.classed("is-pinned is-dim", false);
    pinned = null; pinnedSel = null;
    tip().attr("hidden", true);
  }, { passive: true });

  // ---- toggle buttons with the shared look ----
  function buttons(container, label, options, onPick) {
    container.append("span").text(label + " ");
    container.selectAll("button").data(options).join("button")
      .text((o) => o.label).classed("active", (o, i) => i === 0)
      .on("click", function (e, o) {
        container.selectAll("button").classed("active", (p) => p === o);
        onPick(o.key);
      });
  }

  // ---- page assembly: identical skeleton for every view ----
  const TK_LABEL = { holds: "✓ What we found", fails: "✗ What we didn't find", exception: "! Exceptions", caveat: "⚠ Keep in mind" };

  // Takeaways: one headline sentence per item, then one bullet per supporting fact.
  // item = { type, text, points?: [...], stat? }. <b> for key numbers; stat = technical figure, shown small.
  function renderTakeaways(sel, items) {
    if (!items || !items.length) return;
    sel.append("li").attr("class", "takeaways-title").text("What this shows");
    const li = sel.selectAll("li.tk").data(items).join("li").attr("class", (d) => `tk ${d.type}`);
    li.append("span").attr("class", "tk-tag").text((d) => TK_LABEL[d.type] || d.type);
    const body = li.append("div").attr("class", "tk-text");
    body.append("div").attr("class", "tk-head")
      .html((d) => d.text + (d.stat ? ` <span class="tk-stat">(${d.stat})</span>` : ""));
    body.filter((d) => d.points && d.points.length).append("ul").attr("class", "tk-points")
      .selectAll("li").data((d) => d.points).join("li").html((p) => p);
  }

  function section(v, i) {
    const s = d3.select("#dash-views").append("section").attr("class", "view").attr("id", v.id);
    s.append("p").attr("class", "view-kicker").text(`View ${i + 1} · ${v.kind}`);
    s.append("h2").attr("class", "view-title").text(v.title);
    s.append("p").attr("class", "view-question").text(v.question);
    s.append("ul").attr("class", "howto").selectAll("li").data(v.howToRead || []).join("li")
      .html((d) => `<b>${d[0]}</b>${d[1]}`);
    return {
      root: s,
      controls: s.append("div").attr("class", "view-controls"),
      chart: s.append("div").attr("class", "view-chart"),
      takeaways: s.append("ul").attr("class", "takeaways"),
      footer: s.append("p").attr("class", "view-source"),
    };
  }

  function register(view) { views.push(view); }

  async function start() {
    views.sort((a, b) => a.order - b.order);
    d3.select("#dash-nav").selectAll("a").data(views).join("a")
      .attr("href", (v) => `#${v.id}`)
      .html((v, i) => `<span class="num">${i + 1}</span>${v.kind}`);

    let data = [];
    try { data = clean(await d3.csv(DATA_URL)); }
    catch (err) {
      d3.select("#dash-views").append("p").attr("class", "view-error")
        .text("Could not load data. Start a server from the repo root (see STYLEGUIDE.md). " + err);
      return;
    }

    views.forEach((v, i) => {
      const ctx = section(v, i);
      ctx.footer.html(`${v.source || ""}<br><span class="view-owner">Owner: ${v.owner || "—"}</span>`);
      if (v.status === "todo") {
        ctx.chart.append("div").attr("class", "placeholder")
          .html(`<strong>Not built yet.</strong><br>${v.owner} · edit <code>viz/views/${v.id}.js</code>`);
        renderTakeaways(ctx.takeaways, v.takeaways);
        return;
      }
      try {
        const out = v.render({ ...ctx, data }) || {};
        renderTakeaways(ctx.takeaways, out.takeaways);
      } catch (err) {
        console.error(err);
        ctx.chart.append("p").attr("class", "view-error").text(`${v.id}: ${err.message}`);
      }
    });

    // Sections are built after the data loads, so jump to #view-id now that it exists.
    if (location.hash) document.querySelector(location.hash)?.scrollIntoView();

    // Highlight the nav link of the view on screen.
    const links = d3.selectAll("#dash-nav a");
    const io = new IntersectionObserver((entries) => entries.forEach((e) => {
      if (e.isIntersecting) links.classed("active", (v) => v.id === e.target.id);
    }), { rootMargin: "-40% 0px -55% 0px" });
    document.querySelectorAll(".view").forEach((el) => io.observe(el));
  }

  return { COLORS, LAYOUT, fmt, register, start, complete, spearman, svg, hoverPin, buttons };
})();
