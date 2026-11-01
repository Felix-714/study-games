/* Study Games - Supabase tracking v1
 * Drop-in tracker for /english/index.html
 * Keeps the existing game/localStorage logic and records each answer in Supabase.
 */
(() => {
  'use strict';

  const SUPABASE_URL = 'https://wxusktzdvpqxhxpyondx.supabase.co';
  const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_5GiK7W35mbXULkBFTdctPg_YchxjQEM';
  const STUDENT_NAME = '大女';
  const GAME_ID = 'english-challenge-idv';

  const chapterMeta = [
    {
      topic: 'Jobs', difficulty: 1,
      items: [
        ['Vocabulary', 'Job duties'], ['Vocabulary', 'Job duties'],
        ['Vocabulary', 'Job duties'], ['Vocabulary', 'Job duties'],
        ['Vocabulary', 'Jobs vocabulary']
      ]
    },
    {
      topic: 'Dream Jobs', difficulty: 1,
      items: [
        ['Reading', 'Question meaning'], ['Vocabulary', 'Job duties'],
        ['Vocabulary', 'Job duties'], ['Vocabulary', 'Job duties'],
        ['Grammar', 'Third-person singular']
      ]
    },
    {
      topic: 'Job Requirements', difficulty: 2,
      items: [
        ['Vocabulary', 'Personality adjectives'], ['Vocabulary', 'Personality adjectives'],
        ['Vocabulary', 'Personality adjectives'], ['Grammar', 'If clauses'],
        ['Grammar', 'So that']
      ]
    },
    {
      topic: 'Special Jobs', difficulty: 2,
      items: [
        ['Reading', 'Job requirements'], ['Vocabulary', 'Personality adjectives'],
        ['Grammar', 'Need to be'], ['Grammar', 'So that'],
        ['Grammar', 'So that']
      ]
    },
    {
      topic: 'Natural Disasters', difficulty: 2,
      items: [
        ['Vocabulary', 'Natural disasters'], ['Grammar', 'Present perfect'],
        ['Grammar', 'Present perfect'], ['Grammar', 'Since'],
        ['Grammar', 'Either or']
      ]
    },
    {
      topic: 'Call to Action', difficulty: 3,
      items: [
        ['Grammar', 'Shall we'], ['Grammar', 'Neither nor'],
        ['Grammar', 'Too adjective'], ['Writing', 'Speech opening'],
        ['Grammar', 'Either or']
      ]
    },
    {
      topic: 'Final Review', difficulty: 3,
      items: [
        ['Vocabulary', 'Jobs vocabulary'], ['Vocabulary', 'Personality adjectives'],
        ['Grammar', 'Present perfect'], ['Grammar', 'Because'],
        ['Vocabulary', 'Personality adjectives']
      ]
    }
  ];

  let client = null;
  let studentId = null;
  let sessionId = null;
  let chapterOpenedAt = Date.now();
  let ready = false;

  function setBadge(message, status = 'loading') {
    let badge = document.getElementById('supabase-tracking-status');
    if (!badge) {
      badge = document.createElement('div');
      badge.id = 'supabase-tracking-status';
      badge.setAttribute('aria-live', 'polite');
      Object.assign(badge.style, {
        position: 'fixed', right: '10px', bottom: '10px', zIndex: '9999',
        padding: '6px 10px', borderRadius: '6px', fontSize: '12px',
        fontFamily: 'system-ui, sans-serif', border: '1px solid #444',
        background: '#151515', color: '#bbb', opacity: '0.92'
      });
      document.body.appendChild(badge);
    }
    const colors = { loading: '#bbb', ok: '#72c472', error: '#ff8a80', saving: '#ffd180' };
    badge.style.color = colors[status] || colors.loading;
    badge.textContent = message;
  }

  function loadSupabaseLibrary() {
    return new Promise((resolve, reject) => {
      if (window.supabase && window.supabase.createClient) return resolve();
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
      script.onload = resolve;
      script.onerror = () => reject(new Error('Unable to load Supabase library'));
      document.head.appendChild(script);
    });
  }

  function questionId(levelIndex, questionIndex) {
    return `eng_ch${levelIndex + 1}_q${String(questionIndex + 1).padStart(2, '0')}`;
  }

  async function getStudent() {
    const { data, error } = await client
      .from('students')
      .select('id,name')
      .eq('name', STUDENT_NAME)
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new Error(`Student profile not found: ${STUDENT_NAME}`);
    return data.id;
  }

  async function getOrCreateSession() {
    const storageKey = 'studyGamesEnglishSessionId';
    const saved = sessionStorage.getItem(storageKey);
    if (saved) return saved;

    const { data, error } = await client
      .from('practice_sessions')
      .insert({ student_id: studentId, game: GAME_ID })
      .select('id')
      .single();
    if (error) throw error;
    sessionStorage.setItem(storageKey, data.id);
    return data.id;
  }

  function answerValues(q, value) {
    if (q.type === 'mcq') {
      const selectedIndex = Number(value);
      return {
        submitted: q.options[selectedIndex] ?? String(value),
        correct: q.options[q.answer] ?? String(q.answer),
        isCorrect: selectedIndex === q.answer
      };
    }
    const submitted = String(value ?? '').trim();
    const correct = String(q.answer ?? '').trim();
    return {
      submitted,
      correct,
      isCorrect: submitted.toLowerCase() === correct.toLowerCase()
    };
  }

  async function saveAttempt(levelIndex, questionIndex, value) {
    if (!ready || !client || !studentId || !sessionId) return;
    if (value === undefined || String(value).trim() === '') return;

    const q = levels[levelIndex].questions[questionIndex];
    const meta = chapterMeta[levelIndex];
    const [skill, subSkill] = meta.items[questionIndex];
    const values = answerValues(q, value);

    setBadge('☁️ 正在保存作答…', 'saving');

    const payload = {
      student_id: studentId,
      session_id: sessionId,
      question_id: questionId(levelIndex, questionIndex),
      submitted_answer: values.submitted,
      correct_answer: values.correct,
      is_correct: values.isCorrect,
      response_time_ms: Math.max(0, Date.now() - chapterOpenedAt),
      hint_used: false,
      attempt_number: 1,
      topic: meta.topic,
      skill,
      sub_skill: subSkill,
      difficulty: meta.difficulty
    };

    const { error } = await client.from('attempts').insert(payload);
    if (error) throw error;
    setBadge('✅ 作答已保存', 'ok');
  }

  function wrapGameFunctions() {
    if (typeof answer !== 'function') throw new Error('Game answer() function was not found');
    const originalAnswer = answer;
    answer = function(levelIndex, questionIndex, value) {
      originalAnswer(levelIndex, questionIndex, value);
      saveAttempt(levelIndex, questionIndex, value).catch(error => {
        console.error('[Study Games] Save attempt failed:', error);
        setBadge('⚠️ 雲端保存失敗，遊戲進度仍已保留', 'error');
      });
    };

    ['goToLevel', 'prevLevel', 'completeLevel'].forEach(name => {
      if (typeof window[name] !== 'function') return;
      const original = window[name];
      window[name] = function(...args) {
        const result = original.apply(this, args);
        chapterOpenedAt = Date.now();
        return result;
      };
    });
  }

  async function initialize() {
    try {
      setBadge('☁️ 正在連接學習紀錄…', 'loading');
      await loadSupabaseLibrary();
      client = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
      studentId = await getStudent();
      sessionId = await getOrCreateSession();
      wrapGameFunctions();
      ready = true;
      setBadge('✅ 學習紀錄已連線', 'ok');
      console.info('[Study Games] Supabase tracking ready', { studentId, sessionId });
    } catch (error) {
      console.error('[Study Games] Supabase initialization failed:', error);
      setBadge('⚠️ 雲端紀錄未連線，遊戲仍可使用', 'error');
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize, { once: true });
  } else {
    initialize();
  }
})();
