const Groq = require('groq-sdk');

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const SYSTEM_PROMPT = `You are an expert ATS (Applicant Tracking System) analyst and professional resume writer.

You will receive a Job Description and a candidate's Resume text.

Analyze deeply and return ONLY a valid JSON object with this exact structure. No markdown, no code fences, no extra text:

{
  "ats_score": <integer 0-100>,
  "missing_keywords": [<keywords from JD missing in resume>],
  "optimization_suggestions": [<4-6 specific, actionable improvement tips>],
  "generated_variants": [
    {
      "style_name": "Professional Default",
      "contact": {
        "name": "<full name>",
        "email": "<email>",
        "phone": "<phone>",
        "linkedin": "<linkedin url or empty string>",
        "github": "<github url or empty string>",
        "location": "<city or empty string>"
      },
      "summary": "<2-3 sentence professional summary tailored to JD>",
      "skills": {
        "languages": "<comma separated>",
        "frameworks": "<comma separated>",
        "tools": "<comma separated>",
        "soft_skills": "<comma separated>"
      },
      "experience": [
        {
          "title": "<job title>",
          "company": "<company>",
          "duration": "<dates>",
          "bullets": ["<achievement bullet 1>", "<achievement bullet 2>"]
        }
      ],
      "projects": [
        {
          "name": "<project name>",
          "tech": "<tech stack>",
          "duration": "<dates>",
          "bullets": ["<bullet 1>", "<bullet 2>"]
        }
      ],
      "education": [
        {
          "degree": "<degree name>",
          "institution": "<university>",
          "duration": "<dates>",
          "gpa": "<gpa or empty string>"
        }
      ],
      "certifications": ["<cert 1>", "<cert 2>"],
      "achievements": ["<achievement 1>", "<achievement 2>"]
    },
    {
      "style_name": "Modern Action-Oriented",
      "contact": { "name": "<full name>", "email": "<email>", "phone": "<phone>", "linkedin": "<linkedin>", "github": "<github>", "location": "" },
      "summary": "<punchy, action-verb-heavy 2-3 sentence summary>",
      "skills": { "languages": "<>", "frameworks": "<>", "tools": "<>", "soft_skills": "<>" },
      "experience": [],
      "projects": [],
      "education": [],
      "certifications": [],
      "achievements": []
    },
    {
      "style_name": "Keyword-Maximized",
      "contact": { "name": "<full name>", "email": "<email>", "phone": "<phone>", "linkedin": "<linkedin>", "github": "<github>", "location": "" },
      "summary": "<keyword-dense 2-3 sentence summary using JD terminology>",
      "skills": { "languages": "<>", "frameworks": "<>", "tools": "<>", "soft_skills": "<>" },
      "experience": [],
      "projects": [],
      "education": [],
      "certifications": [],
      "achievements": []
    }
  ]
}

Rules:
- All three variants get the same candidate data but with different writing styles in summary, bullets, and skills emphasis.
- Skills, projects, education, certifications, achievements should be consistent across all variants.
- Tailor each bullet point to highlight relevance to the JD.
- Return ONLY the JSON.`;

const runGroqAnalysis = async (resumeText, jd) => {
  const userMessage = `Job Description:\n${jd}\n\n---\n\nResume:\n${resumeText}`;

  const completion = await groq.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userMessage }
    ],
    temperature: 0.3,
    max_tokens: 6000,
    stream: false,
  });

  const raw = completion.choices[0]?.message?.content || '';
  const cleaned = raw.replace(/```json|```/g, '').trim();

  let parsed;
  try {
    parsed = JSON.parse(cleaned);
  } catch (e) {
    throw new Error(`AI returned invalid JSON. Please try again.`);
  }

  return parsed;
};

module.exports = { runGroqAnalysis };
