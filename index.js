// function getFnName(fn) {
//   var f = typeof fn == 'function';
//   var s = f && ((fn.name && ['', fn.name]) || fn.toString().match(/function ([^\(]+)/));
//   return (!f && 'not a function') || (s && s[1] || 'anonymous');
// }
//
//
//
AFRAME.log("hello");
var sceneEl = document.querySelector("a-scene");
var cursor = document.querySelector("#cursor");
var logPlane = document.querySelector("#log");

function test(){
  AFRAME.log('click');
}
logPlane.addEventListener('click', ()=>{AFRAME.log('click')});

// function setIntersectionSpawn(event, mixin) {
//   cursor.removeAttribute('spawn');
//   cursor.setAttribute('spawn', {
//     "event": event,
//     "mixin": mixin
//   });
// }
//
//
// function spawnOnece(data) {
//   // Create element.
//   const spawnEl = document.createElement('a-entity');
//   // AFRAME.log(spawnEl.getAttribute('position'));
//
//   // Set components and properties.
//   Object.keys(data).forEach(name => {
//     if (name === 'event') {
//       return;
//     }
//     AFRAME.utils.entity.setComponentProperty(spawnEl, name, data[name]);
//   });
//
//   spawnEl.setAttribute('follow-mouse', 'target: #cursor')
//
//   // Append to scene.
//   sceneEl.appendChild(spawnEl);
// }
//
// function addClickListener(el, event, mixin) {
//   el.addEventListener(event, () => {
//     spawnOnece({
//       "mixin": mixin
//     });
//     // setIntersectionSpawn(event, mixin);
//   }, false);
// }
// var buttonSpawner = document.querySelector("#buttonSpawner");
// addClickListener(buttonSpawner, 'click', 'button');
//
// var sliderSpawner = document.querySelector("#sliderSpawner");
// addClickListener(sliderSpawner, 'click', 'slider');
// buttonSpawner.setAttribute('gui-interactable', "clickAction: setIntersectionSpawn", true);
// buttonSpawner.addEventListener('click', setIntersectionSpawn('button'), false);
// AFRAME.log(buttonSpawner.getAttribute('gui-interactable'));
//
//
//
// setTimeout(function() {}, 3000);
