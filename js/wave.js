'use strict';
import {
  now,
  config
} from './interact.js';

var zoom = d3.zoom();
var x_grid = d3.axisBottom();
var x_axis = d3.axisBottom();

var initialTimeScale = d3.scaleLinear();
var timeScale = d3.scaleLinear();
var renderTimeScale = d3.scaleLinear();
var bitWaveScale = d3.scaleLinear();

var renderRange = [];
var renderDomain = [];

function init() {
  renderRange = [0, now];
  renderDomain = [0, now];

  renderTimeScale
    .domain(renderDomain)
    .range(renderRange);
  initialTimeScale
    .domain([0, now])
    .range([0, now]);
  timeScale
    .domain([0, now])
    .range([0, now]);
  bitWaveScale
    .domain([0, 1])
    .range([config.rowHeight - config.bitWavePadding, config.bitWavePadding]);
}

/* Debug variables */
var dbg_enableUpdateRenderRange = true;
var dbg_enableRender = true;

export function dbg_setEnableUpdateRenderRange(val){
  dbg_enableUpdateRenderRange = val;
}

export function dbg_setEnableRender(val){
  dbg_enableRender = val;
}

/* index definitions for render data */
const WAVEARRAY = 0;
const IDX = 1;

// From: https://stackoverflow.com/a/9851769/2506522
// Opera 8.0+
var isOpera = (!!window.opr && !!opr.addons) || !!window.opera || navigator.userAgent.indexOf(' OPR/') >= 0;

// Firefox 1.0+
var isFirefox = typeof InstallTrigger !== 'undefined';

// Safari 3.0+ "[object HTMLElementConstructor]" 
var isSafari = /constructor/i.test(window.HTMLElement) || (function (p) {
  return p.toString() === "[object SafariRemoteNotification]";
})(!window['safari'] || (typeof safari !== 'undefined' && safari.pushNotification));

// Internet Explorer 6-11
var isIE = /*@cc_on!@*/ false || !!document.documentMode;

// Edge 20+
var isEdge = !isIE && !!window.StyleMedia;

// Chrome 1 - 79
var isChrome = !!window.chrome && (!!window.chrome.webstore || !!window.chrome.runtime);

// Edge (based on chromium) detection
var isEdgeChromium = isChrome && (navigator.userAgent.indexOf("Edg") != -1);

// Blink engine detection
var isBlink = (isChrome || isOpera) && !!window.CSS;


/*
 * Binary search in JavaScript.
 * Returns the index of of the element in a sorted array or (-n-1) where n is the insertion point for the new element.
 * Parameters:
 *     ar - A sorted array
 *     el - An element to search for
 *     compare_fn - A comparator function. The function takes two arguments: (a, b) and returns:
 *        a negative number  if a is less than b;
 *        0 if a is equal to b;
 *        a positive number of a is greater than b.
 * The array may contain duplicate elements. If there are more than one equal elements in the array,
 * the returned value can be the index of any one of the equal elements.
 *
 * https://stackoverflow.com/a/29018745/2506522
 */
function binarySearch(ar, el, compare_fn) {
  var m = 0;
  var n = ar.length - 1;
  while (m <= n) {
    var k = (n + m) >> 1;
    var cmp = compare_fn(el, ar[k]);
    if (cmp > 0) {
      m = k + 1;
    } else if (cmp < 0) {
      n = k - 1;
    } else {
      return k;
    }
  }
  return -m - 1;
}


function getChangeIndexAt(signal, time) {
  var idx = binarySearch(signal.wave, time, (time, wave) => {
    return time - wave.time;
  })
  if (idx < 0) {
    idx = -idx - 2;
  }
  return idx;
}


function zoom_end() {

  console.log(d3.event);

  drawWave2();

}

export function zoomFit() {
  var width = $("#wave-axis-container").width();
  // The average change should be ~20px;
  var scale = (width - 202) / now;

  var autozoom = d3.zoomIdentity;
  autozoom.k = scale;

  d3.select("#wave-axis-container")
    .call(zoom.transform, autozoom);
}

export function zoomIn() {
  zoom.scaleBy(d3.select("#wave-axis-container"), 1.3);
}

export function zoomOut() {
  zoom.scaleBy(d3.select("#wave-axis-container"), 1 / 1.3);
}

export function zoomAutoscale() {
  var signals = d3.selectAll('.signalRow').data()

  if(signals.length > 0) {
    // Average wave change times
    var avgDelta = signals.reduce((acc, signal) => {
      if (signal.wave.length) {
        return acc + now / signal.wave.length
      } else {
        return 0;
      }
    }, 0) / signals.length;

    // The average change should be ~20px;
    var scale = 20 / avgDelta;

    var autozoom = d3.zoomIdentity;
    autozoom.k = scale;

    console.log(`avgDelta: ${avgDelta}`);
    console.log(`scale: ${scale}`);
    console.log(autozoom);

    d3.select("#wave-axis-container")
      .call(zoom.transform, autozoom);
  }
}

function updateRenderRange(){
  if(dbg_enableUpdateRenderRange) {
    const wrapper = d3.select('#wave-axis-container');

    const visibleWidth = wrapper.node().getBoundingClientRect().width,
      visibleLeft = wrapper.node().scrollLeft,
      visibleRight = visibleLeft + visibleWidth;

    renderRange = [visibleLeft-200, visibleRight+200];
    renderDomain = [timeScale.invert(renderRange[0]), timeScale.invert(renderRange[1])];
    renderTimeScale
      .range(renderRange)
      .domain(renderDomain);
    console.log(renderRange)
    console.log(renderDomain)
  }
}

function updateAxis(){
  const rangeWidth = renderTimeScale.range()[1]-renderTimeScale.range()[0];

  x_axis
    .scale(renderTimeScale)
    .ticks(rangeWidth/150);
  d3.select('#time-axis-gr').call(x_axis);

  x_grid.scale(renderTimeScale)
    .ticks(rangeWidth/300);
  d3.select('#grid-gr').call(x_grid);

}

function zoom_fast() {

  console.log(d3.event);

  const wrapper = d3.select('#wave-axis-container');
  timeScale.range([0, now*d3.event.transform.k]);

  d3.select('#mainSVG')
  .attr('width', d3.event.transform.k * (now) + 200);
  
  // Move scrollbars.
  wrapper.node().scrollLeft = -d3.event.transform.x;

  updateRenderRange();
  
  // Fast Zoom:
  d3.selectAll('.signalWave')
    .attr('transform', 'scale(' + d3.event.transform.k + ',1)');  

  updateAxis();
}

function scrolled() {
  const wrapper = d3.select('#wave-axis-container');
  d3.zoomTransform(wrapper.node()).x = -wrapper.node().scrollLeft;
  
  updateRenderRange();
  updateAxis();

}

export function removeAllSignals(){
  d3.select('#mainGr').selectAll("*").remove();
  
  d3.select('#names-col').selectAll("*").remove();

  d3.select('#values-col').selectAll("*").remove();
}

function generateTable(signals) {

  zoom
    .scaleExtent([200 / timeScale(now), 20])
    .on("zoom", zoom_fast).filter(() => d3.event.ctrlKey)
    .on("end", zoom_end);

  // zoom
  d3.select("#wave-axis-container")
    .on('scroll', scrolled)
    .call(zoom)
    .on("wheel", () => {
      if (d3.event.ctrlKey)
        d3.event.preventDefault()
    })

  const mainSVG = d3.select('#mainSVG')
    .attr('width', now + 200)
    .attr('height', config.rowHeight * (signals.length+1));

  const mainGr = d3.select('#mainGr');
  mainGr.selectAll("*").remove();
  
  mainGr.selectAll('#grid-gr').remove();
  mainGr.append('g')
    .attr('id', 'grid-gr')
    .attr('transform', (d, i) => `translate(0, ${config.rowHeight * signals.length})`);

  var signalRow = mainGr.selectAll('.signalRow')
    .data(signals)
    .enter()
    .append('g')
    .attr('transform', (d, i) => `translate(0, ${i * config.rowHeight})`)
    .attr('id', d => `signalRow_${d.id}`)
    .attr('class', d => `signalRow ${d.id} signal-highlighter`)
    .on('click', function (d) {
      console.log(d3.event);
    });

  var namesCol = d3.select('#names-col')
  namesCol.selectAll("*").remove();

  namesCol.selectAll('.signal-name')
    .data(signals)
    .enter()
    .append('li')
    .attr('id', d => `signalName_${d.id}`)
    .attr('class', d => `signal-name ${d.id} signal-highlighter`)
    .text(d => d.name);

  var valuesCol = d3.select('#values-col')
  valuesCol.selectAll("*").remove();

  valuesCol.selectAll('.signal-value')
    .data(signals)
    .enter()
    .append('div')
    .attr('id', d => `signalName_${d.id}`)
    .attr('class', d => `signal-value ${d.id} signal-highlighter`)
    .on('click', function (d) {
      console.log(d3.select(d3.event.target).data());
      console.log(d);
      d3.selectAll('.highlighted-signal').classed('highlighted-signal', false);
      d3.selectAll(`.${d.id}`).classed('highlighted-signal', true);
    });

  var signalWave = signalRow
    .append('g')
    //    .attr('transform', (d, i) => `translate(150, 0)`)
    .attr('id', d => `signalWave_${d.id}`)
    .attr('class', d => `signalWave`);
      
  mainGr.selectAll('#time-axis-gr').remove();
  mainGr.append('g')
    .attr('id', 'time-axis-gr')
    .attr('transform', (d, i) => `translate(0, ${config.rowHeight * signals.length})`);
    
  const timeAxisGr = d3.select('#time-axis-gr');
  x_axis.scale(timeScale);
  x_grid
    .tickSize(-config.rowHeight * signals.length)
    .tickFormat("");
  timeAxisGr.call(x_axis);

}


function fillSignalNames(signals) {
  d3.selectAll('.signalName')
    .append("text")
    .attr("y", config.rowHeight / 2)
    .attr("x", 10)
    .attr('text-anchor', 'left')
    .attr('alignment-baseline', 'central')
    .attr("class", "signalNameText")
    .text(d => d.name);
}


function reOrderSignals(signals) {
  // signals contains the signals in the *wanted* order

  function reOrder(containerSelector, childSelector) {
    // originalSignals: contains the signals in the *original* order
    var originalSignals = d3.select(containerSelector).selectAll(childSelector).data();
    // indexMapping: contains the original indexes in the wanted order.
    var indexMapping = signals.map(x => originalSignals.indexOf(x));

    var containerElement = $(containerSelector);
    var childrenList = containerElement.children(childSelector);
    containerElement.append($.map(indexMapping, v => childrenList[v]));
  }

  reOrder('#names-col', '.signal-name');
  reOrder('#values-col', '.signal-value');
  reOrder('#mainGr', '.signalRow');

  d3.select('#mainSVG').selectAll('.signalRow')
    .attr('transform', (d, i) => {
      return `translate(0, ${i * config.rowHeight})`
    });
}


$("#names-col").sortable({
  update: function (event, ui) {
    reOrderSignals(d3.select("#names-col").selectAll('.signal-name').data());
  }
});

$("#values-col").sortable({
  update: function (event, ui) {
    reOrderSignals(d3.select("#values-col").selectAll('.signal-value').data());
  }
});


function showValuesAt(time) {
  d3.selectAll('.signal-value')
    .text(d => {
      try {
        const idx = getChangeIndexAt(d, time);
        const wave = d.wave[idx];
        return wave.val;
      }
      catch (err) {
        return '- NA -'
      }
    });
}

function isInt(value) {
  return !isNaN(value) &&
    parseInt(Number(value)) == value &&
    !isNaN(parseInt(value, 10));
}


function drawWave2() {
  if(dbg_enableRender) {
    d3.selectAll('.signalWave')
      .each(function () {
        drawWave(d3.select(this));
      });
  }
}


/**
 * Filter value change elements, pass which are inside the rendering region.
 *
 * @param {Object} waveChange a wave change element, to filter
 * @return {boolean} true if the waveChange element inside the rendering region.
 */
function waveChangeInRenderRange(waveChange){
  var t0 = waveChange[0].time,
    t1 = waveChange[1].time,
    domainMin = d3.min(renderTimeScale.domain()),
    domainMax = d3.max(renderTimeScale.domain());

  return t0 <= domainMax && t1 >= domainMin;
}

/**
 * Filter value change elements, pass which are inside the rendering region.
 *
 * @param {Object} waveChange a wave change element, to filter
 * @return {boolean} true if the waveChange element inside the rendering region.
 */
function waveIInRenderRange(wave, i){
  var t0 = wave[i].time,
    t1 = wave[i+1].time,
    domainMin = d3.min(renderTimeScale.domain()),
    domainMax = d3.max(renderTimeScale.domain());

  return t0 <= domainMax && t1 >= domainMin;
}

function drawWave(svg) {

  var sigData = svg.datum();

  function parseIntDef(intToPare, def) {
    if (isInt(intToPare)) {
      return parseInt(intToPare);
    } else {
      return def;
    }
  }

  function value2Color(val) {
    if (isInt(val))
      return "#00FF00";
    else if (val == 'z')
      return "#0000FF";
    else
      return "#FF0000";
  }
  
  var waveChangesIndex = sigData.wave.reduce((res, current, i, waveArr) => {
    if(i< waveArr.length-1){
      if (waveIInRenderRange(waveArr, i)) {
        res.push([waveArr, i]);
      }
    }
    return res;
  }, []);

  // console.log(waveChangesIndex);
  svg.classed(`wave-style-${sigData.waveStyle}`, true);

  if (sigData.waveStyle == 'bit') {

    // horizontal aka. timeholder:
    var timeholders = svg.selectAll('.timeholder')
      .data(waveChangesIndex);

    timeholders.exit().remove();

    timeholders.enter()
      .append('line')
      .classed('timeholder', true);

    // vertical aka. valuechanger
    var valuechanger = svg.selectAll('.valuechanger')
      .data(waveChangesIndex);

    valuechanger.exit().remove();

    valuechanger.enter()
      .append('line')
      .classed('valuechanger', true);

    // transparent rect
    var transRect = svg.selectAll('.transparent-rect')
      .data(waveChangesIndex);
      
    transRect.exit().remove();
      
    transRect.enter()
      .append('rect')
      .classed('transparent-rect', true);
    
    svg.selectAll('.transparent-rect')
      .attr('x', d => initialTimeScale(d[WAVEARRAY][d[IDX]].time))
      .attr('y', d => bitWaveScale(parseIntDef(d[WAVEARRAY][d[IDX]].val)))
      .attr('width', d => initialTimeScale(d[WAVEARRAY][d[IDX]+1].time - d[WAVEARRAY][d[IDX]].time))
      .attr('height', d => bitWaveScale(1-parseIntDef(d[WAVEARRAY][d[IDX]].val)) - 2 )
      .style("fill", d => value2Color(d[WAVEARRAY][d[IDX]].val));

    svg.selectAll('.timeholder')
      .attr('x1', d => initialTimeScale(d[WAVEARRAY][d[IDX]].time))
      .attr('y1', d => bitWaveScale(parseIntDef(d[WAVEARRAY][d[IDX]].val)))
      .attr('x2', d => initialTimeScale(d[WAVEARRAY][d[IDX]+1].time))
      .attr('y2', d => bitWaveScale(parseIntDef(d[WAVEARRAY][d[IDX]].val)))
      .style("stroke", d => value2Color(d[WAVEARRAY][d[IDX]].val))
      .attr('vector-effect', 'non-scaling-stroke');

    svg.selectAll('.valuechanger')
      .attr('x1', d => initialTimeScale(d[WAVEARRAY][d[IDX]+1].time))
      .attr('y1', d => bitWaveScale(parseIntDef(d[WAVEARRAY][d[IDX]].val)))
      .attr('x2', d => initialTimeScale(d[WAVEARRAY][d[IDX]+1].time))
      .attr('y2', d => bitWaveScale(parseIntDef(d[WAVEARRAY][d[IDX]+1].val)))
      .style("stroke", d => value2Color(d[WAVEARRAY][d[IDX]+1].val))
      .attr('vector-effect', 'non-scaling-stroke');

  } else if (sigData.waveStyle == 'bus') {
    var busPath = svg.selectAll('path')
      .data(waveChangesIndex);

    busPath.exit().remove();

    busPath.enter()
      .append('path')
      .classed('bus-path', true);

    svg.selectAll('.bus-path')
      .attr('vector-effect', 'non-scaling-stroke')
      .style("stroke", d => value2Color(d[WAVEARRAY][d[IDX]].val))
      .style("fill", d => value2Color(d[WAVEARRAY][d[IDX]].val))
      .style("stroke-width", "2")
      .attr('d', d => {
        var ret = '';
        ret += `M${(d[WAVEARRAY][d[IDX]+1].time) - (timeScale.invert(2))},${bitWaveScale(1)} `
        ret += `${(d[WAVEARRAY][d[IDX]].time) + (timeScale.invert(2))},${bitWaveScale(1)} `
        ret += `${(d[WAVEARRAY][d[IDX]].time)},${bitWaveScale(0.5)} `
        ret += `${(d[WAVEARRAY][d[IDX]].time) + (timeScale.invert(2))},${bitWaveScale(0)} `
        ret += `${(d[WAVEARRAY][d[IDX]+1].time) - (timeScale.invert(2))},${bitWaveScale(0)} `
        if (d[WAVEARRAY][d[IDX]+1].time < now) {
          ret += `${(d[WAVEARRAY][d[IDX]+1].time)},${bitWaveScale(0.5)} `
          ret += `${(d[WAVEARRAY][d[IDX]+1].time) - (timeScale.invert(2))},${bitWaveScale(1)} `
        }
        return ret;
      });
      
  } else {

    svg
      .append('rect')
      .attr('height', default_row_height)
      .attr('width', now)
      .attr('fill', 'rgba(180, 0, 0, 0.5)');
    svg.append('text')
      .text(`Unsupported waveStyle: ${sigData.waveStyle}`)
      .attr("y", default_row_height / 2)
      .attr("x", 10)
      .attr('text-anchor', 'left')
      .attr('alignment-baseline', 'middle');
    return;
  }

}

function signals2Wave(signals) {
  return signals.reduce((signalsWave, signal) => {
    var sigWave = {
      name: signal.name,
      wave: []
    }

    sigWave.id = encodeURI(signal.name)

    signal.wave.forEach((wave) => {
      sigWave.wave.push({
        time: wave.time,
        val: wave.val * 20
      });

    });
    signalsWave.push(sigWave)
    return signalsWave
  }, []);
}


export function showSignals(signals) {
  init();
  generateTable(signals);
  fillSignalNames(signals);
  showValuesAt(0);
  zoomAutoscale();
}
