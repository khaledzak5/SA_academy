const fs = require('fs')
const path = require('path')

function loadJson(rel) {
  const p = path.join(__dirname, '..', 'src', 'data', rel)
  return JSON.parse(fs.readFileSync(p, 'utf8'))
}

function normalize(raw) {
  return raw.map((item, idx) => {
    const isTrueFalse = item.question_type === 'true_false' || item.type === 'boolean' || (Array.isArray(item.answerOptions) && item.answerOptions.length === 2 && item.answerOptions.every(a => typeof a.text === 'string' && (a.text.includes('صح') || a.text.includes('خطأ'))))

    let options = []
    let correctIndex = -1

    if (Array.isArray(item.answerOptions)) {
      options = item.answerOptions.map(ao => ao.text ?? String(ao))
      const idxCorrect = item.answerOptions.findIndex(ao => ao.isCorrect === true || ao.is_correct === true)
      if (idxCorrect >= 0) correctIndex = idxCorrect
    } else if (item.answer_data) {
      if (Array.isArray(item.answer_data.options)) {
        options = item.answer_data.options.map(String)
      }
      if (typeof item.answer_data.correct_answer === 'boolean') {
        const boolCorrect = item.answer_data.correct_answer === true
        options = ['صح', 'خطأ']
        correctIndex = boolCorrect ? 0 : 1
      } else if (typeof item.answer_data.correct_answer === 'string') {
        const idx = (options || []).findIndex(o => String(o) === String(item.answer_data.correct_answer))
        if (idx >= 0) correctIndex = idx
      }
    } else {
      options = isTrueFalse ? ['صح', 'خطأ'] : (item.options || item.options_list || [])
      if (isTrueFalse) {
        correctIndex = (item.correct_answer === true || item.correct === 0 || item.correct === 'صح') ? 0 : 1
      } else if (Array.isArray(options)) {
        correctIndex = options.findIndex(o => String(o) === String(item.correct_answer ?? item.correct))
      }
    }

    return {
      id: item.id ?? item.questionNumber ?? item.question_number ?? idx,
      question: String(item.question_text || item.question || item.text || ''),
      options: Array.isArray(options) ? options.map(String) : [],
      correct: correctIndex >= 0 ? correctIndex : Number(item.correct ?? 0),
      type: isTrueFalse ? 'boolean' : 'multiple',
      _raw: item,
    }
  })
}

function shuffleSelect(arr, count) {
  const shuffled = arr.map(q => ({ q, r: Math.random() })).sort((a, b) => a.r - b.r).map(x => x.q)
  return shuffled.slice(0, count)
}

function inspectLesson(fileName, count = 10) {
  const json = loadJson(fileName)
  const raw = Array.isArray(json.questions) ? json.questions : []
  const all = normalize(raw)
  const sel = shuffleSelect(all, count)
  console.log('\n===', fileName, 'raw count=', raw.length, 'normalized=', all.length, 'selected=', sel.length)
  if (sel.length > 0) {
    sel.slice(0, 3).forEach((q, i) => {
      console.log(`- sample ${i+1}: id=${q.id} options=${q.options.length} hint=${!!q._raw?.hint} question='${(q.question||'').slice(0,80).replace(/\n/g,' ')}'`)
    })
  }
}

inspectLesson('lesson2_questions.json', 10)
inspectLesson('lesson4_questions.json', 10)
inspectLesson('lesson5_questions.json', 10)
inspectLesson('lesson6_questions.json', 10)

console.log('\nDone')
