import 'dotenv/config';
import express from 'express';
import multer from 'multer';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

function fetchWithTimeout(url, options = {}, timeoutMs = 120000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { ...options, signal: controller.signal }).finally(() =>
    clearTimeout(timeout),
  );
}

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

app.post('/api/upload', upload.array('images', 10), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ success: false, error: '请选择至少一张图片' });
    }

    const files = await Promise.all(
      req.files.map(async (file, index) => {
        const filePath = path.join(uploadsDir, file.filename);
        const data = await fs.promises.readFile(filePath);
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
      }),
    );

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

    const response = await fetchWithTimeout(
      `${process.env.YUNWU_API_BASE || 'https://yunwu.ai'}/v1/images/generations`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
          Accept: 'application/json',
        },
        body: JSON.stringify(body),
      },
      120000,
    );

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
    const message = err.name === 'AbortError' ? '请求超时，请稍后重试' : err.message;
    res.status(500).json({ success: false, error: message });
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

    const response = await fetchWithTimeout(
      `${process.env.YUNWU_API_BASE || 'https://yunwu.ai'}/v1/chat/completions`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
          Accept: 'application/json',
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
      },
      60000,
    );

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
    const message = err.name === 'AbortError' ? '请求超时，请稍后重试' : err.message;
    res.status(500).json({ success: false, error: message });
  }
});

// ===== 视频模块 =====

// 创建视频（Veo 3.1 系列）
app.post('/api/video/create', async (req, res) => {
  try {
    const { prompt, images, model, aspectRatio, enhancePrompt, enableUpsample, apiKey: clientApiKey } = req.body;

    if (!prompt) {
      return res.status(400).json({ success: false, error: '缺少 prompt' });
    }

    const apiKey = clientApiKey || process.env.YUNWU_API_KEY;
    if (!apiKey || apiKey === '你的API_KEY') {
      return res.status(400).json({ success: false, error: '请先设置 API Key' });
    }

    const validModels = ['veo_3_1', 'veo_3_1-fast', 'veo3.1-pro', 'veo3.1', 'veo3.1-fast', 'veo3.1-pro-4k'];
    const videoModel = model || 'veo_3_1-fast';
    if (!validModels.includes(videoModel)) {
      return res.status(400).json({ success: false, error: `不支持的模型: ${videoModel}，可选: ${validModels.join(', ')}` });
    }

    const body = {
      model: videoModel,
      prompt,
      enhance_prompt: enhancePrompt !== false,
      enable_upsample: enableUpsample !== false,
      aspect_ratio: aspectRatio || '9:16',
    };

    if (images && images.length > 0) {
      body.images = images.map((img) => img.dataUrl || img.url || img);
    }

    console.log('Creating video with model:', videoModel, 'prompt:', prompt.substring(0, 80) + '...');

    const response = await fetchWithTimeout(
      `${process.env.YUNWU_API_BASE || 'https://yunwu.ai'}/v1/video/create`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
          Accept: 'application/json',
        },
        body: JSON.stringify(body),
      },
      60000,
    );

    const data = await response.json();

    if (!response.ok) {
      console.error('Video create error:', data);
      return res.status(response.status).json({
        success: false,
        error: data.error?.message || JSON.stringify(data),
      });
    }

    res.json({ success: true, taskId: data.id, status: data.status });
  } catch (err) {
    console.error('Video create error:', err);
    const message = err.name === 'AbortError' ? '请求超时，请稍后重试' : err.message;
    res.status(500).json({ success: false, error: message });
  }
});

// 查询视频任务状态
app.post('/api/video/query', async (req, res) => {
  try {
    const { taskId, apiKey: clientApiKey } = req.body;

    if (!taskId) {
      return res.status(400).json({ success: false, error: '缺少 taskId' });
    }

    const apiKey = clientApiKey || process.env.YUNWU_API_KEY;
    if (!apiKey || apiKey === '你的API_KEY') {
      return res.status(400).json({ success: false, error: '请先设置 API Key' });
    }

    const response = await fetchWithTimeout(
      `${process.env.YUNWU_API_BASE || 'https://yunwu.ai'}/v1/video/query`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
          Accept: 'application/json',
        },
        body: JSON.stringify({ id: taskId }),
      },
      30000,
    );

    const data = await response.json();

    if (!response.ok) {
      console.error('Video query error:', data);
      return res.status(response.status).json({
        success: false,
        error: data.error?.message || JSON.stringify(data),
      });
    }

    res.json({ success: true, ...data });
  } catch (err) {
    console.error('Video query error:', err);
    const message = err.name === 'AbortError' ? '请求超时，请稍后重试' : err.message;
    res.status(500).json({ success: false, error: message });
  }
});

// 视频识别分析（gemini-3.1-pro-preview）
app.post('/api/video/analyze', async (req, res) => {
  try {
    const { videoUrl, prompt, apiKey: clientApiKey } = req.body;

    if (!videoUrl && !prompt) {
      return res.status(400).json({ success: false, error: '请提供视频 URL 或描述' });
    }

    const apiKey = clientApiKey || process.env.YUNWU_API_KEY;
    if (!apiKey || apiKey === '你的API_KEY') {
      return res.status(400).json({ success: false, error: '请先设置 API Key' });
    }

    const systemPrompt = `你是一个专业的短视频分析专家，擅长拆解 TikTok 爆款视频的结构和元素。

请分析用户提供的视频，输出以下结构化信息（JSON 格式）：
1. "hook" - 前3秒钩子分析（画面、文案、情绪）
2. "scenes" - 分镜列表（每个分镜的画面描述、时长、转场方式）
3. "script" - 口播文案/字幕
4. "bgm" - 背景音乐风格描述
5. "viral_elements" - 爆款元素（节奏、情绪点、视觉冲击点等）
6. "style" - 整体风格标签

只输出 JSON，不要加任何其他文字。`;

    const messages = [{ role: 'system', content: systemPrompt }];

    if (videoUrl) {
      messages.push({
        role: 'user',
        content: [
          { type: 'text', text: '请分析这个视频的结构和爆款元素：' },
          { type: 'image_url', image_url: { url: videoUrl } },
        ],
      });
    } else {
      messages.push({ role: 'user', content: `请基于以下描述分析视频结构：${prompt}` });
    }

    console.log('Analyzing video...');

    const response = await fetchWithTimeout(
      `${process.env.YUNWU_API_BASE || 'https://yunwu.ai'}/v1/chat/completions`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
          Accept: 'application/json',
        },
        body: JSON.stringify({
          model: 'gemini-3.1-pro-preview',
          messages,
          temperature: 0.3,
          max_tokens: 4000,
        }),
      },
      60000,
    );

    const data = await response.json();

    if (!response.ok) {
      console.error('Analyze error:', data);
      return res.status(response.status).json({
        success: false,
        error: data.error?.message || JSON.stringify(data),
      });
    }

    let analysisText = data.choices?.[0]?.message?.content || '';
    // 尝试解析 JSON
    let analysis;
    try {
      // 移除可能的 markdown 代码块标记
      const jsonStr = analysisText.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
      analysis = JSON.parse(jsonStr);
    } catch {
      analysis = { raw: analysisText };
    }

    res.json({ success: true, analysis });
  } catch (err) {
    console.error('Analyze error:', err);
    const message = err.name === 'AbortError' ? '请求超时，请稍后重试' : err.message;
    res.status(500).json({ success: false, error: message });
  }
});

// 脚本复刻（gemini-3.1-pro-preview）
app.post('/api/video/recreate-script', async (req, res) => {
  try {
    const { analysis, productInfo, images, apiKey: clientApiKey } = req.body;

    if (!analysis) {
      return res.status(400).json({ success: false, error: '缺少爆款视频分析结果' });
    }

    const apiKey = clientApiKey || process.env.YUNWU_API_KEY;
    if (!apiKey || apiKey === '你的API_KEY') {
      return res.status(400).json({ success: false, error: '请先设置 API Key' });
    }

    const systemPrompt = `你是一个专业的短视频编剧，擅长基于爆款视频复刻出新的脚本。

用户会提供一个爆款视频的分析结果，以及产品信息。你需要：
1. 保留原视频的爆款结构（钩子、节奏、情绪点）
2. 将内容替换为新产品相关
3. 输出新的分镜脚本，每个分镜包含：
   - scene_number: 分镜序号
   - duration: 时长（秒）
   - visual: 画面描述（用于生成图片的 prompt）
   - camera: 运镜方式
   - voiceover: 口播文案
   - transition: 转场方式

只输出 JSON 数组，不要加任何其他文字。`;

    const userContent = `爆款视频分析：\n${JSON.stringify(analysis, null, 2)}\n\n产品信息：${productInfo || '未提供'}`;

    console.log('Recreating script based on viral video analysis...');

    const response = await fetchWithTimeout(
      `${process.env.YUNWU_API_BASE || 'https://yunwu.ai'}/v1/chat/completions`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
          Accept: 'application/json',
        },
        body: JSON.stringify({
          model: 'gemini-3.1-pro-preview',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userContent },
          ],
          temperature: 0.7,
          max_tokens: 4000,
        }),
      },
      60000,
    );

    const data = await response.json();

    if (!response.ok) {
      console.error('Recreate error:', data);
      return res.status(response.status).json({
        success: false,
        error: data.error?.message || JSON.stringify(data),
      });
    }

    let scriptText = data.choices?.[0]?.message?.content || '';
    let scenes;
    try {
      const jsonStr = scriptText.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
      scenes = JSON.parse(jsonStr);
    } catch {
      scenes = { raw: scriptText };
    }

    res.json({ success: true, scenes });
  } catch (err) {
    console.error('Recreate error:', err);
    const message = err.name === 'AbortError' ? '请求超时，请稍后重试' : err.message;
    res.status(500).json({ success: false, error: message });
  }
});

// 分镜图片生成（gpt-image-2-all，复用现有图片生成逻辑）
app.post('/api/video/generate-storyboard', async (req, res) => {
  try {
    const { scenes, apiKey: clientApiKey } = req.body;

    if (!scenes || !Array.isArray(scenes) || scenes.length === 0) {
      return res.status(400).json({ success: false, error: '缺少分镜数据' });
    }

    const apiKey = clientApiKey || process.env.YUNWU_API_KEY;
    if (!apiKey || apiKey === '你的API_KEY') {
      return res.status(400).json({ success: false, error: '请先设置 API Key' });
    }

    const results = [];
    const size = '1024x1820'; // 9:16 竖版，适合 TikTok

    for (const scene of scenes) {
      const prompt = scene.visual || scene.prompt;
      if (!prompt) continue;

      console.log(`Generating storyboard image for scene ${scene.scene_number}...`);

      const body = {
        model: 'gpt-image-2-all',
        prompt,
        size,
        n: 1,
      };

      const response = await fetchWithTimeout(
        `${process.env.YUNWU_API_BASE || 'https://yunwu.ai'}/v1/images/generations`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
            Accept: 'application/json',
          },
          body: JSON.stringify(body),
        },
        120000,
      );

      const data = await response.json();

      if (response.ok && data.data && data.data.length > 0) {
        results.push({
          scene_number: scene.scene_number,
          url: data.data[0].url,
          revised_prompt: data.data[0].revised_prompt || '',
        });
      } else {
        results.push({
          scene_number: scene.scene_number,
          error: data.error?.message || '生成失败',
        });
      }
    }

    res.json({ success: true, images: results });
  } catch (err) {
    console.error('Storyboard generate error:', err);
    const message = err.name === 'AbortError' ? '请求超时，请稍后重试' : err.message;
    res.status(500).json({ success: false, error: message });
  }
});

// ===== 人设模块 =====

app.get('/api/weather', async (req, res) => {
  try {
    const { city } = req.query;
    if (!city) {
      return res.status(400).json({ success: false, error: '缺少 city 参数' });
    }

    const geoRes = await fetchWithTimeout(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=zh`,
      {},
      10000,
    );
    const geoData = await geoRes.json();

    if (!geoData.results || geoData.results.length === 0) {
      return res.status(400).json({ success: false, error: `未找到城市: ${city}` });
    }

    const { latitude, longitude, name, country } = geoData.results[0];

    const weatherRes = await fetchWithTimeout(
      `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&daily=temperature_2m_max,temperature_2m_min,weather_code,precipitation_probability_max&timezone=auto&forecast_days=1`,
      {},
      10000,
    );
    const weatherData = await weatherRes.json();

    const daily = weatherData.daily;
    res.json({
      success: true,
      weather: {
        city: name,
        country: country || '',
        maxTemp: daily.temperature_2m_max[0],
        minTemp: daily.temperature_2m_min[0],
        weatherCode: daily.weather_code[0],
        precipProbability: daily.precipitation_probability_max[0],
        date: daily.time[0],
      },
    });
  } catch (err) {
    console.error('Weather error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/persona/generate', async (req, res) => {
  try {
    const { profile, weather, apiKey: clientApiKey } = req.body;

    if (!profile) {
      return res.status(400).json({ success: false, error: '缺少人设档案' });
    }

    const apiKey = clientApiKey || process.env.YUNWU_API_KEY;
    if (!apiKey || apiKey === '你的API_KEY') {
      return res.status(400).json({ success: false, error: '请先设置 API Key' });
    }

    const weatherInfo = weather
      ? `天气：${weather.city}，最高温 ${weather.maxTemp}°C，最低温 ${weather.minTemp}°C，天气代码 ${weather.weatherCode}，降水概率 ${weather.precipProbability}%`
      : '天气：未知（用户未设置城市或获取失败）';

    const systemPrompt = `你是一个专业的AI虚拟人设生活设计师。根据用户的虚拟人设档案和当地天气，生成这个人设今天一整天的"衣食住行"详细内容。

输出必须是严格的 JSON 格式，不要加任何 markdown 代码块标记或其他文字：

{
  "character_appearance": "统一的角色外貌英文描述（50-80英文词）。基于race种族特征，描述此人的年龄感、脸型、发型发色、眼型瞳色、肤色、身型、气质。此描述将用于所有含人物的图片生成以保证外貌一致性。例如：'A 25-year-old East Asian woman with heart-shaped face, long straight black hair, almond-shaped dark brown eyes, fair porcelain skin, slim build, gentle and warm aura'",
  "date": "今天的日期",
  "outfit": {
    "top": "上衣描述",
    "bottom": "下装描述",
    "shoes": "鞋子描述",
    "accessories": "配饰描述",
    "overall": "整体穿搭一句话描述",
    "outfit_desc": "今日穿搭的英文描述（20-30词），描述全身穿着、颜色搭配，用于其他图片中统一服装。例如：'wearing a beige linen blouse, high-waisted wide-leg navy trousers, white leather sneakers, and a gold pendant necklace'",
    "image_prompt": "英文图片生成提示词，用于AI生成穿搭照。必须以'A fashion photo of'开头，必须包含完整角色外貌(character_appearance)和今日穿搭(outfit_desc)、场景（早晨卧室/阳台自然光）、全身或大半身构图、写实风格。格式：'A fashion photo of [完整character_appearance], [完整outfit_desc], standing by [场景], natural morning light, full body shot, photorealistic'"
  },
  "meals": {
    "breakfast": {
      "food": "食物名称",
      "description": "简短的中文描述",
      "image_prompt": "英文Vlog风格图片提示词。人物以博主身份向观众分享早餐，像是在拍Vlog记录日常生活，手持食物或对着镜头展示，有互动感和分享感。必须包含完整的角色外貌(character_appearance)和今日穿搭(outfit_desc)。格式：'A vlog-style photo of [完整character_appearance], [完整outfit_desc], holding up [food] to the camera with a warm smile, morning kitchen background, natural light, casual selfie angle, photorealistic'"
    },
    "lunch": {
      "food": "食物名称",
      "description": "简短的中文描述",
      "image_prompt": "英文Vlog风格图片提示词。人物以博主身份向观众分享午餐，像是在拍Vlog记录日常生活，手持食物或对着镜头展示，有互动感和分享感。必须包含完整的角色外貌(character_appearance)和今日穿搭(outfit_desc)。格式：'A vlog-style photo of [完整character_appearance], [完整outfit_desc], showing [food] to the camera at a cafe, casual vlog selfie angle, natural afternoon light, photorealistic'"
    },
    "dinner": {
      "food": "食物名称",
      "description": "简短的中文描述",
      "image_prompt": "英文Vlog风格图片提示词。人物以博主身份向观众分享晚餐，像是在拍Vlog记录日常生活，手持食物或对着镜头展示，有互动感和分享感。必须包含完整的角色外貌(character_appearance)和今日穿搭(outfit_desc)。格式：'A vlog-style photo of [完整character_appearance], [完整outfit_desc], presenting [food] to the camera at a restaurant, warm evening light, casual vlog selfie angle, photorealistic'"
    }
  },
  "activities": [
    {
      "time": "HH:MM",
      "location": "地点名称",
      "description": "活动的中文描述, 20字以内",
      "image_prompt": "英文生活场景拍摄提示词。必须包含完整的角色外貌(character_appearance)和今日穿搭(outfit_desc)，因为人物全天穿着同一套衣服。必须以'A lifestyle photo of'开头。格式：'A lifestyle photo of [完整character_appearance], [完整outfit_desc], [活动场景动作], [光线环境], photorealistic'"
    }
  ],
  "caption": {
    "zh": "中文文案（2-4句话，带2-3个话题标签，符合人设语言风格）",
    "en": "English translation of the caption (2-4 sentences, with 2-3 hashtags)",
    "ms": "Malay translation of the caption (2-4 ayat, dengan 2-3 hashtag)"
  },
  "location_note": "今日主要活动区域的一句话描述"
}

关键要求：
1. character_appearance 必须基于 race（种族）生成，外貌特征要有种族辨识度
2. outfit_desc 必须详细描述今日全身穿着（包括颜色、材质、款式），同一角色全天穿同一套衣服
3. outfit.image_prompt、所有 activities[].image_prompt、meals 中所有 image_prompt 中的人物必须是【完全相同的 character_appearance + 完全相同的 outfit_desc】，确保全天所有图片看起来是同一个人、同一套衣服
 4. 餐食图片必须是人物以Vlog博主身份向观众分享美食，像是自拍视角对着镜头展示食物，有互动感和分享感，不是孤立拍摄食物，也不是正襟危坐吃饭
 5. 所有内容符合人设性格/职业/偏好；根据天气决定穿搭厚度和风格；根据城市特色设计活动地点
 6. 语言偏好(language)如为中文则caption和描述用中文，如为其他语言可混合使用
 7. 只输出 JSON，不要任何额外文字。`;

    const userContent = `人设档案：
- 名称：${profile.name || '未设定'}
- 年龄：${profile.age || '未设定'}
- 性别：${profile.gender || '未设定'}
- 城市：${profile.city || '未设定'}
- 职业：${profile.occupation || '未设定'}
- 种族：${profile.race || '未设定'}
- 语言：${profile.language || '未设定'}
- 性格标签：${profile.personality || '未设定'}
- 穿搭风格：${profile.stylePreference || '未设定'}
- 饮食偏好：${profile.dietPreference || '未设定'}
- 活动偏好：${profile.activityPreference || '未设定'}
- 语言风格：${profile.languageStyle || '未设定'}

${weatherInfo}

请生成这个人设今日的完整日常。`;

    console.log('Generating persona daily...');

    const response = await fetchWithTimeout(
      `${process.env.YUNWU_API_BASE || 'https://yunwu.ai'}/v1/chat/completions`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
          Accept: 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-5.5',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userContent },
          ],
          temperature: 0.8,
          max_tokens: 4000,
        }),
      },
      180000,
    );

    const data = await response.json();

    if (!response.ok) {
      console.error('Persona generate error:', data);
      return res.status(response.status).json({
        success: false,
        error: data.error?.message || JSON.stringify(data),
      });
    }

    const content = data.choices?.[0]?.message?.content || '';
    let daily;
    try {
      daily = JSON.parse(content.trim());
    } catch {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          daily = JSON.parse(jsonMatch[0]);
        } catch {
          return res.status(500).json({ success: false, error: 'AI 返回格式异常，请重试' });
        }
      } else {
        return res.status(500).json({ success: false, error: 'AI 返回格式异常，请重试' });
      }
    }

    res.json({ success: true, daily });
  } catch (err) {
    console.error('Persona generate error:', err);
    const message = err.name === 'AbortError' ? '请求超时，请稍后重试' : err.message;
    res.status(500).json({ success: false, error: message });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 后端服务已启动: http://localhost:${PORT}`);
  console.log(`📁 上传目录: ${uploadsDir}`);
  console.log(`🎬 视频模块已启用`);
  console.log(`🎭 人设模块已启用`);
});
