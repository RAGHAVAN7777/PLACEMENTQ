import { config } from './config.mjs';
import { createHash } from 'node:crypto';

const SKILLS = [
  ['Python', /\bpython\b/i], ['SQL', /\b(sql|mysql|postgres(?:ql)?|sqlite)\b/i],
  ['Machine learning', /\b(machine learning|scikit[- ]learn|sklearn|classification|regression)\b/i],
  ['Deep learning', /\b(deep learning|pytorch|tensorflow|keras|neural network)\b/i],
  ['JavaScript', /\b(javascript|typescript|react|node(?:\.js)?)\b/i],
  ['Java', /\bjava\b/i], ['C++', /\bc\+\+(?!\w)/i], ['Git', /\b(git|github)\b/i],
  ['Data analysis', /\b(pandas|numpy|data analysis|power bi|tableau)\b/i]
];

const sourcePassages = (text) => text
  .split(/(?<=[.!?])\s+|\r?\n+/)
  .map((value) => value.trim())
  .filter((value) => value.length >= 8 && value.length <= 700);

const claim = (name, passage, category, confidence = 'observed') => ({
  id: `${category}_${createHash('sha256').update(`${name}:${passage}`).digest('hex').slice(0, 16)}`,
  name, sourcePassage: passage, origin: 'resume', confidence, confirmed: false
});

export function extractProfileDeterministically(input) {
  const text = input.slice(0, config.maxResumeTextChars);
  const passages = sourcePassages(text);
  const result = { skills: [], projects: [], education: [], experience: [], strengths: [] };

  for (const [name, pattern] of SKILLS) {
    const passage = passages.find((item) => pattern.test(item));
    if (passage) result.skills.push(claim(name, passage, 'skill'));
  }
  for (const passage of passages) {
    if (/\b(project|built|developed|implemented|created)\b/i.test(passage) && result.projects.length < 6) {
      result.projects.push(claim(passage.slice(0, 100), passage, 'project'));
    }
    if (/\b(b\.?tech|bachelor|university|college|cgpa|gpa|education)\b/i.test(passage) && result.education.length < 4) {
      result.education.push(claim(passage.slice(0, 100), passage, 'education'));
    }
    if (/\b(intern|experience|worked|employment|developer at|engineer at)\b/i.test(passage) && result.experience.length < 5) {
      result.experience.push(claim(passage.slice(0, 100), passage, 'experience'));
    }
    if (/\b(strength|proficient|expertise|strong in|skilled in)\b/i.test(passage) && result.strengths.length < 5) {
      result.strengths.push(claim(passage.slice(0, 100), passage, 'strength'));
    }
  }
  return result;
}

function passageExists(source, passage) {
  const normalize = (value) => value.toLowerCase().replace(/\s+/g, ' ').trim();
  return normalize(source).includes(normalize(passage));
}

export function validateAiProfile(output, sourceText) {
  const result = { skills: [], projects: [], education: [], experience: [], strengths: [] };
  for (const key of Object.keys(result)) {
    const rows = Array.isArray(output?.[key]) ? output[key].slice(0, 12) : [];
    for (const row of rows) {
      if (typeof row?.name !== 'string' || typeof row?.sourcePassage !== 'string') continue;
      const name = row.name.trim().slice(0, 160);
      const passage = row.sourcePassage.trim().slice(0, 700);
      if (!name || !passage || !passageExists(sourceText, passage)) continue;
      result[key].push(claim(name, passage, key.replace(/s$/, ''), 'model-extracted'));
    }
  }
  return result;
}
