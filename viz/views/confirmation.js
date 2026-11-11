// View 2: Confirmation (testing the hypothesis). Owner: TBD. Copy the body of _template.js here.
// Delete `status: "todo"` once render() works.

Dash.register({
  id: "confirmation",
  order: 2,
  kind: "Confirmation",
  owner: "TBD",
  status: "todo",
  title: "Write the CLAIM this chart shows (a sentence, not a topic)",
  question: "Is the brake-vs-gas pattern real, or could it be luck?",
  howToRead: [
    ["Each dot", "one medicine"],
    ["Across", "presses the gas more ← → presses the brake more"],
    ["Up", "more patients sleepy than sleepless"],
  ],
  source: "Binding: PDSP K<sub>i</sub>. Side effects: SIDER 4.1.",
  takeaways: [
    { type: "caveat", text: "Placeholder: a short headline goes here.", points: ["Each supporting fact gets its own bullet (see STYLEGUIDE.md §7)."] },
  ],
});
