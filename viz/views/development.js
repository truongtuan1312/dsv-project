// View 1: Development (exploration). Owner: TBD. Copy the body of _template.js here.
// Delete `status: "todo"` once render() works.

Dash.register({
  id: "development",
  order: 1,
  kind: "Development",
  owner: "TBD",
  status: "todo",
  title: "Write the CLAIM this chart shows (a sentence, not a topic)",
  question: "Which docking spot in the brain goes with feeling sleepy?",
  howToRead: [
    ["Each dot", "one medicine"],
    ["Across", "how hard the medicine presses a spot (grip)"],
    ["Up", "out of 100 patients, how many felt sleepy"],
  ],
  source: "Binding: PDSP K<sub>i</sub>. Side effects: SIDER 4.1.",
  takeaways: [
    { type: "caveat", text: "Placeholder: a short headline goes here.", points: ["Each supporting fact gets its own bullet (see STYLEGUIDE.md §7)."] },
  ],
});
