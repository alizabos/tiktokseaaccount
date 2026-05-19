import 'dotenv/config';
import express from 'express';
import multer from 'multer';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json({ limit: '50mb' }));

const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
app.use('/uploads', express.static(uploadsDir));

const storage = multer.diskStorage({
  destination: uploadsDir,
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname) || '.png';
    cb(null, uniqueSuffix + ext);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 },
});

app.post('/api/upload', upload.array('images', 10), (req, res) => {
  try {
    const files = req.files.map((file, index) => {
      const filePath = path.join(uploadsDir, file.filename);
      const data = fs.readFileSync(filePath);
      const base64 = data.toString('base64');
      const mimeType = file.mimetype || 'image/png';
      const dataUrl = `data:${mimeType};base64,${base64}`;

      return {
        id: index,
        label: `@${String(index + 1).padStart(2, '0')}`,
        filename: file.filename,
        url: `/uploads/${file.filename}`,
        dataUrl,
      };
    });

    res.json({ success: true, images: files });
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/generate', async (req, res) => {
  try {
    const { prompt, images, size, n, apiKey: clientApiKey } = req.body;

    if (!prompt) {
      return res.status(400).json({ success: false, error: '缺少 prompt' });
    }

    const apiKey = clientApiKey || process.env.YUNWU_API_KEY;
    if (!apiKey || apiKey === '你的API_KEY') {
      return res.status(400).json({
        success: false,
        error: '请先设置 API Key',
      });
    }

    const body = {
      model: 'gpt-image-2-all',
      prompt,
      size: size || '1024x1024',
      n: n || 1,
    };

    if (images && images.length > 0) {
      body.image = images.map((img) => img.dataUrl || img.url || img);
    }

    console.log('Calling yunwu.ai with prompt:', prompt.substring(0, 80) + '...');

    const response = await fetch(`${process.env.YUNWU_API_BASE || 'https://yunwu.ai'}/v1/images/generations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'Accept': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('API error:', data);
      return res.status(response.status).json({
        success: false,
        error: data.error?.message || JSON.stringify(data),
      });
    }

    const resultImages = (data.data || []).map((item) => ({
      url: item.url,
      revised_prompt: item.revised_prompt || '',
    }));

    res.json({ success: true, images: resultImages, created: data.created });
  } catch (err) {
    console.error('Generate error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/optimize-prompt', async (req, res) => {
  try {
    const { original, apiKey: clientApiKey } = req.body;

    if (!original || !original.trim()) {
      return res.status(400).json({ success: false, error: '缺少待优化的提示词' });
    }

    const apiKey = clientApiKey || process.env.YUNWU_API_KEY;
    if (!apiKey || apiKey === '你的API_KEY') {
      return res.status(400).json({ success: false, error: '请先设置 API Key' });
    }

    const systemPrompt = `你是一个专业的 AI 图片生成提示词（Prompt）优化专家。用户会给你一段用于生成图片的原始提示词，你需要将其优化为更专业、更详细、更能生成高质量图片的提示词。

## 你的核心优化原则：
1. **保留核心意图**：不要改变用户想要的主体、风格、场景，可以增加细节但不能违背原意
2. **增加具体细节**：补充光源描述（如"柔和的自然光"、"霓虹灯光"）、质感描述（如"金属光泽"、"毛绒质感"）、构图描述（如"低角度广角"、"特写"）
3. **风格化语言**：根据原始提示词的风格倾向，用更专业的美术/摄影用语重写
4. **保留 @引用**：如果原提示词中含有 @01、@02 等图片引用标记，必须原样保留不修改
5. **简洁输出**：直接输出优化后的提示词，不要加任何解释、前缀或后缀。不要用引号包裹。

## 如果原提示词很短（少于10个字），请大胆扩展补充细节。
## 如果原提示词已经比较完整，只做小幅润色优化，保持原风格。`;

    console.log('Optimizing prompt:', original.substring(0, 80) + '...');

    const response = await fetch(`${process.env.YUNWU_API_BASE || 'https://yunwu.ai'}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-5.5',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: original },
        ],
        temperature: 0.7,
        max_tokens: 2000,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Optimize API error:', data);
      return res.status(response.status).json({
        success: false,
        error: data.error?.message || JSON.stringify(data),
      });
    }

    const optimized = data.choices?.[0]?.message?.content || '';
    res.json({ success: true, optimized: optimized.trim() });
  } catch (err) {
    console.error('Optimize error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 后端服务已启动: http://localhost:${PORT}`);
  console.log(`📁 上传目录: ${uploadsDir}`);
});
