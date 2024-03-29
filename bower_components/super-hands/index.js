(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
'use strict';

/* global AFRAME */

if (typeof AFRAME === 'undefined') {
  throw new Error('Component attempted to register before AFRAME was available.');
}

require('./systems/super-hands-system.js');
require('./reaction_components/hoverable.js');
require('./reaction_components/grabbable.js');
require('./reaction_components/stretchable.js');
require('./reaction_components/drag-droppable.js');
require('./reaction_components/draggable.js');
require('./reaction_components/droppable.js');
require('./reaction_components/clickable.js');
require('./misc_components/locomotor-auto-config.js');
require('./misc_components/progressive-controls.js');
require('./primitives/a-locomotor.js');

/**
 * Super Hands component for A-Frame.
 */
AFRAME.registerComponent('super-hands', {
  schema: {
    colliderState: { default: '' },
    colliderEvent: { default: 'hit' },
    colliderEventProperty: { default: 'el' },
    colliderEndEvent: { default: 'hitend' },
    colliderEndEventProperty: { default: 'el' },
    grabStartButtons: {
      default: ['gripdown', 'trackpaddown', 'triggerdown', 'gripclose', 'pointup', 'thumbup', 'pointingstart', 'pistolstart', 'thumbstickdown', 'mousedown', 'touchstart']
    },
    grabEndButtons: {
      default: ['gripup', 'trackpadup', 'triggerup', 'gripopen', 'pointdown', 'thumbdown', 'pointingend', 'pistolend', 'thumbstickup', 'mouseup', 'touchend']
    },
    stretchStartButtons: {
      default: ['gripdown', 'trackpaddown', 'triggerdown', 'gripclose', 'pointup', 'thumbup', 'pointingstart', 'pistolstart', 'thumbstickdown', 'mousedown', 'touchstart']
    },
    stretchEndButtons: {
      default: ['gripup', 'trackpadup', 'triggerup', 'gripopen', 'pointdown', 'thumbdown', 'pointingend', 'pistolend', 'thumbstickup', 'mouseup', 'touchend']
    },
    dragDropStartButtons: {
      default: ['gripdown', 'trackpaddown', 'triggerdown', 'gripclose', 'pointup', 'thumbup', 'pointingstart', 'pistolstart', 'thumbstickdown', 'mousedown', 'touchstart']
    },
    dragDropEndButtons: {
      default: ['gripup', 'trackpadup', 'triggerup', 'gripopen', 'pointdown', 'thumbdown', 'pointingend', 'pistolend', 'thumbstickup', 'mouseup', 'touchend']
    }
  },

  /**
   * Set if component needs multiple instancing.
   */
  multiple: false,

  /**
   * Called once when component is attached. Generally for initial setup.
   */
  init: function () {
    // constants
    this.HOVER_EVENT = 'hover-start';
    this.UNHOVER_EVENT = 'hover-end';
    this.GRAB_EVENT = 'grab-start';
    this.UNGRAB_EVENT = 'grab-end';
    this.STRETCH_EVENT = 'stretch-start';
    this.UNSTRETCH_EVENT = 'stretch-end';
    this.DRAG_EVENT = 'drag-start';
    this.UNDRAG_EVENT = 'drag-end';
    this.DRAGOVER_EVENT = 'dragover-start';
    this.UNDRAGOVER_EVENT = 'dragover-end';
    this.DRAGDROP_EVENT = 'drag-drop';

    // links to other systems/components
    this.otherSuperHand = null;

    // state tracking - global event handlers (GEH)
    this.gehDragged = new Set();
    this.gehClicking = new Set();

    // state tracking - reaction components
    this.hoverEls = [];
    this.state = new Map();
    this.dragging = false;

    this.unHover = this.unHover.bind(this);
    this.unWatch = this.unWatch.bind(this);
    this.onHit = this.onHit.bind(this);
    this.onGrabStartButton = this.onGrabStartButton.bind(this);
    this.onGrabEndButton = this.onGrabEndButton.bind(this);
    this.onStretchStartButton = this.onStretchStartButton.bind(this);
    this.onStretchEndButton = this.onStretchEndButton.bind(this);
    this.onDragDropStartButton = this.onDragDropStartButton.bind(this);
    this.onDragDropEndButton = this.onDragDropEndButton.bind(this);
    this.system.registerMe(this);
  },

  /**
   * Called when component is attached and when component data changes.
   * Generally modifies the entity based on the data.
   */
  update: function (oldData) {
    if (this.data.colliderState.length) {
      console.warn('super-hands colliderState property is deprecated. Use colliderEndEvent/colliderEndEventProperty instead');
    }
    this.unRegisterListeners(oldData);
    this.registerListeners();
  },

  /**
   * Called when a component is removed (e.g., via removeAttribute).
   * Generally undoes all modifications to the entity.
   */
  remove: function () {
    this.system.unregisterMe(this);
    this.unRegisterListeners();
    // cleanup states
    this.hoverEls.forEach(h => {
      h.removeEventListener('stateremoved', this.unWatch);
    });
    this.hoverEls.length = 0;
    if (this.state.get(this.HOVER_EVENT)) {
      this._unHover(this.state.get(this.HOVER_EVENT));
    }
    this.onGrabEndButton();
    this.onStretchEndButton();
    this.onDragDropEndButton();
  },
  /**
   * Called when entity pauses.
   * Use to stop or remove any dynamic or background behavior such as events.
   */
  pause: function () {},

  /**
   * Called when entity resumes.
   * Use to continue or add any dynamic or background behavior such as events.
   */
  play: function () {},
  onGrabStartButton: function (evt) {
    let carried = this.state.get(this.GRAB_EVENT);
    this.dispatchMouseEventAll('mousedown', this.el);
    this.gehClicking = new Set(this.hoverEls);
    if (!carried) {
      carried = this.findTarget(this.GRAB_EVENT, {
        hand: this.el,
        buttonEvent: evt
      });
      if (carried) {
        this.state.set(this.GRAB_EVENT, carried);
        this._unHover(carried);
      }
    }
  },
  onGrabEndButton: function (evt) {
    const clickables = this.hoverEls.filter(h => this.gehClicking.has(h));
    const grabbed = this.state.get(this.GRAB_EVENT);
    const endEvt = { hand: this.el, buttonEvent: evt };
    this.dispatchMouseEventAll('mouseup', this.el);
    for (let i = 0; i < clickables.length; i++) {
      this.dispatchMouseEvent(clickables[i], 'click', this.el);
    }
    this.gehClicking.clear();
    // check if grabbed entity accepts ungrab event
    if (grabbed && !this.emitCancelable(grabbed, this.UNGRAB_EVENT, endEvt)) {
      /* push to top of stack so a drop followed by re-grab gets the same
         target */
      this.promoteHoveredEl(this.state.get(this.GRAB_EVENT));
      this.state.delete(this.GRAB_EVENT);
      this.hover();
    }
  },
  onStretchStartButton: function (evt) {
    let stretched = this.state.get(this.STRETCH_EVENT);
    if (!stretched) {
      stretched = this.findTarget(this.STRETCH_EVENT, {
        hand: this.el,
        buttonEvent: evt
      });
      if (stretched) {
        this.state.set(this.STRETCH_EVENT, stretched);
        this._unHover(stretched);
      }
    }
  },
  onStretchEndButton: function (evt) {
    const stretched = this.state.get(this.STRETCH_EVENT);
    const endEvt = { hand: this.el, buttonEvent: evt };
    // check if end event accepted
    if (stretched && !this.emitCancelable(stretched, this.UNSTRETCH_EVENT, endEvt)) {
      this.promoteHoveredEl(stretched);
      this.state.delete(this.STRETCH_EVENT);
      this.hover();
    }
  },
  onDragDropStartButton: function (evt) {
    let dragged = this.state.get(this.DRAG_EVENT);
    this.dragging = true;
    if (this.hoverEls.length) {
      this.gehDragged = new Set(this.hoverEls);
      this.dispatchMouseEventAll('dragstart', this.el);
    }
    if (!dragged) {
      /* prefer carried so that a drag started after a grab will work
       with carried element rather than a currently intersected drop target.
       fall back to queue in case a drag is initiated independent
       of a grab */
      if (this.state.get(this.GRAB_EVENT) && !this.emitCancelable(this.state.get(this.GRAB_EVENT), this.DRAG_EVENT, { hand: this.el, buttonEvent: evt })) {
        dragged = this.state.get(this.GRAB_EVENT);
      } else {
        dragged = this.findTarget(this.DRAG_EVENT, {
          hand: this.el,
          buttonEvent: evt
        });
      }
      if (dragged) {
        this.state.set(this.DRAG_EVENT, dragged);
        this._unHover(dragged);
      }
    }
  },
  onDragDropEndButton: function (evt) {
    const carried = this.state.get(this.DRAG_EVENT);
    this.dragging = false; // keep _unHover() from activating another droptarget
    this.gehDragged.forEach(carried => {
      this.dispatchMouseEvent(carried, 'dragend', this.el);
      // fire event both ways for all intersected targets
      this.dispatchMouseEventAll('drop', carried, true, true);
      this.dispatchMouseEventAll('dragleave', carried, true, true);
    });
    this.gehDragged.clear();
    if (carried) {
      const ddEvt = {
        hand: this.el,
        dropped: carried,
        on: null,
        buttonEvent: evt
      };
      const endEvt = { hand: this.el, buttonEvent: evt };
      const dropTarget = this.findTarget(this.DRAGDROP_EVENT, ddEvt, true);
      if (dropTarget) {
        ddEvt.on = dropTarget;
        this.emitCancelable(carried, this.DRAGDROP_EVENT, ddEvt);
        this._unHover(dropTarget);
      }
      // check if end event accepted
      if (!this.emitCancelable(carried, this.UNDRAG_EVENT, endEvt)) {
        this.promoteHoveredEl(carried);
        this.state.delete(this.DRAG_EVENT);
        this.hover();
      }
    }
  },
  onHit: function (evt) {
    const hitEl = evt.detail[this.data.colliderEventProperty];
    var processHitEl = hitEl => {
      let hitElIndex;
      hitElIndex = this.hoverEls.indexOf(hitEl);
      if (hitElIndex === -1) {
        this.hoverEls.push(hitEl);
        // later loss of collision will remove from hoverEls
        hitEl.addEventListener('stateremoved', this.unWatch);
        this.dispatchMouseEvent(hitEl, 'mouseover', this.el);
        if (this.dragging && this.gehDragged.size) {
          // events on targets and on dragged
          this.gehDragged.forEach(dragged => {
            this.dispatchMouseEventAll('dragenter', dragged, true, true);
          });
        }
        this.hover();
      }
    };
    if (!hitEl) {
      return;
    }
    if (Array.isArray(hitEl)) {
      hitEl.forEach(processHitEl);
    } else {
      processHitEl(hitEl);
    }
  },
  /* search collided entities for target to hover/dragover */
  hover: function () {
    var hvrevt, hoverEl;
    // end previous hover
    if (this.state.has(this.HOVER_EVENT)) {
      this._unHover(this.state.get(this.HOVER_EVENT), true);
    }
    if (this.state.has(this.DRAGOVER_EVENT)) {
      this._unHover(this.state.get(this.DRAGOVER_EVENT), true);
    }
    if (this.dragging && this.state.get(this.DRAG_EVENT)) {
      hvrevt = {
        hand: this.el,
        hovered: hoverEl,
        carried: this.state.get(this.DRAG_EVENT)
      };
      hoverEl = this.findTarget(this.DRAGOVER_EVENT, hvrevt, true);
      if (hoverEl) {
        hoverEl.addEventListener('stateremoved', this.unHover);
        this.emitCancelable(this.state.get(this.DRAG_EVENT), this.DRAGOVER_EVENT, hvrevt);
        this.state.set(this.DRAGOVER_EVENT, hoverEl);
      }
    }
    // fallback to hover if not dragging or dragover wasn't successful
    if (!this.state.has(this.DRAGOVER_EVENT)) {
      hoverEl = this.findTarget(this.HOVER_EVENT, { hand: this.el }, true);
      if (hoverEl) {
        hoverEl.addEventListener('stateremoved', this.unHover);
        this.state.set(this.HOVER_EVENT, hoverEl);
      }
    }
  },
  /* tied to 'stateremoved' event for hovered entities,
     called when controller moves out of collision range of entity */
  unHover: function (evt) {
    const clearedEls = evt.detail[this.data.colliderEndEventProperty];
    if (clearedEls) {
      if (Array.isArray(clearedEls)) {
        clearedEls.forEach(el => this._unHover(el));
      } else {
        this._unHover(clearedEls);
      }
    } else if (evt.detail.state === this.data.colliderState) {
      this._unHover(evt.target);
    }
  },
  /* inner unHover steps needed regardless of cause of unHover */
  _unHover: function (el, skipNextHover) {
    let unHovered = false;
    let evt;
    el.removeEventListener('stateremoved', this.unHover);
    if (el === this.state.get(this.DRAGOVER_EVENT)) {
      this.state.delete(this.DRAGOVER_EVENT);
      unHovered = true;
      evt = {
        hand: this.el,
        hovered: el,
        carried: this.state.get(this.DRAG_EVENT)
      };
      this.emitCancelable(el, this.UNDRAGOVER_EVENT, evt);
      if (this.state.has(this.DRAG_EVENT)) {
        this.emitCancelable(this.state.get(this.DRAG_EVENT), this.UNDRAGOVER_EVENT, evt);
      }
    }
    if (el === this.state.get(this.HOVER_EVENT)) {
      this.state.delete(this.HOVER_EVENT);
      unHovered = true;
      this.emitCancelable(el, this.UNHOVER_EVENT, { hand: this.el });
    }
    // activate next target, if present
    if (unHovered && !skipNextHover) {
      this.hover();
    }
  },
  unWatch: function (evt) {
    const clearedEls = evt.detail[this.data.colliderEndEventProperty];
    if (clearedEls) {
      if (Array.isArray(clearedEls)) {
        clearedEls.forEach(el => this._unWatch(el));
      } else {
        // deprecation path: aframe <=0.7.0 / sphere-collider
        this._unWatch(clearedEls);
      }
    } else if (evt.detail.state === this.data.colliderState) {
      // deprecation path: sphere-collider <=3.11.4
      this._unWatch(evt.target);
    }
  },
  _unWatch: function (target) {
    var hoverIndex = this.hoverEls.indexOf(target);
    target.removeEventListener('stateremoved', this.unWatch);
    if (hoverIndex !== -1) {
      this.hoverEls.splice(hoverIndex, 1);
    }
    this.gehDragged.forEach(dragged => {
      this.dispatchMouseEvent(target, 'dragleave', dragged);
      this.dispatchMouseEvent(dragged, 'dragleave', target);
    });
    this.dispatchMouseEvent(target, 'mouseout', this.el);
  },
  registerListeners: function () {
    this.el.addEventListener(this.data.colliderEvent, this.onHit);
    this.el.addEventListener(this.data.colliderEndEvent, this.unWatch);
    this.el.addEventListener(this.data.colliderEndEvent, this.unHover);

    this.data.grabStartButtons.forEach(b => {
      this.el.addEventListener(b, this.onGrabStartButton);
    });
    this.data.grabEndButtons.forEach(b => {
      this.el.addEventListener(b, this.onGrabEndButton);
    });
    this.data.stretchStartButtons.forEach(b => {
      this.el.addEventListener(b, this.onStretchStartButton);
    });
    this.data.stretchEndButtons.forEach(b => {
      this.el.addEventListener(b, this.onStretchEndButton);
    });
    this.data.dragDropStartButtons.forEach(b => {
      this.el.addEventListener(b, this.onDragDropStartButton);
    });
    this.data.dragDropEndButtons.forEach(b => {
      this.el.addEventListener(b, this.onDragDropEndButton);
    });
  },
  unRegisterListeners: function (data) {
    data = data || this.data;
    if (Object.keys(data).length === 0) {
      // Empty object passed on initalization
      return;
    }
    this.el.removeEventListener(data.colliderEvent, this.onHit);
    this.el.removeEventListener(data.colliderEndEvent, this.unHover);
    this.el.removeEventListener(data.colliderEndEvent, this.unWatch);

    data.grabStartButtons.forEach(b => {
      this.el.removeEventListener(b, this.onGrabStartButton);
    });
    data.grabEndButtons.forEach(b => {
      this.el.removeEventListener(b, this.onGrabEndButton);
    });
    data.stretchStartButtons.forEach(b => {
      this.el.removeEventListener(b, this.onStretchStartButton);
    });
    data.stretchEndButtons.forEach(b => {
      this.el.removeEventListener(b, this.onStretchEndButton);
    });
    data.dragDropStartButtons.forEach(b => {
      this.el.removeEventListener(b, this.onDragDropStartButton);
    });
    data.dragDropEndButtons.forEach(b => {
      this.el.removeEventListener(b, this.onDragDropEndButton);
    });
  },
  emitCancelable: function (target, name, detail) {
    var data, evt;
    detail = detail || {};
    data = { bubbles: true, cancelable: true, detail: detail };
    data.detail.target = data.detail.target || target;
    evt = new window.CustomEvent(name, data);
    return target.dispatchEvent(evt);
  },
  dispatchMouseEvent: function (target, name, relatedTarget) {
    var mEvt = new window.MouseEvent(name, { relatedTarget: relatedTarget });
    target.dispatchEvent(mEvt);
  },
  dispatchMouseEventAll: function (name, relatedTarget, filterUsed, alsoReverse) {
    let els = this.hoverEls;
    if (filterUsed) {
      els = els.filter(el => el !== this.state.get(this.GRAB_EVENT) && el !== this.state.get(this.DRAG_EVENT) && el !== this.state.get(this.STRETCH_EVENT) && !this.gehDragged.has(el));
    }
    if (alsoReverse) {
      for (let i = 0; i < els.length; i++) {
        this.dispatchMouseEvent(els[i], name, relatedTarget);
        this.dispatchMouseEvent(relatedTarget, name, els[i]);
      }
    } else {
      for (let i = 0; i < els.length; i++) {
        this.dispatchMouseEvent(els[i], name, relatedTarget);
      }
    }
  },
  findTarget: function (evType, detail, filterUsed) {
    var elIndex;
    var eligibleEls = this.hoverEls;
    if (filterUsed) {
      eligibleEls = eligibleEls.filter(el => el !== this.state.get(this.GRAB_EVENT) && el !== this.state.get(this.DRAG_EVENT) && el !== this.state.get(this.STRETCH_EVENT));
    }
    for (elIndex = eligibleEls.length - 1; elIndex >= 0; elIndex--) {
      if (!this.emitCancelable(eligibleEls[elIndex], evType, detail)) {
        return eligibleEls[elIndex];
      }
    }
    return null;
  },
  promoteHoveredEl: function (el) {
    var hoverIndex = this.hoverEls.indexOf(el);
    if (hoverIndex !== -1) {
      this.hoverEls.splice(hoverIndex, 1);
      this.hoverEls.push(el);
    }
  }
});

},{"./misc_components/locomotor-auto-config.js":2,"./misc_components/progressive-controls.js":3,"./primitives/a-locomotor.js":4,"./reaction_components/clickable.js":5,"./reaction_components/drag-droppable.js":6,"./reaction_components/draggable.js":7,"./reaction_components/droppable.js":8,"./reaction_components/grabbable.js":9,"./reaction_components/hoverable.js":10,"./reaction_components/stretchable.js":13,"./systems/super-hands-system.js":14}],2:[function(require,module,exports){
'use strict';

/* global AFRAME */
AFRAME.registerComponent('locomotor-auto-config', {
  schema: {
    camera: { default: true },
    stretch: { default: true },
    move: { default: true }
  },
  dependencies: ['grabbable', 'stretchable'],
  init: function () {
    this.ready = false;
    if (this.data.camera) {
      if (!document.querySelector('a-camera, [camera]')) {
        let cam = document.createElement('a-camera');
        this.el.appendChild(cam);
      }
    }
    this.fakeCollisions();
    // for controllers added later
    this.fakeCollisionsB = this.fakeCollisions.bind(this);
    this.el.addEventListener('controllerconnected', this.fakeCollisionsB);
  },
  update: function () {
    if (this.el.getAttribute('stretchable') && !this.data.stretch) {
      // store settings for resetting
      this.stretchSet = this.el.getAttribute('stretchable');
      this.el.removeAttribute('stretchable');
    } else if (!this.el.getAttribute('stretchable') && this.data.stretch) {
      this.el.setAttribute('stretchable', this.stretchSet);
    }
    if (this.el.getAttribute('grabbable') && !this.data.move) {
      // store settings for resetting
      this.grabSet = this.el.getAttribute('grabbable');
      this.el.removeAttribute('grabbable');
    } else if (!this.el.getAttribute('grabbable') && this.data.move) {
      this.el.setAttribute('grabbable', this.grabSet);
    }
  },
  remove: function () {
    this.el.removeState(this.colliderState);
    this.el.removeEventListener('controllerconnected', this.fakeCollisionsB);
  },
  announceReady: function () {
    if (!this.ready) {
      this.ready = true;
      this.el.emit('locomotor-ready', {});
    }
  },
  fakeCollisions: function () {
    this.el.getChildEntities().forEach(el => {
      let sh = el.getAttribute('super-hands');
      if (sh) {
        // generate fake collision to be permanently in super-hands queue
        let evtDetails = {};
        evtDetails[sh.colliderEventProperty] = this.el;
        el.emit(sh.colliderEvent, evtDetails);
        this.colliderState = sh.colliderState;
        this.el.addState(this.colliderState);
      }
      this.announceReady();
    });
  }
});

},{}],3:[function(require,module,exports){
'use strict';

/* global AFRAME */
const gazeDefaultId = 'progressivecontrolsgazedefault';
const pointDefaultId = 'progressivecontrolspointdefault';
const touchDefaultId = 'progressivecontrolstouchdefault';

AFRAME.registerComponent('progressive-controls', {
  schema: {
    maxLevel: { default: 'touch', oneOf: ['gaze', 'point', 'touch'] },
    gazeMixin: { default: '' },
    pointMixin: { default: '' },
    touchMixin: { default: '' },
    override: { default: false },
    objects: { default: '' },
    controllerModel: { default: true }
  },
  init: function () {
    // deprecation path: AFRAME v0.8.0 prerelease not reporting new version number
    // use this condition after v0.8.0 release: parseFloat(AFRAME.version) < 0.8
    const rayEndProp = !AFRAME.components.link.schema.titleColor ? 'el' : 'clearedEls';

    this.levels = ['gaze', 'point', 'touch'];
    this.currentLevel = new Map();
    this.controllerName = new Map();

    // setup mixins for defaults
    const assets = this.el.sceneEl.querySelector('a-assets') || this.el.sceneEl.appendChild(document.createElement('a-assets'));
    const gazeDefault = this.gazeDefault = document.createElement('a-mixin');
    const shRayConfig = AFRAME.utils.styleParser.stringify({
      colliderEvent: 'raycaster-intersection',
      colliderEventProperty: 'els',
      colliderEndEvent: 'raycaster-intersection-cleared',
      colliderEndEventProperty: rayEndProp,
      colliderState: ''
    });
    gazeDefault.setAttribute('id', gazeDefaultId);
    gazeDefault.setAttribute('geometry', 'primitive: ring;' + 'radiusOuter: 0.008; radiusInner: 0.005; segmentsTheta: 32');
    gazeDefault.setAttribute('material', 'color: #000; shader: flat');
    gazeDefault.setAttribute('position', '0 0 -0.5');
    gazeDefault.setAttribute('raycaster', '');
    gazeDefault.setAttribute('super-hands', shRayConfig);
    const pointDefault = this.pointDefault = document.createElement('a-mixin');
    pointDefault.setAttribute('id', pointDefaultId);
    pointDefault.setAttribute('raycaster', 'showLine: true');
    pointDefault.setAttribute('super-hands', shRayConfig);
    const touchDefault = this.touchDefault = document.createElement('a-mixin');
    touchDefault.setAttribute('id', touchDefaultId);
    touchDefault.setAttribute('super-hands', '');
    touchDefault.setAttribute('sphere-collider', '');
    if (this.el.sceneEl.getAttribute('physics')) {
      const physicsBodyDefault = 'shape: sphere; sphereRadius: 0.02';
      pointDefault.setAttribute('static-body', physicsBodyDefault);
      gazeDefault.setAttribute('static-body', physicsBodyDefault);
      touchDefault.setAttribute('static-body', physicsBodyDefault);
    }
    assets.appendChild(gazeDefault);
    assets.appendChild(pointDefault);
    assets.appendChild(touchDefault);

    this.camera = this.el.querySelector('a-camera,[camera]') || this.el.appendChild(document.createElement('a-camera'));
    this.caster = this.camera.querySelector('.gazecaster') || this.camera.appendChild(document.createElement('a-entity'));
    ['left', 'right'].forEach(hand => {
      // find controller by left-controller/right-controller class or create one
      this[hand] = this.el.querySelector('.' + hand + '-controller') || this.el.appendChild(document.createElement('a-entity'));
      const ctrlrCompConfig = {
        hand: hand,
        model: this.data.controllerModel
      };
      ['daydream-controls', 'gearvr-controls', 'oculus-touch-controls', 'vive-controls', 'windows-motion-controls'].forEach(ctrlr => this[hand].setAttribute(ctrlr, ctrlrCompConfig));
    });
    this.el.addEventListener('controllerconnected', e => this.detectLevel(e));
    this.eventRepeaterB = this.eventRepeater.bind(this);
    // pass mouse and touch events into the scene
    this.addEventListeners();
    // default level
    this.currentLevel.set('right', 0);
  },
  update: function (oldData) {
    const objs = { objects: this.data.objects };
    updateMixin(this.gazeDefault, 'raycaster', objs);
    updateMixin(this.pointDefault, 'raycaster', objs);
    updateMixin(this.touchDefault, 'sphere-collider', objs);
    // async updates due to aframevr/aframe#3200
    // force setLevel refresh with new params
    for (let [hand, level] of this.currentLevel) {
      window.setTimeout(() => this.setLevel(level, hand, true));
    }
  },
  remove: function () {
    if (!this.eventsRegistered) {
      return;
    }
    const canv = this.el.sceneEl.canvas;
    canv.removeEventListener('mousedown', this.eventRepeaterB);
    canv.removeEventListener('mouseup', this.eventRepeaterB);
    canv.removeEventListener('touchstart', this.eventRepeaterB);
    canv.removeEventListener('touchend', this.eventRepeaterB);
  },
  setLevel: function (newLevel, hand, force) {
    hand = hand || 'right';
    const maxLevel = this.levels.indexOf(this.data.maxLevel);
    const currentHand = this[hand];
    const override = this.data.override;
    newLevel = newLevel > maxLevel ? maxLevel : newLevel;
    if (newLevel === this.currentLevel.get(hand) && !force) {
      return;
    }
    if (newLevel !== 0 && this.caster) {
      // avoids error where physics system tries to tick on removed entity
      this.caster.setAttribute('mixin', '');
      this.camera.removeChild(this.caster);
      this.caster = null;
    }
    switch (newLevel) {
      case this.levels.indexOf('gaze'):
        const gazeMixin = this.data.gazeMixin;
        this.caster.setAttribute('mixin', (override && gazeMixin.length ? '' : gazeDefaultId + ' ') + gazeMixin);
        break;
      case this.levels.indexOf('point'):
        const ctrlrName = this.controllerName.get(hand);
        const ctrlrCfg = this.controllerConfig[ctrlrName];
        const pntMixin = this.data.pointMixin;
        if (ctrlrCfg && ctrlrCfg.raycaster) {
          currentHand.setAttribute('raycaster', ctrlrCfg.raycaster);
        }
        currentHand.setAttribute('mixin', (override && pntMixin.length ? '' : pointDefaultId + ' ') + pntMixin);
        break;
      case this.levels.indexOf('touch'):
        const tchMixin = this.data.touchMixin;
        currentHand.setAttribute('mixin', (override && tchMixin.length ? '' : touchDefaultId + ' ') + tchMixin);
        break;
    }
    this.currentLevel.set(hand, newLevel);
    this.el.emit('controller-progressed', {
      level: this.levels[newLevel],
      hand: hand
    });
  },
  detectLevel: function (evt) {
    const DOF6 = ['vive-controls', 'oculus-touch-controls', 'windows-motion-controls'];
    const DOF3 = ['gearvr-controls', 'daydream-controls'];
    const hand = evt.detail.component.data.hand || 'right';
    this.controllerName.set(hand, evt.detail.name);
    if (DOF6.indexOf(evt.detail.name) !== -1) {
      this.setLevel(this.levels.indexOf('touch'), hand);
    } else if (DOF3.indexOf(evt.detail.name) !== -1) {
      this.setLevel(this.levels.indexOf('point'), hand);
    }
  },
  eventRepeater: function (evt) {
    if (!this.caster) {
      return;
    } // only for gaze mode
    if (evt.type.startsWith('touch')) {
      evt.preventDefault();
      // avoid repeating touchmove because it interferes with look-controls
      if (evt.type === 'touchmove') {
        return;
      }
    }
    this.caster.emit(evt.type, evt.detail);
  },
  addEventListeners: function () {
    if (!this.el.sceneEl.canvas) {
      this.el.sceneEl.addEventListener('loaded', this.addEventListeners.bind(this));
      return;
    }
    this.el.sceneEl.canvas.addEventListener('mousedown', this.eventRepeaterB);
    this.el.sceneEl.canvas.addEventListener('mouseup', this.eventRepeaterB);
    this.el.sceneEl.canvas.addEventListener('touchstart', this.eventRepeaterB);
    this.el.sceneEl.canvas.addEventListener('touchmove', this.eventRepeaterB);
    this.el.sceneEl.canvas.addEventListener('touchend', this.eventRepeaterB);
    this.eventsRegistered = true;
  },
  controllerConfig: {
    'gearvr-controls': {
      raycaster: { origin: { x: 0, y: 0.0005, z: 0 } }
    },
    'oculus-touch-controls': {
      raycaster: { origin: { x: 0.001, y: 0, z: 0.065 }, direction: { x: 0, y: -0.8, z: -1 } }
    }
  }
});

function updateMixin(mixin, attr, additions) {
  const stringify = AFRAME.utils.styleParser.stringify;
  const extend = AFRAME.utils.extend;
  const old = mixin.getAttribute(attr);
  if (old) {
    mixin.setAttribute(attr, stringify(extend(old, additions)));
  }
}

},{}],4:[function(require,module,exports){
'use strict';

/* global AFRAME */
var extendDeep = AFRAME.utils.extendDeep;
// The mesh mixin provides common material properties for creating mesh-based primitives.
// This makes the material component a default component and maps all the base material properties.
var meshMixin = AFRAME.primitives.getMeshMixin();
AFRAME.registerPrimitive('a-locomotor', extendDeep({}, meshMixin, {
  // Preset default components. These components and component properties will be attached to the entity out-of-the-box.
  defaultComponents: {
    grabbable: {
      usePhysics: 'never',
      invert: true,
      suppressY: true
    },
    stretchable: {
      invert: true
    },
    'locomotor-auto-config': {}
  },
  mappings: {
    'fetch-camera': 'locomotor-auto-config.camera',
    'allow-movement': 'locomotor-auto-config.move',
    'horizontal-only': 'grabbable.suppressY',
    'allow-scaling': 'locomotor-auto-config.stretch'
  }
}));

},{}],5:[function(require,module,exports){
'use strict';

/* global AFRAME */
const buttonCore = require('./prototypes/buttons-proto.js');
AFRAME.registerComponent('clickable', AFRAME.utils.extendDeep({}, buttonCore, {
  schema: {
    onclick: { type: 'string' }
  },
  init: function () {
    this.CLICKED_STATE = 'clicked';
    this.CLICK_EVENT = 'grab-start';
    this.UNCLICK_EVENT = 'grab-end';
    this.clickers = [];

    this.start = this.start.bind(this);
    this.end = this.end.bind(this);
    this.el.addEventListener(this.CLICK_EVENT, this.start);
    this.el.addEventListener(this.UNCLICK_EVENT, this.end);
  },
  remove: function () {
    this.el.removeEventListener(this.CLICK_EVENT, this.start);
    this.el.removeEventListener(this.UNCLICK_EVENT, this.end);
  },
  start: function (evt) {
    if (!this.startButtonOk(evt)) {
      return;
    }
    this.el.addState(this.CLICKED_STATE);
    if (this.clickers.indexOf(evt.detail.hand) === -1) {
      this.clickers.push(evt.detail.hand);
      if (evt.preventDefault) {
        evt.preventDefault();
      }
    }
  },
  end: function (evt) {
    const handIndex = this.clickers.indexOf(evt.detail.hand);
    if (!this.endButtonOk(evt)) {
      return;
    }
    if (handIndex !== -1) {
      this.clickers.splice(handIndex, 1);
    }
    if (this.clickers.length < 1) {
      this.el.removeState(this.CLICKED_STATE);
    }
    if (evt.preventDefault) {
      evt.preventDefault();
    }
    // this.el.emit('click');
  }
}));

},{"./prototypes/buttons-proto.js":11}],6:[function(require,module,exports){
'use strict';

/* global AFRAME */
const inherit = AFRAME.utils.extendDeep;
const buttonCore = require('./prototypes/buttons-proto.js');

AFRAME.registerComponent('drag-droppable', inherit({}, buttonCore, {
  init: function () {
    console.warn('Warning: drag-droppable is deprecated. Use draggable and droppable components instead');
    this.HOVERED_STATE = 'dragover';
    this.DRAGGED_STATE = 'dragged';
    this.HOVER_EVENT = 'dragover-start';
    this.UNHOVER_EVENT = 'dragover-end';
    this.DRAG_EVENT = 'drag-start';
    this.UNDRAG_EVENT = 'drag-end';
    this.DRAGDROP_EVENT = 'drag-drop';

    this.hoverStart = this.hoverStart.bind(this);
    this.dragStart = this.dragStart.bind(this);
    this.hoverEnd = this.hoverEnd.bind(this);
    this.dragEnd = this.dragEnd.bind(this);
    this.dragDrop = this.dragDrop.bind(this);

    this.el.addEventListener(this.HOVER_EVENT, this.hoverStart);
    this.el.addEventListener(this.DRAG_EVENT, this.dragStart);
    this.el.addEventListener(this.UNHOVER_EVENT, this.hoverEnd);
    this.el.addEventListener(this.UNDRAG_EVENT, this.dragEnd);
    this.el.addEventListener(this.DRAGDROP_EVENT, this.dragDrop);
  },
  remove: function () {
    this.el.removeEventListener(this.HOVER_EVENT, this.hoverStart);
    this.el.removeEventListener(this.DRAG_EVENT, this.dragStart);
    this.el.removeEventListener(this.UNHOVER_EVENT, this.hoverEnd);
    this.el.removeEventListener(this.UNDRAG_EVENT, this.dragEnd);
    this.el.removeEventListener(this.DRAGDROP_EVENT, this.dragDrop);
  },
  hoverStart: function (evt) {
    this.el.addState(this.HOVERED_STATE);
    if (evt.preventDefault) {
      evt.preventDefault();
    }
  },
  dragStart: function (evt) {
    if (!this.startButtonOk(evt)) {
      return;
    }
    this.el.addState(this.DRAGGED_STATE);
    if (evt.preventDefault) {
      evt.preventDefault();
    }
  },
  hoverEnd: function (evt) {
    this.el.removeState(this.HOVERED_STATE);
  },
  dragEnd: function (evt) {
    if (!this.endButtonOk(evt)) {
      return;
    }
    this.el.removeState(this.DRAGGED_STATE);
    if (evt.preventDefault) {
      evt.preventDefault();
    }
  },
  dragDrop: function (evt) {
    if (!this.endButtonOk(evt)) {
      return;
    }
    if (evt.preventDefault) {
      evt.preventDefault();
    }
  }
}));

},{"./prototypes/buttons-proto.js":11}],7:[function(require,module,exports){
'use strict';

/* global AFRAME */
const inherit = AFRAME.utils.extendDeep;
const buttonCore = require('./prototypes/buttons-proto.js');

AFRAME.registerComponent('draggable', inherit({}, buttonCore, {
  init: function () {
    this.DRAGGED_STATE = 'dragged';
    this.DRAG_EVENT = 'drag-start';
    this.UNDRAG_EVENT = 'drag-end';

    this.dragStartBound = this.dragStart.bind(this);
    this.dragEndBound = this.dragEnd.bind(this);

    this.el.addEventListener(this.DRAG_EVENT, this.dragStartBound);
    this.el.addEventListener(this.UNDRAG_EVENT, this.dragEndBound);
  },
  remove: function () {
    this.el.removeEventListener(this.DRAG_EVENT, this.dragStart);
    this.el.removeEventListener(this.UNDRAG_EVENT, this.dragEnd);
  },
  dragStart: function (evt) {
    if (!this.startButtonOk(evt)) {
      return;
    }
    this.el.addState(this.DRAGGED_STATE);
    if (evt.preventDefault) {
      evt.preventDefault();
    }
  },
  dragEnd: function (evt) {
    if (!this.endButtonOk(evt)) {
      return;
    }
    this.el.removeState(this.DRAGGED_STATE);
    if (evt.preventDefault) {
      evt.preventDefault();
    }
  }
}));

},{"./prototypes/buttons-proto.js":11}],8:[function(require,module,exports){
'use strict';

/* global AFRAME */
function elementMatches(el, selector) {
  if (el.matches) {
    return el.matches(selector);
  }
  if (el.msMatchesSelector) {
    return el.msMatchesSelector(selector);
  }
  if (el.webkitMatchesSelector) {
    return el.webkitMatchesSelector(selector);
  }
}
AFRAME.registerComponent('droppable', {
  schema: {
    accepts: { default: '' },
    autoUpdate: { default: true },
    acceptEvent: { default: '' },
    rejectEvent: { default: '' }
  },
  multiple: true,
  init: function () {
    this.HOVERED_STATE = 'dragover';
    this.HOVER_EVENT = 'dragover-start';
    this.UNHOVER_EVENT = 'dragover-end';
    this.DRAGDROP_EVENT = 'drag-drop';

    // better for Sinon spying if original method not overwritten
    this.hoverStartBound = this.hoverStart.bind(this);
    this.hoverEndBound = this.hoverEnd.bind(this);
    this.dragDropBound = this.dragDrop.bind(this);
    this.mutateAcceptsBound = this.mutateAccepts.bind(this);

    this.acceptableEntities = [];
    this.observer = new window.MutationObserver(this.mutateAcceptsBound);
    this.observerOpts = { childList: true, subtree: true };

    this.el.addEventListener(this.HOVER_EVENT, this.hoverStartBound);
    this.el.addEventListener(this.UNHOVER_EVENT, this.hoverEndBound);
    this.el.addEventListener(this.DRAGDROP_EVENT, this.dragDropBound);
  },
  update: function () {
    if (this.data.accepts.length) {
      this.acceptableEntities = Array.prototype.slice.call(this.el.sceneEl.querySelectorAll(this.data.accepts));
    } else {
      this.acceptableEntities = null;
    }
    if (this.data.autoUpdate && this.acceptableEntities != null) {
      this.observer.observe(this.el.sceneEl, this.observerOpts);
    } else {
      this.observer.disconnect();
    }
  },
  remove: function () {
    this.el.removeEventListener(this.HOVER_EVENT, this.hoverStartBound);
    this.el.removeEventListener(this.UNHOVER_EVENT, this.hoverEndBound);
    this.el.removeEventListener(this.DRAGDROP_EVENT, this.dragDropBound);
    this.observer.disconnect();
  },
  mutateAccepts: function (mutations) {
    const query = this.data.accepts;
    mutations.forEach(mutation => {
      mutation.addedNodes.forEach(added => {
        if (elementMatches(added, query)) {
          this.acceptableEntities.push(added);
        }
      });
    });
  },
  entityAcceptable: function (entity) {
    const acceptableEntities = this.acceptableEntities;
    if (acceptableEntities == null) {
      return true;
    }
    for (let item of acceptableEntities) {
      if (item === entity) {
        return true;
      }
    }
    return false;
  },
  hoverStart: function (evt) {
    if (!this.entityAcceptable(evt.detail.carried)) {
      return;
    }
    this.el.addState(this.HOVERED_STATE);
    if (evt.preventDefault) {
      evt.preventDefault();
    }
  },
  hoverEnd: function (evt) {
    this.el.removeState(this.HOVERED_STATE);
  },
  dragDrop: function (evt) {
    const dropped = evt.detail.dropped;
    if (!this.entityAcceptable(dropped)) {
      if (this.data.rejectEvent.length) {
        this.el.emit(this.data.rejectEvent, { el: dropped });
      }
      return;
    }
    if (this.data.acceptEvent.length) {
      this.el.emit(this.data.acceptEvent, { el: dropped });
    }
    if (evt.preventDefault) {
      evt.preventDefault();
    }
  }
});

},{}],9:[function(require,module,exports){
'use strict';

/* global AFRAME, THREE */
const inherit = AFRAME.utils.extendDeep;
const physicsCore = require('./prototypes/physics-grab-proto.js');
const buttonsCore = require('./prototypes/buttons-proto.js');
AFRAME.registerComponent('grabbable', inherit({}, physicsCore, buttonsCore, {
  schema: {
    maxGrabbers: { type: 'int', default: NaN },
    invert: { default: false },
    suppressY: { default: false }
  },
  init: function () {
    this.GRABBED_STATE = 'grabbed';
    this.GRAB_EVENT = 'grab-start';
    this.UNGRAB_EVENT = 'grab-end';
    this.grabbed = false;
    this.grabbers = [];
    this.constraints = new Map();
    this.deltaPositionIsValid = false;
    this.grabDistance = undefined;
    this.grabDirection = { x: 0, y: 0, z: -1 };
    this.grabOffset = { x: 0, y: 0, z: 0 };
    // persistent object speeds up repeat setAttribute calls
    this.destPosition = { x: 0, y: 0, z: 0 };
    this.deltaPosition = new THREE.Vector3();
    this.targetPosition = new THREE.Vector3();
    this.physicsInit();

    this.el.addEventListener(this.GRAB_EVENT, e => this.start(e));
    this.el.addEventListener(this.UNGRAB_EVENT, e => this.end(e));
    this.el.addEventListener('mouseout', e => this.lostGrabber(e));
  },
  update: function () {
    this.physicsUpdate();
    this.xFactor = this.data.invert ? -1 : 1;
    this.zFactor = this.data.invert ? -1 : 1;
    this.yFactor = (this.data.invert ? -1 : 1) * !this.data.suppressY;
  },
  tick: function () {
    var entityPosition;
    if (this.grabber) {
      // reflect on z-axis to point in same direction as the laser
      this.targetPosition.copy(this.grabDirection);
      this.targetPosition.applyQuaternion(this.grabber.object3D.getWorldQuaternion()).setLength(this.grabDistance).add(this.grabber.object3D.getWorldPosition()).add(this.grabOffset);
      if (this.deltaPositionIsValid) {
        // relative position changes work better with nested entities
        this.deltaPosition.sub(this.targetPosition);
        entityPosition = this.el.getAttribute('position');
        this.destPosition.x = entityPosition.x - this.deltaPosition.x * this.xFactor;
        this.destPosition.y = entityPosition.y - this.deltaPosition.y * this.yFactor;
        this.destPosition.z = entityPosition.z - this.deltaPosition.z * this.zFactor;
        this.el.setAttribute('position', this.destPosition);
      } else {
        this.deltaPositionIsValid = true;
      }
      this.deltaPosition.copy(this.targetPosition);
    }
  },
  remove: function () {
    this.el.removeEventListener(this.GRAB_EVENT, this.start);
    this.el.removeEventListener(this.UNGRAB_EVENT, this.end);
    this.physicsRemove();
  },
  start: function (evt) {
    if (!this.startButtonOk(evt)) {
      return;
    }
    // room for more grabbers?
    const grabAvailable = !Number.isFinite(this.data.maxGrabbers) || this.grabbers.length < this.data.maxGrabbers;

    if (this.grabbers.indexOf(evt.detail.hand) === -1 && grabAvailable) {
      if (!evt.detail.hand.object3D) {
        console.warn('grabbable entities must have an object3D');
        return;
      }
      this.grabbers.push(evt.detail.hand);
      // initiate physics if available, otherwise manual
      if (!this.physicsStart(evt) && !this.grabber) {
        this.grabber = evt.detail.hand;
        this.resetGrabber();
      }
      // notify super-hands that the gesture was accepted
      if (evt.preventDefault) {
        evt.preventDefault();
      }
      this.grabbed = true;
      this.el.addState(this.GRABBED_STATE);
    }
  },
  end: function (evt) {
    const handIndex = this.grabbers.indexOf(evt.detail.hand);
    if (!this.endButtonOk(evt)) {
      return;
    }
    if (handIndex !== -1) {
      this.grabbers.splice(handIndex, 1);
      this.grabber = this.grabbers[0];
    }
    this.physicsEnd(evt);
    if (!this.resetGrabber()) {
      this.grabbed = false;
      this.el.removeState(this.GRABBED_STATE);
    }
    if (evt.preventDefault) {
      evt.preventDefault();
    }
  },
  resetGrabber: function () {
    let raycaster;
    if (!this.grabber) {
      return false;
    }
    raycaster = this.grabber.getAttribute('raycaster');
    this.deltaPositionIsValid = false;
    this.grabDistance = this.el.object3D.getWorldPosition().distanceTo(this.grabber.object3D.getWorldPosition());
    if (raycaster) {
      this.grabDirection = raycaster.direction;
      this.grabOffset = raycaster.origin;
    }
    return true;
  },
  lostGrabber: function (evt) {
    let i = this.grabbers.indexOf(evt.relatedTarget);
    // if a queued, non-physics grabber leaves the collision zone, forget it
    if (i !== -1 && evt.relatedTarget !== this.grabber && !this.physicsIsConstrained(evt.relatedTarget)) {
      this.grabbers.splice(i, 1);
    }
  }
}));

},{"./prototypes/buttons-proto.js":11,"./prototypes/physics-grab-proto.js":12}],10:[function(require,module,exports){
'use strict';

/* global AFRAME */
AFRAME.registerComponent('hoverable', {
  init: function () {
    this.HOVERED_STATE = 'hovered';
    this.HOVER_EVENT = 'hover-start';
    this.UNHOVER_EVENT = 'hover-end';

    this.hoverers = [];

    this.start = this.start.bind(this);
    this.end = this.end.bind(this);

    this.el.addEventListener(this.HOVER_EVENT, this.start);
    this.el.addEventListener(this.UNHOVER_EVENT, this.end);
  },
  remove: function () {
    this.el.removeEventListener(this.HOVER_EVENT, this.start);
    this.el.removeEventListener(this.UNHOVER_EVENT, this.end);
  },
  start: function (evt) {
    this.el.addState(this.HOVERED_STATE);
    if (this.hoverers.indexOf(evt.detail.hand) === -1) {
      this.hoverers.push(evt.detail.hand);
    }
    if (evt.preventDefault) {
      evt.preventDefault();
    }
  },
  end: function (evt) {
    var handIndex = this.hoverers.indexOf(evt.detail.hand);
    if (handIndex !== -1) {
      this.hoverers.splice(handIndex, 1);
    }
    if (this.hoverers.length < 1) {
      this.el.removeState(this.HOVERED_STATE);
    }
  }
});

},{}],11:[function(require,module,exports){
'use strict';

// common code used in customizing reaction components by button
module.exports = function () {
  function buttonIsValid(evt, buttonList) {
    return buttonList.length === 0 || buttonList.indexOf(evt.detail.buttonEvent.type) !== -1;
  }
  return {
    schema: {
      startButtons: { default: [] },
      endButtons: { default: [] }
    },
    startButtonOk: function (evt) {
      return buttonIsValid(evt, this.data['startButtons']);
    },
    endButtonOk: function (evt) {
      return buttonIsValid(evt, this.data['endButtons']);
    }
  };
}();

},{}],12:[function(require,module,exports){
'use strict';

// base code used by grabbable for physics interactions
module.exports = {
  schema: {
    usePhysics: { default: 'ifavailable' }
  },
  physicsInit: function () {
    this.constraints = new Map();
  },
  physicsUpdate: function () {
    if (this.data.usePhysics === 'never' && this.constraints.size) {
      this.physicsClear();
    }
  },
  physicsRemove: function () {
    this.physicsClear();
  },
  physicsStart: function (evt) {
    // initiate physics constraint if available and not already existing
    if (this.data.usePhysics !== 'never' && this.el.body && evt.detail.hand.body && !this.constraints.has(evt.detail.hand)) {
      let newCon = new window.CANNON.LockConstraint(this.el.body, evt.detail.hand.body);
      this.el.body.world.addConstraint(newCon);
      this.constraints.set(evt.detail.hand, newCon);
      return true;
    }
    return false;
  },
  physicsEnd: function (evt) {
    let constraint = this.constraints.get(evt.detail.hand);
    if (constraint) {
      this.el.body.world.removeConstraint(constraint);
      this.constraints.delete(evt.detail.hand);
    }
  },
  physicsClear: function () {
    if (this.el.body) {
      for (let c of this.constraints.values()) {
        this.el.body.world.removeConstraint(c);
      }
    }
    this.constraints.clear();
  },
  physicsIsConstrained: function (el) {
    return this.constraints.has(el);
  },
  physicsIsGrabbing() {
    return this.constraints.size > 0;
  }
};

},{}],13:[function(require,module,exports){
'use strict';

/* global AFRAME, THREE */
const inherit = AFRAME.utils.extendDeep;
const buttonCore = require('./prototypes/buttons-proto.js');
AFRAME.registerComponent('stretchable', inherit({}, buttonCore, {
  schema: {
    usePhysics: { default: 'ifavailable' },
    invert: { default: false }
  },
  init: function () {
    this.STRETCHED_STATE = 'stretched';
    this.STRETCH_EVENT = 'stretch-start';
    this.UNSTRETCH_EVENT = 'stretch-end';
    this.stretched = false;
    this.stretchers = [];

    this.scale = new THREE.Vector3();
    this.handPos = new THREE.Vector3();
    this.otherHandPos = new THREE.Vector3();

    this.start = this.start.bind(this);
    this.end = this.end.bind(this);

    this.el.addEventListener(this.STRETCH_EVENT, this.start);
    this.el.addEventListener(this.UNSTRETCH_EVENT, this.end);
  },
  update: function (oldDat) {},
  tick: function () {
    if (!this.stretched) {
      return;
    }
    this.scale.copy(this.el.getAttribute('scale'));
    this.handPos.copy(this.stretchers[0].getAttribute('position'));
    this.otherHandPos.copy(this.stretchers[1].getAttribute('position'));
    const currentStretch = this.handPos.distanceTo(this.otherHandPos);
    let deltaStretch = 1;
    if (this.previousStretch !== null && currentStretch !== 0) {
      deltaStretch = Math.pow(currentStretch / this.previousStretch, this.data.invert ? -1 : 1);
    }
    this.previousStretch = currentStretch;
    this.scale.multiplyScalar(deltaStretch);
    this.el.setAttribute('scale', this.scale);
    // force scale update for physics body
    if (this.el.body && this.data.usePhysics !== 'never') {
      var physicsShape = this.el.body.shapes[0];
      if (physicsShape.halfExtents) {
        physicsShape.halfExtents.scale(deltaStretch, physicsShape.halfExtents);
        physicsShape.updateConvexPolyhedronRepresentation();
      } else if (physicsShape.radius) {
        physicsShape.radius *= deltaStretch;
        physicsShape.updateBoundingSphereRadius();
        // This doesn't update the cone size - can't find right update function
        // } else if (physicsShape.radiusTop && physicsShape.radiusBottom &&
        //     physicsShape.height) {
        //   physicsShape.height *= deltaStretch;
        //   physicsShape.radiusTop *= deltaStretch;
        //   physicsShape.radiusBottom *= deltaStretch;
        //   physicsShape.updateBoundingSphereRadius();
      } else if (!this.shapeWarned) {
        console.warn('Unable to stretch physics body: unsupported shape');
        this.shapeWarned = true;
        // todo: suport more shapes
      }
      this.el.body.updateBoundingRadius();
    }
  },
  remove: function () {
    this.el.removeEventListener(this.STRETCH_EVENT, this.start);
    this.el.removeEventListener(this.UNSTRETCH_EVENT, this.end);
  },
  start: function (evt) {
    if (this.stretched || this.stretchers.includes(evt.detail.hand) || !this.startButtonOk(evt)) {
      return;
    } // already stretched or already captured this hand or wrong button
    this.stretchers.push(evt.detail.hand);
    if (this.stretchers.length === 2) {
      this.stretched = true;
      this.previousStretch = null;
      this.el.addState(this.STRETCHED_STATE);
    }
    if (evt.preventDefault) {
      evt.preventDefault();
    } // gesture accepted
  },
  end: function (evt) {
    var stretcherIndex = this.stretchers.indexOf(evt.detail.hand);
    if (!this.endButtonOk(evt)) {
      return;
    }
    if (stretcherIndex !== -1) {
      this.stretchers.splice(stretcherIndex, 1);
      this.stretched = false;
      this.el.removeState(this.STRETCHED_STATE);
    }
    if (evt.preventDefault) {
      evt.preventDefault();
    }
  }
}));

},{"./prototypes/buttons-proto.js":11}],14:[function(require,module,exports){
'use strict';

/* global AFRAME */
AFRAME.registerSystem('super-hands', {
  init: function () {
    this.superHands = [];
  },
  registerMe: function (comp) {
    // when second hand registers, store links
    if (this.superHands.length === 1) {
      this.superHands[0].otherSuperHand = comp;
      comp.otherSuperHand = this.superHands[0];
    }
    this.superHands.push(comp);
  },
  unregisterMe: function (comp) {
    var index = this.superHands.indexOf(comp);
    if (index !== -1) {
      this.superHands.splice(index, 1);
    }
    this.superHands.forEach(x => {
      if (x.otherSuperHand === comp) {
        x.otherSuperHand = null;
      }
    });
  }
});

},{}]},{},[1]);
