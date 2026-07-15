const MODEL_PRIORITY = [
  "gemini-3.1-flash-lite",
  "gemini-3.5-flash",
  "gemini-2.5-flash-lite"
];

const ALLOWED_ORIGINS = [
  "https://poroboy.github.io",
  "http://localhost:5500",
  "http://localhost:5501",
  "http://localhost:4174",
  "http://127.0.0.1:5500",
  "http://127.0.0.1:5501",
  "http://127.0.0.1:4174"
];

function getCorsOrigin(request) {
  const origin = request.headers.get("Origin") || "";
  return ALLOWED_ORIGINS.includes(origin) ? origin : "https://poroboy.github.io";
}


function corsHeaders(origin) {
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin)
    ? origin
    : "https://poroboy.github.io";

  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json"
  };
}

function cleanJsonText(text) {
  return String(text || "")
    .replace(/```json/g, "")
    .replace(/```/g, "")
    .trim();
}

function normalizeName(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/\([^)]*\)/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, "")
    .trim();
}

function isValidAiJson(parsed) {
  return parsed
    && typeof parsed === "object"
    && typeof parsed.reply === "string"
    && Array.isArray(parsed.items)
    && Array.isArray(parsed.suggestions);
}


function toMacroNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(0, n) : 0;
}

function estimateFoodMetabolicFallback(item) {
  const name = String(item?.name || "").toLowerCase();
  const kcal = toMacroNumber(item?.kcal);
  const protein = toMacroNumber(item?.protein);

  const hasSweetDrink = /ชานม|ชาไทย|น้ำหวาน|น้ำอัดลม|โกโก้|กาแฟหวาน|น้ำผลไม้|หวาน|ไซรัป|นมเย็น/.test(name);
  const hasDessert = /เค้ก|ขนม|โดนัท|คุกกี้|ไอศกรีม|บิงซู|บราวนี่|พาย|ครัวซองต์/.test(name);
  const hasRice = /ข้าว|ข้าวหุง|ข้าวสวย|ข้าวเปล่า|ข้าวเหนียว/.test(name);
  const hasNoodle = /เส้น|ก๋วยเตี๋ยว|บะหมี่|ราเมน|พาสต้า|สปาเกตตี|มาม่า/.test(name);
  const hasBread = /ขนมปัง|แซนด์วิช|โรตี|แป้ง|พิซซ่า|เบอร์เกอร์/.test(name);
  const hasStarchy = /มันฝรั่ง|มันหวาน|เผือก|ข้าวโพด/.test(name);
  const hasVeg = /ผัก|กะหล่ำ|แครอท|บรอก|คะน้า|ผักบุ้ง|สลัด|เห็ด|แตง|มะเขือ/.test(name);
  const proteinOnly = /อกไก่|ไก่|หมู|เนื้อ|ปลา|ไข่|เวย์|โปรตีน|เต้าหู้/.test(name) &&
    !(hasRice || hasNoodle || hasBread || hasStarchy || hasSweetDrink || hasDessert);

  let carb = 0;
  let sugar = 0;
  let fiber = 0;

  if (hasRice) {
    carb = Math.max(carb, Math.round((kcal * 0.88) / 4));
    fiber = Math.max(fiber, 1);
  }

  if (hasNoodle || hasBread || hasStarchy) {
    carb = Math.max(carb, Math.round((kcal * 0.65) / 4));
    sugar = Math.max(sugar, hasBread ? 4 : 1);
    fiber = Math.max(fiber, 1);
  }

  if (hasVeg) {
    carb = Math.max(carb, Math.min(12, Math.round(Math.max(5, kcal * 0.35 / 4))));
    sugar = Math.max(sugar, 2);
    fiber = Math.max(fiber, 2);
  }

  if (hasSweetDrink) {
    sugar = Math.max(sugar, Math.round((kcal * 0.75) / 4));
    carb = Math.max(carb, sugar);
  }

  if (hasDessert) {
    carb = Math.max(carb, Math.round((kcal * 0.6) / 4));
    sugar = Math.max(sugar, Math.round((kcal * 0.32) / 4));
    fiber = Math.max(fiber, 1);
  }

  if (carb === 0 && kcal > 0 && !proteinOnly) {
    const residual = Math.max(0, kcal - protein * 4);
    carb = Math.round((residual * 0.35) / 4);
  }

  sugar = Math.max(0, Math.min(sugar, carb));
  fiber = Math.max(0, Math.min(fiber, carb));

  return { carb, sugar, fiber };
}

function estimateGlucoseSpikeRisk(item) {
  const carb = toMacroNumber(item.carb ?? item.carbs ?? item.carbohydrate);
  const sugar = toMacroNumber(item.sugar);
  const fiber = toMacroNumber(item.fiber);
  const protein = toMacroNumber(item.protein);

  if (carb >= 70 || sugar >= 25 || (carb >= 50 && fiber < 3 && protein < 15)) return "high";
  if (carb >= 35 || sugar >= 12 || (carb >= 25 && fiber < 2 && protein < 10)) return "medium";
  return "low";
}

function normalizeMetabolicItems(parsed) {
  if (!parsed || !Array.isArray(parsed.items)) return parsed;

  parsed.items = parsed.items.map(item => {
    if (!item || item.type !== "food") return item;

    const hasAny =
      item.carb !== undefined ||
      item.carbs !== undefined ||
      item.carbohydrate !== undefined ||
      item.sugar !== undefined ||
      item.fiber !== undefined;

    let carb;
    let sugar;
    let fiber;

    if (hasAny) {
      carb = toMacroNumber(item.carb ?? item.carbs ?? item.carbohydrate);
      sugar = toMacroNumber(item.sugar);
      fiber = toMacroNumber(item.fiber);
    } else {
      const estimated = estimateFoodMetabolicFallback(item);
      carb = estimated.carb;
      sugar = estimated.sugar;
      fiber = estimated.fiber;
      item.metabolicEstimated = true;
    }

    item.carb = carb;
    item.sugar = sugar;
    item.fiber = fiber;
    item.spikeRisk = item.spikeRisk || item.glucoseSpikeRisk || estimateGlucoseSpikeRisk(item);

    return item;
  });

  return parsed;
}


async function callGeminiModel(model, prompt, env) {
  const startedAt = Date.now();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 12000);
  const generationConfig = {
    temperature: 0.25,
    responseMimeType: "application/json",
    maxOutputTokens: 1536
  };

  if (model === "gemini-3.5-flash") {
    generationConfig.thinkingConfig = { thinkingLevel: "low" };
  }
  if (model.startsWith("gemini-2.5-")) {
    generationConfig.thinkingConfig = { thinkingBudget: 0 };
  }

  let res;
  try {
    res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": env.GEMINI_API_KEY
        },
        signal: controller.signal,
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [{ text: prompt }]
            }
          ],
          generationConfig
        })
      }
    );
  } catch (err) {
    return {
      ok: false,
      model,
      status: err?.name === "AbortError" ? 408 : 503,
      elapsedMs: Date.now() - startedAt,
      detail: {
        error: {
          status: err?.name === "AbortError" ? "MODEL_TIMEOUT" : "MODEL_REQUEST_FAILED",
          message: String(err?.message || err)
        }
      }
    };
  } finally {
    clearTimeout(timeoutId);
  }

  const data = await res.json().catch(() => ({
    error: {
      status: "INVALID_RESPONSE",
      message: "Invalid Gemini response"
    }
  }));

  if (!res.ok) {
    return {
      ok: false,
      model,
      status: res.status,
      elapsedMs: Date.now() - startedAt,
      detail: data
    };
  }

  const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";

  try {
    const parsed = JSON.parse(cleanJsonText(rawText));

    if (!isValidAiJson(parsed)) {
      return {
        ok: false,
        model,
        status: 200,
        elapsedMs: Date.now() - startedAt,
        detail: {
          error: {
            status: "INVALID_AI_JSON_STRUCTURE",
            message: "AI returned JSON but structure is invalid"
          },
          rawText
        }
      };
    }

    return {
      ok: true,
      model,
      elapsedMs: Date.now() - startedAt,
      parsed
    };
  } catch (err) {
    return {
      ok: false,
      model,
      status: 200,
      elapsedMs: Date.now() - startedAt,
      detail: {
        error: {
          status: "INVALID_AI_JSON_PARSE",
          message: err.message
        },
        rawText
      }
    };
  }
}

async function callGeminiWithFallback(prompt, env) {
  const startedAt = Date.now();
  const triedModels = [];

  for (const model of MODEL_PRIORITY) {
    const result = await callGeminiModel(model, prompt, env);

    triedModels.push({
      model,
      status: result.status || 200,
      elapsedMs: result.elapsedMs || 0,
      errorStatus: result.detail?.error?.status || null,
      message: result.detail?.error?.message || null
    });

    if (result.ok) {
      return {
        ok: true,
        parsed: result.parsed,
        model,
        fallbackFrom: model !== MODEL_PRIORITY[0] ? MODEL_PRIORITY[0] : null,
        processingMs: Date.now() - startedAt,
        triedModels
      };
    }
  }

  return {
    ok: false,
    detail: {
      error: "Gemini API error",
      message: "All Gemini models failed",
      triedModels
    }
  };
}


function normalizeFoodMacroFieldsV1(item) {
  if (!item || typeof item !== "object") return item;

  const category = String(item.category || item.type || "").toLowerCase();
  if (category !== "food") return item;

  const n = (value) => {
    const num = Number(String(value ?? "").replace(",", "."));
    return Number.isFinite(num) && num >= 0 ? Math.round(num) : 0;
  };

  const name = String(item.name || "").toLowerCase();
  const kcal = n(item.kcal);
  const protein = n(item.protein);

  let carb = n(item.carb ?? item.carbs ?? item.carbohydrate);
  let sugar = n(item.sugar);
  let fiber = n(item.fiber);
  let spikeRisk = item.spikeRisk || item.glucoseSpikeRisk || "";

  if (!carb && !sugar && !fiber) {
    if (/เวย์|whey|protein|โปรตีน/.test(name)) {
      carb = 2;
      sugar = 1;
      fiber = 0;
    } else if (/ข้าว|เส้น|ก๋วยเตี๋ยว|บะหมี่|ขนมปัง|แป้ง|มัน|เผือก|rice|noodle|bread|pasta/.test(name)) {
      carb = Math.max(25, Math.round(kcal * 0.45 / 4));
      sugar = 2;
      fiber = 2;
    } else if (/น้ำหวาน|ชาเย็น|ชานม|น้ำอัดลม|ขนม|เค้ก|โดนัท|ไอศกรีม|sweet|dessert|soda|milk tea/.test(name)) {
      carb = Math.max(20, Math.round(kcal * 0.55 / 4));
      sugar = Math.max(12, Math.round(carb * 0.55));
      fiber = 0;
    }
  }

  if (!spikeRisk) {
    if (sugar >= 20 || carb >= 60) spikeRisk = "สูง";
    else if (sugar >= 8 || carb >= 30) spikeRisk = "กลาง";
    else spikeRisk = "ต่ำ";
  }

  return {
    ...item,
    category: "food",
    kcal,
    protein,
    carb,
    sugar,
    fiber,
    spikeRisk
  };
}

function normalizeAiItemsMacroFieldsV1(items) {
  if (!Array.isArray(items)) return [];
  return items.map((item) => normalizeFoodMacroFieldsV1(item));
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders(origin) });
    }

    if (request.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: corsHeaders(origin)
      });
    }

    try {
      const body = await request.json();

      const message = String(body.message || "").trim();
      const currentWeight = body.currentWeight || null;
      const todaySummary = body.todaySummary || {};
      const todayLog = body.todayLog || {};
      const currentTimeContext = body.currentTimeContext || {};
      const userGoal = body.userGoal || {};
      const userProfile = body.userProfile || {};
      const profileMetrics = body.profileMetrics || null;
      const appAnalytics = body.appAnalytics && typeof body.appAnalytics === "object" ? body.appAnalytics : {};
      const chatHistory = Array.isArray(body.chatHistory) ? body.chatHistory.slice(-6) : [];

      if (!message) {
        return new Response(JSON.stringify({ error: "Message is required" }), {
          status: 400,
          headers: corsHeaders(origin)
        });
      }

      const prompt = `
You are a friendly Thai health, food, and kcal assistant inside a personal tracker app.

The user may:
1. Ask health/food/workout questions.
2. Tell you what they ate.
3. Tell you what exercise they did.
4. Mix logging and asking in the same message.

Your job:
Return structured JSON only.

Important behavior:
- If the user is only asking for advice, do NOT create log items.
- If the user clearly says they ate/drank something, create food log items.
- If the user clearly says they exercised, create exercise log items.
- If the message is mixed, answer the question and create log items.
- For food items, estimate protein in grams and return protein as a number.
- Estimate carbohydrate, sugar, and fiber in grams for food items.
- For food items, return carb, sugar, fiber, and spikeRisk.
- spikeRisk means estimated glucose spike risk, not actual insulin measurement.
- Use spikeRisk values: "low", "medium", or "high".
- High risk examples: sweet drinks, desserts, large white rice/noodle portions, low fiber + high sugar meals.
- Lower risk examples: protein-rich meals with vegetables, higher fiber carbs, low sugar meals.
- For exercise items, protein should be 0.
- If protein is unclear, estimate based on a normal portion.
- If a food/exercise item already exists in today's log and the user says it as context such as "กินไปแล้ว", "ทำไปแล้ว", "เมื่อกี้", or asks advice based on it, do not create a duplicate log item.
- Estimate kcal reasonably when exact amount is missing.
- For Thai food, use normal Thai portion estimates.
- Use today's kcal context to make useful suggestions.
- Use current day part and local time when giving meal, snack, workout, or sleep-related advice.
- Use profile metrics such as BMR, TDEE, BMI, protein target, age, height, gender, and activity level when available.
- For questions about past progress, weight direction, kcal balance, or protein, use App analytics as the authoritative source.
- Clearly distinguish recorded weight from app-estimated or predicted weight.
- Mention the analyzed date range and data coverage when discussing trends.
- Never invent missing history. If there are too few records, say that more data is needed.
- Analysis-only questions must return an empty items array and must not create food or exercise logs.
- Keep reply short, natural, supportive, and in Thai.
- Do not give medical diagnosis or medical treatment.
- If the user mentions serious symptoms, chest pain, fainting, eating disorder behavior, or medical conditions, advise seeing a healthcare professional.

Current user context:
- Current weight: ${currentWeight || "unknown"} kg
- Today's base kcal / TDEE: ${todaySummary.base || 0}
- Today's food kcal: ${todaySummary.food || 0}
- Today's exercise kcal: ${todaySummary.exercise || 0}
- Today's net kcal: ${todaySummary.net || 0}
- Estimated remaining kcal before reaching TDEE: ${Math.max(0, (todaySummary.base || 0) + (todaySummary.exercise || 0) - (todaySummary.food || 0))}
- Final weight goal: ${userGoal.finalGoal || "unknown"} kg
- Current streak: ${userGoal.streak || 0} days
- User profile: ${JSON.stringify(userProfile)}
- Profile metrics: ${JSON.stringify(profileMetrics)}
- Today's food log: ${JSON.stringify(todayLog.food || [])}
- Today's exercise log: ${JSON.stringify(todayLog.exercise || [])}
- Current local date/time context: ${JSON.stringify(currentTimeContext)}
- Current day part: ${currentTimeContext.dayPart || "unknown"}
- Current local time: ${currentTimeContext.displayDate || "unknown"} ${currentTimeContext.displayTime || ""}
- Recent chat history: ${JSON.stringify(chatHistory)}
- App analytics (compact pre-calculated history): ${JSON.stringify(appAnalytics)}

Required JSON schema:
{
  "mode": "chat" | "log" | "mixed" | "clarify",
  "reply": "short Thai reply",
  "items": [
    {
      "category": "food" | "exercise",
      "name": "string",
      "kcal": number,
      "protein": number, "carb": number, "sugar": number, "fiber": number, "spikeRisk": "low" | "medium" | "high",
      "confidence": "low" | "medium" | "high",
      "note": "short Thai note"
    }
  ],
  "suggestions": ["short Thai suggestion 1", "short Thai suggestion 2"]
}

Examples:

User: ข้าวเที่ยงนี้กินอะไรดี
JSON:
{
  "mode": "chat",
  "reply": "ถ้าอยากคุม kcal แนะนำสุกี้น้ำไก่ เกาเหลา หรือข้าวอกไก่ครับ เลือกเมนูที่โปรตีนพอและไม่มันมาก จะอิ่มนานกว่า",
  "items": [],
  "suggestions": ["สุกี้น้ำไก่", "เกาเหลาหมู", "ข้าวอกไก่"]
}

User: วันนี้กินข้าวมันไก่
JSON:
{
  "mode": "log",
  "reply": "เพิ่มข้าวมันไก่ประมาณ 550 kcal ให้แล้วครับ",
  "items": [
    {
      "category": "food",
      "name": "ข้าวมันไก่",
      "kcal": 550,
      "protein": 25,
      "confidence": "medium",
      "note": "ประเมินจากข้าวมันไก่ 1 จานปกติ"
    }
  ],
  "suggestions": []
}

User: วันนี้กินข้าวมันไก่ไปแล้ว เย็นนี้กินอะไรดี
JSON:
{
  "mode": "mixed",
  "reply": "เห็นว่ากินข้าวมันไก่ไปแล้วครับ มื้อเย็นแนะนำเมนูเบา ๆ โปรตีนดี เช่น สุกี้น้ำไก่ เกาเหลา หรือไข่ต้มกับผัก เพื่อคุม kcal รวมของวัน",
  "items": [],
  "suggestions": ["สุกี้น้ำไก่", "เกาเหลา", "ไข่ต้มกับผัก"]
}

User: Cardio 20m
JSON:
{
  "mode": "log",
  "reply": "เพิ่ม Cardio 20 นาที เผาผลาญประมาณ 150 kcal ให้แล้วครับ",
  "items": [
    {
      "category": "exercise",
      "name": "Cardio 20 นาที",
      "kcal": 150,
      "protein": 0,
      "confidence": "medium",
      "note": "ประเมินจากการคาร์ดิโอระดับกลาง"
    }
  ],
  "suggestions": []
}

User message:
${message}
`;

      const fallbackResult = await callGeminiWithFallback(prompt, env);

      if (!fallbackResult.ok) {
        return new Response(
          JSON.stringify({
            error: "Gemini API error",
            detail: fallbackResult.detail
          }),
          {
            status: 500,
            headers: corsHeaders(origin)
          }
        );
      }

      const parsed = fallbackResult.parsed;

      const messageLooksContextual = /(ไปแล้ว|ทำแล้ว|กินแล้ว|เมื่อกี้|ก่อนหน้านี้|แล้ว\s*เย็นนี้|แล้ว\s*ต่อ)/i.test(message);

      if (messageLooksContextual && parsed.items.length) {
        const existingFood = Array.isArray(todayLog.food) ? todayLog.food : [];
        const existingExercise = Array.isArray(todayLog.exercise) ? todayLog.exercise : [];

        parsed.items = parsed.items.filter(item => {
          const itemName = normalizeName(item.name);
          const existingList = item.category === "exercise" ? existingExercise : existingFood;

          const isDuplicate = existingList.some(logItem => {
            const logName = normalizeName(logItem.name);
            return itemName && logName && (logName.includes(itemName) || itemName.includes(logName));
          });

          return !isDuplicate;
        });
      }

      parsed.model = fallbackResult.model;
      parsed.fallbackFrom = fallbackResult.fallbackFrom;
      parsed.triedModels = fallbackResult.triedModels;
      parsed.processingMs = fallbackResult.processingMs;

      return new Response(JSON.stringify(parsed), {
        headers: corsHeaders(origin)
      });
    } catch (err) {
      return new Response(
        JSON.stringify({
          error: "Worker error",
          detail: String(err?.message || err)
        }),
        {
          status: 500,
          headers: corsHeaders(origin)
        }
      );
    }
  }
};


/*
IMPORTANT FOOD ITEM RULE:
For every item where category is "food", you MUST return all of these numeric fields:
- kcal
- protein
- carb
- sugar
- fiber
And also return:
- spikeRisk: one of "ต่ำ", "กลาง", "สูง"

Estimate carb, sugar, and fiber even when the user does not mention them.
Use realistic Thai food estimates.
For protein-only items such as whey/protein drink, use low carb, low sugar, low fiber unless stated otherwise.
For sweet drinks, dessert, rice, noodles, bread, and starchy food, estimate higher carb/sugar and set spikeRisk accordingly.

*/
