let loop = false;

let initialPitch = 0.5;

let enableRandomPitchChange = true;
let minPitch = 0.5;
let maxPitch = 3;

let timeBetweenSteps = 1/30; // seconds
let timeUntilFirstChange = 160/30; // seconds
let timeMinBetweenChanges = 4/30; // seconds
let timeMaxBetweenChanges = 4; // seconds

let sinePitchMagnitude = 0.01;
let sinePhaseSpeed = 15; // radians per second

const $ = q => document.querySelector(q);

let filename = "";

let audioCtx = null;
let audioSource = null;
let audioBuffer = null;

let timeoutStep = null;
let timeoutChange = null;

let basePitch = initialPitch;
let sinePitch = 0;
let sinePhase = 0;

const randomRange = (min, max) => Math.random() * (max - min) + min;

const startAudioCtx = () => {
    if (!audioCtx) {
        audioCtx = new AudioContext();
    }
}

const loadFromFile = (file) => {

    startAudioCtx();
    stop();

    return new Promise((resolve, reject) => {
        let fileReader = new FileReader();
        fileReader.onload = () => {
            resolve(loadFromArrayBuffer(fileReader.result));
        }
        fileReader.onerror = () => {
            reject();
        }
        fileReader.readAsArrayBuffer(file);
    });
    
}

const loadFromURL = (url) => {

    startAudioCtx();
    stop();

    return fetch(url)
    .then(response => response.arrayBuffer())
    .then(arrayBuffer => loadFromArrayBuffer(arrayBuffer));

}

const loadFromArrayBuffer = (arrayBuffer) => {
    return audioCtx.decodeAudioData(arrayBuffer)
    .then(buffer => {
        audioBuffer = buffer;
    });
}

const start = () => {

    audioSource = audioCtx.createBufferSource();
    audioSource.buffer = audioBuffer; //load buffer into buffersourcenode
    audioSource.loop = loop;
    audioSource.playbackRate.value = basePitch;
    audioSource.connect(audioCtx.destination);
    audioSource.start();

    if (enableRandomPitchChange) {
        timeoutChange = setTimeout(() => change(), timeUntilFirstChange * 1000);
    }
    timeoutStep = setTimeout(() => step(), timeBetweenSteps * 1000);

}

const stop = () => {
    if (audioSource) {

        audioSource.stop();
        audioSource.disconnect();
        audioSource = null;

        basePitch = initialPitch;
        sinePhase = 0;

        clearTimeout(timeoutStep);
        clearTimeout(timeoutChange);
    }
}

const step = () => {

    sinePhase += timeBetweenSteps * sinePhaseSpeed;
    sinePitch = Math.sin(sinePhase) * sinePitchMagnitude;

    let finalPitch = basePitch + sinePitch;
    audioSource.playbackRate.value = finalPitch;

    timeoutStep = setTimeout(() => step(), timeBetweenSteps * 1000);

}

const change = () => {

    basePitch = randomRange(minPitch, maxPitch);

    let nextChangeTime = randomRange(timeMinBetweenChanges, timeMaxBetweenChanges);
    timeoutChange = setTimeout(() => change(), nextChangeTime * 1000);

}

const download = () => {
    const worker = new Worker("worker.js");

    let data = [];

    for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
        data[channel] = audioBuffer.getChannelData(channel)
    }

    worker.postMessage({
        data,

        numberOfChannels: audioBuffer.numberOfChannels,
        duration: audioBuffer.duration,
        sampleRate: audioBuffer.sampleRate,

        initialPitch,
        timeBetweenSteps,
        timeUntilFirstChange,
        enableRandomPitchChange,
        minPitch,
        maxPitch,
        timeMinBetweenChanges,
        timeMaxBetweenChanges,
        sinePhaseSpeed,
        sinePitchMagnitude,
    });

    worker.onmessage = e => {
        worker.terminate();

        const newAudioBuffer = new AudioBuffer({
            length: e.data.length,
            numberOfChannels: audioBuffer.numberOfChannels,
            sampleRate: audioBuffer.sampleRate,
        });

        e.data.data.forEach((channelData, i) => {
            newAudioBuffer.copyToChannel(channelData, i);
        });

        const wavBuffer = audioBufferToWav(newAudioBuffer, {float32: true});

        const a = document.createElement("a");
        a.href = URL.createObjectURL(new Blob([wavBuffer]));
        a.download = "let_it_be_cold_audio.wav";
        a.click();

        $('.info').textContent = `Downloading.`;
    }
}

$('input.url').disabled = false;
$('input.file').disabled = true;

$('input.fromURL').onclick = () => {
    $('input.url').disabled = false;
    $('input.file').disabled = true;
}

$('input.fromFile').onclick = () => {
    $('input.url').disabled = true;
    $('input.file').disabled = false;
}

$('button.load').disabled = false;
$('button.load').onclick = () => {

    $('.info').textContent = `Loading...`;

    $('button.play').disabled = true;
    $('button.stop').disabled = true;
    $('button.download').disabled = true;

    let promLoad;
    let fileName;

    if ($('input.fromFile').checked) {
        fileName = $('input.file').files[0].name;
        promLoad = loadFromFile($('input.file').files[0]);
    } else if ($('input.fromURL').checked) {
        fileName = $('input.url').value || "music.ogg";
        promLoad = loadFromURL(fileName);
    }

    promLoad
    .then(() => {
        $('.info').textContent = `Loaded "`+fileName+`"`;

        $('button.play').disabled = false;
        $('button.stop').disabled = true;
        $('button.download').disabled = false;
    })
    .catch(() => {
        $('.info').textContent = `Error loading "`+fileName+`"!`;
    });

};

$('button.play').disabled = true;
$('button.play').onclick = () => {

    $('.info').textContent = `Playing.`;

    $('button.play').disabled = true;
    $('button.stop').disabled = false;

    start();

};

$('button.stop').disabled = true;
$('button.stop').onclick = () => {

    $('.info').textContent = `Stopped.`;

    $('button.play').disabled = false;
    $('button.stop').disabled = true;

    stop();

};

$('button.download').disabled = true;
$('button.download').onclick = () => {

    $('.info').textContent = `Generating download...`;

    setTimeout(() => download(), 0);

};
