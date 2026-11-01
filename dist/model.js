/* State model: no DOM here, so the same logic can be tested in Node. */
(function (root) {
  "use strict";
  const LIMITS = Object.freeze({ hardCap: 100, maxSeconds: 12, engageDepth: 20, releaseDepth: 10, stableSeconds: 0.2, stopSeconds: 0.25 });
  const BOTTLES = Object.freeze({
    round: { label: "Round perfume bottle", adapter: "A", tube: "short" },
    tall: { label: "Tall cologne bottle", adapter: "B", tube: "long" }
  });
  class Atomizer {
    constructor() {
      this.state = "detached";
      this.attached = false;
      this.setupValid = false;
      this.sensorValid = true;
      this.faultLatched = false;
      this.pressed = false;
      this.touchOnly = false;
      this.armed = false;
      this.depth = 55;
      this.speed = 1;
      this.selectedDose = 60;
      this.targetDose = 60;
      this.delivered = 0;
      this.elapsed = 0;
      this.flow = 0;
      this.stableTime = 0;
      this.stopTime = 0;
      this.stopReason = "";
      this.overLimitTest = false;
      this.config = { bottle: "round", adapter: "A", tube: "short", gasket: false, pathReady: false };
      this.message = "Choose a bottle and parts, then attach the head.";
      this.log = [];
      this.record("start", "detached", this.message);
    }
    record(from, to, reason) {
      this.log.unshift({ from: from, to: to, reason: reason });
      this.log = this.log.slice(0, 16);
    }
    transition(next, reason) {
      const previous = this.state;
      this.state = next;
      this.message = reason;
      if (next !== previous) this.record(previous, next, reason);
    }
    isReleased() { return !this.pressed && !this.touchOnly; }
    configure(key, value) {
      if (this.attached) { this.message = "Detach the head before changing its bottle or parts."; return false; }
      if (!(key in this.config)) return false;
      this.config[key] = value;
      this.setupValid = false;
      return true;
    }
    attach() {
      if (this.attached) return;
      this.attached = true;
      this.setupValid = false;
      this.armed = false;
      this.flow = 0;
      if (this.faultLatched) { this.message = "Head attached, but the fault still needs a reset."; return; }
      this.transition("setup_required", "Head attached. Confirm the setup before any mist.");
    }
    detach() {
      this.attached = false;
      this.setupValid = false;
      this.armed = false;
      this.flow = 0;
      this.stableTime = 0;
      this.stopReason = "detached";
      if (this.faultLatched) { this.message = "Head detached; the fault remains latched."; return; }
      this.transition("detached", "Attachment lost: pump off and setup cleared. The old dose will not resume.");
    }
    confirmSetup() {
      if (this.faultLatched || !this.sensorValid) { this.message = "Resolve and reset the sensor fault first."; return false; }
      if (!this.attached) { this.message = "Attach the head first."; return false; }
      const bottle = BOTTLES[this.config.bottle];
      if (!bottle || this.config.adapter !== bottle.adapter) { this.message = "Adapter mismatch. This model bottle requires adapter " + (bottle ? bottle.adapter : "?") + "."; return false; }
      if (this.config.tube !== bottle.tube) { this.message = "Choose the " + bottle.tube + " dip tube for this model bottle."; return false; }
      if (!this.config.gasket || !this.config.pathReady) { this.message = "Confirm the gasket and fluid-path setup. These are user checks, not automatic seal detection."; return false; }
      if (!this.isReleased()) { this.message = "Release the press and touch inputs before confirming setup."; return false; }
      this.setupValid = true;
      this.armed = true;
      this.transition("standby", "Setup confirmed. Ready for a fresh touch and press.");
      return true;
    }
    setDose(value) {
      if (["atomizing", "press_engaged", "stopping"].includes(this.state)) return false;
      if (![30, 60, 90].includes(Number(value))) return false;
      this.selectedDose = Number(value);
      return true;
    }
    setDepth(value) {
      const number = Number(value);
      if (!Number.isFinite(number)) return;
      this.depth = Math.max(0, Math.min(100, number));
      if (this.pressed && this.depth < LIMITS.releaseDepth && ["atomizing", "press_engaged"].includes(this.state)) this.beginStop("cancelled", "Press fell below the release threshold.");
      else this.evaluatePress();
    }
    setSpeed(value) {
      const number = Number(value);
      if ([0.8, 1, 1.2].includes(number)) this.speed = number;
    }
    setTouch(value) {
      this.touchOnly = Boolean(value);
      if (this.faultLatched || !this.setupValid) return;
      if (this.touchOnly && this.state === "standby") this.transition("touch_sensing", "Touch detected. The pump is still off.");
      else if (!this.touchOnly && !this.pressed && this.state === "touch_sensing") this.transition("standby", "Touch removed without dispensing.");
    }
    setPressed(value) {
      const wasPressed = this.pressed;
      this.pressed = Boolean(value);
      if (!this.pressed) {
        if (["atomizing", "press_engaged"].includes(this.state)) this.beginStop("cancelled", "Button released: stop the pump and cancel the remainder.");
        else if (this.state === "touch_sensing" && !this.touchOnly) this.transition("standby", "Press released before activation.");
        this.stableTime = 0;
      } else if (!wasPressed) {
        this.evaluatePress();
      }
    }
    evaluatePress() {
      if (!this.pressed || !this.attached || !this.setupValid || !this.sensorValid || this.faultLatched || !this.armed) return;
      if (!["standby", "touch_sensing"].includes(this.state)) return;
      if (this.state === "standby") this.transition("touch_sensing", "Touch detected; checking press depth.");
      if (this.depth >= LIMITS.engageDepth) {
        this.stableTime = 0;
        this.transition("press_engaged", "Press is deep enough. It must stay stable for 0.2 seconds.");
      }
    }
    beginStop(reason, message) {
      this.flow = 0;
      this.armed = false;
      this.stopTime = 0;
      this.stopReason = reason;
      this.transition("stopping", message);
    }
    latchFault(reason) {
      this.flow = 0;
      this.setupValid = false;
      this.armed = false;
      this.faultLatched = true;
      this.stopReason = "fault";
      this.transition("fault", reason);
    }
    setSensorFault(enabled) {
      this.sensorValid = !enabled;
      if (enabled) this.latchFault("Sensor fault: pump off. Clear the fault input, release, then reset.");
    }
    resetFault() {
      if (!this.faultLatched) return false;
      if (!this.sensorValid) { this.message = "Clear the sensor fault input before resetting."; return false; }
      if (!this.isReleased()) { this.message = "Release both press and touch inputs before resetting."; return false; }
      this.faultLatched = false;
      this.setupValid = false;
      this.armed = false;
      this.transition(this.attached ? "setup_required" : "detached", "Fault reset. Fresh setup is required; no automatic restart.");
      return true;
    }
    tick(dt) {
      if (!Number.isFinite(dt) || dt <= 0) return;
      if (this.faultLatched || !this.attached || !this.sensorValid) { this.flow = 0; return; }
      if (this.state === "press_engaged") {
        if (!this.pressed || this.depth < LIMITS.engageDepth) {
          this.stableTime = 0;
          this.transition(this.pressed || this.touchOnly ? "touch_sensing" : "standby", "Press was not stable long enough; no dose started.");
          return;
        }
        this.stableTime += dt;
        if (this.stableTime >= LIMITS.stableSeconds) {
          this.delivered = 0;
          this.elapsed = 0;
          this.targetDose = this.overLimitTest ? 120 : this.selectedDose;
          this.armed = false;
          this.transition("atomizing", "Stable press accepted. This cycle's target is now fixed.");
        }
        return;
      }
      if (this.state === "atomizing") {
        if (!this.pressed || this.depth < LIMITS.releaseDepth) { this.beginStop("cancelled", "Press released: pump off."); return; }
        const flow = (4 + this.depth * 0.2) * this.speed; // Illustrative units/second, not a real pump calibration.
        const timeLeft = Math.max(0, LIMITS.maxSeconds - this.elapsed);
        const allowedTime = Math.min(dt, timeLeft);
        const targetRemaining = Math.max(0, this.targetDose - this.delivered);
        const capRemaining = Math.max(0, LIMITS.hardCap - this.delivered);
        const addition = Math.min(flow * allowedTime, targetRemaining, capRemaining);
        this.delivered += addition;
        this.elapsed += addition / flow;
        this.flow = flow;
        if (this.targetDose > LIMITS.hardCap && this.delivered >= LIMITS.hardCap - 0.000001) this.beginStop("fault", "Hard cap reached at 100 units; an over-limit target cannot override it.");
        else if (this.delivered >= this.targetDose - 0.000001) this.beginStop("complete", "Selected dose reached. Pump off even if the button is still held.");
        else if (this.elapsed >= LIMITS.maxSeconds - 0.000001) this.beginStop("fault", "Maximum pump time reached at 12 seconds.");
        return;
      }
      if (this.state === "stopping") {
        this.flow = 0;
        this.stopTime += dt; // Visual shutdown interval only. No residual fluid is modeled.
        if (this.stopTime >= LIMITS.stopSeconds) {
          if (this.stopReason === "fault") this.latchFault(this.message);
          else this.transition(this.stopReason === "complete" ? "dose_complete" : "cancelled", this.stopReason === "complete" ? "Dose complete. Release fully before another cycle." : "Cycle cancelled. Release fully before another cycle.");
        }
        return;
      }
      if (["dose_complete", "cancelled"].includes(this.state) && this.isReleased()) {
        this.armed = true;
        this.transition("standby", "Fully released. The next press starts a new cycle, not the remainder.");
      }
    }
  }
  root.Atomizer = Atomizer;
  root.ATOMIZER_LIMITS = LIMITS;
  root.ATOMIZER_BOTTLES = BOTTLES;
  if (typeof module !== "undefined" && module.exports) module.exports = { Atomizer: Atomizer, LIMITS: LIMITS, BOTTLES: BOTTLES };
})(typeof globalThis !== "undefined" ? globalThis : this);

