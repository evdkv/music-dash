// Declare Web Audio API variables
var wavesurfer = null;
var frequencyData = null;
var audioContext = null;
var analyser = null;
var dataArray = null;
var bufferLength = null;

// Variables for BPM calculation
var lastBeatTime = 0;  // Timestamp of the last detected beat
var bpm = 0;  // Current BPM
var beatInterval = 0;  // Time difference between beats in milliseconds
var beatCounter = 0;  // Number of beats detected\
var currentSecond = 0;  // Flag to check if a second has passed

// Canvases setup
const canvasb = document.getElementById('beat');
const ctxb = canvasb.getContext('2d');

const canvasw = document.getElementById('mirrorwave');
const ctxw = canvasw.getContext('2d');

const canvasl = document.getElementById('loudnessbar');
const ctxl = canvasl.getContext('2d');

let beatContainer = document.getElementById('beatCanvas').getBoundingClientRect();
let waveContainer = document.getElementById('waveCanvas').getBoundingClientRect();
let loudnessContainer = document.getElementById('barCanvas').getBoundingClientRect();

canvasb.width = beatContainer.width;
canvasb.height = beatContainer.height;

canvasl.width = loudnessContainer.width - 10;
canvasl.height = loudnessContainer.height - 10;

canvasw.width = waveContainer.width - 10;
canvasw.height = waveContainer.height - 10;

// Display the titles on the canvases
ctxb.font = '20px Arial';
ctxb.fillStyle = 'black';
ctxb.fillText(`BPM:`, 20, 40);

ctxw.font = '20px Arial';
ctxw.fillStyle = 'black';
ctxw.fillText(`Waveform`, 20, 40);

ctxl.font = '20px Arial';
ctxl.fillStyle = 'black';
ctxl.fillText(`Loudness`, 20, 40);

function initWaveSurfer() { 
  wavesurfer = WaveSurfer.create({
    container: '#waveform',
    waveColor: '#4F4A85',
    progressColor: '#383351',
    height: 30,
    barWidth: 2,
    barGap: 1,
    barRadius: 2,
    media: audio,
  });

  wavesurfer.registerPlugin(
    WaveSurfer.Spectrogram.create({
      labels: true,
      height: 500,
      splitChannels: true,
    }),
  );

  wavesurfer.on('interaction', () => {
    wavesurfer.play()
  });
  
  wavesurfer.on('timeupdate', function (currentTime) {
    updateVisualizations();
  });
  wavesurfer.on('error', function(error) {
    console.error("Error loading audio:", error);
  });
}

document.getElementById('play').addEventListener('click', () => {
  wavesurfer.playPause()
})

// Create an Audio object
const audio = new Audio();

initWaveSurfer();

wavesurfer.on('ready', function () {
  audioContext = new AudioContext();
  analyser = audioContext.createAnalyser();
  analyser.fftSize = 2048;
  bufferLength = analyser.frequencyBinCount;
  dataArray = new Uint8Array(bufferLength);

  const mediaNode = audioContext.createMediaElementSource(audio)
  mediaNode.connect(analyser);
  analyser.connect(audioContext.destination);
});

// Plotly setup
const trace = {
  x: [],
  y: [],
  type: 'scatter',
  mode: 'lines'
};

const layout = {
  title: 'Frequency Distribution',
  xaxis: { title: 'Frequency (Hz)' },
  yaxis: { title: 'Amplitude' },
  height: document.getElementById('plotlycard').offsetHeight -5,
};

let plotly = document.getElementById('plotly');

Plotly.newPlot(plotly, [trace], layout);

const fileInput = document.getElementById('audioUpload');
fileInput.addEventListener('change', function(event) {
  const file = event.target.files[0]; // Get the selected file

  if (file) {
    // Create an object URL for the audio file
    const url = URL.createObjectURL(file);

    // Load the audio file into WaveSurfer
    // wavesurfer.load(url);
    audio.src = url;
    console.log(audio.src);
    wavesurfer.load(url);

  }
});

function loadDemo() {
  audio.src = '/audio.mp3';
  wavesurfer.load('/audio.mp3');
}

// document.getElementById('demo').addEventListener('click', () => {
//   loadDemo();
// });

document.getElementById('reset').addEventListener('click', () => {
  resetAudio();
});

function resetAudio() {
  wavesurfer.destroy();  // Clears the waveform
  audio.src = '';  // Clears the audio source
  document.getElementById('audioUpload').value = '';  // Resets the file input
  initWaveSurfer();
}

// Update DFT in real-time
function updateVisualizations() {
  analyser.getByteFrequencyData(dataArray);
  
  let frequencies = [];
  let amplitudes = [];
  for (let i = 0; i < bufferLength; i++) {
    frequencies.push(i * audioContext.sampleRate / analyser.fftSize);
    amplitudes.push(dataArray[i]);
  }

  renderDFT(frequencies, amplitudes);
  renderWaveform();
  renderLoudness()

  // [4] Beat Detection Algorithm. https://www.parallelcube.com/2018/03/30/beat-detection-algorithm/
  let sum = 0;
  // Analyze low frequencies (bass ranges where beats are usually prominent)
  for (let i = 0; i < 100; i++) {
      sum += dataArray[i];
  }

  // Average of the low frequencies
  const average = sum / 100;

  // Trigger a beat visualization if the volume spikes
  if (average > 150) {
      const currentTime = audioContext.currentTime;
      beatInterval = currentTime - lastBeatTime;
      lastBeatTime = currentTime;

      if (beatInterval > 0.1) {
        beatCounter++;  // Increment beat counter
      }
      drawBeat();
  }

  // Calculate BPM
  if ((Math.round(audioContext.currentTime) % 10 === 0) && (Math.round(audioContext.currentTime) !== 0)) {
      if (currentSecond === 0) {
        bpm = beatCounter * 6;
        beatCounter = 0;  // Reset beat counter
        currentSecond = 1;
        drawBPM();
      }
  } else {
    currentSecond = 0;
  }
}

function renderDFT(frequencies, amplitudes) {
  const trace = {
    x: frequencies,
    y: amplitudes,
    type: 'scatter',
    mode: 'lines',
    line: { color: 'rgba(255, 0, 0, 0.7)', width: 1 }
  };
  const layout = {
    title: 'Frequency Spectrum',
    xaxis: { title: 'Frequency (Hz)', range: [0, 22000] },
    yaxis: { title: 'Amplitude' }
  };
  
  Plotly.react(plotly, [trace], layout);
}

function drawBeat() {
  const beatHeight = 50;
  const x = canvasb.width / 2;  // Random position for the "beat"
  const y = canvasb.height / 2 - beatHeight / 2;

  // Draw a circle on the canvas to represent a beat
  ctxb.beginPath();
  ctxb.arc(x, y, beatHeight, 0, 2 * Math.PI);
  ctxb.fillStyle = 'red';
  ctxb.fill();

  // Clear the circle after a brief duration to create a pulsating effect
  setTimeout(() => {
      ctxb.clearRect(x - beatHeight, y - beatHeight, beatHeight * 2, beatHeight * 2);
  }, 150);
}

function drawBPM() {
  ctxb.clearRect(0, 0, canvasb.width, 50);
  ctxb.fillText(`BPM: ${bpm}`, 20, 40);
}

function renderWaveform() {
  analyser.getByteTimeDomainData(dataArray);

  ctxw.clearRect(0, 0, canvasw.width, canvasw.height);

  const middleY = canvasw.height / 2;

  ctxw.font = '20px Arial';
  ctxw.fillStyle = 'black';
  ctxw.fillText(`Waveform`, 20, 40);

  // Draw the left side of the waveform (normal)
  ctxw.beginPath();
  for (let i = 0; i < bufferLength; i++) {
      const value = dataArray[i] - 128; // Normalize the data to the center
      var y = middleY + (value * middleY) / 128;
      ctxw.lineTo(i, y);
  }
  ctxw.strokeStyle = 'rgb(46, 139, 87)';
  ctxw.lineWidth = 2;
  ctxw.stroke();
}

// Draw loudness visualization
function renderLoudness() {
    // Compute RMS loudness
    const rms = computeRMS(dataArray);

    // Map RMS value to canvas height
    const height = Math.min(rms * 2, canvasl.height); // Clamp to canvas height

    // Clear the canvas before drawing the next frame
    ctxl.clearRect((canvasl.width / 3), 0, (canvasl.width / 3) * 2, canvasl.height);

    // Draw a bar representing loudness
    ctxl.fillStyle = 'rgb(17, 30, 108)';
    ctxl.fillRect((canvasl.width / 3), canvasl.height - height, (canvasl.width / 3) , height);
}

// [5] Loudness Calculation. https://github.com/Sreeleena3s/Loudness-calculation
function computeRMS(data) {
  let sum = 0;
  for (let i = 0; i < data.length; i++) {
      sum += Math.pow(data[i] - 128, 2); // Subtracting 128 to center the waveform on the canvas
  }
  const rms = Math.sqrt(sum / data.length);
  return rms;
}