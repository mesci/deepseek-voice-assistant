<p align="center">
  <img src="logo.svg" alt="SeekVoice Logo" width="500"/>
</p>

# SeekVoice - DeepSeek AI Voice Assistant

SeekVoice is a voice assistant project developed using the DeepSeek AI model. This browser-based application allows users to give voice commands and receive voice responses from AI.

## 🚀 Features

- **Voice Command Recognition**: Converts voice commands to text using Web Speech API
- **AI Responses**: Generates intelligent responses using DeepSeek AI model
- **Voice Responses**: Converts text responses to speech using Speech Synthesis API
- **Visual Feedback**: Visually displays listening, thinking, and speaking states
- **Caching Mechanism**: Uses cache for quick responses to frequently asked questions

## 🛠️ Technologies

- **Frontend**: Next.js, React
- **AI**: DeepSeek API
- **Speech Recognition**: Web Speech API
- **Text-to-Speech Conversion**: Speech Synthesis API
- **Language Detection**: Franc library

## 🔧 Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/deepseek-voice-assistant.git
   cd deepseek-voice-assistant
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a `.env.local` file and add your DeepSeek API key:
   ```
   DEEPSEEK_API_KEY=your_api_key_here
   ```

4. Start the application:
   ```bash
   npm run dev
   ```

5. Go to `http://localhost:3000` in your browser

## 🌐 Browser Compatibility

For the best experience, **Google Chrome** is recommended. The Web Speech API and Speech Synthesis API have the most consistent support in Chrome. Other browsers may have limited functionality or unexpected behavior.

## ⚠️ Known Issues

- **Memory Issue**: It has no memory at the moment, can't remember previous messages, any solution to this issue would be appreciated.

- **API Authentication Error**: Users may occasionally encounter a "I'm having trouble connecting to my knowledge base" error. This is related to API authentication issues with the DeepSeek API. The root cause is still under investigation. If you encounter this error, try refreshing the page or waiting a few minutes before trying again.

- **Long Response Cutoff**: Sometimes, when the AI generates a long response, the speech synthesis may stop prematurely. This is a known limitation of the Speech Synthesis API in browsers.

## 🤝 Contributing

This project is still in a very primitive stage and is open for development. Please feel free to fork and send pull requests. All contributions are welcome!

Areas that can be improved:
- More language support
- Better error handling
- User interface improvements
- Support for more AI models
- Improving speech recognition accuracy
- Fixing the API authentication issues

## ⚠️ Note

This project was developed with the help of AI and is for experimental purposes. It is recommended to perform security and performance tests before using it in a production environment.
