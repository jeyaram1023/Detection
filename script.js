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
        // **NEW**: Check for secure context before proceeding
        if (location.protocol !== 'https:') {
            if (location.hostname !== "127.0.0.1" && location.hostname !== "localhost") {
                statusDisplay.innerText = 'Error: Camera requires a secure (HTTPS) connection.';
                statusDisplay.style.display = 'block';
                cameraBtn.disabled = true;
                return;
            }
        }

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
                statusDisplay.innerText = 'Error: Could not access webcam. Please grant permission and ensure it is not in use.';
                statusDisplay.style.display = 'block';
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
        // Match canvas dimensions to video to prevent distortion
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        
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
            
            ctx.strokeStyle = '#00FFFF';
            ctx.lineWidth = 2;
            ctx.strokeRect(x, y, width, height);
            
            ctx.fillStyle = '#00FFFF';
            const textWidth = ctx.measureText(label).width;
            ctx.fillRect(x, y, textWidth + 8, 20);
            
            ctx.fillStyle = '#000000';
            ctx.fillText(label, x + 4, y + 4);
        });
    }

    // --- UI & CONTROLS ---
    function updateUI() {
        if (isCameraOn) {
            cameraBtn.innerText = '📷 Turn Camera Off';
            cameraBtn.classList.add('off');
        } else {
            cameraBtn.innerText = '📷 Turn Camera On';
            cameraBtn.classList.remove('off');
            flashBtn.disabled = true;
            flashBtn.innerText = '💡 Flash Off';
        }
        menuDropdown.classList.toggle('hidden', !isMenuOpen);
        modeBtn.innerText = `🔁 Switch Mode: ${detectionMode === 'all' ? 'All' : 'Animals'}`;
    }

    async function toggleFlash() {
        if (!stream) return;
        const track = stream.getVideoTracks()[0];
        try {
            isFlashOn = !isFlashOn;
            await track.applyConstraints({ advanced: [{ torch: isFlashOn }] });
            flashBtn.innerText = isFlashOn ? '💡 Flash On' : '💡 Flash Off';
        } catch(e) {
            console.error('Flash control failed: ', e);
            alert('Flash control is not supported on this device/browser.');
            isFlashOn = false; // Reset state
            flashBtn.disabled = true;
        }
    }
    
    async function checkFlashCapability() {
        if (!stream) return;
        const track = stream.getVideoTracks()[0];
        try {
            const capabilities = track.getCapabilities();
            flashBtn.disabled = !capabilities.torch;
        } catch(e) {
            console.error('Could not check flash capabilities: ', e);
            flashBtn.disabled = true;
        }
    }
    
    function takeSnapshot() {
        if (!isCameraOn) {
            alert('Please turn on the camera first.');
            return;
        }
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        model.detect(video).then(predictions => {
            drawDetections(predictions);
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
        isCameraOn ? stopCamera() : startCamera();
    });

    flashBtn.addEventListener('click', toggleFlash);

    menuToggle.addEventListener('click', () => {
        isMenuOpen = !isMenuOpen;
        updateUI();
    });

    helpBtn.addEventListener('click', (e) => {
        e.preventDefault();
        alert('--- Object & Animal Observer ---\n\n1. Use a secure (HTTPS) connection or a local server.\n2. Turn on the camera to start detection.\n3. Detected objects will be highlighted.\n4. Use the menu for more options.');
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
