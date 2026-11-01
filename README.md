# Perfume Atomizer State Lab

An HTML, CSS, and JavaScript Doodle for an interchangeable perfume and cologne atomizer. The goal is to model decisions and state transitions, not to control real hardware.

## Run the model

Open dist/index.html in a browser. All assets are local, and no installation or build is needed.

1. Start with the round bottle, adapter A, and the short tube.
2. Confirm the gasket and fluid-path checkboxes.
3. Select Attach head, then Confirm setup.
4. Hold the mist button with a mouse, touch, or Space/Enter while it has keyboard focus.
5. Release early, or keep holding until the target is reached.
6. Open Try an edge case to hold an input while detaching, request an over-limit target, or inject a sensor fault.

For the tall bottle, detach first, then choose adapter B and the long tube. The example compatibility table is illustrative and is not a real bottle standard.

## Code map

- dist/index.html: form controls, status feedback, concept image, and short learning notes.
- dist/styles.css: responsive layout, LED ring, bottle schematic, and mist animation.
- dist/model.js: state variables, configuration rules, transitions, and limits.
- dist/app.js: event listeners and display updates.
- tests/model.test.cjs: deterministic state-model tests using Node's built-in test runner.
- tests/browser.test.cjs: browser interaction checks using Playwright and Chrome.

The model object stores state, attached, setupValid, pressed, touchOnly, depth, speed, targetDose, delivered, elapsed, and faultLatched. Input event handlers call model methods. The animation loop advances simulated time and updates the page.

## How the model uses control flow

The head cannot dispense while detached, unconfigured, or faulted. A valid press must remain at or above 20 percent depth for 0.2 seconds before dispensing starts. Once dispensing, falling below 10 percent cancels it. These are illustrative thresholds.

Dose choices are 30, 60, and 90 simulation units. The hard cap is 100 units and maximum pump time is 12 simulated seconds. The optional 120-unit test target demonstrates that the cap wins over the request. A completed cycle will not restart until the input is fully released.

Flow is an illustrative formula: (4 + depth * 0.2) * speed. It is not a calibration for a perfume pump. The 0.25-second stopping state has zero modeled flow; residual real mist is outside this model.

## Tests

Run: node --test tests/model.test.cjs

For browser checks, provide Playwright through the environment, install Chrome, and run: node tests/browser.test.cjs

The browser test uses the standalone file by default. ATOMIZER_TEST_URL can point it at a preview server instead.

Codex ran 25 state-model tests and 10 browser checks successfully on November 1, 2026. Desktop and mobile layouts were inspected. These checks verify software behavior only.

## Design limits and AI support

The attachment signal does not prove the thread fit or seal. Gasket and fluid-path checks are represented by user confirmations. The browser cannot measure actual physical force; sliders represent the proposed sensor input. Bottle sealing, scent carryover, fluid preparation, hardware failure, and residual mist require physical testing.

The student supplied the product idea and clarified the interchangeable attachment, release behavior, and research question. Codex generated this implementation and ran the automated checks. The code is organized so its variables, events, and conditions can be read and discussed.

## References

- [MDN event listeners](https://developer.mozilla.org/en-US/docs/Web/API/EventTarget/addEventListener)
- [MDN if and else](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/if...else)
- [MDN pointer events](https://developer.mozilla.org/en-US/docs/Web/API/Pointer_events)

The concept image was generated with Codex's built-in image tool in the earlier design work.


## Project links

- [Public interactive model](https://perfume-atomizer-doodle-1101.eku2101.chatgpt.site)
- [Codex conversation transcript](https://chatgpt.com/s/cx_6ae7cee98ebc819181c8c2e594799d0b)
- [MDN pointer events](https://developer.mozilla.org/en-US/docs/Web/API/Pointer_events)
