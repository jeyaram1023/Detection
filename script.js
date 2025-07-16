document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const video = document.getElementById('webcam');
    const canvas = document.getElementById('canvas');
    const ctx = canvas.getContext('2d');
    const loadingContainer = document.getElementById('loading-container');
    const cameraBtn = document.getElementById('camera-btn');
    const flashBtn = document.getElementById('flash-btn');
    const flashOverlay = document.getElementById('flash-overlay');
    const menuToggle = document.getElementById('menu-toggle');
    const menuDropdown = document.getElementById('menu-dropdown');
    const helpBtn = document.getElementById('help-btn');
    const snapshotBtn = document.getElementById('snapshot-btn');
    const modeBtn = document.getElementById('mode-btn');
    const helpModal = document.getElementById('help-modal');
    const closeModal = document.getElementById('close-modal');

    // State variables
    let model = null;
    let stream = null;
    let isCameraOn = false;
    let detectionInterval = null;
    let detectionMode = 'all'; // 'all' or 'animals'
    const animalList = ['dog', 'cat', 'bird', 'cow', 'elephant']; // COCO-SSD supports dog, cat, bird

    // Load COCO-SSD model
    async function loadModel() {
        try {
            model = await cocoSsd.load();
            loadingContainer.classList.add('hidden');
            console.log('Model loaded successfully.');
        } catch (error) {
            console.error('Failed to load model:', error);
            loadingContainer.innerHTML = '<p>Failed to load model. Please refresh.</p>';
        }
    }
    loadModel();

    // Toggle Camera
    cameraBtn.addEventListener('click', async () => {
        if (isCameraOn) {
            stopCamera();
        } else {
            await startCamera();
        }
    });

    // Start the webcam
    async function startCamera() {
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
            try {
                stream = await navigator.mediaDevices.getUserMedia({
                    video: { facingMode: 'environment' } // Prefer back camera
                });
                video.srcObject = stream;
                video.style.display = 'block'; // Show video to establish dimensions
                isCameraOn = true;
                cameraBtn.textContent = '📷 Turn Off Camera';
                
                video.onloadedmetadata = () => {
                    canvas.width = video.videoWidth;
                    canvas.height = video.videoHeight;
                    video.style.display = 'none'; // Hide video, use canvas for display
                    detectionInterval = setInterval(detectFrame, 100); // Start detection loop
                };
            } catch (error) {
                console.error('Error accessing webcam:', error);
                alert('Could not access your camera. Please ensure permissions are granted.');
            }
        } else {
            alert('Your browser does not support camera access.');
        }
    }

    // Stop the webcam
    function stopCamera() {
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
        }
        clearInterval(detectionInterval);
        ctx.clearRect(0, 0, canvas.width, canvas.height); // Clear canvas
        isCameraOn = false;
        video.srcObject = null;
        cameraBtn.textContent = '📷 Turn On Camera';
    }

    // Detection loop
    async function detectFrame() {
        if (!model || !isCameraOn || video.paused || video.ended) return;

        // Draw video frame to canvas first
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        const predictions = await model.detect(video);
        drawBoundingBoxes(predictions);
    }

    // Draw bounding boxes and labels
    function drawBoundingBoxes(predictions) {
        const filteredPredictions = predictions.filter(p => {
            if (detectionMode === 'animals') {
                return animalList.includes(p.class);
            }
            return true; // 'all' mode
        });
        
        filteredPredictions.forEach(prediction => {
            const [x, y, width, height] = prediction.bbox;
            const label = `${prediction.class} (${Math.round(prediction.score * 100)}%)`;
            
            // Styling
            ctx.strokeStyle = getColor(prediction.class);
            ctx.lineWidth = 3;
            ctx.fillStyle = getColor(prediction.class);
            ctx.font = '18px Arial';

            // Draw the bounding box
            ctx.beginPath();
            ctx.rect(x, y, width, height);
            ctx.stroke();

            // Draw the label background
            const textWidth = ctx.measureText(label).width;
            ctx.fillRect(x, y, textWidth + 10, 25);
            
            // Draw the label text
            ctx.fillStyle = '#FFFFFF';
            ctx.fillText(label, x + 5, y + 18);
        });
    }

    // Get color based on object class
    function getColor(className) {
        if (animalList.includes(className)) return '#2ecc71'; // Green for animals
        if (className === 'person') return '#3498db'; // Blue for humans
        return '#e74c3c'; // Red for other objects
    }

    // Menu Toggle
    menuToggle.addEventListener('click', () => {
        menuDropdown.classList.toggle('hidden');
    });
    // Close menu if clicking outside
    document.addEventListener('click', (e) => {
        if (!menuContainer.contains(e.target)) {
            menuDropdown.classList.add('hidden');
        }
    });
    const menuContainer = document.querySelector('.menu-container');

    // Help Modal
    helpBtn.addEventListener('click', () => {
        helpModal.classList.remove('hidden');
    });
    closeModal.addEventListener('click', () => {
        helpModal.classList.add('hidden');
    });
    window.addEventListener('click', (e) => {
        if (e.target === helpModal) {
            helpModal.classList.add('hidden');
        }
    });

    // Snapshot
    snapshotBtn.addEventListener('click', () => {
        if (!isCameraOn) {
            alert('Please turn on the camera first.');
            return;
        }
        const dataUrl = canvas.toDataURL('image/png');
        const link = document.createElement('a');
        link.href = dataUrl;
        link.download = `snapshot-${new Date().toISOString()}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    });

    // Switch Detection Mode
    modeBtn.addEventListener('click', () => {
        if (detectionMode === 'all') {
            detectionMode = 'animals';
            modeBtn.textContent = '🔁 Switch to All Objects';
        } else {
            detectionMode = 'all';
            modeBtn.textContent = '🔁 Switch to Animals';
        }
        menuDropdown.classList.add('hidden'); // Close menu after selection
    });

    // Flash Button
    flashBtn.addEventListener('click', () => {
        flashOverlay.classList.add('flash');
        setTimeout(() => {
            flashOverlay.classList.remove('flash');
        }, 150); // Flash duration
    });
});
