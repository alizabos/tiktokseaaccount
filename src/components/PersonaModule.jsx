import { useState, useEffect, useRef } from 'react';

const API_BASE = '/api';

const LS_PERSONA_KEY = 'tiktokseaaccount_persona';

const GENDERS = ['女', '男', '其他'];
const LANGUAGE_STYLES = [
  { value: '活泼', label: '活泼可爱' },
  { value: '文艺', label: '文艺清新' },
  { value: '松弛', label: '松弛自然' },
  { value: '精致', label: '精致优雅' },
  { value: '酷飒', label: '酷飒个性' },
];

function getWeatherEmoji(code) {
  if (code <= 1) return '☀️';
  if (code === 2) return '⛅';
  if (code === 3) return '☁️';
  if (code <= 48) return '🌫️';
  if (code <= 57) return '🌧️';
  if (code <= 67) return '🌧️';
  if (code <= 77) return '❄️';
  if (code <= 82) return '🌧️';
  if (code <= 86) return '🌨️';
  return '⛈️';
}

function getWeatherDesc(code) {
  if (code <= 1) return '晴';
  if (code === 2) return '多云';
  if (code === 3) return '阴';
  if (code <= 48) return '雾';
  if (code <= 57) return '毛毛雨';
  if (code <= 67) return '雨';
  if (code <= 77) return '雪';
  if (code <= 82) return '阵雨';
  if (code <= 86) return '阵雪';
  return '雷暴';
}

export default function PersonaModule({ apiKey }) {
  const [profile, setProfile] = useState(null);
  const [showProfileForm, setShowProfileForm] = useState(false);
  const [daily, setDaily] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [weather, setWeather] = useState(null);
  const [generatedImages, setGeneratedImages] = useState({});
  const [generatingImages, setGeneratingImages] = useState(false);
  const [imageError, setImageError] = useState('');
  const [generatingIndex, setGeneratingIndex] = useState(-1);
  const [totalImageCount, setTotalImageCount] = useState(0);
  const [copied, setCopied] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const avatarInputRef = useRef(null);

  const [form, setForm] = useState({
    name: '',
    age: '',
    gender: '女',
    city: '',
    occupation: '',
    personality: '',
    stylePreference: '',
    dietPreference: '',
    activityPreference: '',
    languageStyle: '松弛',
    race: '',
    language: '',
    avatar: '',
  });

  const [personalityTags, setPersonalityTags] = useState([]);
  const [personalityInput, setPersonalityInput] = useState('');
  const personalityInputRef = useRef(null);

  const addPersonalityTag = (value) => {
    const tag = value.trim();
    if (!tag) return;
    if (personalityTags.includes(tag)) return;
    setPersonalityTags((prev) => [...prev, tag]);
    setPersonalityInput('');
  };

  const removePersonalityTag = (index) => {
    setPersonalityTags((prev) => prev.filter((_, i) => i !== index));
  };

  const handlePersonalityKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addPersonalityTag(personalityInput);
    }
    if (e.key === 'Backspace' && !personalityInput && personalityTags.length > 0) {
      removePersonalityTag(personalityTags.length - 1);
    }
  };

  const handlePersonalityBlur = () => {
    if (personalityInput.trim()) {
      addPersonalityTag(personalityInput);
    }
  };

  useEffect(() => {
    try {
      const saved = localStorage.getItem(LS_PERSONA_KEY);
      if (saved) {
        const p = JSON.parse(saved);
        setProfile(p);
        setForm(p);
        if (p.personality) {
          const tags = p.personality.split(/[,，]/).map((t) => t.trim()).filter(Boolean);
          setPersonalityTags(tags);
        }
      } else {
        setShowProfileForm(true);
      }
    } catch {
      setShowProfileForm(true);
    }
  }, []);

  const handleFormChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleAvatarUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('请选择图片文件');
      return;
    }

    setAvatarUploading(true);
    setError('');

    try {
      const formData = new FormData();
      formData.append('images', file);

      const res = await fetch(`${API_BASE}/upload`, {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (data.success && data.images?.length > 0) {
        handleFormChange('avatar', data.images[0].dataUrl || data.images[0].url);
      } else {
        setError(data.error || '头像上传失败');
      }
    } catch (err) {
      setError('头像上传失败，请检查网络连接');
    } finally {
      setAvatarUploading(false);
    }
  };

  const saveProfile = () => {
    if (!form.name.trim() || !form.city.trim()) {
      setError('请至少填写名称和城市');
      return;
    }
    const saved = { ...form, personality: personalityTags.join(', ') };
    localStorage.setItem(LS_PERSONA_KEY, JSON.stringify(saved));
    setProfile(saved);
    setShowProfileForm(false);
    setError('');
  };

  const handleEditProfile = () => {
    setForm(profile || {});
    if (profile?.personality) {
      const tags = profile.personality.split(/[,，]/).map((t) => t.trim()).filter(Boolean);
      setPersonalityTags(tags);
    } else {
      setPersonalityTags([]);
    }
    setShowProfileForm(true);
  };

  const handleClearProfile = () => {
    localStorage.removeItem(LS_PERSONA_KEY);
    setProfile(null);
    setDaily(null);
    setGeneratedImages({});
    setShowProfileForm(true);
  };

  const fetchWeather = async (city) => {
    try {
      const res = await fetch(`/api/weather?city=${encodeURIComponent(city)}`);
      const data = await res.json();
      if (data.success) {
        setWeather(data.weather);
        return data.weather;
      }
    } catch (err) {
      console.error('天气获取失败:', err);
    }
    return null;
  };

  const handleGenerate = async () => {
    if (!profile) return;
    if (!apiKey?.trim()) {
      setError('请先设置 API Key');
      return;
    }

    setLoading(true);
    setError('');
    setDaily(null);
    setGeneratedImages({});
    setImageError('');

    try {
      const weatherData = profile.city ? await fetchWeather(profile.city) : null;

      const res = await fetch('/api/persona/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profile,
          weather: weatherData,
          apiKey: apiKey.trim(),
        }),
      });

      const data = await res.json();
      if (!data.success) {
        setError(data.error || '生成失败');
        return;
      }

      setDaily(data.daily);
    } catch (err) {
      setError('网络错误：' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateImages = async () => {
    if (!daily || !apiKey?.trim()) return;

    const prompts = [];
    if (daily.outfit?.image_prompt) prompts.push({ key: 'outfit', prompt: daily.outfit.image_prompt });
    if (daily.meals?.breakfast?.image_prompt) prompts.push({ key: 'breakfast', prompt: daily.meals.breakfast.image_prompt });
    if (daily.meals?.lunch?.image_prompt) prompts.push({ key: 'lunch', prompt: daily.meals.lunch.image_prompt });
    if (daily.meals?.dinner?.image_prompt) prompts.push({ key: 'dinner', prompt: daily.meals.dinner.image_prompt });
    if (daily.activities) {
      daily.activities.forEach((act, i) => {
        if (act.image_prompt) prompts.push({ key: `activity_${i}`, prompt: act.image_prompt });
      });
    }

    if (prompts.length === 0) {
      setImageError('没有可生成的图片');
      return;
    }

    setGeneratingImages(true);
    setImageError('');
    setTotalImageCount(prompts.length);
    setGeneratingIndex(0);

    const images = {};
    for (let i = 0; i < prompts.length; i++) {
      setGeneratingIndex(i);
      const item = prompts[i];
      try {
        const res = await fetch('/api/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt: item.prompt,
            size: '768x1024',
            n: 1,
            apiKey: apiKey.trim(),
          }),
        });
        const data = await res.json();
        if (data.success && data.images?.[0]) {
          images[item.key] = data.images[0].url;
        }
      } catch (err) {
        console.error(`图片生成失败 (${item.key}):`, err);
      }
      setGeneratedImages({ ...images });
    }

    setGeneratingImages(false);
    setGeneratingIndex(-1);
  };

  const handleCopyCaption = () => {
    if (daily?.caption) {
      navigator.clipboard.writeText(daily.caption).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      });
    }
  };

  if (showProfileForm) {
    return (
      <div className="persona-module">
        <div className="persona-section-header">
          <h2>🎭 人设档案</h2>
          <p className="section-desc">设定你的虚拟人设，AI 将据此生成每日的衣食住行</p>
        </div>

        <div className="persona-profile-form">
          <div className="persona-avatar-upload">
            <div
              className={`persona-avatar-preview ${avatarUploading ? 'uploading' : ''}`}
              onClick={() => avatarInputRef.current?.click()}
            >
              {form.avatar ? (
                <img src={form.avatar} alt="头像" className="persona-avatar-img" />
              ) : (
                <div className="persona-avatar-placeholder">
                  {avatarUploading ? (
                    <span className="uploading-spinner" />
                  ) : (
                    <>
                      <span className="persona-avatar-icon">📷</span>
                      <span className="persona-avatar-text">上传头像</span>
                    </>
                  )}
                </div>
              )}
            </div>
            {form.avatar && (
              <button
                className="persona-avatar-clear"
                onClick={(e) => {
                  e.stopPropagation();
                  handleFormChange('avatar', '');
                }}
              >
                移除
              </button>
            )}
            <input
              ref={avatarInputRef}
              type="file"
              accept="image/*"
              onChange={handleAvatarUpload}
              style={{ display: 'none' }}
            />
          </div>

          <div className="persona-form-grid">
            <div className="persona-form-field">
              <label className="persona-form-label">名称 *</label>
              <input
                className="persona-form-input"
                type="text"
                placeholder="如：小鹿Luna"
                value={form.name}
                onChange={(e) => handleFormChange('name', e.target.value)}
              />
            </div>
            <div className="persona-form-field">
              <label className="persona-form-label">年龄</label>
              <input
                className="persona-form-input"
                type="number"
                placeholder="如：25"
                value={form.age}
                onChange={(e) => handleFormChange('age', e.target.value)}
              />
            </div>
            <div className="persona-form-field">
              <label className="persona-form-label">性别</label>
              <select
                className="persona-form-select"
                value={form.gender}
                onChange={(e) => handleFormChange('gender', e.target.value)}
              >
                {GENDERS.map((g) => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
            </div>
            <div className="persona-form-field">
              <label className="persona-form-label">城市 *</label>
              <input
                className="persona-form-input"
                type="text"
                placeholder="如：北京、上海、东京"
                value={form.city}
                onChange={(e) => handleFormChange('city', e.target.value)}
              />
            </div>
            <div className="persona-form-field">
              <label className="persona-form-label">职业</label>
              <input
                className="persona-form-input"
                type="text"
                placeholder="如：自由设计师、咖啡师"
                value={form.occupation}
                onChange={(e) => handleFormChange('occupation', e.target.value)}
              />
            </div>
            <div className="persona-form-field">
              <label className="persona-form-label">语言风格</label>
              <select
                className="persona-form-select"
                value={form.languageStyle}
                onChange={(e) => handleFormChange('languageStyle', e.target.value)}
              >
                {LANGUAGE_STYLES.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>
            <div className="persona-form-field">
              <label className="persona-form-label">种族</label>
              <input
                className="persona-form-input"
                type="text"
                placeholder="如：东亚、高加索、非洲"
                value={form.race}
                onChange={(e) => handleFormChange('race', e.target.value)}
              />
            </div>
            <div className="persona-form-field">
              <label className="persona-form-label">语言</label>
              <input
                className="persona-form-input"
                type="text"
                placeholder="如：中文、英语、日语"
                value={form.language}
                onChange={(e) => handleFormChange('language', e.target.value)}
              />
            </div>
          </div>

          <div className="persona-form-field full-width">
            <label className="persona-form-label">性格标签</label>
            <div
              className="persona-tag-input-wrap"
              onClick={() => personalityInputRef.current?.focus()}
            >
              {personalityTags.map((tag, i) => (
                <span key={i} className="persona-tag">
                  {tag}
                  <button
                    className="persona-tag-remove"
                    onClick={(e) => {
                      e.stopPropagation();
                      removePersonalityTag(i);
                    }}
                  >
                    ×
                  </button>
                </span>
              ))}
              <input
                ref={personalityInputRef}
                className="persona-tag-input"
                type="text"
                placeholder={personalityTags.length === 0 ? '输入标签后按回车添加' : ''}
                value={personalityInput}
                onChange={(e) => setPersonalityInput(e.target.value)}
                onKeyDown={handlePersonalityKeyDown}
                onBlur={handlePersonalityBlur}
              />
            </div>
            <span className="persona-form-hint">按回车或逗号添加标签，Backspace 删除</span>
          </div>

          <div className="persona-form-field full-width">
            <label className="persona-form-label">穿搭风格偏好</label>
            <input
              className="persona-form-input"
              type="text"
              placeholder="如：韩系简约、日系休闲、法式优雅"
              value={form.stylePreference}
              onChange={(e) => handleFormChange('stylePreference', e.target.value)}
            />
          </div>

          <div className="persona-form-field full-width">
            <label className="persona-form-label">饮食偏好</label>
            <input
              className="persona-form-input"
              type="text"
              placeholder="如：轻食、咖啡、甜品、日料"
              value={form.dietPreference}
              onChange={(e) => handleFormChange('dietPreference', e.target.value)}
            />
          </div>

          <div className="persona-form-field full-width">
            <label className="persona-form-label">活动偏好</label>
            <input
              className="persona-form-input"
              type="text"
              placeholder="如：瑜伽、探店、咖啡厅、书店、看展"
              value={form.activityPreference}
              onChange={(e) => handleFormChange('activityPreference', e.target.value)}
            />
          </div>

          {error && <div className="error-message">⚠️ {error}</div>}

          <div className="persona-form-actions">
            <button className="persona-btn persona-btn-primary" onClick={saveProfile}>
              💾 保存人设
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!profile) {
    return null;
  }

  if (!daily) {
    return (
      <div className="persona-module">
        <div className="persona-section-header">
          <h2>🎭 人设日常</h2>
          <p className="section-desc">基于人设档案，AI 自动生成今日的衣食住行</p>
        </div>

        <div className="persona-profile-card">
          <div className="persona-profile-top">
            <div className="persona-profile-avatar">
              {profile.avatar ? (
                <img src={profile.avatar} alt={profile.name} className="persona-avatar-img" />
              ) : (
                '🎭'
              )}
            </div>
            <div className="persona-profile-info">
              <div className="persona-profile-name">{profile.name}</div>
              <div className="persona-profile-meta">
                {profile.gender && <span>{profile.gender}</span>}
                {profile.age && <span>{profile.age}岁</span>}
                {profile.city && <span>📍 {profile.city}</span>}
                {profile.occupation && <span>💼 {profile.occupation}</span>}
              </div>
            </div>
            <div className="persona-profile-actions">
              <button className="persona-btn persona-btn-secondary" onClick={handleEditProfile}>
                ✏️ 编辑
              </button>
              <button className="persona-btn persona-btn-danger" onClick={handleClearProfile}>
                重置
              </button>
            </div>
          </div>
          {profile.personality && (
            <div className="persona-profile-tags">
              {profile.personality.split(/[,，]/).map((tag, i) => (
                <span key={i} className="persona-profile-tag">{tag.trim()}</span>
              ))}
            </div>
          )}
          <div className="persona-profile-detail">
            {profile.stylePreference && <span>👗 {profile.stylePreference}</span>}
            {profile.dietPreference && <span>🍽️ {profile.dietPreference}</span>}
            {profile.activityPreference && <span>🚶 {profile.activityPreference}</span>}
            {profile.languageStyle && <span>💬 {LANGUAGE_STYLES.find((s) => s.value === profile.languageStyle)?.label || profile.languageStyle}</span>}
            {profile.race && <span>🌍 {profile.race}</span>}
            {profile.language && <span>🗣️ {profile.language}</span>}
          </div>
        </div>

        {error && <div className="error-message">⚠️ {error}</div>}

        <button
          className="persona-btn persona-btn-primary persona-generate-btn"
          onClick={handleGenerate}
          disabled={loading}
        >
          {loading ? (
            <>
              <span className="uploading-spinner" />
              生成中...
            </>
          ) : (
            '📅 生成今日日常'
          )}
        </button>
      </div>
    );
  }

  return (
    <div className="persona-module">
      <div className="persona-section-header">
        <h2>🎭 人设日常</h2>
        <p className="section-desc">
          {profile.name} · {profile.city}
          <button className="persona-link-btn" onClick={handleEditProfile}>编辑人设</button>
        </p>
      </div>

      <div className="persona-daily">
        <div className="persona-daily-header">
          <span className="persona-daily-date">
            📅 {weather?.date || new Date().toISOString().slice(0, 10)}
          </span>
          <span className="persona-daily-weather">
            {weather
              ? `${getWeatherEmoji(weather.weatherCode)} ${getWeatherDesc(weather.weatherCode)} ${weather.minTemp}°~${weather.maxTemp}° | ${weather.city}`
              : '🌤️ 天气数据获取中...'}
          </span>
        </div>

        {daily.outfit && (
          <div className="persona-daily-section">
            <div className="persona-daily-section-title">👗 今日穿搭</div>
            <div className="persona-outfit-card">
              {generatedImages.outfit && (
                <img
                  className="persona-image"
                  src={generatedImages.outfit}
                  alt="今日穿搭"
                />
              )}
              <div className="persona-outfit-detail">
                <div className="persona-outfit-items">
                  {daily.outfit.top && (
                    <div className="persona-outfit-item">
                      <span className="persona-outfit-label">上装</span>
                      <span>{daily.outfit.top}</span>
                    </div>
                  )}
                  {daily.outfit.bottom && (
                    <div className="persona-outfit-item">
                      <span className="persona-outfit-label">下装</span>
                      <span>{daily.outfit.bottom}</span>
                    </div>
                  )}
                  {daily.outfit.shoes && (
                    <div className="persona-outfit-item">
                      <span className="persona-outfit-label">鞋子</span>
                      <span>{daily.outfit.shoes}</span>
                    </div>
                  )}
                  {daily.outfit.accessories && (
                    <div className="persona-outfit-item">
                      <span className="persona-outfit-label">配饰</span>
                      <span>{daily.outfit.accessories}</span>
                    </div>
                  )}
                </div>
                {daily.outfit.overall && (
                  <p className="persona-outfit-overall">{daily.outfit.overall}</p>
                )}
              </div>
            </div>
          </div>
        )}

        {daily.meals && (
          <div className="persona-daily-section">
            <div className="persona-daily-section-title">🍽️ 今日餐食</div>
            <div className="persona-meals-grid">
              {daily.meals.breakfast && (
                <div className="persona-meal-card">
                  {generatedImages.breakfast && (
                    <img className="persona-image" src={generatedImages.breakfast} alt="早餐" />
                  )}
                  <div className="persona-meal-time">🌅 早餐</div>
                  <div className="persona-meal-food">{daily.meals.breakfast.food}</div>
                  {daily.meals.breakfast.description && (
                    <div className="persona-meal-desc">{daily.meals.breakfast.description}</div>
                  )}
                </div>
              )}
              {daily.meals.lunch && (
                <div className="persona-meal-card">
                  {generatedImages.lunch && (
                    <img className="persona-image" src={generatedImages.lunch} alt="午餐" />
                  )}
                  <div className="persona-meal-time">🌞 午餐</div>
                  <div className="persona-meal-food">{daily.meals.lunch.food}</div>
                  {daily.meals.lunch.description && (
                    <div className="persona-meal-desc">{daily.meals.lunch.description}</div>
                  )}
                </div>
              )}
              {daily.meals.dinner && (
                <div className="persona-meal-card">
                  {generatedImages.dinner && (
                    <img className="persona-image" src={generatedImages.dinner} alt="晚餐" />
                  )}
                  <div className="persona-meal-time">🌙 晚餐</div>
                  <div className="persona-meal-food">{daily.meals.dinner.food}</div>
                  {daily.meals.dinner.description && (
                    <div className="persona-meal-desc">{daily.meals.dinner.description}</div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {daily.activities && daily.activities.length > 0 && (
          <div className="persona-daily-section">
            <div className="persona-daily-section-title">📍 今日活动</div>
            <div className="persona-activity-timeline">
              {daily.activities.map((act, i) => (
                <div key={i} className="persona-activity-item">
                  <div className="persona-activity-time">{act.time}</div>
                  <div className="persona-activity-dot" />
                  <div className="persona-activity-content">
                    {generatedImages[`activity_${i}`] && (
                      <img
                        className="persona-image persona-image-sm"
                        src={generatedImages[`activity_${i}`]}
                        alt={act.location}
                      />
                    )}
                    <div className="persona-activity-location">{act.location}</div>
                    <div className="persona-activity-desc">{act.description}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {daily.location_note && (
          <div className="persona-location-note">📍 {daily.location_note}</div>
        )}

        {daily.caption && (
          <div className="persona-daily-section">
            <div className="persona-daily-section-title">📝 发布文案</div>
            <div className="persona-caption">
              <div className="persona-caption-text">{daily.caption}</div>
              <button className="persona-copy-btn" onClick={handleCopyCaption}>
                {copied ? '✅ 已复制' : '📋 复制文案'}
              </button>
            </div>
          </div>
        )}

        {error && <div className="error-message">⚠️ {error}</div>}
        {imageError && <div className="error-message">⚠️ {imageError}</div>}

        <div className="persona-actions">
          <button
            className="persona-btn persona-btn-primary"
            onClick={handleGenerate}
            disabled={loading}
          >
            {loading ? '生成中...' : '🔄 重新生成'}
          </button>

          {!generatingImages && Object.keys(generatedImages).length === 0 && (
            <button
              className="persona-btn persona-btn-accent"
              onClick={handleGenerateImages}
              disabled={generatingImages}
            >
              🎨 一键生成所有配图
            </button>
          )}

          {generatingImages && (
            <div className="persona-generating-progress">
              <span className="uploading-spinner" />
              <span className="persona-progress-text">
                生成配图中... {generatingIndex + 1}/{totalImageCount}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
