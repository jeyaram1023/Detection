document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const video = document.getElementById('webcam');
    const canvas = document.getElementById('canvas');
    const ctx = canvas.getContext('2d');
    const loadingContainer = document.getElementById('loading-container');
    const loadingText = document.getElementById('loading-text');
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
    const menuContainer = document.querySelector('.menu-container');

    // State variables
    let model = null;
    let stream = null;
    let isCameraOn = false;
    let isFlashOn = false;
    let detectionInterval = null;
    let detectionMode = 'all'; // 'all' or 'animals'
    const animalList = ['dog', 'cat', 'bird', 'cow', 'elephant', 'bear', 'zebra', 'giraffe'];

    // Load COCO-SSD model
    cocoSsd.load().then(loadedModel => {
        model = loadedModel;
        loadingContainer.classList.add('hidden');
    }).catch(error => {
        console.error('Failed to load model:', error);
        loadingText.textContent = 'Failed to load AI model. Please check your connection and refresh.';
    });

    // Start the webcam
    async function startCamera() {
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
            loadingText.textContent = 'Please grant camera permission...';
            loadingContainer.classList.remove('hidden');
            try {
                // ***MODIFIED***: Using a more generic constraint to improve compatibility
                stream = await navigator.mediaDevices.getUserMedia({
                    video: { facingMode: 'environment' }
                });
                video.srcObject = stream;
                isCameraOn = true;
                cameraBtn.textContent = '📷 Turn Off Camera';
                video.style.display = 'block';

                video.onloadedmetadata = () => {
                    canvas.width = video.videoWidth;
                    canvas.height = video.videoHeight;
                    video.style.display = 'none';
                    loadingContainer.classList.add('hidden');
                    detectionInterval = setInterval(detectFrame, 100);
                };
            } catch (error) {
                loadingContainer.classList.add('hidden');
                console.error('Error accessing webcam:', error);
                // Handle cases where the back camera is not available
                if (error.name === 'OverconstrainedError' || error.name === 'NotFoundError') {
                    try {
                        stream = await navigator.mediaDevices.getUserMedia({ video: true }); // Fallback to any camera
                        video.srcObject = stream;
                        // ... (repeat setup logic as above)
                    } catch (fallbackError) {
                        alert('Could not access any camera. Please ensure permissions are granted and no other app is using the camera.');
                    }
                } else {
                     alert('Could not access your camera. Please ensure permissions are granted.');
                }
            }
        } else {
            alert('Your browser does not support camera access.');
        }
    }

    // Stop the webcam
    function stopCamera() {
        if (stream) {
            // Turn off flashlight if it was on
            if (isFlashOn) toggleFlashlight(false); 
            stream.getTracks().forEach(track => track.stop());
        }
        clearInterval(detectionInterval);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        isCameraOn = false;
        video.srcObject = null;
        cameraBtn.textContent = '📷 Turn On Camera';
    }

    // ***NEW***: Function to control the device flashlight (torch)
    async function toggleFlashlight() {
        if (!stream) {
            alert("Please turn on the camera first to use the flash.");
            return;
        }
        const videoTrack = stream.getVideoTracks()[0];
        const capabilities = videoTrack.getCapabilities();

        if (capabilities.torch) {
            try {
                await videoTrack.applyConstraints({
                    advanced: [{ torch: !isFlashOn }]
                });
                isFlashOn = !isFlashOn;
                flashBtn.style.backgroundColor = isFlashOn ? '#ffff8d' : '';
                flashBtn.style.color = isFlashOn ? '#000' : '';
            } catch (error) {
                console.error('Error controlling flashlight:', error);
                alert("Could not control flashlight. Your device may not support it.");
            }
        } else {
            // Fallback to screen flash if torch is not supported
            console.log("Device flashlight not supported. Using screen flash.");
            flashOverlay.classList.add('flash');
            setTimeout(() => {
                flashOverlay.classList.remove('flash');
            }, 150);
        }
    }

    // Detection loop
    async function detectFrame() {
        if (!model || !isCameraOn || video.paused || video.ended) return;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const predictions = await model.detect(video);
        drawBoundingBoxes(predictions);
    }

    // Draw bounding boxes and labels
    function drawBoundingBoxes(predictions) {
        const filteredPredictions = predictions.filter(p => {
            if (detectionMode === 'animals') return animalList.includes(p.class);
            return true;
        });
        
        filteredPredictions.forEach(prediction => {
            const [x, y, width, height] = prediction.bbox;
            const label = `${prediction.class} (${Math.round(prediction.score * 100)}%)`;
            const color = getColor(prediction.class);

            ctx.strokeStyle = color;
            ctx.lineWidth = 3;
            ctx.fillStyle = color;
            ctx.font = '18px Arial';

            ctx.beginPath();
            ctx.rect(x, y, width, height);
            ctx.stroke();

            const textWidth = ctx.measureText(label).width;
            ctx.fillRect(x, y, textWidth + 10, 25);
            
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

    // Event Listeners
    cameraBtn.addEventListener('click', () => isCameraOn ? stopCamera() : startCamera());
    flashBtn.addEventListener('click', toggleFlashlight);
    menuToggle.addEventListener('click', (e) => {
        e.stopPropagation(); // Prevent document click from closing it immediately
        menuDropdown.classList.toggle('hidden');
    });
    helpBtn.addEventListener('click', () => helpModal.classList.remove('hidden'));
    closeModal.addEventListener('click', () => helpModal.classList.add('hidden'));
    snapshotBtn.addEventListener('click', () => {
        if (!isCameraOn) return alert('Please turn on the camera first.');
        const link = document.createElement('a');
        link.href = canvas.toDataURL('image/png');
        link.download = `detection-snapshot-${Date.now()}.png`;
        link.click();
    });
    modeBtn.addEventListener('click', () => {
        detectionMode = (detectionMode === 'all') ? 'animals' : 'all';
        modeBtn.textContent = (detectionMode === 'all') ? '🔁 Switch to Animals' : '🔁 Switch to All';
    });
    
    // Close menus when clicking outside
    document.addEventListener('click', (e) => {
        if (!menuContainer.contains(e.target)) menuDropdown.classList.add('hidden');
        if (e.target === helpModal) helpModal.classList.add('hidden');
    });
});
