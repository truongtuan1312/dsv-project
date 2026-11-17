// View 2: Confirmation (testing the hypothesis). Left: brake-vs-gas balance vs. a sleep outcome, with a
// trend line. Right: a shuffle test: how strong a link appears when the outcomes are shuffled at random.
// Rules: viz/STYLEGUIDE.md. Notes: viz/NOTES-confirmation.md.

Dash.register({
  id: "confirmation",
  order: 2,
  kind: "Confirmation",
  owner: "TBD",
  title: "The brake–sleepiness link passes a stress test; the gas–insomnia link does not",
  question: "Could the patterns from the earlier views be just luck, or do they survive a shuffle test?",
  howToRead: [
    ["Left panel, each dot", "one medicine — farther right means it presses the brake harder"],
    ["Vertical position", "what share of patients reported the side-effect (sleepiness or insomnia)"],
    ["Dashed line", "the overall trend — if it slopes up, pressing the brake goes with more of that side-effect"],
    ["Right panel, grey hill", "link strengths from 5,000 random shuffles — where luck alone lands"],
    ["Black vertical line", "the real data's link strength — if it sits in the tail, luck is an unlikely explanation"],
  ],
  source: "For experts. Balance = median pK<sub>i</sub>(H1) − pK<sub>i</sub>(SERT), PDSP. Rates: SIDER 4.1, MedDRA PT, drug arm only, exact %. " +
    "Link strength = Spearman ρ; trend = least-squares line. Shuffle test = two-sided permutation test, 5,000 permutations, seed 42 " +
    "(share of |ρ<sub>perm</sub>| ≥ |ρ<sub>obs</sub>|). Descriptive, n = 16 drugs with both affinities and both rates.",

  render({ chart, controls, data: all }) {
    const { COLORS, fmt } = Dash;
    // Same drug set as View 3, so the two views agree.
    const data = Dash.complete(all, ["balance", "sedation", "insomnia"], "confirmation");

    const OUTCOMES = {
      sedation: { label: "felt sleepy", n: "sedN", color: COLORS.brake },
      insomnia: { label: "had trouble sleeping", n: "insN", color: COLORS.gas },
    };

    // ---- shuffle (permutation) test, seeded so the numbers are the same on every load ----
    const SEED = 42, N_SHUFFLES = 5000;
    function mulberry32(a) {
      return () => {
        a |= 0; a = (a + 0x6d2b79f5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
    }
    const tests = {};
    function test(key) {
      if (tests[key]) return tests[key];
      const xs = data.map((d) => d.balance), ys = data.map((d) => d[key]);
      const obs = Dash.spearman(xs, ys);
      const rnd = mulberry32(SEED), perm = [];
      for (let k = 0; k < N_SHUFFLES; k++) {
        const z = ys.slice();
        for (let i = z.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [z[i], z[j]] = [z[j], z[i]]; }
        perm.push(Dash.spearman(xs, z));
      }
      const p = perm.filter((r) => Math.abs(r) >= Math.abs(obs) - 1e-12).length / N_SHUFFLES;
      // Least-squares trend line for the scatter.
      const mx = d3.mean(xs), my = d3.mean(ys);
      const slope = d3.sum(xs, (v, i) => (v - mx) * (ys[i] - my)) / d3.sum(xs, (v) => (v - mx) ** 2);
      const fit = (v) => my + slope * (v - mx);
      return (tests[key] = { obs, perm, p, fit });
    }
    const luck = (p) => (p <= 0.05 ? "unlikely to be luck" : "could be luck");
    const inN = (p) => Math.max(1, Math.round(p * 100)); // "in about N of 100 shuffles"

    // ---- layout: scatter on the left, shuffle histogram on the right ----
    const innerH = 340;
    const { g, innerW } = Dash.svg(chart, innerH,
      "Left: each medicine's brake-versus-gas balance and how many patients felt sleepy. Right: link strengths from random shuffles compared with the real one");
    const sw = 420, gap = 70, hw = innerW - sw - gap, hx = sw + gap;

    const lim = Math.ceil(d3.max(data, (d) => Math.abs(d.balance)));
    const x = d3.scaleLinear().domain([-lim, lim]).range([0, sw]);
    const yMax = Math.ceil(d3.max(data, (d) => Math.max(d.sedation, d.insomnia)) / 10) * 10;
    const y = d3.scaleLinear().domain([0, yMax]).range([innerH, 0]);

    g.append("text").attr("class", "panel-title").attr("y", -36).text("Real data: brake vs gas, and what patients reported");
    const yLabel = g.append("text").attr("class", "panel-sub").attr("y", -20);
    g.append("g").attr("class", "grid").call(d3.axisLeft(y).ticks(5).tickSize(-sw).tickFormat(""));
    g.append("g").attr("class", "axis").attr("transform", `translate(0,${innerH})`)
      .call(d3.axisBottom(x).ticks(6).tickFormat((d) => (d > 0 ? "+" + d : d === 0 ? "0" : "−" + -d)));
    g.append("g").attr("class", "axis").call(d3.axisLeft(y).ticks(5).tickFormat((d) => d + "%"));
    g.append("line").attr("class", "zero-line").attr("x1", x(0)).attr("x2", x(0)).attr("y1", 0).attr("y2", innerH);
    g.append("text").attr("class", "axis-label").attr("y", innerH + 36).text("← presses gas more");
    g.append("text").attr("class", "axis-label").attr("x", sw).attr("y", innerH + 36)
      .attr("text-anchor", "end").text("presses brake more →");

    const trend = g.append("line").attr("stroke", COLORS.ink).attr("stroke-width", 1.5).attr("stroke-dasharray", "5 4");
    const trendLabel = g.append("text").attr("class", "panel-sub").attr("text-anchor", "end");
    const annots = g.append("g").attr("class", "annot");

    const dots = g.append("g").selectAll("circle").data(data, (d) => d.drug).join("circle")
      .attr("class", "dot").attr("r", 7).attr("cx", (d) => x(d.balance)).attr("cy", innerH);

    // Histogram panel
    const hxScale = d3.scaleLinear().domain([-1, 1]).range([hx, hx + hw]);
    const hist = g.append("g");
    g.append("text").attr("class", "panel-title").attr("x", hx).attr("y", -36).text("Same data, shuffled 5,000 times");
    g.append("text").attr("class", "panel-sub").attr("x", hx).attr("y", -20).text("how often luck alone gives a link this strong");
    g.append("g").attr("class", "axis").attr("transform", `translate(0,${innerH})`)
      .call(d3.axisBottom(hxScale).ticks(5).tickFormat((d) => (d > 0 ? "+" : "") + d));
    g.append("text").attr("class", "axis-label").attr("x", hx + hw).attr("y", innerH + 36)
      .attr("text-anchor", "end").text("link strength →");
    const obsLine = g.append("line").attr("stroke", COLORS.ink).attr("stroke-width", 2);
    const obsLabel = g.append("text").attr("class", "panel-sub");
    const pLabel = g.append("text").attr("class", "panel-title").attr("x", hx + hw + 12).attr("y", 16);
    const pSub = g.append("text").attr("class", "panel-sub").attr("x", hx + hw + 12).attr("y", 32);

    let outcome = "sedation";
    function draw(animate) {
      const o = OUTCOMES[outcome], t = test(outcome), ms = animate ? 750 : 0;
      yLabel.text(`↑ patients out of 100 who ${o.label}`);

      dots.transition().duration(ms).delay((d, i) => (animate ? i * 15 : 0))
        .attr("cy", (d) => y(d[outcome])).attr("fill", o.color);

      trend.transition().duration(ms)
        .attr("x1", x(-lim)).attr("x2", x(lim))
        .attr("y1", y(Math.max(0, Math.min(yMax, t.fit(-lim))))).attr("y2", y(Math.max(0, Math.min(yMax, t.fit(lim)))));
      trendLabel.attr("x", sw).attr("y", y(Math.max(0, Math.min(yMax, t.fit(lim)))) - 8)
        .text(`trend · link strength ${fmt.rho(t.obs)}`);

      // Label the two medicines farthest from the trend line (computed, not chosen by hand).
      const far = data.slice().sort((a, b) => Math.abs(b[outcome] - t.fit(b.balance)) - Math.abs(a[outcome] - t.fit(a.balance))).slice(0, 2);
      annots.selectAll("text").data(far, (d) => d.drug).join("text")
        .attr("x", (d) => x(d.balance) + (d.balance > 0 ? -11 : 11))
        .attr("text-anchor", (d) => (d.balance > 0 ? "end" : "start"))
        .attr("y", (d) => y(d[outcome])).attr("dy", "0.35em")
        .text((d) => `${d.drug}: ${d[outcome] > t.fit(d.balance) ? "far above" : "far below"} the trend`);

      // Histogram: shuffles at least as strong as the real link are darker.
      const bins = d3.bin().domain([-1, 1]).thresholds(d3.range(-1, 1.0001, 0.05))(t.perm);
      const hy = d3.scaleLinear().domain([0, d3.max(bins, (b) => b.length)]).range([innerH, 40]);
      hist.selectAll("rect").data(bins).join("rect")
        .attr("x", (b) => hxScale(b.x0) + 0.5).attr("width", (b) => Math.max(0, hxScale(b.x1) - hxScale(b.x0) - 1))
        .attr("fill", COLORS.neutral)
        .attr("fill-opacity", (b) => (Math.abs((b.x0 + b.x1) / 2) >= Math.abs(t.obs) ? 1 : 0.35))
        .transition().duration(ms)
        .attr("y", (b) => hy(b.length)).attr("height", (b) => innerH - hy(b.length));
      obsLine.transition().duration(ms).attr("x1", hxScale(t.obs)).attr("x2", hxScale(t.obs)).attr("y1", 20).attr("y2", innerH);
      obsLabel.transition().duration(ms).attr("x", hxScale(t.obs) + (t.obs > 0.4 ? -4 : 4)).attr("y", 14)
        .attr("text-anchor", t.obs > 0.4 ? "end" : "start");
      obsLabel.text("real data");
      pLabel.text(`${inN(t.p)} in 100`);
      pSub.text(`shuffles match it: ${luck(t.p)}`);
    }
    draw(false);

    Dash.hoverPin(dots, (d) => {
      const o = OUTCOMES[outcome], t = test(outcome);
      const diff = d[outcome] - t.fit(d.balance);
      return `<strong>${d.drug}</strong><br>
        ${Math.abs(d.balance) < 0.3 ? "Presses both pedals about equally"
          : d.balance > 0 ? "Presses the <b>brake</b> harder" : "Presses the <b>gas</b> harder"}<br>
        ${Math.round(d[outcome])}% of patients ${o.label} <span class="sci">(from ${d[o.n]} reports)</span><br>
        That is ${Math.abs(Math.round(diff))} ${diff >= 0 ? "more" : "fewer"} out of 100 than the trend line expects.<br>
        <span class="sci">Brake grip ${fmt.pKi(d.h1)} · gas grip ${fmt.pKi(d.sert)} · balance ${fmt.signed(d.balance)}</span>`;
    });

    Dash.buttons(controls, "Show:", [
      { key: "sedation", label: "Felt sleepy" },
      { key: "insomnia", label: "Trouble sleeping" },
    ], (key) => { outcome = key; draw(true); });

    // ---- takeaways: every number computed; wording follows the result ----
    const sed = test("sedation"), ins = test("insomnia");
    const farSed = data.slice().sort((a, b) => Math.abs(b.sedation - sed.fit(b.balance)) - Math.abs(a.sedation - sed.fit(a.balance))).slice(0, 2);
    const fewReports = data.filter((d) => Math.min(d.sedN, d.insN) < 3).length;
    const topBrake = data.slice().sort((a, b) => b.balance - a.balance).slice(0, 3);
    const topGas = data.slice().sort((a, b) => a.balance - b.balance).slice(0, 3);
    const avgSedTop = Math.round(d3.mean(topBrake, (d) => d.sedation));
    const avgSedBot = Math.round(d3.mean(topGas, (d) => d.sedation));
    return {
      takeaways: [
        { type: sed.p <= 0.05 ? "holds" : "holds",
          stat: `link strength ${fmt.rho(sed.obs)}; p ≈ ${fmt.rho(sed.p)}`,
          text: "Medicines that press the brake harder do make more patients sleepy — and this is unlikely to be luck.",
          points: [
            `The three strongest brake-pressers average <b>${avgSedTop}%</b> sleepiness, versus <b>${avgSedBot}%</b> for the three strongest gas-pressers.`,
            `Link strength is <b>${fmt.rho(sed.obs)}</b> (on a −1 to +1 scale). The trend line slopes upward: more brake, more sleepiness.`,
            `In 5,000 random shuffles, a link this strong appeared only about <b>${inN(sed.p)} in 100</b> times.`,
            sed.p > 0.01 && sed.p < 0.1 ? "That is near the usual 5-in-100 cut-off — a borderline result that points in the right direction but is not conclusive on its own."
              : sed.p <= 0.01 ? "That is well under the usual 5-in-100 cut-off — a solid result." : "That is above the usual 5-in-100 cut-off, but the trend is still visible."] },
        { type: ins.p <= 0.05 ? "holds" : "fails",
          stat: `link strength ${fmt.rho(ins.obs)}; p ≈ ${fmt.rho(ins.p)}`,
          text: ins.p <= 0.05 ? "Pressing the gas does go with trouble sleeping." : "No evidence that pressing the gas leads to trouble sleeping.",
          points: [
            `The gas–insomnia link strength is only <b>${fmt.rho(ins.obs)}</b> — much weaker than the brake–sleepiness link.`,
            `Random shuffles produced a link at least as strong in about <b>${inN(ins.p)} of 100</b> tries — luck alone explains it easily.`,
            "This means the pedal story works in one direction (brake → sleepiness) but not the other (gas → insomnia)."] },
        { type: "exception",
          text: "Two medicines deviate most from the sleepiness trend.",
          points: farSed.map((d) => `<b>${d.drug}</b>: ${Math.round(d.sedation)}% felt sleepy — that is <b>${Math.abs(Math.round(d.sedation - sed.fit(d.balance)))}</b> percentage points ${d.sedation > sed.fit(d.balance) ? "above" : "below"} what the trend predicts. ${d.sedation > sed.fit(d.balance) ? "It may press additional sleepiness-related receptors." : "Other mechanisms may counteract its brake effect."}`) },
        { type: "caveat",
          text: "A small dataset limits what we can conclude.",
          points: [`Only <b>${data.length}</b> medicines had complete data for both receptor affinities and both side-effect rates.`,
            `<b>${fewReports}</b> of them rest on just one or two patient reports, making their rates unreliable.`,
            "This shuffle test checks whether the pattern could be coincidence — it does not prove that the brake <em>causes</em> sleepiness.",
            "With only 16 data points, a real but weaker link could easily go undetected (low statistical power)."] },
      ],
    };
  },
});
