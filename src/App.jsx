import { useState, useRef, useEffect } from 'react';
import ImageUploader from './components/ImageUploader';
import PromptInput from './components/PromptInput';
import ResultGallery from './components/ResultGallery';
import VideoModule from './components/VideoModule';
import PersonaModule from './components/PersonaModule';
import { IconImage, IconPersona, IconKey, IconCheck, IconX, IconRocket, IconAlert } from './components/Icons';

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
const LS_RESULTS_KEY = 'tiktokseaaccount_results';
const MAX_CACHED_RESULTS = 20;

export default function App() {
  const [activeTab, setActiveTab] = useState('image'); // 'image' | 'video'
  const [apiKey, setApiKey] = useState(() => {
    return localStorage.getItem(LS_KEY) || '';
  });
  const [showKeyInput, setShowKeyInput] = useState(false);
  const [images, setImages] = useState([]);
  const [prompt, setPrompt] = useState('');
  const [size, setSize] = useState('1024x1024');
  const [count, setCount] = useState(1);
  const [results, setResults] = useState(() => {
    try {
      const cached = localStorage.getItem(LS_RESULTS_KEY);
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [previewImage, setPreviewImage] = useState(null);
  const resultRef = useRef(null);

  const handleKeyInputChange = (val) => {
    setApiKey(val);
  };

  const handleKeyConfirm = () => {
    localStorage.setItem(LS_KEY, apiKey);
    setShowKeyInput(false);
  };

  useEffect(() => {
    try {
      const capped = results.slice(0, MAX_CACHED_RESULTS);
      localStorage.setItem(LS_RESULTS_KEY, JSON.stringify(capped));
    } catch {
      // localStorage full, ignore
    }
  }, [results]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && previewImage) {
        setPreviewImage(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [previewImage]);

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

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 180000);

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
        signal: controller.signal,
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
      if (err.name === 'AbortError') {
        setError('请求超时（3分钟），请稍后重试');
      } else {
        setError('网络错误：' + err.message);
      }
    } finally {
      clearTimeout(timeout);
      setLoading(false);
    }
  };

  return (
    <div className="app">
      <header className="app-header">
        <h1><span className="header-icon"><IconImage size={28} /></span>TikTok 内容工厂</h1>

        <div className="tab-bar">
          <button
            className={`tab-btn ${activeTab === 'image' ? 'active' : ''}`}
            onClick={() => setActiveTab('image')}
          >
            <span className="tab-icon"><IconImage size={18} /></span>图片
          </button>
          <button
            className={`tab-btn ${activeTab === 'video' ? 'active' : ''}`}
            onClick={() => setActiveTab('video')}
            style={{ display: 'none' }}
          >
            <span className="tab-icon"><IconRocket size={18} /></span>视频
          </button>
          <button
            className={`tab-btn ${activeTab === 'persona' ? 'active' : ''}`}
            onClick={() => setActiveTab('persona')}
          >
            <span className="tab-icon"><IconPersona size={18} /></span>人设
          </button>
        </div>

        <div className="key-area">
          {!showKeyInput ? (
            <button
              className={`key-toggle ${apiKey ? 'has-key' : ''}`}
              onClick={() => setShowKeyInput(true)}
              title={apiKey ? '已设置 API Key，点击可修改' : '点击设置 API Key'}
            >
              {apiKey ? <><IconKey size={16} />已设置 Key</> : <><IconKey size={16} />设置 Key</>}
            </button>
          ) : (
            <div className="key-input-group">
              <input
                className="key-input"
                type="password"
                placeholder="输入 API Key (sk-...)"
                value={apiKey}
                onChange={(e) => handleKeyInputChange(e.target.value)}
                autoFocus
              />
              <button
                className="key-done"
                onClick={handleKeyConfirm}
              >
                <IconCheck size={16} />
              </button>
            </div>
          )}
        </div>
      </header>

      <main className="app-main">
        {activeTab === 'image' ? (
          <>
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

            {error && <div className="error-message"><IconAlert size={16} /> {error}</div>}

            <ResultGallery
              results={results}
              loading={loading}
              onPreview={setPreviewImage}
              resultRef={resultRef}
            />
          </>
        ) : activeTab === 'persona' ? (
          <PersonaModule apiKey={apiKey} />
        ) : (
          <VideoModule apiKey={apiKey} />
        )}
      </main>

      {previewImage && (
        <div className="preview-overlay" onClick={() => setPreviewImage(null)}>
          <button className="preview-close" onClick={() => setPreviewImage(null)}>
            <IconX size={20} />
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
