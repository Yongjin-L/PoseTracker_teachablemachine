# 🎯 Pose Duration Tracker

A modern web application for tracking pose durations using Teachable Machine pose models. Features real-time feedback, accurate timing, session history, and data export.

**Live Demo:** [https://mc25.onrender.com/](https://mc25.onrender.com/)

![Pose Tracker Screenshot](https://via.placeholder.com/800x400/0f0f23/7c3aed?text=Pose+Duration+Tracker)

## ✨ Features

- **🤖 AI-Powered Detection** - Load any Teachable Machine pose model via URL
- **📊 Real-time Visualization** - Live confidence charts and pose skeleton overlay
- **⏱️ Accurate Timing** - Frame-accurate duration tracking using delta time
- **⏸️ Pause/Resume** - Full control over your tracking sessions
- **💾 Session History** - Automatic saving to local storage
- **📥 CSV Export** - Download your session data for analysis
- **⌨️ Keyboard Shortcuts** - Space to pause, Escape to end
- **📱 Responsive Design** - Works on desktop and mobile devices
- **♿ Accessible** - Keyboard navigation and screen reader support

## 🚀 Quick Start

### Prerequisites

- Python 3.8+
- Modern web browser (Chrome, Firefox, Safari, Edge)
- Webcam

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/PoseTracker_teachablemachine.git
   cd PoseTracker_teachablemachine
   ```

2. **Create virtual environment** (recommended)
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

3. **Install dependencies**
   ```bash
   pip install -r requirements.txt
   ```

4. **Run the application**
   ```bash
   # Development mode
   FLASK_ENV=development python app.py
   
   # Production mode
   python app.py
   ```

5. **Open in browser**
   Navigate to `http://localhost:5000`

## 📖 Usage

### 1. Load Your Model

Enter a Teachable Machine pose model URL:
```
https://teachablemachine.withgoogle.com/models/YOUR_MODEL_ID/
```

### 2. Configure Settings

- **Confidence Threshold** - Minimum confidence % to count as a detected pose (default: 80%)

### 3. Test Your Webcam

Click "Test Webcam" to verify your camera is working correctly before starting.

### 4. Start Tracking

1. Click **Start Task**
2. Wait for the 5-second countdown
3. Strike your poses!
4. Use **Space** to pause/resume
5. Use **Escape** or click **End Task** to finish

### 5. Review & Export

- View your session summary with duration breakdown
- Export data as CSV for further analysis
- Session history is automatically saved

## 🔧 Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `SECRET_KEY` | Flask secret key for sessions | Random bytes |
| `FLASK_ENV` | Set to `development` for debug mode | `production` |
| `PORT` | Server port | `5000` |

### Example `.env` file

```env
SECRET_KEY=your-super-secret-key-here
FLASK_ENV=development
PORT=5000
```

## 📁 Project Structure

```
PoseTracker_teachablemachine/
├── app.py                 # Flask application
├── requirements.txt       # Python dependencies
├── README.md             # This file
├── netlify.toml          # Netlify configuration
├── templates/
│   └── index.html        # Main HTML template
└── static/
    ├── css/
    │   └── styles.css    # Modern styling
    └── js/
        └── pose-tracker.js  # Application logic
```

## 🎨 Creating a Teachable Machine Model

1. Visit [Teachable Machine](https://teachablemachine.withgoogle.com/)
2. Click **Get Started** → **Pose Project**
3. Create classes for each pose you want to track
4. Train your model using the webcam
5. Click **Export Model** → **Tensorflow.js** → **Upload**
6. Copy the shareable URL

## 🛠️ Development

### Running in Development Mode

```bash
FLASK_ENV=development python app.py
```

### Running with Gunicorn (Production)

```bash
gunicorn app:app --bind 0.0.0.0:5000
```

## 🚀 Deployment

### Render

1. Connect your GitHub repository
2. Set build command: `pip install -r requirements.txt`
3. Set start command: `gunicorn app:app`
4. Add environment variables as needed

### Heroku

```bash
heroku create your-app-name
git push heroku main
```

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📝 License

MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [Teachable Machine](https://teachablemachine.withgoogle.com/) by Google
- [TensorFlow.js](https://www.tensorflow.org/js)
- [Chart.js](https://www.chartjs.org/)
- [Flask](https://flask.palletsprojects.com/)

---

Made with ❤️ by Yongjin Lee
