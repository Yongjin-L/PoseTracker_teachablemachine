/**
 * Pose Duration Tracker
 * A modern pose tracking application using Teachable Machine
 * 
 * Features:
 * - Accurate time-based duration tracking
 * - Configurable confidence threshold
 * - Local storage persistence
 * - CSV export functionality
 * - Pause/Resume support
 * - Session history
 */

// ============================================
// Configuration
// ============================================
const CONFIG = {
    CONFIDENCE_THRESHOLD: 0.8,
    COUNTDOWN_DURATION: 5,
    WEBCAM_WIDTH: 640,
    WEBCAM_HEIGHT: 480,
    MIN_POSE_CONFIDENCE: 0.5,
    STORAGE_KEY: 'poseTrackerSessions',
    MAX_HISTORY_ITEMS: 50
};

// ============================================
// State Management
// ============================================
let state = {
    model: null,
    videoStream: null,  // Native webcam stream
    videoElement: null, // Native video element
    isTestMode: false,  // Webcam test without model
    maxPredictions: 0,
    isTaskMode: false,
    isPaused: false,
    taskStartTime: null,
    lastTimestamp: null,
    totalPausedTime: 0,
    pauseStartTime: null,
    classDurations: {},
    currentClass: null,
    animationFrameId: null,
    _debugLogged: false,      // Debug flag
    _predictionLogged: false, // Debug flag
    _errorLogged: false       // Debug flag
};

// Chart instances
let barChart = null;
let summaryChart = null;

// ============================================
// DOM Elements
// ============================================
const elements = {
    // Model Section
    modelSection: document.getElementById('model-section'),
    modelUrlInput: document.getElementById('model-url'),
    checkModelButton: document.getElementById('check-model-button'),
    testWebcamButton: document.getElementById('test-webcam-button'),
    stopTestWebcamButton: document.getElementById('stop-test-webcam-button'),
    feedback: document.getElementById('feedback'),
    thresholdInput: document.getElementById('threshold-input'),

    // Task Section
    taskSection: document.getElementById('task-section'),
    webcamCanvas: document.getElementById('webcam-canvas'),
    barChartContainer: document.getElementById('bar-chart-container'),
    barChartCanvas: document.getElementById('bar-chart'),
    taskTimer: document.getElementById('task-timer'),
    currentClassDisplay: document.getElementById('current-class'),
    currentProbability: document.getElementById('current-probability'),
    countdownElement: document.getElementById('countdown'),
    feedbackMessage: document.getElementById('feedback-message'),
    startTaskButton: document.getElementById('start-task-button'),
    pauseTaskButton: document.getElementById('pause-task-button'),
    endTaskButton: document.getElementById('end-task-button'),

    // Summary Section
    summarySection: document.getElementById('summary-section'),
    summaryContent: document.getElementById('summary-content'),
    summaryGraphCanvas: document.getElementById('summary-graph'),
    totalDurationDisplay: document.getElementById('total-duration'),
    posesDetectedDisplay: document.getElementById('poses-detected'),
    exportButton: document.getElementById('export-button'),
    restartButton: document.getElementById('restart-button'),

    // History Section
    historySection: document.getElementById('history-section'),
    historyList: document.getElementById('history-list'),
    clearHistoryButton: document.getElementById('clear-history-button'),

    // Toast Container
    toastContainer: document.getElementById('toast-container')
};

// Get canvas context
const ctx = elements.webcamCanvas?.getContext('2d');

// ============================================
// Utility Functions
// ============================================

/**
 * Show feedback message with animation
 */
function showFeedback(message, type = 'loading') {
    if (!elements.feedback) return;
    elements.feedback.textContent = message;
    elements.feedback.className = `feedback show ${type}`;
}

/**
 * Hide feedback message
 */
function hideFeedback() {
    if (!elements.feedback) return;
    elements.feedback.className = 'feedback';
}

/**
 * Show toast notification
 */
function showToast(message, type = 'success') {
    if (!elements.toastContainer) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
        <span>${type === 'success' ? '✓' : type === 'error' ? '✕' : 'ℹ'}</span>
        <span>${message}</span>
    `;

    elements.toastContainer.appendChild(toast);

    // Auto remove after 3 seconds
    setTimeout(() => {
        toast.style.animation = 'toastIn 0.3s ease-out reverse';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

/**
 * Format time in seconds to display string
 */
function formatTime(seconds) {
    return seconds.toFixed(2) + 's';
}

/**
 * Get current confidence threshold from input or default
 */
function getConfidenceThreshold() {
    if (elements.thresholdInput) {
        const value = parseFloat(elements.thresholdInput.value);
        if (!isNaN(value) && value >= 0 && value <= 100) {
            return value / 100;
        }
    }
    return CONFIG.CONFIDENCE_THRESHOLD;
}

// ============================================
// Model Loading
// ============================================

/**
 * Load Teachable Machine pose model from URL
 */
async function loadModel(modelURL) {
    try {
        // Ensure URL ends with slash
        if (!modelURL.endsWith('/')) {
            modelURL += '/';
        }

        const modelJSON = modelURL + 'model.json';
        const metadataJSON = modelURL + 'metadata.json';

        console.log('Loading model from:', modelJSON);

        // Load the model
        state.model = await tmPose.load(modelJSON, metadataJSON);
        state.maxPredictions = state.model.getTotalClasses();

        console.log('Model loaded successfully');
        console.log('Total classes:', state.maxPredictions);
        console.log('Class labels:', state.model.getClassLabels ? state.model.getClassLabels() : 'N/A');

        // Initialize class durations
        state.classDurations = {};
        const labels = state.model.getClassLabels ? state.model.getClassLabels() : [];
        for (let i = 0; i < state.maxPredictions; i++) {
            let className = labels[i] || state.model.classes?.[i] || state.model.labels?.[i] || `Class ${i}`;
            if (className) {
                state.classDurations[className] = 0;
            }
        }

        console.log('Class durations initialized:', Object.keys(state.classDurations));

        return true;
    } catch (error) {
        console.error('Error loading model:', error);
        showFeedback(`Error loading model: ${error.message}`, 'error');
        return false;
    }
}

// ============================================
// Webcam Management
// ============================================

/**
 * Initialize and start webcam for task mode (with pose detection)
 */
async function setupWebcam() {
    try {
        // Use native webcam API for reliable video display
        state.videoStream = await navigator.mediaDevices.getUserMedia({
            video: {
                width: { ideal: CONFIG.WEBCAM_WIDTH },
                height: { ideal: CONFIG.WEBCAM_HEIGHT },
                facingMode: 'user'
            }
        });

        // Create video element if not exists
        if (!state.videoElement) {
            state.videoElement = document.createElement('video');
            state.videoElement.setAttribute('playsinline', '');
            state.videoElement.setAttribute('autoplay', '');
            state.videoElement.setAttribute('muted', '');
            // Set explicit dimensions for pose estimation
            state.videoElement.width = CONFIG.WEBCAM_WIDTH;
            state.videoElement.height = CONFIG.WEBCAM_HEIGHT;
            state.videoElement.style.display = 'none';
            document.body.appendChild(state.videoElement);
        }

        state.videoElement.srcObject = state.videoStream;
        await state.videoElement.play();

        // Set canvas dimensions
        if (elements.webcamCanvas) {
            elements.webcamCanvas.width = CONFIG.WEBCAM_WIDTH;
            elements.webcamCanvas.height = CONFIG.WEBCAM_HEIGHT;
        }

        // Wait for video to be ready with actual dimensions
        await new Promise((resolve) => {
            const checkReady = () => {
                if (state.videoElement.readyState >= 2 &&
                    state.videoElement.videoWidth > 0 &&
                    state.videoElement.videoHeight > 0) {
                    console.log('Video ready:', state.videoElement.videoWidth, 'x', state.videoElement.videoHeight);
                    resolve();
                } else {
                    setTimeout(checkReady, 100);
                }
            };
            checkReady();
        });

        // Start the animation loop
        state.animationFrameId = window.requestAnimationFrame(loop);

        return true;
    } catch (error) {
        console.error('Error setting up webcam:', error);
        showFeedback(`Error accessing webcam: ${error.message}`, 'error');
        return false;
    }
}

/**
 * Setup native webcam for test mode (without model)
 */
async function setupNativeWebcam() {
    try {
        // Request webcam access
        state.videoStream = await navigator.mediaDevices.getUserMedia({
            video: {
                width: { ideal: CONFIG.WEBCAM_WIDTH },
                height: { ideal: CONFIG.WEBCAM_HEIGHT },
                facingMode: 'user'
            }
        });

        // Create video element if not exists
        if (!state.videoElement) {
            state.videoElement = document.createElement('video');
            state.videoElement.setAttribute('playsinline', '');
            state.videoElement.setAttribute('autoplay', '');
            state.videoElement.setAttribute('muted', '');
            state.videoElement.width = CONFIG.WEBCAM_WIDTH;
            state.videoElement.height = CONFIG.WEBCAM_HEIGHT;
            state.videoElement.style.display = 'none';
            document.body.appendChild(state.videoElement);
        }

        state.videoElement.srcObject = state.videoStream;
        await state.videoElement.play();

        // Set canvas dimensions
        if (elements.webcamCanvas) {
            elements.webcamCanvas.width = CONFIG.WEBCAM_WIDTH;
            elements.webcamCanvas.height = CONFIG.WEBCAM_HEIGHT;
        }

        // Wait for video to be ready with actual dimensions
        await new Promise((resolve) => {
            const checkReady = () => {
                if (state.videoElement.readyState >= 2 &&
                    state.videoElement.videoWidth > 0 &&
                    state.videoElement.videoHeight > 0) {
                    resolve();
                } else {
                    setTimeout(checkReady, 100);
                }
            };
            checkReady();
        });

        // Start the test animation loop
        state.isTestMode = true;
        state.animationFrameId = window.requestAnimationFrame(testLoop);

        return true;
    } catch (error) {
        console.error('Error setting up native webcam:', error);
        showFeedback(`Error accessing webcam: ${error.message}`, 'error');
        return false;
    }
}

/**
 * Animation loop for test mode (native webcam)
 */
function testLoop() {
    if (!state.isTestMode || !state.videoElement || !ctx) {
        return;
    }

    // Draw video frame to canvas (flip horizontally for mirror effect)
    ctx.save();
    ctx.scale(-1, 1);
    ctx.drawImage(
        state.videoElement,
        -CONFIG.WEBCAM_WIDTH, 0,
        CONFIG.WEBCAM_WIDTH, CONFIG.WEBCAM_HEIGHT
    );
    ctx.restore();

    state.animationFrameId = window.requestAnimationFrame(testLoop);
}

/**
 * Stop native webcam test
 */
function stopNativeWebcam() {
    state.isTestMode = false;

    if (state.videoStream) {
        state.videoStream.getTracks().forEach(track => track.stop());
        state.videoStream = null;
    }

    if (state.videoElement) {
        state.videoElement.srcObject = null;
    }

    if (state.animationFrameId) {
        window.cancelAnimationFrame(state.animationFrameId);
        state.animationFrameId = null;
    }
}

/**
 * Stop webcam
 */
function stopWebcam() {
    if (state.videoStream) {
        state.videoStream.getTracks().forEach(track => track.stop());
        state.videoStream = null;
    }

    if (state.videoElement) {
        state.videoElement.srcObject = null;
    }

    if (state.animationFrameId) {
        window.cancelAnimationFrame(state.animationFrameId);
        state.animationFrameId = null;
    }
}

// ============================================
// Main Loop & Prediction
// ============================================

/**
 * Main animation loop with accurate timing
 */
async function loop(timestamp) {
    if (!state.videoElement) return;

    // Calculate delta time for accurate duration tracking
    let deltaTime = 0;
    if (state.lastTimestamp !== null && state.isTaskMode && !state.isPaused) {
        deltaTime = (timestamp - state.lastTimestamp) / 1000; // Convert to seconds
    }
    state.lastTimestamp = timestamp;

    await predict(deltaTime);

    state.animationFrameId = window.requestAnimationFrame(loop);
}

/**
 * Run pose prediction
 */
async function predict(deltaTime) {
    if (!state.videoElement || !ctx || !elements.webcamCanvas) return;

    const width = CONFIG.WEBCAM_WIDTH;
    const height = CONFIG.WEBCAM_HEIGHT;

    // Draw video frame (flipped horizontally for mirror/selfie effect)
    ctx.save();
    ctx.scale(-1, 1);
    ctx.drawImage(state.videoElement, -width, 0, width, height);
    ctx.restore();

    // If no model is loaded, just show the webcam feed
    if (!state.model) {
        return;
    }

    try {
        // Estimate pose directly from video element
        // The tmPose library handles resizing internally
        const result = await state.model.estimatePose(state.videoElement);

        // Debug: log first result
        if (!state._debugLogged) {
            console.log('Pose estimation result:', result);
            console.log('Model classes:', state.model.getClassLabels ? state.model.getClassLabels() : 'N/A');
            state._debugLogged = true;
        }

        const pose = result?.pose;
        const posenetOutput = result?.posenetOutput;

        if (!posenetOutput) {
            console.log('No posenetOutput');
            return;
        }

        const prediction = await state.model.predict(posenetOutput);

        // Debug: log first prediction
        if (!state._predictionLogged) {
            console.log('Prediction result:', prediction);
            state._predictionLogged = true;
        }

        // Update visualization in task mode - always update if we have predictions
        if (prediction && prediction.length > 0) {
            // Always update the current pose/confidence display
            const topPred = prediction.reduce((max, p) => p.probability > max.probability ? p : max, prediction[0]);
            if (elements.currentClassDisplay) {
                elements.currentClassDisplay.textContent = topPred.className;
            }
            if (elements.currentProbability) {
                elements.currentProbability.textContent = (topPred.probability * 100).toFixed(1) + '%';
            }

            if (state.isTaskMode && !state.isPaused) {
                updateTaskUI(prediction, deltaTime);
            }
        }

        // Draw pose overlay (need to flip the keypoints to match mirrored video)
        if (pose && pose.keypoints) {
            drawPoseOverlayFlipped(pose, width);
        }

    } catch (error) {
        console.error('Error during prediction:', error);
        // Log more details about the error
        if (!state._errorLogged) {
            console.error('Error details:', error.message, error.stack);
            state._errorLogged = true;
        }
    }
}

/**
 * Update UI during active task
 */
function updateTaskUI(prediction, deltaTime) {
    const threshold = getConfidenceThreshold();

    // Update bar chart
    const labels = prediction.map(pred => pred.className);
    const data = prediction.map(pred => (pred.probability * 100).toFixed(1));
    updateBarChart(labels, data);

    // Find high confidence predictions
    const highConfidence = prediction.filter(pred => pred.probability >= threshold);

    if (highConfidence.length > 0) {
        // Get top prediction
        const topPred = highConfidence.reduce((max, pred) =>
            pred.probability > max.probability ? pred : max, highConfidence[0]);

        // Update duration tracking with accurate delta time
        if (state.classDurations.hasOwnProperty(topPred.className)) {
            state.classDurations[topPred.className] += deltaTime;
        } else {
            state.classDurations[topPred.className] = deltaTime;
        }

        state.currentClass = topPred.className;

        // Update UI displays
        if (elements.currentClassDisplay) {
            elements.currentClassDisplay.textContent = topPred.className;
        }
        if (elements.currentProbability) {
            elements.currentProbability.textContent = (topPred.probability * 100).toFixed(1) + '%';
        }
        if (elements.feedbackMessage) {
            elements.feedbackMessage.textContent = 'Great Pose!';
            elements.feedbackMessage.className = 'pose-feedback great';
        }
    } else {
        state.currentClass = null;

        if (elements.currentClassDisplay) {
            elements.currentClassDisplay.textContent = 'N/A';
        }
        if (elements.currentProbability) {
            elements.currentProbability.textContent = '0%';
        }
        if (elements.feedbackMessage) {
            elements.feedbackMessage.textContent = 'No Pose Detected';
            elements.feedbackMessage.className = 'pose-feedback none';
        }
    }

    // Update timer
    updateTaskTimer();
}

/**
 * Update task timer display
 */
function updateTaskTimer() {
    if (!state.taskStartTime || !elements.taskTimer) return;

    const now = performance.now();
    const elapsed = (now - state.taskStartTime - state.totalPausedTime) / 1000;
    elements.taskTimer.textContent = formatTime(elapsed);
}

/**
 * Draw pose keypoints and skeleton overlay on canvas (flipped to match mirrored video)
 */
function drawPoseOverlayFlipped(pose, canvasWidth) {
    if (!ctx || !pose || !pose.keypoints) return;

    const minConfidence = CONFIG.MIN_POSE_CONFIDENCE;

    // Flip keypoints horizontally to match mirrored video display
    const flippedKeypoints = pose.keypoints.map(kp => ({
        ...kp,
        position: {
            x: canvasWidth - kp.position.x,
            y: kp.position.y
        }
    }));

    // Draw keypoints
    for (const keypoint of flippedKeypoints) {
        if (keypoint.score >= minConfidence) {
            ctx.beginPath();
            ctx.arc(keypoint.position.x, keypoint.position.y, 5, 0, 2 * Math.PI);
            ctx.fillStyle = 'aqua';
            ctx.fill();
        }
    }

    // Draw skeleton lines
    const adjacentKeyPoints = [
        ['leftShoulder', 'rightShoulder'],
        ['leftShoulder', 'leftElbow'],
        ['leftElbow', 'leftWrist'],
        ['rightShoulder', 'rightElbow'],
        ['rightElbow', 'rightWrist'],
        ['leftShoulder', 'leftHip'],
        ['rightShoulder', 'rightHip'],
        ['leftHip', 'rightHip'],
        ['leftHip', 'leftKnee'],
        ['leftKnee', 'leftAnkle'],
        ['rightHip', 'rightKnee'],
        ['rightKnee', 'rightAnkle']
    ];

    // Create a map for quick lookup
    const keypointMap = {};
    flippedKeypoints.forEach(kp => {
        keypointMap[kp.part] = kp;
    });

    ctx.strokeStyle = 'aqua';
    ctx.lineWidth = 2;

    for (const [partA, partB] of adjacentKeyPoints) {
        const kpA = keypointMap[partA];
        const kpB = keypointMap[partB];

        if (kpA && kpB && kpA.score >= minConfidence && kpB.score >= minConfidence) {
            ctx.beginPath();
            ctx.moveTo(kpA.position.x, kpA.position.y);
            ctx.lineTo(kpB.position.x, kpB.position.y);
            ctx.stroke();
        }
    }
}

// ============================================
// Chart Management
// ============================================

/**
 * Initialize or update real-time bar chart
 */
function updateBarChart(labels, data) {
    if (!elements.barChartCanvas) return;

    const chartCtx = elements.barChartCanvas.getContext('2d');

    if (!barChart) {
        barChart = new Chart(chartCtx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Confidence (%)',
                    data: data,
                    backgroundColor: 'rgba(124, 58, 237, 0.7)',
                    borderColor: 'rgba(124, 58, 237, 1)',
                    borderWidth: 2,
                    borderRadius: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: { duration: 100 },
                plugins: {
                    legend: { display: false }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 100,
                        grid: { color: 'rgba(255, 255, 255, 0.1)' },
                        ticks: { color: 'rgba(255, 255, 255, 0.7)' }
                    },
                    x: {
                        grid: { display: false },
                        ticks: { color: 'rgba(255, 255, 255, 0.7)' }
                    }
                }
            }
        });
    } else {
        barChart.data.labels = labels;
        barChart.data.datasets[0].data = data;
        barChart.update('none');
    }
}

/**
 * Create summary chart
 */
function createSummaryChart(labels, data) {
    if (!elements.summaryGraphCanvas) return;

    const chartCtx = elements.summaryGraphCanvas.getContext('2d');

    if (summaryChart) {
        summaryChart.destroy();
    }

    // Generate gradient colors
    const colors = labels.map((_, i) => {
        const hue = (i * 360 / labels.length + 260) % 360;
        return `hsla(${hue}, 70%, 60%, 0.8)`;
    });

    summaryChart = new Chart(chartCtx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Duration (s)',
                data: data,
                backgroundColor: colors,
                borderColor: colors.map(c => c.replace('0.8', '1')),
                borderWidth: 2,
                borderRadius: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: (context) => `${context.parsed.y.toFixed(2)}s`
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: { color: 'rgba(255, 255, 255, 0.1)' },
                    ticks: {
                        color: 'rgba(255, 255, 255, 0.7)',
                        callback: (value) => value + 's'
                    }
                },
                x: {
                    grid: { display: false },
                    ticks: { color: 'rgba(255, 255, 255, 0.7)' }
                }
            }
        }
    });
}

// ============================================
// Countdown
// ============================================

/**
 * Start countdown before task
 */
function startCountdown(duration, callback) {
    if (!elements.countdownElement) {
        callback();
        return;
    }

    let remaining = duration;
    elements.countdownElement.classList.remove('hidden');
    elements.countdownElement.textContent = remaining;

    const interval = setInterval(() => {
        remaining--;
        if (remaining > 0) {
            elements.countdownElement.textContent = remaining;
        } else {
            clearInterval(interval);
            elements.countdownElement.classList.add('hidden');
            callback();
        }
    }, 1000);
}

// ============================================
// Task Control
// ============================================

/**
 * Start the pose tracking task
 */
async function startTask() {
    // Stop any running test webcam first
    stopNativeWebcam();

    // Hide model section
    elements.modelSection?.classList.add('hidden');

    // Start countdown
    startCountdown(CONFIG.COUNTDOWN_DURATION, async () => {
        state.isTaskMode = true;
        state.isPaused = false;
        state.totalPausedTime = 0;
        state.lastTimestamp = null;
        state._debugLogged = false;
        state._predictionLogged = false;
        state._errorLogged = false;

        console.log('Task starting, isTaskMode:', state.isTaskMode);
        console.log('Model loaded:', !!state.model);

        // Setup webcam
        const success = await setupWebcam();
        if (!success) return;

        // Show task UI
        elements.startTaskButton?.classList.add('hidden');
        elements.pauseTaskButton?.classList.remove('hidden');
        elements.endTaskButton?.classList.remove('hidden');
        elements.barChartContainer?.classList.remove('hidden');

        // Reset durations
        Object.keys(state.classDurations).forEach(key => {
            state.classDurations[key] = 0;
        });

        // Start timer
        state.taskStartTime = performance.now();

        showToast('Task started! Strike a pose!', 'success');
    });
}

/**
 * Pause/Resume the task
 */
function togglePause() {
    if (!state.isTaskMode) return;

    if (state.isPaused) {
        // Resume
        if (state.pauseStartTime) {
            state.totalPausedTime += performance.now() - state.pauseStartTime;
        }
        state.isPaused = false;
        state.pauseStartTime = null;
        elements.pauseTaskButton.textContent = '⏸ Pause';
        elements.pauseTaskButton.classList.remove('btn-warning');
        elements.pauseTaskButton.classList.add('btn-secondary');
        showToast('Task resumed', 'success');
    } else {
        // Pause
        state.isPaused = true;
        state.pauseStartTime = performance.now();
        elements.pauseTaskButton.textContent = '▶ Resume';
        elements.pauseTaskButton.classList.remove('btn-secondary');
        elements.pauseTaskButton.classList.add('btn-warning');
        showToast('Task paused', 'success');
    }
}

/**
 * End the task and show summary
 */
function endTask() {
    state.isTaskMode = false;
    state.isPaused = false;

    // Calculate total time
    const totalTime = (performance.now() - state.taskStartTime - state.totalPausedTime) / 1000;

    // Stop webcam
    stopWebcam();

    // Prepare summary data
    const labels = Object.keys(state.classDurations);
    const durations = Object.values(state.classDurations).map(d => parseFloat(d.toFixed(2)));
    const posesDetected = durations.filter(d => d > 0).length;

    // Update summary displays
    if (elements.totalDurationDisplay) {
        elements.totalDurationDisplay.textContent = formatTime(totalTime);
    }
    if (elements.posesDetectedDisplay) {
        elements.posesDetectedDisplay.textContent = posesDetected;
    }

    // Create summary table
    if (elements.summaryContent) {
        let tableHTML = `
            <table class="data-table">
                <thead>
                    <tr>
                        <th>Pose</th>
                        <th>Duration</th>
                        <th>Percentage</th>
                    </tr>
                </thead>
                <tbody>
        `;

        labels.forEach((label, i) => {
            const duration = durations[i];
            const percentage = totalTime > 0 ? ((duration / totalTime) * 100).toFixed(1) : 0;
            tableHTML += `
                <tr>
                    <td>${label}</td>
                    <td>${formatTime(duration)}</td>
                    <td>${percentage}%</td>
                </tr>
            `;
        });

        tableHTML += '</tbody></table>';
        elements.summaryContent.innerHTML = tableHTML;
    }

    // Create summary chart
    createSummaryChart(labels, durations);

    // Save session to history
    saveSession({
        timestamp: new Date().toISOString(),
        totalDuration: totalTime,
        classDurations: { ...state.classDurations },
        posesDetected: posesDetected
    });

    // Show summary section
    elements.taskSection?.classList.add('hidden');
    elements.summarySection?.classList.remove('hidden');

    showToast('Task completed! Great work!', 'success');
}

/**
 * Restart the application
 */
function restart() {
    // Reset state
    state.isTaskMode = false;
    state.isPaused = false;
    state.taskStartTime = null;
    state.lastTimestamp = null;
    state.totalPausedTime = 0;
    state.currentClass = null;

    // Stop webcam (both tmPose and native)
    stopWebcam();
    stopNativeWebcam();

    // Destroy charts
    if (barChart) {
        barChart.destroy();
        barChart = null;
    }
    if (summaryChart) {
        summaryChart.destroy();
        summaryChart = null;
    }

    // Reset durations
    Object.keys(state.classDurations).forEach(key => {
        state.classDurations[key] = 0;
    });

    // Reset UI
    elements.summarySection?.classList.add('hidden');
    elements.taskSection?.classList.add('hidden');
    elements.modelSection?.classList.remove('hidden');
    elements.startTaskButton?.classList.remove('hidden');
    elements.pauseTaskButton?.classList.add('hidden');
    elements.endTaskButton?.classList.add('hidden');
    elements.barChartContainer?.classList.add('hidden');

    if (elements.taskTimer) elements.taskTimer.textContent = '0.00s';
    if (elements.feedbackMessage) elements.feedbackMessage.textContent = '';
    if (elements.pauseTaskButton) {
        elements.pauseTaskButton.textContent = '⏸ Pause';
        elements.pauseTaskButton.classList.remove('btn-warning');
        elements.pauseTaskButton.classList.add('btn-secondary');
    }

    hideFeedback();

    // Reset model URL and disable start task button (but keep test webcam enabled)
    if (elements.modelUrlInput) elements.modelUrlInput.value = '';
    if (elements.startTaskButton) elements.startTaskButton.disabled = true;
    // Keep test webcam button enabled
    state.model = null;
}

// ============================================
// Data Persistence
// ============================================

/**
 * Save session to localStorage
 */
function saveSession(sessionData) {
    try {
        let sessions = JSON.parse(localStorage.getItem(CONFIG.STORAGE_KEY) || '[]');
        sessions.unshift(sessionData);

        // Keep only recent sessions
        if (sessions.length > CONFIG.MAX_HISTORY_ITEMS) {
            sessions = sessions.slice(0, CONFIG.MAX_HISTORY_ITEMS);
        }

        localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify(sessions));
        updateHistoryDisplay();
    } catch (error) {
        console.error('Error saving session:', error);
    }
}

/**
 * Load sessions from localStorage
 */
function loadSessions() {
    try {
        return JSON.parse(localStorage.getItem(CONFIG.STORAGE_KEY) || '[]');
    } catch (error) {
        console.error('Error loading sessions:', error);
        return [];
    }
}

/**
 * Update history display
 */
function updateHistoryDisplay() {
    if (!elements.historyList) return;

    const sessions = loadSessions();

    if (sessions.length === 0) {
        elements.historyList.innerHTML = '<p style="color: var(--text-muted); text-align: center; padding: 2rem;">No sessions yet</p>';
        return;
    }

    let html = '';
    sessions.slice(0, 10).forEach(session => {
        const date = new Date(session.timestamp);
        const dateStr = date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        html += `
            <div class="history-item">
                <span class="history-date">${dateStr}</span>
                <span class="history-duration">${formatTime(session.totalDuration)}</span>
            </div>
        `;
    });

    elements.historyList.innerHTML = html;
}

/**
 * Clear all history
 */
function clearHistory() {
    if (confirm('Are you sure you want to clear all session history?')) {
        localStorage.removeItem(CONFIG.STORAGE_KEY);
        updateHistoryDisplay();
        showToast('History cleared', 'success');
    }
}

// ============================================
// Export Functionality
// ============================================

/**
 * Export current session data as CSV
 */
function exportAsCSV() {
    const labels = Object.keys(state.classDurations);
    const durations = Object.values(state.classDurations);
    const totalTime = durations.reduce((sum, d) => sum + d, 0);

    let csv = 'Pose,Duration (seconds),Percentage\n';
    labels.forEach((label, i) => {
        const duration = durations[i].toFixed(2);
        const percentage = totalTime > 0 ? ((durations[i] / totalTime) * 100).toFixed(1) : 0;
        csv += `"${label}",${duration},${percentage}%\n`;
    });
    csv += `\nTotal,${totalTime.toFixed(2)},100%\n`;

    // Create and download file
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `pose-session-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    showToast('Session exported as CSV', 'success');
}

// ============================================
// Event Listeners
// ============================================

function initializeEventListeners() {
    // Check Model Button
    elements.checkModelButton?.addEventListener('click', async () => {
        const url = elements.modelUrlInput?.value.trim();
        if (!url) {
            showFeedback('Please enter a model URL', 'error');
            return;
        }

        showFeedback('Loading model...', 'loading');
        const success = await loadModel(url);

        if (success) {
            showFeedback('Model loaded successfully!', 'success');
            elements.taskSection?.classList.remove('hidden');
            if (elements.startTaskButton) elements.startTaskButton.disabled = false;
            if (elements.testWebcamButton) elements.testWebcamButton.disabled = false;
            showToast('Model loaded successfully!', 'success');
        } else {
            showFeedback('Failed to load model. Please check the URL.', 'error');
        }
    });

    // Test Webcam Button
    elements.testWebcamButton?.addEventListener('click', async () => {
        state.isTaskMode = false;
        // Show task section for webcam preview
        elements.taskSection?.classList.remove('hidden');
        elements.barChartContainer?.classList.add('hidden');

        // Use native webcam for test mode (more reliable without model)
        const success = await setupNativeWebcam();
        if (success) {
            elements.testWebcamButton?.classList.add('hidden');
            elements.stopTestWebcamButton?.classList.remove('hidden');
            showFeedback('Webcam test running...', 'success');
        }
    });

    // Stop Test Webcam Button
    elements.stopTestWebcamButton?.addEventListener('click', () => {
        // Stop native webcam test
        stopNativeWebcam();
        elements.stopTestWebcamButton?.classList.add('hidden');
        elements.testWebcamButton?.classList.remove('hidden');
        // Hide task section if no model is loaded
        if (!state.model) {
            elements.taskSection?.classList.add('hidden');
        }
        showFeedback('Webcam test stopped', 'success');
    });

    // Start Task Button
    elements.startTaskButton?.addEventListener('click', startTask);

    // Pause Task Button
    elements.pauseTaskButton?.addEventListener('click', togglePause);

    // End Task Button
    elements.endTaskButton?.addEventListener('click', endTask);

    // Export Button
    elements.exportButton?.addEventListener('click', exportAsCSV);

    // Restart Button
    elements.restartButton?.addEventListener('click', restart);

    // Clear History Button
    elements.clearHistoryButton?.addEventListener('click', clearHistory);

    // Threshold Input
    elements.thresholdInput?.addEventListener('change', () => {
        const value = parseFloat(elements.thresholdInput.value);
        if (value < 0 || value > 100) {
            elements.thresholdInput.value = CONFIG.CONFIDENCE_THRESHOLD * 100;
        }
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        if (e.code === 'Space' && state.isTaskMode) {
            e.preventDefault();
            togglePause();
        }
        if (e.code === 'Escape' && state.isTaskMode) {
            e.preventDefault();
            endTask();
        }
    });
}

// ============================================
// Initialization
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    initializeEventListeners();
    updateHistoryDisplay();

    // Initially hide task and summary sections
    elements.taskSection?.classList.add('hidden');
    elements.summarySection?.classList.add('hidden');

    console.log('Pose Duration Tracker initialized');
});

