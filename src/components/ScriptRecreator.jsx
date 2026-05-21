import { useState } from 'react';
import { IconLayers, IconImage, IconAlert } from './Icons';

export default function ScriptRecreator({ apiKey, analysis, onComplete }) {
  const [productInfo, setProductInfo] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingImages, setLoadingImages] = useState(false);
  const [error, setError] = useState('');
  const [scenes, setScenes] = useState(null);
  const [storyboardImages, setStoryboardImages] = useState(null);

  const handleRecreate = async () => {
    if (!apiKey?.trim()) {
      setError('请先设置 API Key');
      return;
    }

    setLoading(true);
    setError('');
    setScenes(null);
    setStoryboardImages(null);

    try {
      const res = await fetch('/api/video/recreate-script', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          analysis,
          productInfo: productInfo.trim() || undefined,
          apiKey: apiKey.trim(),
        }),
      });

      const data = await res.json();
      if (!data.success) {
        setError(data.error || '复刻失败');
        return;
      }

      setScenes(data.scenes);
    } catch (err) {
      setError('网络错误：' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateStoryboard = async () => {
    if (!scenes || !Array.isArray(scenes)) return;
    if (!apiKey?.trim()) {
      setError('请先设置 API Key');
      return;
    }

    setLoadingImages(true);
    setError('');

    try {
      const res = await fetch('/api/video/generate-storyboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scenes,
          apiKey: apiKey.trim(),
        }),
      });

      const data = await res.json();
      if (!data.success) {
        setError(data.error || '分镜图片生成失败');
        return;
      }

      setStoryboardImages(data.images);
    } catch (err) {
      setError('网络错误：' + err.message);
    } finally {
      setLoadingImages(false);
    }
  };

  return (
    <div className="script-recreator">
      <div className="video-section-header">
        <h2><IconLayers size={22} /> 脚本复刻</h2>
        <p className="section-desc">基于爆款分析结果，生成新的分镜脚本</p>
      </div>

      <div className="video-input-group">
        <label className="video-input-label">产品信息（可选）</label>
        <textarea
          className="video-textarea"
          placeholder="描述你的产品名称、卖点、目标受众..."
          value={productInfo}
          onChange={(e) => setProductInfo(e.target.value)}
          rows={3}
        />
      </div>

      <button
        className="video-action-btn"
        onClick={handleRecreate}
        disabled={loading}
      >
        {loading ? (
          <>
            <span className="spinner" />
            生成脚本中...
          </>
        ) : (
          <><IconLayers size={16} /> 生成脚本</>
        )}
      </button>

      {error && <div className="error-message"><IconAlert size={16} /> {error}</div>}

      {scenes && Array.isArray(scenes) && (
        <div className="scenes-result">
          <div className="result-header">
            <h3>分镜脚本</h3>
            <button
              className="video-action-btn storyboard-btn"
              onClick={handleGenerateStoryboard}
              disabled={loadingImages}
            >
              {loadingImages ? (
                <>
                  <span className="spinner" />
                  生成分镜图片中...
                </>
              ) : (
                <><IconImage size={16} /> 生成分镜图片</>
              )}
            </button>
          </div>

          <div className="scene-cards">
            {scenes.map((scene, idx) => (
              <div key={idx} className="scene-card">
                <div className="scene-header">
                  <span className="scene-number">分镜 {scene.scene_number || idx + 1}</span>
                  {scene.duration && <span className="scene-duration">{scene.duration}s</span>}
                </div>

                {storyboardImages && storyboardImages[idx] && storyboardImages[idx].url && (
                  <div className="scene-image-wrap">
                    <img src={storyboardImages[idx].url} alt={`分镜 ${scene.scene_number || idx + 1}`} />
                  </div>
                )}

                {scene.visual && (
                  <div className="scene-field">
                    <label>画面描述</label>
                    <p>{scene.visual}</p>
                  </div>
                )}

                {scene.camera && (
                  <div className="scene-field">
                    <label>运镜</label>
                    <p>{scene.camera}</p>
                  </div>
                )}

                {scene.voiceover && (
                  <div className="scene-field">
                    <label>口播文案</label>
                    <p className="voiceover">{scene.voiceover}</p>
                  </div>
                )}

                {scene.transition && (
                  <div className="scene-field">
                    <label>转场</label>
                    <p>{scene.transition}</p>
                  </div>
                )}
              </div>
            ))}
          </div>

          {storyboardImages && (
            <button
              className="video-action-btn next-step-btn"
              onClick={() => onComplete(scenes, storyboardImages)}
            >
              下一步：视频生成 →
            </button>
          )}
        </div>
      )}

      {scenes && scenes.raw && (
        <div className="scenes-result">
          <div className="result-header">
            <h3>分镜脚本（原始）</h3>
          </div>
          <pre>{scenes.raw}</pre>
        </div>
      )}
    </div>
  );
}
