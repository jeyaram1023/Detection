document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const video = document.getElementById('webcam');
    const canvas = document.getElementById('canvas');
    const ctx = canvas.getContext('2d');
    const statusDisplay = document.getElementById('status');
    
    const menuToggle = document.getElementById('menu-toggle');
    const menuDropdown = document.getElementById('menu-dropdown');
    const helpBtn = document.getElementById('help-btn');
    const snapshotBtn = document.getElementById('snapshot-btn');
    const modeBtn = document.getElementById('mode-btn');
    
    const cameraBtn = document.getElementById('camera-btn');
    const flashBtn = document.getElementById('flash-btn');

    // App State
    let model = null;
    let stream = null;
    let isCameraOn = false;
    let isFlashOn = false;
    let isMenuOpen = false;
    let detectionMode = 'all'; // 'all' or 'animals'
    let animationFrameId = null;

    const ANIMAL_CLASSES = ['bird', 'cat', 'dog', 'horse', 'sheep', 'cow', 'elephant', 'bear', 'zebra', 'giraffe', 'person'];

    // --- MODEL LOADING ---
    async function loadModel() {
        statusDisplay.innerText = 'Loading Model... Please Wait.';
        statusDisplay.style.display = 'block';
        try {
            model = await cocoSsd.load();
            statusDisplay.innerText = 'Model Loaded. Turn on Camera to Start.';
            cameraBtn.disabled = false;
        } catch (err) {
            console.error("Failed to load model", err);
            statusDisplay.innerText = 'Error: Could not load model.';
        }
    }

    // --- CAMERA & DETECTION ---
    async function startCamera() {
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
            try {
                const streamConfig = { 
                    video: { 
                        facingMode: 'environment' // Prefer back camera
                    } 
                };
                stream = await navigator.mediaDevices.getUserMedia(streamConfig);
                video.srcObject = stream;
                video.onloadedmetadata = () => {
                    canvas.width = video.videoWidth;
                    canvas.height = video.videoHeight;
                    isCameraOn = true;
                    statusDisplay.style.display = 'none';
                    updateUI();
                    detectObjects();
                    checkFlashCapability();
                };
            } catch (err) {
                console.error("Error accessing webcam", err);
                statusDisplay.innerText = 'Error: Could not access webcam. Please grant permission.';
                statusDisplay.style.display = 'block';
                // Fallback to front camera if environment fails
                if (err.name === "OverconstrainedError" || err.name === "NotReadableError") {
                    streamConfig.video.facingMode = 'user';
                    stream = await navigator.mediaDevices.getUserMedia(streamConfig);
                    video.srcObject = stream;
                }
            }
        }
    }

    function stopCamera() {
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
        }
        video.srcObject = null;
        isCameraOn = false;
        isFlashOn = false;
        cancelAnimationFrame(animationFrameId);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        statusDisplay.innerText = 'Camera Off.';
        statusDisplay.style.display = 'block';
        updateUI();
    }

    async function detectObjects() {
        if (!isCameraOn || !model) return;

        const predictions = await model.detect(video);
        drawDetections(predictions);
        animationFrameId = requestAnimationFrame(detectObjects);
    }

    function drawDetections(predictions) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.font = '16px sans-serif';
        ctx.textBaseline = 'top';

        let filteredPredictions = predictions;
        if (detectionMode === 'animals') {
            filteredPredictions = predictions.filter(p => ANIMAL_CLASSES.includes(p.class));
        }

        filteredPredictions.forEach(prediction => {
            const [x, y, width, height] = prediction.bbox;
            const label = `${prediction.class} (${Math.round(prediction.score * 100)}%)`;
            
            // Bounding box
            ctx.strokeStyle = '#00FFFF';
            ctx.lineWidth = 2;
            ctx.strokeRect(x, y, width, height);
            
            // Label background
            ctx.fillStyle = '#00FFFF';
            const textWidth = ctx.measureText(label).width;
            ctx.fillRect(x, y, textWidth + 8, 20);
            
            // Label text
            ctx.fillStyle = '#000000';
            ctx.fillText(label, x + 4, y + 4);
        });
    }

    // --- UI & CONTROLS ---
    function updateUI() {
        // Camera Button
        if (isCameraOn) {
            cameraBtn.innerText = '📷 Turn Camera Off';
            cameraBtn.classList.add('off');
        } else {
            cameraBtn.innerText = '📷 Turn Camera On';
            cameraBtn.classList.remove('off');
            flashBtn.disabled = true;
            flashBtn.innerText = '💡 Flash Off';
        }

        // Menu
        menuDropdown.classList.toggle('hidden', !isMenuOpen);

        // Mode Button
        modeBtn.innerText = `🔁 Switch Mode: ${detectionMode === 'all' ? 'All' : 'Animals'}`;
    }

    function toggleFlash() {
        if (!stream) return;
        const track = stream.getVideoTracks()[0];
        isFlashOn = !isFlashOn;
        track.applyConstraints({
            advanced: [{ torch: isFlashOn }]
        }).catch(e => console.error('Flash control failed: ', e));
        flashBtn.innerText = isFlashOn ? '💡 Flash On' : '💡 Flash Off';
    }
    
    async function checkFlashCapability() {
        if (!stream) return;
        const track = stream.getVideoTracks()[0];
        try {
            const capabilities = track.getCapabilities();
            if (capabilities.torch) {
                flashBtn.disabled = false;
            } else {
                console.log("Flash/Torch not supported by this device/camera.");
            }
        } catch(e) {
            console.error('Could not check flash capabilities: ', e);
        }
    }
    
    function takeSnapshot() {
        if (!isCameraOn) {
            alert('Please turn on the camera first.');
            return;
        }
        // Draw the current video frame onto the canvas
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        // Redraw the latest detections on top
        model.detect(video).then(predictions => {
            drawDetections(predictions);
            
            // Trigger download
            const dataUrl = canvas.toDataURL('image/png');
            const link = document.createElement('a');
            link.href = dataUrl;
            link.download = `snapshot-${new Date().toISOString()}.png`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        });
    }

    // --- EVENT LISTENERS ---
    cameraBtn.addEventListener('click', () => {
        if (isCameraOn) {
            stopCamera();
        } else {
            startCamera();
        }
    });

    flashBtn.addEventListener('click', toggleFlash);

    menuToggle.addEventListener('click', () => {
        isMenuOpen = !isMenuOpen;
        updateUI();
    });

    helpBtn.addEventListener('click', (e) => {
        e.preventDefault();
        alert('--- Object & Animal Observer ---\n\n1. Turn on the camera to start detection.\n2. Detected objects will be highlighted.\n3. Use the menu for more options like taking a snapshot or switching detection modes.\n4. The flash button works on supported mobile devices.');
        isMenuOpen = false;
        updateUI();
    });

    snapshotBtn.addEventListener('click', (e) => {
        e.preventDefault();
        takeSnapshot();
        isMenuOpen = false;
        updateUI();
    });



    modeBtn.addEventListener('click', (e) => {
        e.preventDefault();
        detectionMode = (detectionMode === 'all') ? 'animals' : 'all';
        updateUI();
    });
    
    // Close menu if clicking outside
    document.addEventListener('click', (e) => {
        if (!menuToggle.contains(e.target) && !menuDropdown.contains(e.target) && isMenuOpen) {
            isMenuOpen = false;
            updateUI();
        }
    });

    // --- INITIALIZATION ---
    cameraBtn.disabled = true;
    loadModel();
});
