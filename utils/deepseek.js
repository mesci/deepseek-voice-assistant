import axios from 'axios';

export async function sendMessageToDeepSeek(message) {
  try {
    const response = await axios.post(
      'https://api.deepseek.com/chat/completions',
      {
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: 'Sen telefon görüşmesinde bir asistansın. Kısa ve net cevaplar ver.' },
          { role: 'user', content: message }
        ],
        max_tokens: 150,
        temperature: 0.7,
        stream: false
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`
        }
      }
    );
    
    console.log('DeepSeek API response:', response.data);
    return response.data.choices[0].message.content;
  } catch (error) {
    console.error('DeepSeek API Error:', error.response?.data || error.message);
    throw new Error('DeepSeek API ile iletişim kurulamadı');
  }
}