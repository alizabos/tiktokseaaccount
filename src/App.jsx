import { useState, useRef } from 'react';
import ImageUploader from './components/ImageUploader';
import PromptInput from './components/PromptInput';
import ResultGallery from './components/ResultGallery';

const SIZES = [
  { label: '1:1 方形', value: '1024x1024' },
  { label: '3:4 竖版', value: '768x1024' },
  { label: '2:3 竖版', value: '1024x1536' },
  { label: '3:2 横版', value: '1536x1024' },
  { label: '9:16 竖版', value: '1024x1820' },
  { label: '16:9 横版', value: '1820x1024' },
];

const API_BASE = '/api';
const LS_KEY = 'tiktokseaaccount_apikey';

export default function App() {
  const [apiKey, setApiKey] = useState(() => {
    return localStorage.getItem(LS_KEY) || '';
  });
  const [showKeyInput, setShowKeyInput] = useState(false);
  const [images, setImages] = useState([]);
  const [prompt, setPrompt] = useState('');
  const [size, setSize] = useState('1024x1024');
  const [count, setCount] = useState(1);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [previewImage, setPreviewImage] = useState(null);
  const resultRef = useRef(null);

  const handleSaveKey = (val) => {
    setApiKey(val);
    localStorage.setItem(LS_KEY, val);
  };

  const handleImagesChange = (newImages) => {
    setImages(newImages);
    setError('');
  };

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      setError('请输入提示词');
      return;
    }
    if (!apiKey.trim()) {
      setError('请先设置 API Key');
      setShowKeyInput(true);
      return;
    }

    setLoading(true);
    setError('');
    setResults([]);

    try {
      const imageData = images.map((img) => ({
        dataUrl: img.dataUrl,
        url: img.url,
      }));

      const response = await fetch(`${API_BASE}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: prompt.trim(),
          images: imageData.length > 0 ? imageData : undefined,
          size,
          n: count,
          apiKey: apiKey.trim(),
        }),
      });

      const data = await response.json();

      if (!data.success) {
        setError(data.error || '生成失败');
        return;
      }

      setResults(data.images || []);
      setTimeout(() => {
        resultRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 200);
    } catch (err) {
      setError('网络错误：' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app">
      <header className="app-header">
        <h1>🎨 图片生成</h1>
        <span className="model-badge">gpt-image-2-all</span>

        <div className="key-area">
          {!showKeyInput ? (
            <button
              className={`key-toggle ${apiKey ? 'has-key' : ''}`}
              onClick={() => setShowKeyInput(true)}
              title={apiKey ? '已设置 API Key，点击可修改' : '点击设置 API Key'}
            >
              {apiKey ? '🔑 已设置 Key' : '⚠️ 设置 Key'}
            </button>
          ) : (
            <div className="key-input-group">
              <input
                className="key-input"
                type="password"
                placeholder="输入 API Key (sk-...)"
                value={apiKey}
                onChange={(e) => handleSaveKey(e.target.value)}
                autoFocus
              />
              <button
                className="key-done"
                onClick={() => setShowKeyInput(false)}
              >
                ✓
              </button>
            </div>
          )}
        </div>
      </header>

      <main className="app-main">
        <ImageUploader images={images} onChange={handleImagesChange} />

        <PromptInput
          prompt={prompt}
          onPromptChange={setPrompt}
          size={size}
          onSizeChange={setSize}
          count={count}
          onCountChange={setCount}
          onGenerate={handleGenerate}
          loading={loading}
          sizes={SIZES}
          imageCount={images.length}
          images={images}
          apiKey={apiKey}
        />

        {error && <div className="error-message">⚠️ {error}</div>}

        <ResultGallery
          results={results}
          loading={loading}
          onPreview={setPreviewImage}
          resultRef={resultRef}
        />
      </main>

      {previewImage && (
        <div className="preview-overlay" onClick={() => setPreviewImage(null)}>
          <button className="preview-close" onClick={() => setPreviewImage(null)}>
            ✕
          </button>
          <img
            src={previewImage}
            alt="预览"
            className="preview-image"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
