var EVENTS = {
  CLICK: 'click',
  FUSING: 'fusing',
  MOUSEENTER: 'mouseenter',
  MOUSEDOWN: 'mousedown',
  MOUSELEAVE: 'mouseleave',
  MOUSEUP: 'mouseup'
};

var STATES = {
  FUSING: 'cursor-fusing',
  HOVERING: 'cursor-hovering',
  HOVERED: 'cursor-hovered'
};

var CANVAS_EVENTS = {
  DOWN: ['mousedown', 'touchstart'],
  UP: ['mouseup', 'touchend']
};


AFRAME.registerComponent('my-cursor', {
  dependencies: ['raycaster'],

  schema: {
    downEvents: {default: []},
    fuse: {default: AFRAME.utils.device.isMobile()},
    fuseTimeout: {default: 1500, min: 0},
    upEvents: {default: []},
    rayOrigin: {default: 'entity', oneOf: ['mouse', 'entity']}
  },

  init: function () {
    var self = this;

    this.fuseTimeout = undefined;
    this.cursorDownEl = null;
    this.intersection = null;
    this.intersectedEl = null;
    this.canvasBounds = document.body.getBoundingClientRect();

    // Debounce.
    this.updateCanvasBounds = AFRAME.utils.debounce(function updateCanvasBounds () {
      self.canvasBounds = self.el.sceneEl.canvas.getBoundingClientRect();
    }, 1000);

    this.eventDetail = {};
    this.intersectedEventDetail = {cursorEl: this.el};

    // AFRAME.utils.bind methods.
    this.onCursorDown = AFRAME.utils.bind(this.onCursorDown, this);
    this.onCursorUp = AFRAME.utils.bind(this.onCursorUp, this);
    this.onIntersection = AFRAME.utils.bind(this.onIntersection, this);
    this.onIntersectionCleared = AFRAME.utils.bind(this.onIntersectionCleared, this);
    this.onMouseMove = AFRAME.utils.bind(this.onMouseMove, this);
  },

  update: function (oldData) {
    if (this.data.rayOrigin === oldData.rayOrigin) { return; }
    this.updateMouseEventListeners();
  },

  play: function () {
    this.addEventListeners();
  },

  pause: function () {
    this.removeEventListeners();
  },

  remove: function () {
    var el = this.el;
    el.removeState(STATES.HOVERING);
    el.removeState(STATES.FUSING);
    clearTimeout(this.fuseTimeout);
    if (this.intersectedEl) { this.intersectedEl.removeState(STATES.HOVERED); }
    this.removeEventListeners();
  },

  addEventListeners: function () {
    var canvas;
    var data = this.data;
    var el = this.el;
    var self = this;

    function addCanvasListeners () {
      canvas = el.sceneEl.canvas;
      if (data.downEvents.length || data.upEvents.length) { return; }
      CANVAS_EVENTS.DOWN.forEach(function (downEvent) {
        canvas.addEventListener(downEvent, self.onCursorDown);
      });
      CANVAS_EVENTS.UP.forEach(function (upEvent) {
        canvas.addEventListener(upEvent, self.onCursorUp);
      });
    }

    canvas = el.sceneEl.canvas;
    if (canvas) {
      addCanvasListeners();
    } else {
      el.sceneEl.addEventListener('render-target-loaded', addCanvasListeners);
    }

    data.downEvents.forEach(function (downEvent) {
      el.addEventListener(downEvent, self.onCursorDown);
    });
    data.upEvents.forEach(function (upEvent) {
      el.addEventListener(upEvent, self.onCursorUp);
    });
    el.addEventListener('raycaster-intersection', this.onIntersection);
    el.addEventListener('raycaster-intersection-cleared', this.onIntersectionCleared);

    window.addEventListener('resize', this.updateCanvasBounds);
  },

  removeEventListeners: function () {
    var canvas;
    var data = this.data;
    var el = this.el;
    var self = this;

    canvas = el.sceneEl.canvas;
    if (canvas && !data.downEvents.length && !data.upEvents.length) {
      CANVAS_EVENTS.DOWN.forEach(function (downEvent) {
        canvas.removeEventListener(downEvent, self.onCursorDown);
      });
      CANVAS_EVENTS.UP.forEach(function (upEvent) {
        canvas.removeEventListener(upEvent, self.onCursorUp);
      });
    }

    data.downEvents.forEach(function (downEvent) {
      el.removeEventListener(downEvent, self.onCursorDown);
    });
    data.upEvents.forEach(function (upEvent) {
      el.removeEventListener(upEvent, self.onCursorUp);
    });
    el.removeEventListener('raycaster-intersection', this.onIntersection);
    el.removeEventListener('raycaster-intersection-cleared', this.onIntersectionCleared);
    canvas.removeEventListener('mousemove', this.onMouseMove);
    canvas.removeEventListener('touchstart', this.onMouseMove);
    canvas.removeEventListener('touchmove', this.onMouseMove);
    canvas.removeEventListener('resize', this.updateCanvasBounds);
  },

  updateMouseEventListeners: function () {
    var canvas;
    var el = this.el;

    canvas = el.sceneEl.canvas;
    canvas.removeEventListener('mousemove', this.onMouseMove);
    canvas.removeEventListener('touchmove', this.onMouseMove);
    el.setAttribute('raycaster', 'useWorldCoordinates', false);
    if (this.data.rayOrigin !== 'mouse') { return; }
    canvas.addEventListener('mousemove', this.onMouseMove, false);
    canvas.addEventListener('touchmove', this.onMouseMove, false);
    el.setAttribute('raycaster', 'useWorldCoordinates', true);
    this.updateCanvasBounds();
  },

  onMouseMove: (function () {
    var direction = new THREE.Vector3();
    var mouse = new THREE.Vector2();
    var origin = new THREE.Vector3();
    var rayCasterConfig = {origin: origin, direction: direction};

    return function (evt) {
      var bounds = this.canvasBounds;
      var camera = this.el.sceneEl.camera;
      var left;
      var point;
      var top;

      camera.parent.updateMatrixWorld();
      camera.updateMatrixWorld();

      // Calculate mouse position based on the canvas element
      if (evt.type === 'touchmove' || evt.type === 'touchstart') {
        // Track the first touch for simplicity.
        point = evt.touches.item(0);
      } else {
        point = evt;
      }

      left = point.clientX - bounds.left;
      top = point.clientY - bounds.top;
      mouse.x = (left / bounds.width) * 2 - 1;
      mouse.y = -(top / bounds.height) * 2 + 1;

      origin.setFromMatrixPosition(camera.matrixWorld);
      direction.set(mouse.x, mouse.y, 0.5).unproject(camera).sub(origin).normalize();
      this.el.setAttribute('raycaster', rayCasterConfig);
      if (evt.type === 'touchmove') { evt.preventDefault(); }
    };
  })(),

  /**
   * Trigger mousedown and keep track of the mousedowned entity.
   */
  onCursorDown: function (evt) {
    // Raycast again for touch.
    if (this.data.rayOrigin === 'mouse' && evt.type === 'touchstart') {
      this.onMouseMove(evt);
      this.el.components.raycaster.checkIntersections();
      evt.preventDefault();
    }

    this.twoWayEmit(EVENTS.MOUSEDOWN);
    this.cursorDownEl = this.intersectedEl;
  },

  /**
   * Trigger mouseup if:
   * - Not fusing (mobile has no mouse).
   * - Currently intersecting an entity.
   * - Currently-intersected entity is the same as the one when mousedown was triggered,
   *   in case user mousedowned one entity, dragged to another, and mouseupped.
   */
  onCursorUp: function (evt) {
    this.twoWayEmit(EVENTS.MOUSEUP);

    // If intersected entity has changed since the cursorDown, still emit mouseUp on the
    // previously cursorUp entity.
    if (this.cursorDownEl && this.cursorDownEl !== this.intersectedEl) {
      this.intersectedEventDetail.intersection = null;
      this.cursorDownEl.emit(EVENTS.MOUSEUP, this.intersectedEventDetail);
    }

    if (!this.data.fuse && this.intersectedEl && this.cursorDownEl === this.intersectedEl) {
      this.twoWayEmit(EVENTS.CLICK);
    }

    this.cursorDownEl = null;
    if (evt.type === 'touchend') { evt.preventDefault(); }
  },

  /**
   * Handle intersection.
   */
  onIntersection: function (evt) {
    var cursorEl = this.el;
    var index;
    var intersectedEl;
    var intersection;

    // Select closest object, excluding the cursor.
    index = evt.detail.els[0] === cursorEl ? 1 : 0;
    intersection = evt.detail.intersections[index];
    intersectedEl = evt.detail.els[index];

    // If cursor is the only intersected object, ignore the event.
    if (!intersectedEl) { return; }

    // Already intersecting this entity.
    if (this.intersectedEl === intersectedEl) {
      this.intersection = intersection;
      return;
    }

    // Unset current intersection.
    this.clearCurrentIntersection();

    this.setIntersection(intersectedEl, intersection);
  },

  /**
   * Handle intersection cleared.
   */
  onIntersectionCleared: function (evt) {
    var clearedEls = evt.detail.clearedEls;
    // Check if the current intersection has ended
    if (clearedEls.indexOf(this.intersectedEl) === -1) { return; }
    this.clearCurrentIntersection();
  },

  setIntersection: function (intersectedEl, intersection) {
    var cursorEl = this.el;
    var data = this.data;
    var self = this;

    // Already intersecting.
    if (this.intersectedEl === intersectedEl) { return; }

    // Set new intersection.
    this.intersection = intersection;
    this.intersectedEl = intersectedEl;

    // Hovering.
    cursorEl.addState(STATES.HOVERING);
    intersectedEl.addState(STATES.HOVERED);
    this.twoWayEmit(EVENTS.MOUSEENTER);

    // Begin fuse if necessary.
    if (data.fuseTimeout === 0 || !data.fuse) { return; }
    cursorEl.addState(STATES.FUSING);
    this.twoWayEmit(EVENTS.FUSING);
    this.fuseTimeout = setTimeout(function fuse () {
      cursorEl.removeState(STATES.FUSING);
      self.twoWayEmit(EVENTS.CLICK);
    }, data.fuseTimeout);
  },

  clearCurrentIntersection: function () {
    var cursorEl = this.el;

    // Nothing to be cleared.
    if (!this.intersectedEl) { return; }

    // No longer hovering (or fusing).
    this.intersectedEl.removeState(STATES.HOVERED);
    cursorEl.removeState(STATES.HOVERING);
    cursorEl.removeState(STATES.FUSING);
    this.twoWayEmit(EVENTS.MOUSELEAVE);

    // Unset intersected entity (after emitting the event).
    this.intersection = null;
    this.intersectedEl = null;

    // Clear fuseTimeout.
    clearTimeout(this.fuseTimeout);
  },

  /**
   * Helper to emit on both the cursor and the intersected entity (if exists).
   */
  twoWayEmit: function (evtName) {
    var el = this.el;
    var intersectedEl = this.intersectedEl;
    var intersection = this.intersection;

    this.eventDetail.intersectedEl = intersectedEl;
    this.eventDetail.intersection = intersection;
    el.emit(evtName, this.eventDetail);

    if (!intersectedEl) { return; }

    this.intersectedEventDetail.intersection = intersection;
    intersectedEl.emit(evtName, this.intersectedEventDetail);
  }
});
