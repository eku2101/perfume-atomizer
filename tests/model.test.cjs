"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { Atomizer, LIMITS } = require("../dist/model.js");
function ready() {
  const m = new Atomizer();
  m.configure("gasket", true);
  m.configure("pathReady", true);
  m.attach();
  assert.equal(m.confirmSetup(), true);
  return m;
}
function advance(m, seconds) { for (let t = 0; t < seconds - 0.000001; t += 0.05) m.tick(0.05); }
function start(m) { m.setPressed(true); advance(m, 0.25); assert.equal(m.state, "atomizing"); }
test("detached inputs cannot dispense", function () { const m = new Atomizer(); m.setPressed(true); advance(m, 2); assert.equal(m.delivered, 0); assert.equal(m.state, "detached"); });
test("attached does not mean setup confirmed", function () { const m = new Atomizer(); m.attach(); m.setPressed(true); advance(m, 2); assert.equal(m.state, "setup_required"); assert.equal(m.flow, 0); });
test("wrong adapter blocks setup", function () { const m = new Atomizer(); m.configure("adapter", "B"); m.configure("gasket", true); m.configure("pathReady", true); m.attach(); assert.equal(m.confirmSetup(), false); assert.match(m.message, /mismatch/); });
test("wrong tube blocks setup", function () { const m = new Atomizer(); m.configure("tube", "long"); m.attach(); assert.equal(m.confirmSetup(), false); assert.match(m.message, /short/); });
test("gasket and path checks are required", function () { const m = new Atomizer(); m.attach(); assert.equal(m.confirmSetup(), false); assert.equal(m.setupValid, false); });
test("configuration is locked while attached", function () { const m = ready(); assert.equal(m.configure("bottle", "tall"), false); assert.equal(m.config.bottle, "round"); });
test("touch alone changes state without pumping", function () { const m = ready(); m.setTouch(true); advance(m, 1); assert.equal(m.state, "touch_sensing"); assert.equal(m.delivered, 0); m.setTouch(false); assert.equal(m.state, "standby"); });
test("short presses are rejected before activation", function () { const m = ready(); m.setPressed(true); advance(m, 0.1); m.setPressed(false); advance(m, 1); assert.equal(m.delivered, 0); assert.equal(m.state, "standby"); });
test("unstable depth restarts activation check", function () { const m = ready(); m.setPressed(true); advance(m, 0.1); m.setDepth(15); advance(m, 0.1); assert.equal(m.state, "touch_sensing"); m.setDepth(55); advance(m, 0.1); assert.equal(m.state, "press_engaged"); assert.equal(m.delivered, 0); });
test("early release stops modeled output immediately", function () { const m = ready(); start(m); advance(m, 1); m.setPressed(false); const delivered = m.delivered; assert.equal(m.flow, 0); advance(m, 2); assert.equal(m.delivered, delivered); assert.equal(m.state, "standby"); });
test("deeper press changes flow but not selected target", function () { const low = ready(); const high = ready(); low.setDepth(30); high.setDepth(90); start(low); start(high); advance(low, 1); advance(high, 1); assert.ok(high.delivered > low.delivered); assert.equal(high.targetDose, low.targetDose); });
test("speed setting changes modeled delivery", function () { const low = ready(); const high = ready(); low.setSpeed(0.8); high.setSpeed(1.2); start(low); start(high); advance(low, 1); advance(high, 1); assert.ok(high.delivered > low.delivered); });
test("dose target stops pumping even while held", function () { const m = ready(); m.setDose(30); start(m); advance(m, 8); assert.equal(m.delivered, 30); assert.equal(m.state, "dose_complete"); assert.equal(m.flow, 0); advance(m, 5); assert.equal(m.delivered, 30); });
test("full release rearms but does not automatically spray", function () { const m = ready(); m.setDose(30); start(m); advance(m, 5); m.setPressed(false); advance(m, 1); assert.equal(m.state, "standby"); assert.equal(m.delivered, 30); start(m); assert.ok(m.delivered < 30); });
test("touch still present prevents rearming", function () { const m = ready(); m.setDose(30); m.setTouch(true); start(m); advance(m, 5); m.setPressed(false); advance(m, 1); assert.equal(m.state, "dose_complete"); m.setTouch(false); advance(m, 0.1); assert.equal(m.state, "standby"); });
test("selected target cannot change during a cycle", function () { const m = ready(); start(m); assert.equal(m.setDose(90), false); assert.equal(m.targetDose, 60); });
test("removing the head cuts flow and clears setup", function () { const m = ready(); start(m); advance(m, 1); m.detach(); const delivered = m.delivered; advance(m, 2); assert.equal(m.flow, 0); assert.equal(m.delivered, delivered); assert.equal(m.state, "detached"); assert.equal(m.setupValid, false); });
test("reattaching with held input cannot spray or confirm setup", function () { const m = ready(); start(m); advance(m, 1); m.detach(); m.attach(); assert.equal(m.confirmSetup(), false); advance(m, 2); assert.equal(m.state, "setup_required"); assert.equal(m.flow, 0); m.setPressed(false); assert.equal(m.confirmSetup(), true); advance(m, 1); assert.equal(m.state, "standby"); });
test("bottle swap requires new matching parts", function () { const m = ready(); m.detach(); m.configure("bottle", "tall"); m.attach(); assert.equal(m.confirmSetup(), false); m.detach(); m.configure("adapter", "B"); m.configure("tube", "long"); m.attach(); assert.equal(m.confirmSetup(), true); });
test("hard cap cannot be overridden by a high test target", function () { const m = ready(); m.overLimitTest = true; m.setDepth(100); start(m); advance(m, 10); assert.equal(m.delivered, LIMITS.hardCap); assert.equal(m.state, "fault"); assert.equal(m.flow, 0); });
test("maximum time stops a slow full-dose request", function () { const m = ready(); m.setDose(90); m.setDepth(20); m.setSpeed(0.8); start(m); advance(m, 15); assert.equal(m.state, "fault"); assert.ok(m.elapsed <= LIMITS.maxSeconds + 0.00001); assert.ok(m.delivered < 90); });
test("sensor fault is immediate and remains latched", function () { const m = ready(); start(m); m.setSensorFault(true); assert.equal(m.flow, 0); assert.equal(m.state, "fault"); m.setSensorFault(false); m.setPressed(false); advance(m, 2); assert.equal(m.state, "fault"); });
test("fault requires clearing input, releasing and resetting", function () { const m = ready(); start(m); m.setSensorFault(true); assert.equal(m.resetFault(), false); m.setSensorFault(false); assert.equal(m.resetFault(), false); m.setPressed(false); assert.equal(m.resetFault(), true); assert.equal(m.state, "setup_required"); assert.equal(m.setupValid, false); });
test("detaching does not erase a fault", function () { const m = ready(); m.setSensorFault(true); m.detach(); m.attach(); assert.equal(m.state, "fault"); assert.equal(m.confirmSetup(), false); });
test("large time steps still cannot overshoot volume or time", function () { const m = ready(); m.overLimitTest = true; start(m); m.tick(1000); assert.ok(m.delivered <= 100); assert.ok(m.elapsed <= 12); assert.equal(m.flow, 0); });

