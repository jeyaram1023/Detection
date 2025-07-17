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

    // --- 1. INITIALIZATION ---
    async function initialize() {
        // Security check for camera access
        if (location.protocol !== 'https:' && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') {
            statusDisplay.innerText = 'Error: Camera access requires a secure (HTTPS) connection. Please use a local server or deploy to a secure host.';
            return;
        }
        
        statusDisplay.innerText = 'Loading Model...';
        model = await cocoSsd.load();
        statusDisplay.innerText = 'Ready! Press 📷 to start.';
        cameraBtn.disabled = false;
        cameraBtn.innerHTML = '📷';
        updateUI(); // Set initial button state
    }

    // --- 2. CAMERA & DETECTION ---
    async function toggleCamera() {
        if (isCameraOn) {
            stopCamera();
        } else {
            await startCamera();
        }
        updateUI();
    }

    async function startCamera() {
        try {
            stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
            video.srcObject = stream;
            await video.play(); // Use play() to ensure it's running
            
            isCameraOn = true;
            statusDisplay.style.display = 'none';
            checkFlashCapability();
            detectObjects();
        } catch (err) {
            console.error("Error accessing webcam:", err);
            statusDisplay.innerText = 'Error: Could not access camera. Please grant permission.';
            statusDisplay.style.display = 'block';
            isCameraOn = false;
        }
    }

    function stopCamera() {
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
        }
        video.srcObject = null;
        isCameraOn = false;
        isFlashOn = false; // Reset flash state
        cancelAnimationFrame(animationFrameId);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        statusDisplay.innerText = 'Camera Off. Press 📷 to start.';
        statusDisplay.style.display = 'block';
    }

    async function detectObjects() {
        if (!isCameraOn || !model) return;
        
        const predictions = await model.detect(video);
        drawDetections(predictions);
        animationFrameId = requestAnimationFrame(detectObjects);
    }

    function drawDetections(predictions) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        let filteredPredictions = detectionMode === 'all' 
            ? predictions 
            : predictions.filter(p => ANIMAL_CLASSES.includes(p.class));

        filteredPredictions.forEach(prediction => {
            const [x, y, width, height] = prediction.bbox;
            const label = `${prediction.class} (${Math.round(prediction.score * 100)}%)`;
            
            ctx.strokeStyle = '#00FFFF';
            ctx.lineWidth = 2;
            ctx.font = '16px sans-serif';

            ctx.beginPath();
            ctx.rect(x, y, width, height);
            ctx.stroke();
            
            ctx.fillStyle = '#00FFFF';
            const textWidth = ctx.measureText(label).width;
            ctx.fillRect(x, y, textWidth + 8, 20);
            
            ctx.fillStyle = '#000000';
            ctx.fillText(label, x + 4, y + 14);
        });
    }

    // --- 3. UI & CONTROLS ---
    function updateUI() {
        cameraBtn.classList.toggle('off', !isCameraOn);
        cameraBtn.innerHTML = isCameraOn ? '⏹️' : '📷';

        flashBtn.disabled = !isCameraOn;
        flashBtn.classList.toggle('on', isFlashOn);
        
        modeBtn.innerText = `🔁 Mode: ${detectionMode === 'all' ? 'All Objects' : 'Animals Only'}`;
        menuDropdown.classList.toggle('hidden', !isMenuOpen);
    }

    async function toggleFlash() {
        if (!stream) return;
        const track = stream.getVideoTracks()[0];
        try {
            isFlashOn = !isFlashOn;
            await track.applyConstraints({ advanced: [{ torch: isFlashOn }] });
            updateUI();
        } catch (e) {
            console.error('Flash control failed:', e);
            alert('Flash control is not supported on this device.');
            isFlashOn = false;
        }
    }
    
    function checkFlashCapability() {
        if (!stream) return;
        const track = stream.getVideoTracks()[0];
        const capabilities = track.getCapabilities();
        flashBtn.disabled = !(capabilities.torch && isCameraOn);
    }
    
    function takeSnapshot() {
        if (!isCameraOn) {
            alert('Please turn on the camera first.');
            return;
        }
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        drawDetections(model.detect(video).then(p => drawDetections(p))); // Re-draw detections on the still frame
        
        const dataUrl = canvas.toDataURL('image/png');
        const link = document.createElement('a');
        link.href = dataUrl;
        link.download = `detection-snapshot-${Date.now()}.png`;
        link.click();
    }

    // --- 4. EVENT LISTENERS ---
    cameraBtn.addEventListener('click', toggleCamera);
    flashBtn.addEventListener('click', toggleFlash);
    
    menuToggle.addEventListener('click', () => {
        isMenuOpen = !isMenuOpen;
        updateUI();
    });

    helpBtn.addEventListener('click', (e) => {
        e.preventDefault();
        alert('--- Help ---\n\n1. Press 📷 to start/stop the camera.\n2. Press 💡 to toggle the flash (mobile only).\n3. The app will automatically highlight detected objects.\n4. Use the menu to take a snapshot or switch detection modes.');
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
    
    // --- START THE APP ---
    initialize();
});
