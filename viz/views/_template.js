// TEMPLATE for a dashboard view: a complete, working scatterplot.
// This file is NOT loaded by index.html. Copy everything inside Dash.register({...})
// into your own views/<id>.js, then change the fields marked ✏️.
// Rules are in viz/STYLEGUIDE.md. Do not edit shared/ without telling the team.

Dash.register({
  id: "example",                 // ✏️ must match the file name and the nav anchor
  order: 99,                     // ✏️ 1 = development, 2 = confirmation, 3 = communication
  kind: "Example",               // ✏️ shown in the nav and the kicker ("View 1 · Development")
  owner: "Your Name (Student ID)",
  title: "Medicines that press the brake harder make more people sleepy",   // ✏️ a CLAIM, max ~10 words
  question: "Do medicines that press the brake harder leave more people sleepy?",  // ✏️ one sentence
  howToRead: [                   // ✏️ 2–4 chips: [bold label, plain explanation]
    ["Each dot", "one medicine"],
    ["Across", "how hard it presses the brake (grip)"],
    ["Up", "out of 100 patients, how many felt sleepy"],
    ["Tip", "point at a dot for details, click to keep them open"],
  ],
  source: "Binding: PDSP K<sub>i</sub>. Side effects: SIDER 4.1.",

  // ctx = { chart, controls, data, root }. chart/controls are d3 selections; data = every drug, already cleaned.
  render({ chart, controls, data: all }) {
    const { COLORS, fmt } = Dash;

    // 1. Pick the fields you need: this also logs how many drugs were dropped.
    const data = Dash.complete(all, ["h1", "sedation"], "example");

    // 2. Shared SVG + margin convention. Pick only the inner height.
    const { g, innerW, innerH } = Dash.svg(chart, 360, "Each medicine: how hard it presses the brake, and how many patients felt sleepy");

    // 3. Scales and axes: label units, start rates at 0.
    const x = d3.scaleLinear().domain(d3.extent(data, (d) => d.h1)).nice().range([0, innerW]);
    const y = d3.scaleLinear().domain([0, d3.max(data, (d) => d.sedation)]).nice().range([innerH, 0]);
    g.append("g").attr("class", "grid").call(d3.axisLeft(y).ticks(5).tickSize(-innerW).tickFormat(""));
    g.append("g").attr("class", "axis").attr("transform", `translate(0,${innerH})`).call(d3.axisBottom(x));
    g.append("g").attr("class", "axis").call(d3.axisLeft(y).ticks(5).tickFormat((d) => d + "%"));
    g.append("text").attr("class", "axis-label").attr("x", innerW).attr("y", innerH + 36)
      .attr("text-anchor", "end").text("presses the brake harder →");
    g.append("text").attr("class", "axis-label").attr("x", -10).attr("y", -12).text("↑ patients out of 100 who felt sleepy");

    // 4. Marks: purple = sleepiness, orange = sleeplessness, neutral for anything else.
    const dots = g.selectAll("circle").data(data, (d) => d.drug).join("circle")
      .attr("class", "dot").attr("r", 7)
      .attr("cx", (d) => x(d.h1)).attr("cy", (d) => y(d.sedation))
      .attr("fill", COLORS.brake);

    // 5. Shared interaction: hover = tooltip, click = pin, Esc = unpin.
    Dash.hoverPin(dots, (d) =>
      `<strong>${d.drug}</strong><br>${Math.round(d.sedation)}% of patients felt sleepy <span class="sci">(from ${d.sedN} reports)</span><br><span class="sci">Brake grip ${fmt.pKi(d.h1)}</span>`);

    // 6. (Optional) controls with the shared look.
    Dash.buttons(controls, "Show:", [
      { key: "sedation", label: "Sleepiness" },
      { key: "insomnia", label: "Sleeplessness" },
    ], (key) => console.log("picked", key));

    // 7. Takeaways: 3–5 items. Each = a short headline (one idea) + bullets (one fact each).
    //    type: "holds" | "fails" | "exception" | "caveat". Bold key numbers with <b>; whole % ("31%").
    //    stat (optional) = technical figure, shown small. Numbers are COMPUTED, never typed in.
    const rho = Dash.spearman(data.map((d) => d.h1), data.map((d) => d.sedation));
    return {
      takeaways: [
        { type: "holds", stat: `link strength ${fmt.rho(rho)} on a 0-to-1 scale`,
          text: "The harder a medicine presses the brake, the more people feel sleepy.",
          points: [`This shows up across <b>${data.length}</b> medicines.`] },
        { type: "caveat", text: "This is a pattern, not proof.",
          points: ["We only had a small number of medicines."] },
      ],
    };
  },
});
