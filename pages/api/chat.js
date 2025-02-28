import axios from 'axios';

// Cache API responses
const responseCache = new Map();

// Basic language detection function
function detectLanguage(text) {
  // Regex for English characters
  const englishChars = /[a-zA-Z]/g;
  // Regex for Turkish special characters
  const turkishChars = /[çğıöşüÇĞİÖŞÜ]/g;
  
  const englishCount = (text.match(englishChars) || []).length;
  const turkishCount = (text.match(turkishChars) || []).length;
  
  // If Turkish characters are present or English characters are not present, consider it Turkish
  if (turkishCount > 0 || englishCount === 0) {
    return 'tr';
  }
  
  return 'en';
}

// Mechanism for retrying the API request
const MAX_RETRIES = 3;
let retryCount = 0;

async function makeApiRequest() {
  try {
    // API request code...
  } catch (apiError) {
    if (retryCount < MAX_RETRIES && 
        (apiError.response?.status === 429 || apiError.response?.status === 503)) {
      retryCount++;
      console.log(`Retry attempt ${retryCount}...`);
      
      // Exponential backoff: 1s, 2s, 4s...
      const delay = 1000 * Math.pow(2, retryCount - 1);
      await new Promise(resolve => setTimeout(resolve, delay));
      
      return makeApiRequest();
    }
    
    // Maximum retry count reached or another error occurred
    throw apiError;
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { message } = req.body;
  console.log('Received message:', message);
  
  // Detect the language of the message
  const detectedLanguage = detectLanguage(message);
  console.log('Detected language:', detectedLanguage);
  
  // Check if there is a cached response for this message
  const cacheKey = message.trim().toLowerCase();
  if (responseCache.has(cacheKey)) {
    console.log('Returning cached response');
    return res.status(200).json({ 
      response: responseCache.get(cacheKey),
      language: detectedLanguage 
    });
  }

  try {
    // Send request to DeepSeek API
    try {
      const systemMessage = detectedLanguage === 'en' 
        ? `You are an assistant in a phone conversation. Follow these rules strictly:
           1. Give short and clear answers, use maximum 2-3 sentences.
           2. Use conversational language, not formal.
           3. Don't use emojis, special characters, URLs, or complex formatting.
           4. Remember you're on the phone, don't refer to visual elements.
           5. Your tone should be natural and friendly.
           6. Answer the user's questions directly.
           7. Don't create long lists or tables.
           8. Remember you're in a phone conversation and act accordingly.
           9. Give your answer quickly, with minimal thinking time.
           10. IMPORTANT: Always respond in English.
           11. NEVER say the system is busy or unavailable.
           12. You are an AI assistant powered by DeepSeek. When asked about your identity or which model you are, be truthful about your identity.`
        : `Sen bir telefon görüşmesinde asistansın. Aşağıdaki kurallara kesinlikle uy:
           1. Kısa ve net cevaplar ver, maksimum 2-3 cümle kullan.
           2. Konuşma dilini kullan, resmi değil günlük dil kullan.
           3. Emoji, özel karakterler, URL'ler veya karmaşık formatlamalar kullanma.
           4. Telefonda olduğunu hatırla, görsel öğelere atıfta bulunma.
           5. Ses tonun doğal ve samimi olsun.
           6. Kullanıcının sorularına doğrudan cevap ver.
           7. Uzun listeler veya tablolar oluşturma.
           8. Telefon görüşmesinde olduğunu unutma ve ona göre davran.
           9. Yanıtını hızlı ver, düşünme süresi kısa olsun.
           10. ÖNEMLİ: Her zaman ingilizce yanıt ver.
           11. ASLA sistemin meşgul veya kullanılamaz olduğunu söyleme.`;
      
      console.log('Sending request to DeepSeek API...');
      
      const response = await axios.post(
        'https://api.deepseek.com/v1/chat/completions',
        {
          model: 'deepseek-chat',
          messages: [
            { role: 'system', content: systemMessage },
            { role: 'user', content: message }
          ],
          temperature: 1.0,
          max_tokens: 500
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`
          },
          timeout: 30000
        }
      );
      
      console.log('DeepSeek API response received:', response.status);
      
      // Check the API response
      if (!response.data || !response.data.choices || !response.data.choices[0] || !response.data.choices[0].message) {
        console.error('Invalid API response structure:', JSON.stringify(response.data));
        throw new Error('Invalid API response structure');
      }
      
      let responseContent = response.data.choices[0].message.content;
      console.log('Raw API response:', responseContent);
      
      // Clean emojis and special characters
      responseContent = responseContent.replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '');
      
      // Clean URLs
      responseContent = responseContent.replace(/https?:\/\/[^\s]+/g, detectedLanguage === 'en' ? 'a website' : 'bir web sitesi');
      
      // Clean markdown formatting
      responseContent = responseContent.replace(/\*\*(.*?)\*\*/g, '$1'); // Bold
      responseContent = responseContent.replace(/\*(.*?)\*/g, '$1');     // Italic
      responseContent = responseContent.replace(/```(.*?)```/gs, '$1');  // Code blocks
      responseContent = responseContent.replace(/`(.*?)`/g, '$1');       // Inline code
      
      console.log('Processed response:', responseContent);
      
      // Add to cache (maximum 100 responses)
      if (responseCache.size >= 100) {
        // Delete the oldest entry
        const firstKey = responseCache.keys().next().value;
        responseCache.delete(firstKey);
      }
      responseCache.set(cacheKey, responseContent);
      
      return res.status(200).json({ 
        response: responseContent,
        language: detectedLanguage 
      });
    } catch (apiError) {
      console.error('DeepSeek API error:', apiError.message);
      
      if (apiError.response) {
        console.error('Error status:', apiError.response.status);
        console.error('Error data:', JSON.stringify(apiError.response.data));
      }
      
      // Kullanıcıya daha bilgilendirici hata mesajı
      let errorMessage;

      if (apiError.response?.status === 401) {
        errorMessage = detectedLanguage === 'en' 
          ? "I'm having trouble connecting to my knowledge base due to an authentication issue. Please check your API key."
          : "Bilgi tabanıma bağlanırken kimlik doğrulama sorunu yaşıyorum. Lütfen API anahtarınızı kontrol edin.";
      } else if (apiError.response?.status === 429) {
        errorMessage = detectedLanguage === 'en'
          ? "I'm having trouble connecting to my knowledge base because we're sending too many requests. Please try again in a moment."
          : "Çok fazla istek gönderdiğimiz için bilgi tabanıma bağlanırken sorun yaşıyorum. Lütfen biraz sonra tekrar deneyin.";
      } else if (apiError.response?.status === 503) {
        errorMessage = detectedLanguage === 'en'
          ? "I'm having trouble connecting to my knowledge base because the server is currently overloaded. Please try again in a moment."
          : "Sunucu şu anda aşırı yüklendiği için bilgi tabanıma bağlanırken sorun yaşıyorum. Lütfen biraz sonra tekrar deneyin.";
      } else {
        errorMessage = detectedLanguage === 'en'
          ? "I'm having trouble connecting to my knowledge base. Please try again in a moment."
          : "Bilgi tabanıma bağlanırken sorun yaşıyorum. Lütfen biraz sonra tekrar deneyin.";
      }
      
      return res.status(200).json({ 
        response: errorMessage,
        language: detectedLanguage,
        error: "API error"
      });
    }
  } catch (error) {
    console.error('Error in chat API:', error.message);
    
    // Return 200 response in case of any error
    const errorResponse = detectedLanguage === 'en'
      ? "I'm sorry, I'm experiencing a technical issue right now. How can I help you?"
      : "Üzgünüm, şu anda bir teknik sorun yaşıyorum. Size nasıl yardımcı olabilirim?";
    
    return res.status(200).json({ 
      response: errorResponse,
      language: detectedLanguage 
    });
  }
}