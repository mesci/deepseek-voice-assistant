import formidable from 'formidable';
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import util from 'util';

const execPromise = util.promisify(exec);

// Next.js config for handling FormData
export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('Transcribe API called');
    
    // Get the audio file
    const form = new formidable.IncomingForm();
    form.uploadDir = path.join(process.cwd(), 'tmp');
    form.keepExtensions = true;
    
    // Create temporary directory
    if (!fs.existsSync(form.uploadDir)) {
      fs.mkdirSync(form.uploadDir, { recursive: true });
    }
    
    const [fields, files] = await new Promise((resolve, reject) => {
      form.parse(req, (err, fields, files) => {
        if (err) reject(err);
        resolve([fields, files]);
      });
    });
    
    if (!files.audio) {
      return res.status(400).json({ error: 'Audio file not found' });
    }
    
    const audioFile = files.audio;
    console.log('Audio file received:', audioFile.filepath);
    
    // Return a test response for now
    return res.status(200).json({ 
      transcript: "This is a test transcription. The real voice recognition service is not integrated." 
    });
    
    /* 
    // Example of using Vosk (using Python script):
    const { stdout, stderr } = await execPromise(
      `python scripts/transcribe.py ${audioFile.filepath}`
    );
    
    if (stderr) {
      console.error('Vosk error:', stderr);
    }
    
    return res.status(200).json({ transcript: stdout.trim() });
    */
  } catch (error) {
    console.error('Transcription error:', error);
    return res.status(500).json({ 
      error: 'Internal Server Error',
      message: error.message 
    });
  }
}