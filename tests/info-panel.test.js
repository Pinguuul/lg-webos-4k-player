const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const test = require('node:test');

function fixture() {
  const elements = {};
  const handlers = {};
  function element() {
    return {style: {}, textContent: '', appendChild(child) { if (child.id) elements[child.id] = child; }, addEventListener() {}, focus() {}, set href(value) {this.hostname = new URL(value).hostname;}};
  }
  elements.overlay = element();
  const video = {paused: false, currentTime: 120, duration: 600, videoWidth: 3840, videoHeight: 1600, buffered: {length: 1, start() {return 100;}, end() {return 150;}}, addEventListener(name, fn) {handlers[name] = fn;}};
  const context = {window: {addEventListener() {}}, document: {createElement: element, body: element(), getElementById(id) {return elements[id];}, addEventListener() {}}, localStorage: {getItem() {return null;}, setItem() {}}, setTimeout() {}, clearTimeout() {}, setInterval() {}};
  vm.runInNewContext(fs.readFileSync('app/features.js','utf8'),context);
  const tools = context.window.playerTools;
  tools.init(video,{server() {return 'http://media.example:8200';}});
  tools.open({title:'Synthetic media', url:'http://media.example:8200/fixture.mkv', resolution:'1920x1080', size:13000000000, bitrate:2000000},0);
  return {tools,video,elements,handlers};
}

test('INFO displays actual video resolution ahead of catalogue metadata and refreshes time', () => {
  const {tools,video,elements,handlers} = fixture();
  assert.equal(tools.key({keyCode:457}),true);
  assert.equal(elements.infoPanel.style.display,'block');
  assert.match(elements.infoPanel.textContent,/3840 × 1600 \(TV\)/);
  assert.doesNotMatch(elements.infoPanel.textContent,/1920x1080/);
  assert.match(elements.infoPanel.textContent,/13\.00 GB/);
  assert.match(elements.infoPanel.textContent,/16\.0 Mb\/s/);
  video.currentTime = 130;
  handlers.timeupdate();
  assert.match(elements.infoPanel.textContent,/2:10 \/ 10:00/);
});

test('INFO and BACK close only the information panel; stop clears it', () => {
  const {tools,elements} = fixture();
  tools.key({keyCode:457});
  assert.equal(tools.key({keyCode:461}),true);
  assert.equal(elements.infoPanel.style.display,'none');
  assert.equal(tools.key({keyCode:461}),false);
  tools.key({keyCode:457});
  tools.key({keyCode:457});
  assert.equal(elements.infoPanel.style.display,'none');
  tools.key({keyCode:457});
  tools.close();
  assert.equal(elements.infoPanel.style.display,'none');
});

test('unavailable decoded resolution falls back to explicitly labelled server metadata', () => {
  const {tools,video,elements} = fixture();
  video.videoWidth=0;video.videoHeight=0;
  tools.key({keyCode:457});
  assert.match(elements.infoPanel.textContent,/1920x1080 \(catalogue\)/);
});
