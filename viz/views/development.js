// View 1: Development (exploration). Small multiples: grip at each of six docking spots vs. how many
// patients felt sleepy (or had trouble sleeping). Which spot goes with which outcome?
// Rules: viz/STYLEGUIDE.md. Notes: viz/NOTES-development.md.

Dash.register({
  id: "development",
  order: 1,
  kind: "Development",
  owner: "TBD",
  title: "The brake is not the only spot that goes with feeling sleepy",
  question: "Which docking spot in the brain goes with feeling sleepy?",
  howToRead: [
    ["Each box", "one docking spot (purple = brake, orange = gas, grey = other spots)"],
    ["Each dot", "one medicine"],
    ["Across", "how hard the medicine presses that spot (grip)"],
    ["Up", "out of 100 patients, how many felt sleepy (or had trouble sleeping, see buttons)"],
  ],
  source: "For experts. Binding: PDSP K<sub>i</sub>, median pK<sub>i</sub> per drug–receptor (H1, SERT, M1, 5-HT2A, D2, α1). " +
    "Side effects: SIDER 4.1, MedDRA PT, drug arm only, exact % reports. Each panel uses every drug with that pK<sub>i</sub> and the chosen rate; " +
    "link strength = Spearman ρ. pK<sub>i</sub> 5.0 usually means “no binding up to 10 µM” (a floor), not a measured value.",

  render({ chart, controls, data: all }) {
    const { COLORS, fmt } = Dash;
    // Console check required by the style guide (panels filter further, per spot).
    Dash.complete(all, ["sedation"], "development");

    // The six spots. Brake and gas keep their colours; every other spot is grey.
    const SPOTS = [
      { key: "h1", name: "Brake", sci: "H1", color: COLORS.brake },
      { key: "sert", name: "Gas", sci: "SERT", color: COLORS.gas },
      { key: "alpha1", name: "Other calming spot", sci: "α1", color: COLORS.neutral },
      { key: "ht2a", name: "Other calming spot", sci: "5-HT2A", color: COLORS.neutral },
      { key: "d2", name: "Other spot", sci: "D2", color: COLORS.neutral },
      { key: "m1", name: "Other spot", sci: "M1", color: COLORS.neutral },
    ];
    const OUTCOMES = {
      sedation: { label: "felt sleepy", n: "sedN" },
      insomnia: { label: "had trouble sleeping", n: "insN" },
    };
    const rows = (spot, out) => all.filter((d) => Number.isFinite(d[spot.key]) && Number.isFinite(d[out]));
    const rho = (spot, out) => {
      const r = rows(spot, out);
      return { n: r.length, rho: Dash.spearman(r.map((d) => d[spot.key]), r.map((d) => d[out])) };
    };

    // ---- small-multiple grid inside the shared SVG ----
    const cols = 3, gapX = 40, gapY = 74, ph = 160;
    const { g, innerW } = Dash.svg(chart, 2 * ph + gapY,
      "Six small charts, one per docking spot: how hard each medicine presses the spot, and how many patients felt sleepy");
    const pw = (innerW - gapX * (cols - 1)) / cols;

    // One shared 0–max% axis for both outcomes, so switching keeps the scale.
    const yMax = Math.ceil(d3.max(all, (d) => Math.max(d.sedation || 0, d.insomnia || 0)) / 10) * 10;
    const y = d3.scaleLinear().domain([0, yMax]).range([ph, 0]);
    // One shared grip axis for all panels, so boxes compare directly.
    const gripAll = SPOTS.flatMap((s) => all.map((d) => d[s.key])).filter(Number.isFinite);
    const x = d3.scaleLinear().domain(d3.extent(gripAll)).nice().range([0, pw]);

    let outcome = "sedation";
    const panels = g.selectAll("g.panel").data(SPOTS).join("g").attr("class", "panel")
      .attr("transform", (s, i) => `translate(${(i % cols) * (pw + gapX)},${Math.floor(i / cols) * (ph + gapY)})`);

    panels.each(function (s, i) {
      const p = d3.select(this);
      p.append("g").attr("class", "grid").call(d3.axisLeft(y).ticks(4).tickSize(-pw).tickFormat(""));
      p.append("g").attr("class", "axis").attr("transform", `translate(0,${ph})`).call(d3.axisBottom(x).ticks(5));
      p.append("g").attr("class", "axis").call(d3.axisLeft(y).ticks(4).tickFormat((v) => v + "%"));
      const t = p.append("text").attr("class", "panel-title").attr("y", -24).style("fill", s.color); // style, since the CSS rule `svg text` would override a fill attribute
      t.append("tspan").text(s.name + " ");
      t.append("tspan").attr("class", "panel-sub").text(`(${s.sci})`);
      p.append("text").attr("class", "panel-sub rho").attr("y", -10);
      p.append("text").attr("class", "axis-label").attr("x", pw).attr("y", ph + 32)
        .attr("text-anchor", "end").text("presses harder →");
    });
    g.append("text").attr("class", "axis-label").attr("x", -110).attr("y", -46).text("↑ patients out of 100 who…");
    const yLabel = g.append("text").attr("class", "axis-label").attr("x", -110).attr("y", -34);

    // Dots are created once, for every medicine with that grip and at least one rate (keyed by drug).
    // Every medicine is one data object shared by its dots in all six boxes, so hovering one dot
    // highlights the same medicine everywhere (Dash.hoverPin compares data objects).
    panels.each(function (s) {
      d3.select(this).selectAll("circle.dot")
        .data(all.filter((d) => Number.isFinite(d[s.key]) && (Number.isFinite(d.sedation) || Number.isFinite(d.insomnia))), (d) => d.drug)
        .join("circle").attr("class", "dot").attr("r", 5)
        .attr("cx", (d) => x(d[s.key])).attr("cy", ph)
        .attr("fill", s.color).attr("fill-opacity", 0.85);
    });
    const dots = g.selectAll("circle.dot");

    function draw(animate) {
      yLabel.text(OUTCOMES[outcome].label);
      panels.each(function (s) {
        const r = rho(s, outcome);
        d3.select(this).select("text.rho").text(`link strength ${fmt.rho(r.rho)} · ${r.n} medicines`);
      });
      // Medicines without the chosen rate are hidden (not removed), so the hover wiring stays.
      dots.attr("display", (d) => (Number.isFinite(d[outcome]) ? null : "none"))
        .transition().duration(animate ? 750 : 0).delay((d, i) => (animate ? (i % 32) * 10 : 0))
        .attr("cy", (d) => (Number.isFinite(d[outcome]) ? y(d[outcome]) : ph));
    }
    draw(false);

    Dash.hoverPin(dots, (d) => {
      const o = OUTCOMES[outcome];
      const grips = SPOTS.filter((s) => Number.isFinite(d[s.key]))
        .map((s) => `${s.sci} ${fmt.pKi(d[s.key])}`).join(" · ");
      return `<strong>${d.drug}</strong><br>
        ${Math.round(d[outcome])}% of patients ${o.label} <span class="sci">(from ${d[o.n]} reports)</span><br>
        Its dot lights up in every box where we know its grip.<br>
        <span class="sci">Grip: ${grips}</span>`;
    });

    Dash.buttons(controls, "Show:", [
      { key: "sedation", label: "Felt sleepy" },
      { key: "insomnia", label: "Trouble sleeping" },
    ], (key) => { outcome = key; draw(true); });

    // ---- takeaways: all numbers computed ----
    const sed = SPOTS.map((s) => ({ ...s, ...rho(s, "sedation") })).sort((a, b) => b.rho - a.rho);
    const ins = SPOTS.map((s) => ({ ...s, ...rho(s, "insomnia") })).sort((a, b) => b.rho - a.rho);
    const label = (s) => (s.key === "h1" || s.key === "sert" ? `the <b>${s.name.toLowerCase()}</b>` : `another spot <span class="sci">(${s.sci})</span>`);
    const brake = sed.find((s) => s.key === "h1"), brakeRank = sed.indexOf(brake) + 1;
    const gasIns = ins.find((s) => s.key === "sert");
    const strongerThanBrake = sed.filter((s) => s.rho > brake.rho);
    const ordinal = ["first", "second", "third", "fourth", "fifth", "sixth"][brakeRank - 1];
    const minN = d3.min(SPOTS, (s) => rho(s, "sedation").n), maxN = d3.max(SPOTS, (s) => rho(s, "sedation").n);
    const atFloor = all.filter((d) => SPOTS.some((s) => d[s.key] === 5)).length;

    return {
      takeaways: [
        { type: "holds", stat: `link strength ${fmt.rho(brake.rho)} on a 0-to-1 scale`,
          text: "Medicines that press the brake harder tend to make more people sleepy.",
          points: [`But the brake comes only <b>${ordinal}</b> of the six spots.`] },
        { type: "exception",
          text: `${strongerThanBrake.length === 1 ? "One other spot goes" : strongerThanBrake.length + " other spots go"} with sleepiness more closely than the brake.`,
          points: strongerThanBrake.map((s) => `${label(s)}: link strength <b>${fmt.rho(s.rho)}</b>.`)
            .concat(["Many medicines press several of these spots at once, so we can't yet tell which one does the work."]) },
        { type: "fails", stat: `link strength ${fmt.rho(gasIns.rho)}`,
          text: "Pressing the gas doesn't go with more trouble sleeping.",
          points: [`No spot links strongly to trouble sleeping. The closest is ${label(ins[0])} (link strength ${fmt.rho(ins[0].rho)}).`] },
        { type: "caveat",
          text: "This is a first look, not proof.",
          points: [`Each box has only <b>${minN}–${maxN}</b> medicines.`,
            `For <b>${atFloor}</b> medicines, at least one grip is just the lowest value the lab could measure.`,
            "View 2 checks whether the brake-vs-gas pattern could be luck."] },
      ],
    };
  },
});
