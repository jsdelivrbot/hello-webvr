/**
 * Spawn entity at the intersection point on click, given the properties passed.
 *
 * `<a-entity intersection-spawn="mixin: box; material.color: red">` will spawn
 * `<a-entity mixin="box" material="color: red">` at intersection point.
 */
AFRAME.registerComponent('intersection-spawn', {
  schema: {
    default: '',
    parse: AFRAME.utils.styleParser.parse
  },

  init: function () {
    this.spawnOnce();
  },

  update: function(oldData) {
    this.spawnOnce();
  },

  spawnOnce: function () {
    const data = this.data;
    const el = this.el;

    el.addEventListener(data.event, evt => {
      // Create element.
      const spawnEl = document.createElement('a-entity');

      // Snap intersection point to grid and offset from center.
      spawnEl.setAttribute('position', evt.detail.intersection.point);

      // Set components and properties.
      Object.keys(data).forEach(name => {
        if (name === 'event') { return; }
        AFRAME.utils.entity.setComponentProperty(spawnEl, name, data[name]);
      });

      // Append to scene.
      el.sceneEl.appendChild(spawnEl);
    }, {once: true});
  }
});

AFRAME.registerComponent('spawn', {
  schema: {
    default: '',
    parse: AFRAME.utils.styleParser.parse
  },

  dependencies: ['follow'],

  init: function () {
    this.spawnOnce();
  },

  update: function(oldData) {
    this.spawnOnce();
  },

  spawnOnce: function () {
    AFRAME.log('spawn');
    const data = this.data;
    const el = this.el;

    // Create element.
    const spawnEl = document.createElement('a-entity');

    spawnEl.setAttribute('follow', 'target: #log')
    // Set components and properties.
    Object.keys(data).forEach(name => {
      if (name === 'event') { return; }
      AFRAME.utils.entity.setComponentProperty(spawnEl, name, data[name]);
    });

    // Append to scene.
    el.sceneEl.appendChild(spawnEl);
  }
});


AFRAME.registerComponent('follow', {
  schema: {
    target: {type: 'selector'}
  },

  tick: function (time, timeDelta) {
    // Grab position vectors (THREE.Vector3) from the entities' three.js objects.
    var targetPosition = this.data.target.object3D.position;
    this.el.setAttribute('position', targetPosition);
    // this.el.object3D.position.set(targetPosition);
  }
});



AFRAME.registerComponent('follow-mouse', {
  schema: {
    target: {type: 'selector'},
    distance: {type: 'number', default: 5},
    untilEvent: {type: 'string', default: 'click'},
    following: {type: 'boolean', default: true}
  },

  init: function() {
    var self = this;
    setTimeout(()=>{window.addEventListener(self.data.untilEvent, ()=>{AFRAME.log("unfollow");self.pause();}, {once: true});
}, 1);
  },

  tick: function (time, timeDelta) {
    var self = this;
    // Grab position vectors (THREE.Vector3) from the entities' three.js objects.
    var raycaster = self.data.target.getAttribute('raycaster');
    var origin = new THREE.Vector3();
    var direction = new THREE.Vector3();
    var targetPosition = new THREE.Vector3();
    origin.copy(raycaster.origin);
    direction.copy(raycaster.direction).multiplyScalar(self.data.distance);
    targetPosition.copy(origin).add(direction);
    this.el.setAttribute('position', targetPosition);
    // this.el.object3D.position.set(targetPosition);
  }

});


AFRAME.registerComponent('log-position', {
  schema: {
    default: ''
  },

  tick: function (time, timeDelta) {
    // Grab position vectors (THREE.Vector3) from the entities' three.js objects.
    AFRAME.log(this.el.getAttribute('position'));
  }
});

AFRAME.registerComponent('log-attribute', {
  schema: {
    attribute: {type: "string", default: "position"}
  },

  tick: function (time, timeDelta) {
    // Grab position vectors (THREE.Vector3) from the entities' three.js objects.
    AFRAME.log(this.el.getAttribute(this.data.attribute));
  }
});

AFRAME.registerComponent('log-mouse-position', {
  schema: {
    default: ''
  },

  tick: function (time, timeDelta) {
    // Grab position vectors (THREE.Vector3) from the entities' three.js objects.
    AFRAME.log(this.el.getAttribute('raycaster').direction);
  }
});
