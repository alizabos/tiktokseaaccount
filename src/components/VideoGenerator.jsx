import { useState, useRef, useEffect } from 'react';

const VIDEO_MODELS = [
  { label: 'Veo 3.1 Fast', value: 'veo_3_1-fast', desc: '快速出片' },
  { label: 'Veo 3.1', value: 'veo_3_1', desc: '标准质量' },
  { label: 'Veo 3.1 Pro', value: 'veo3.1-pro', desc: '高质量' },
];

const ASPECT_RATIOS = [
  { label: '9:16 竖版', value: '9:16' },
  { label: '16:9 横版', value: '16:9' },
];

export default function VideoGenerator({ apiKey, script, storyboardImages }) {
  const [prompt, setPrompt] = useState('');
  const [model, setModel] = useState('veo_3_1-fast');
  const [aspectRatio, setAspectRatio] = useState('9:16');
  const [loading, setLoading] = useState(false);
  const [polling, setPolling] = useState(false);
  const [error, setError] = useState('');
  const [taskId, setTaskId] = useState(null);
  const [videoUrl, setVideoUrl] = useState(null);
  const [status, setStatus] = useState('');
  const pollRef = useRef(null);

  useEffect(() => {
    // 如果有分镜脚本，自动拼接 prompt
    if (script && Array.isArray(script)) {
      const combined = script
        .map((s) => s.visual || s.prompt || '')
        .filter(Boolean)
        .join('. ');
      if (combined) setPrompt(combined);
    }
  }, [script]);

  // 轮询视频任务状态
  useEffect(() => {
    if (!taskId || !polling) return;

    const poll = async () => {
      try {
        const res = await fetch('/api/video/query', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            taskId,
            apiKey: apiKey.trim(),
          }),
        });

        const data = await res.json();
        if (!data.success) {
          setError(data.error || '查询失败');
          setPolling(false);
          return;
        }

        setStatus(data.status || data.status_update_time ? 'processing' : 'unknown');

        // 检查是否完成
        if (data.status === 'completed' || data.status === 'succeeded' || data.video_url || data.output) {
          setVideoUrl(data.video_url || data.output || data.url);
          setPolling(false);
          setLoading(false);
        } else if (data.status === 'failed' || data.status === 'error') {
          setError('视频生成失败');
          setPolling(false);
          setLoading(false);
        }
      } catch (err) {
        console.error('Poll error:', err);
      }
    };

    pollRef.current = setInterval(poll, 5000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [taskId, polling, apiKey]);

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      setError('请输入提示词');
      return;
    }
    if (!apiKey?.trim()) {
      setError('请先设置 API Key');
      return;
    }

    setLoading(true);
    setPolling(true);
    setError('');
    setVideoUrl(null);
    setStatus('pending');

    try {
      const res = await fetch('/api/video/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: prompt.trim(),
          model,
          aspectRatio,
          enhancePrompt: true,
          enableUpsample: true,
          apiKey: apiKey.trim(),
        }),
      });

      const data = await res.json();
      if (!data.success) {
        setError(data.error || '创建失败');
        setLoading(false);
        setPolling(false);
        return;
      }

      setTaskId(data.taskId);
      setStatus('processing');
    } catch (err) {
      setError('网络错误：' + err.message);
      setLoading(false);
      setPolling(false);
    }
  };

  return (
    <div className="video-generator">
      <div className="video-section-header">
        <h2>🎬 视频生成</h2>
        <p className="section-desc">使用 Veo 3.1 系列模型生成最终视频</p>
      </div>

      <div className="video-input-group">
        <label className="video-input-label">视频提示词</label>
        <textarea
          className="video-textarea"
          placeholder="描述你想要生成的视频内容..."
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={4}
        />
      </div>

      <div className="video-params">
        <div className="param-group">
          <label className="param-label">模型</label>
          <div className="param-options">
            {VIDEO_MODELS.map((m) => (
              <button
                key={m.value}
                className={`param-btn ${model === m.value ? 'active' : ''}`}
                onClick={() => setModel(m.value)}
                title={m.desc}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        <div className="param-group">
          <label className="param-label">比例</label>
          <div className="param-options">
            {ASPECT_RATIOS.map((r) => (
              <button
                key={r.value}
                className={`param-btn ${aspectRatio === r.value ? 'active' : ''}`}
                onClick={() => setAspectRatio(r.value)}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <button
        className="video-action-btn generate-video-btn"
        onClick={handleGenerate}
        disabled={loading || !prompt.trim()}
      >
        {loading ? (
          <>
            <span className="spinner" />
            {polling ? '生成中，请稍候...' : '提交任务中...'}
          </>
        ) : (
          '🎬 生成视频'
        )}
      </button>

      {status && polling && (
        <div className="video-status">
          <span className="spinner" />
          <span>视频生成中...（通常需要 1-3 分钟）</span>
        </div>
      )}

      {error && <div className="error-message">⚠️ {error}</div>}

      {videoUrl && (
        <div className="video-result">
          <h3>生成成功！</h3>
          <video
            className="video-player"
            src={videoUrl}
            controls
            autoPlay
            loop
          />
          <div className="video-actions">
            <a
              className="download-btn"
              href={videoUrl}
              target="_blank"
              rel="noopener noreferrer"
              download
            >
              ⬇️ 下载视频
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
