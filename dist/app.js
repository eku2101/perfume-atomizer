"use strict";
let model = new Atomizer();
const $ = function (id) { return document.getElementById(id); };
const pressSources = new Set();
let lastJournal = "";
let lastMessage = "";
// A stable particle field avoids randomness or DOM creation in the animation loop.
for (let i = 0; i < 36; i++) {
  const drop = document.createElement("i");
  drop.style.setProperty("--fan", String((i % 9 - 4) / 4));
  drop.style.setProperty("--delay", (-i * 0.073) + "s");
  $("spray").append(drop);
}
const pretty = function (value) { return value.replaceAll("_", " ").replace(/^./, function (c) { return c.toUpperCase(); }); };
function syncPress() { model.setPressed(pressSources.size > 0); render(); }
function setSource(source, active) { if (active) pressSources.add(source); else pressSources.delete(source); syncPress(); }

$("ready-example").addEventListener("click", function () {
  releaseAll();
  const bottle = $("bottle").value;
  model = new Atomizer();
  model.configure("bottle", bottle);
  model.configure("adapter", bottle === "tall" ? "B" : "A");
  model.configure("tube", bottle === "tall" ? "long" : "short");
  model.configure("gasket", true);
  model.configure("pathReady", true);
  ["adapter", "tube"].forEach(function (key) { $(key).value = model.config[key]; });
  $("gasket").checked = $("path-ready").checked = true;
  $("sensor-fault").checked = $("over-limit").checked = false;
  $("dose").value = String(model.selectedDose);
  $("depth").value = String(model.depth);
  $("speed").value = String(model.speed);
  model.attach();
  model.confirmSetup();
  render();
});

["bottle", "adapter", "tube", "gasket"].forEach(function (key) {
  $(key).addEventListener("change", function (event) {
    model.configure(key, event.target.type === "checkbox" ? event.target.checked : event.target.value);
    render();
  });
});
$("path-ready").addEventListener("change", function (event) { model.configure("pathReady", event.target.checked); render(); });
$("attachment").addEventListener("click", function () {
  if (model.attached) model.detach(); else model.attach();
  render();
});
$("confirm").addEventListener("click", function () { model.confirmSetup(); render(); });
$("dose").addEventListener("change", function (event) { model.setDose(event.target.value); render(); });
$("depth").addEventListener("input", function (event) { model.setDepth(event.target.value); render(); });
$("speed").addEventListener("change", function (event) { model.setSpeed(event.target.value); render(); });
$("touch-only").addEventListener("change", function (event) { model.setTouch(event.target.checked); render(); });
$("held-test").addEventListener("change", function (event) { setSource("test", event.target.checked); });
$("over-limit").addEventListener("change", function (event) { model.overLimitTest = event.target.checked; render(); });
$("sensor-fault").addEventListener("change", function (event) { model.setSensorFault(event.target.checked); render(); });
$("reset-fault").addEventListener("click", function () { model.resetFault(); render(); });

const pressButton = $("press");
pressButton.addEventListener("pointerdown", function (event) {
  if (event.button !== 0) return;
  event.preventDefault();
  pressButton.focus({ preventScroll: true });
  pressButton.setPointerCapture(event.pointerId);
  setSource("pointer", true);
});
window.addEventListener("pointerup", function () { setSource("pointer", false); });
window.addEventListener("pointercancel", function () { setSource("pointer", false); });
pressButton.addEventListener("lostpointercapture", function () { setSource("pointer", false); });
pressButton.addEventListener("keydown", function (event) {
  if (event.code === "Space" || event.code === "Enter") {
    event.preventDefault();
    if (!event.repeat) setSource(event.code, true);
  }
});
window.addEventListener("keyup", function (event) {
  if (event.code === "Space" || event.code === "Enter") {
    if (pressSources.has(event.code)) event.preventDefault();
    setSource(event.code, false);
  }
});
pressButton.addEventListener("click", function (event) { event.preventDefault(); });
function releaseAll() {
  pressSources.clear();
  $("held-test").checked = false;
  $("touch-only").checked = false;
  model.setTouch(false);
  model.setPressed(false);
  render();
}
window.addEventListener("blur", releaseAll);
document.addEventListener("visibilitychange", function () { if (document.hidden) releaseAll(); });

function render() {
  $("parts").disabled = model.attached;
  $("attachment").textContent = model.attached ? "Detach head" : "Attach head";
  $("attachment").classList.toggle("danger", model.attached);
  $("confirm").disabled = !model.attached || model.faultLatched || model.setupValid;
  const inCycle = ["press_engaged", "atomizing", "stopping"].includes(model.state);
  $("dose").disabled = inCycle;
  $("over-limit").disabled = inCycle;
  $("reset-fault").disabled = !model.faultLatched;
  pressButton.disabled = !model.setupValid || model.faultLatched || !model.attached;
  pressButton.setAttribute("aria-pressed", String(model.pressed));
  $("setup-help").textContent = model.faultLatched
    ? "Clear the sensor fault, release all inputs, then reset the fault and confirm setup. Or load a fresh example."
    : !model.attached ? "Next: select matching parts, check both boxes, then click Attach head."
    : !model.setupValid ? "Next: click Confirm setup. To correct parts or checks, detach the head first."
    : "Setup confirmed. Detach the head to change bottles or parts.";
  $("press-help").textContent = pressButton.disabled
    ? "Complete setup in step 01, or click Load ready-to-try example to unlock this button."
    : model.depth < 20 ? "Increase press depth to at least 20%, then press and hold to mist."
    : "Press and HOLD for longer than a quick click. Release to stop. Keyboard: hold Space or Enter. Start depth is 20%.";
  $("depth-value").textContent = model.depth + "%";
  $("state-badge").textContent = pretty(model.state);
  $("state-badge").className = "badge" + (model.state === "atomizing" ? " active" : "") + (model.state === "fault" ? " fault" : "");
  if (model.message !== lastMessage) { $("status").textContent = model.message; lastMessage = model.message; }
  $("pump").textContent = model.flow > 0 ? "ON" : "OFF";
  $("pump").style.color = model.flow > 0 ? "var(--green)" : "var(--ink)";
  $("flow").textContent = model.flow.toFixed(1) + " u/s";
  $("elapsed").textContent = model.elapsed.toFixed(1) + " s";
  $("volume").textContent = model.delivered.toFixed(1);
  $("setup-value").textContent = model.setupValid ? "Confirmed" : "Not confirmed";
  const activeTarget = model.delivered > 0 || inCycle ? model.targetDose : (model.overLimitTest ? 120 : model.selectedDose);
  const showingLastCycle = model.delivered > 0 && ["standby", "setup_required", "detached", "fault"].includes(model.state);
  $("volume-label").textContent = showingLastCycle ? "units · last cycle" : "units delivered";
  $("target-label").textContent = (showingLastCycle ? "Last target " : "Target ") + activeTarget + (activeTarget > 100 ? " · cap 100" : "");
  $("dose-progress").max = activeTarget;
  $("dose-progress").value = model.delivered;
  $("dose-progress").setAttribute("aria-valuetext", model.delivered.toFixed(1) + " of " + activeTarget + " simulation units");
  $("scene").className = "bottle-scene" +
    (model.config.bottle === "tall" ? " tall" : "") +
    (!model.attached ? " detached" : "") +
    (model.state === "atomizing" && model.flow > 0 ? " spraying" : "") +
    (["touch_sensing", "press_engaged"].includes(model.state) ? " sensing" : "") +
    (model.faultLatched ? " error" : "");
  $("scene").style.setProperty("--glow", Math.min(360, model.delivered / activeTarget * 360) + "deg");
  const intensity = model.depth / 100;
  $("scene").style.setProperty("--throw", (45 + intensity * 95) + "px");
  $("scene").style.setProperty("--spread", (12 + intensity * 44) + "px");
  $("scene").style.setProperty("--mist-opacity", String(0.25 + intensity * 0.5));
  $("scene").style.setProperty("--mist-duration", (1.2 / model.speed) + "s");
  const spraying = model.state === "atomizing" && model.flow > 0;
  const sprayText = spraying
    ? "Spraying · " + model.depth + "% depth · " + (model.depth < 40 ? "gentle, narrow mist" : model.depth < 75 ? "medium mist" : "full, wide mist")
    : model.state === "dose_complete" ? "Dose complete · release before spraying again."
    : !model.setupValid ? "Load a ready-to-try example or complete setup to spray."
    : model.depth < 20 ? "Set depth to 20% or more to start the spray."
    : "Hold to mist · preview at " + model.depth + "% depth";
  if ($("spray-feedback").textContent !== sprayText) $("spray-feedback").textContent = sprayText;
  pressButton.querySelector("span").textContent = spraying ? "Spraying… release to stop" : "Hold to mist";
  const journalString = JSON.stringify(model.log);
  if (journalString !== lastJournal) {
    $("journal").replaceChildren();
    model.log.forEach(function (entry) {
      const row = document.createElement("li");
      const heading = document.createElement("strong");
      const reason = document.createElement("span");
      heading.textContent = pretty(entry.from) + " → " + pretty(entry.to);
      reason.textContent = entry.reason;
      row.append(heading, reason);
      $("journal").append(row);
    });
    lastJournal = journalString;
  }
}
let lastFrame = performance.now();
function frame(now) {
  // Time steps are bounded; hidden tabs and focus loss explicitly release the input.
  const dt = Math.min((now - lastFrame) / 1000, 0.1);
  lastFrame = now;
  model.tick(dt);
  render();
  requestAnimationFrame(frame);
}
render();
requestAnimationFrame(frame);

