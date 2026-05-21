import { useState } from 'react';
import { IconSearch, IconRocket, IconLayers, IconMusic, IconFlame, IconImage, IconFileText, IconAlert } from './Icons';

export default function VideoAnalyzer({ apiKey, onComplete }) {
  const [videoUrl, setVideoUrl] = useState('');
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);

  const handleAnalyze = async () => {
    if (!videoUrl.trim() && !prompt.trim()) {
      setError('请输入视频 URL 或描述');
      return;
    }
    if (!apiKey?.trim()) {
      setError('请先设置 API Key');
      return;
    }

    setLoading(true);
    setError('');
    setResult(null);

    try {
      const res = await fetch('/api/video/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          videoUrl: videoUrl.trim() || undefined,
          prompt: prompt.trim() || undefined,
          apiKey: apiKey.trim(),
        }),
      });

      const data = await res.json();
      if (!data.success) {
        setError(data.error || '分析失败');
        return;
      }

      setResult(data.analysis);
    } catch (err) {
      setError('网络错误：' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="video-analyzer">
      <div className="video-section-header">
        <h2><IconSearch size={22} /> 视频识别分析</h2>
        <p className="section-desc">输入 TikTok 视频链接或描述，AI 自动拆解爆款结构</p>
      </div>

      <div className="video-input-group">
        <label className="video-input-label">视频 URL</label>
        <input
          className="video-input"
          type="text"
          placeholder="粘贴 TikTok 视频链接..."
          value={videoUrl}
          onChange={(e) => setVideoUrl(e.target.value)}
        />
      </div>

      <div className="video-input-group">
        <label className="video-input-label">或手动描述</label>
        <textarea
          className="video-textarea"
          placeholder="描述你想分析的视频内容、风格、结构..."
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={3}
        />
      </div>

      <button
        className="video-action-btn"
        onClick={handleAnalyze}
        disabled={loading || (!videoUrl.trim() && !prompt.trim())}
      >
        {loading ? (
          <>
            <span className="spinner" />
            分析中...
          </>
        ) : (
          <><IconSearch size={16} /> 开始分析</>
        )}
      </button>

      {error && <div className="error-message"><IconAlert size={16} /> {error}</div>}

      {result && (
        <div className="analysis-result">
          <div className="result-header">
            <h3>分析结果</h3>
            <button
              className="next-step-btn"
              onClick={() => onComplete(result)}
            >
              下一步：脚本复刻 →
            </button>
          </div>

          {result.hook && (
            <div className="result-section">
              <h4><IconRocket size={16} /> 前3秒钩子</h4>
              <pre>{typeof result.hook === 'string' ? result.hook : JSON.stringify(result.hook, null, 2)}</pre>
            </div>
          )}

          {result.scenes && (
            <div className="result-section">
              <h4><IconLayers size={16} /> 分镜结构</h4>
              <pre>{typeof result.scenes === 'string' ? result.scenes : JSON.stringify(result.scenes, null, 2)}</pre>
            </div>
          )}

          {result.script && (
            <div className="result-section">
              <h4><IconFileText size={16} /> 口播文案</h4>
              <pre>{typeof result.script === 'string' ? result.script : JSON.stringify(result.script, null, 2)}</pre>
            </div>
          )}

          {result.bgm && (
            <div className="result-section">
              <h4><IconMusic size={16} /> BGM 风格</h4>
              <pre>{typeof result.bgm === 'string' ? result.bgm : JSON.stringify(result.bgm, null, 2)}</pre>
            </div>
          )}

          {result.viral_elements && (
            <div className="result-section">
              <h4><IconFlame size={16} /> 爆款元素</h4>
              <pre>{typeof result.viral_elements === 'string' ? result.viral_elements : JSON.stringify(result.viral_elements, null, 2)}</pre>
            </div>
          )}

          {result.style && (
            <div className="result-section">
              <h4><IconImage size={16} /> 风格标签</h4>
              <pre>{typeof result.style === 'string' ? result.style : JSON.stringify(result.style, null, 2)}</pre>
            </div>
          )}

          {result.raw && (
            <div className="result-section">
              <h4><IconFileText size={16} /> 原始分析</h4>
              <pre>{result.raw}</pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
