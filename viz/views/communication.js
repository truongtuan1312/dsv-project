// View 3: Communication. Owner: Nguyen Thi Khanh Linh.
// One row per drug: chemistry (H1 − SERT balance) next to experience (% sleepy vs % sleepless).

Dash.register({
  id: "communication",
  order: 3,
  kind: "Communication",
  owner: "Nguyen Thi Khanh Linh (ITDSIU25019)",
  title: "Medicines that press the brake do make people sleepier, but not always",
  question: "Do medicines that press the brake harder leave more people feeling sleepy?",
  howToRead: [
    ["Each row", "one medicine"],
    ["Left bars", "purple = presses the brake more, orange = presses the gas more"],
    ["Right dots", "out of 100 patients, how many felt sleepy (purple) or had trouble sleeping (orange)"],
    ["Tip", "point at a row for details, click to keep them open"],
  ],
  source: "For experts. Binding: PDSP K<sub>i</sub>, median pK<sub>i</sub> per drug–receptor. Side effects: SIDER 4.1, MedDRA preferred terms, drug arm only, exact % reports (median across sources, highest matching term). Only drugs with H1 and SERT affinity and both rates are shown.",

  render({ chart, controls, data: all }) {
    const { COLORS, LAYOUT, fmt } = Dash;
    const data = Dash.complete(all, ["balance", "sedation", "insomnia"], "communication")
      .sort((a, b) => d3.descending(a.balance, b.balance));

    // Exceptions get a short label on the chart and a longer one in the tooltip.
    const NOTES = {
      Trazodone: ["sleepy for a different reason", "Makes people sleepy even though its pedals are balanced: it blocks other calming spots too."],
      Clomipramine: ["presses both pedals hard", "The sleepiest medicine here: it presses the brake hard as well as the gas."],
      Bupropion: ["keeps you awake another way", "Keeps people awake through a different brain chemical (dopamine), not the gas pedal."],
    };

    const rowH = 28;
    const { g, innerW, innerH } = Dash.svg(chart, data.length * rowH,
      "For each medicine: whether it presses the brake or the gas harder, and how many patients felt sleepy or had trouble sleeping");
    const balanceW = 250, gap = 70;
    const reportW = innerW - balanceW - gap;

    const lim = Math.ceil(d3.max(data, (d) => Math.abs(d.balance)));
    const xBal = d3.scaleLinear().domain([-lim, lim]).range([0, balanceW]);
    const x0 = balanceW + gap;
    const xPct = d3.scaleLinear()
      .domain([0, Math.ceil(d3.max(data, (d) => Math.max(d.sedation, d.insomnia)) / 10) * 10])
      .range([x0, x0 + reportW]);
    const y = d3.scaleBand().domain(data.map((d) => d.drug)).range([0, innerH]).padding(0.25);
    const bh = y.bandwidth();

    // Panel headers
    g.append("text").attr("class", "panel-title").attr("y", -36).text("In the brain: which pedal does it press harder?");
    g.append("text").attr("class", "panel-sub").attr("y", -20).text("brake grip minus gas grip");
    g.append("text").attr("class", "panel-title").attr("x", x0).attr("y", -36).text("In real life: patients out of 100 who…");
    const leg = g.append("g").attr("transform", `translate(${x0},-20)`);
    [["felt sleepy", COLORS.brake], ["had trouble sleeping", COLORS.gas]].forEach(([t, c], i) => {
      const lg = leg.append("g").attr("transform", `translate(${i * 100},0)`);
      lg.append("circle").attr("r", 5).attr("cy", -4).attr("fill", c);
      lg.append("text").attr("x", 9).attr("class", "panel-sub").text(t);
    });

    // Axes
    g.append("g").attr("class", "grid").attr("transform", `translate(0,${innerH})`)
      .call(d3.axisBottom(xPct).ticks(6).tickSize(-innerH).tickFormat(""));
    g.append("g").attr("class", "axis").attr("transform", `translate(0,${innerH})`)
      .call(d3.axisBottom(xBal).ticks(5).tickFormat((d) => (d > 0 ? "+" + d : d === 0 ? "0" : "−" + -d)));
    g.append("g").attr("class", "axis").attr("transform", `translate(0,${innerH})`)
      .call(d3.axisBottom(xPct).ticks(6).tickFormat((d) => d + "%"));
    g.append("text").attr("class", "axis-label").attr("y", innerH + 36).text("← presses gas more");
    g.append("text").attr("class", "axis-label").attr("x", balanceW).attr("y", innerH + 36)
      .attr("text-anchor", "end").text("presses brake more →");
    g.append("line").attr("class", "zero-line")
      .attr("x1", xBal(0)).attr("x2", xBal(0)).attr("y1", -6).attr("y2", innerH);

    // Rows (keyed so they can be re-sorted)
    const rows = g.append("g").selectAll("g").data(data, (d) => d.drug).join("g")
      .attr("transform", (d) => `translate(0,${y(d.drug)})`);
    rows.append("rect").attr("class", "hit")
      .attr("x", -LAYOUT.margin.left).attr("y", -(rowH - bh) / 2)
      .attr("width", LAYOUT.width).attr("height", rowH);
    rows.append("text").attr("class", "row-label").attr("x", -10).attr("y", bh / 2)
      .attr("dy", "0.35em").attr("text-anchor", "end").text((d) => d.drug);
    rows.append("rect")
      .attr("x", (d) => xBal(Math.min(0, d.balance)))
      .attr("width", (d) => Math.abs(xBal(d.balance) - xBal(0))).attr("height", bh)
      .attr("fill", (d) => (d.balance >= 0 ? COLORS.brake : COLORS.gas));
    rows.append("line").attr("class", "connector")
      .attr("x1", (d) => xPct(d.sedation)).attr("x2", (d) => xPct(d.insomnia))
      .attr("y1", bh / 2).attr("y2", bh / 2);
    rows.append("circle").attr("class", "dot").attr("r", 6)
      .attr("cx", (d) => xPct(d.sedation)).attr("cy", bh / 2).attr("fill", COLORS.brake);
    rows.append("circle").attr("class", "dot").attr("r", 6)
      .attr("cx", (d) => xPct(d.insomnia)).attr("cy", bh / 2).attr("fill", COLORS.gas);
    const ann = rows.filter((d) => NOTES[d.drug]).append("g").attr("class", "annot");
    ann.append("line").attr("x1", (d) => xPct(Math.max(d.sedation, d.insomnia)) + 9)
      .attr("x2", x0 + reportW + 6).attr("y1", bh / 2).attr("y2", bh / 2);
    ann.append("text").attr("x", x0 + reportW + 10).attr("y", bh / 2).attr("dy", "0.35em")
      .text((d) => NOTES[d.drug][0]);

    // Tooltip in everyday words; the technical numbers are in a small line at the end.
    const per100 = (v) => Math.round(v);
    Dash.hoverPin(rows, (d) => `<strong>${d.drug}</strong><br>
      ${Math.abs(d.balance) < 0.3 ? "Presses both pedals about equally"
        : d.balance > 0 ? "Presses the <b>brake</b> harder" : "Presses the <b>gas</b> harder"}<br>
      <span style="color:${COLORS.brake}">●</span> ${per100(d.sedation)}% of patients felt sleepy <span class="sci">(from ${d.sedN} reports)</span><br>
      <span style="color:${COLORS.gas}">●</span> ${per100(d.insomnia)}% had trouble sleeping <span class="sci">(from ${d.insN} reports)</span>` +
      (NOTES[d.drug] ? `<br><em>${NOTES[d.drug][1]}</em>` : "") +
      `<br><span class="sci">Brake grip ${fmt.pKi(d.h1)} · gas grip ${fmt.pKi(d.sert)}</span>`);

    // Sort control
    const sorters = {
      balance: (a, b) => d3.descending(a.balance, b.balance),
      sedation: (a, b) => d3.descending(a.sedation, b.sedation),
      insomnia: (a, b) => d3.descending(a.insomnia, b.insomnia),
    };
    Dash.buttons(controls, "Sort by:", [
      { key: "balance", label: "Brake vs gas" },
      { key: "sedation", label: "Most sleepy" },
      { key: "insomnia", label: "Most trouble sleeping" },
    ], (key) => {
      y.domain(data.slice().sort(sorters[key]).map((d) => d.drug));
      rows.transition().duration(750).delay((d, i) => i * 15)
        .attr("transform", (d) => `translate(0,${y(d.drug)})`);
    });

    // Takeaways: every number is computed from the data
    const top3 = data.slice(0, 3), bottom3 = data.slice(-3);
    const rhoSed = Dash.spearman(data.map((d) => d.balance), data.map((d) => d.sedation));
    const rhoIns = Dash.spearman(data.map((d) => d.balance), data.map((d) => d.insomnia));
    const names = (arr) => arr.slice(0, -1).map((d) => d.drug).join(", ") + " or " + arr[arr.length - 1].drug;
    const fewReports = data.filter((d) => Math.min(d.sedN, d.insN) < 3).length;
    const pct = (v) => Math.round(v) + "%";
    return {
      takeaways: [
        { type: "holds",
          text: "Medicines that press the brake make people sleepier.",
          points: [`<b>${pct(d3.mean(top3, (d) => d.sedation))}</b> of patients on ${names(top3)} felt sleepy, while only <b>${pct(d3.mean(bottom3, (d) => d.sedation))}</b> on ${names(bottom3)} did.`] },
        { type: "holds", stat: `link strength ${fmt.rho(rhoSed)} on a 0-to-1 scale`,
          text: "The harder a medicine presses the brake, the sleepier people tend to feel.",
          points: [`This shows up across all ${data.length} medicines.`, "But it's a rough trend, not a rule."] },
        { type: "fails", stat: `link strength ${fmt.rho(rhoIns)}, weak`,
          text: "Pressing the gas doesn't reliably keep people awake.",
          points: ["Trouble sleeping shows up about as often whichever pedal a medicine presses."] },
        { type: "exception",
          text: "Three medicines break the pattern.",
          points: [
            "<b>Trazodone</b> makes people sleepy in a different way.",
            "<b>Clomipramine</b> presses the brake hard as well as the gas.",
            "<b>Bupropion</b> keeps people awake through a different brain chemical.",
          ] },
        { type: "caveat",
          text: "This is a pattern, not proof.",
          points: [`We had full information for only <b>${data.length}</b> medicines.`,
            `${fewReports} of them rest on just one or two patient reports.`] },
      ],
    };
  },
});
