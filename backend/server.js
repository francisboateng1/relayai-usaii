// server.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { GoogleGenAI, Type } = require('@google/genai');
const db = require('./db'); // Ensure this file exists (see below)

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({ origin: 'https://relayai-usaii.vercel.app', credentials: true }));
app.use(express.json());

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// -------------------------------------------------------------------------
// SCHEMA DEFINITIONS
// -------------------------------------------------------------------------
const polymorphicSchema = {
    type: Type.OBJECT,
    properties: {
        title: { type: Type.STRING },
        scaffold_type: { type: Type.STRING },
        high_level_overview: { type: Type.STRING },
        structural_risks: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { risk_title: { type: Type.STRING }, risk_description: { type: Type.STRING }, mitigation_protocol: { type: Type.STRING } }, required: ["risk_title", "risk_description", "mitigation_protocol"] } },
        blueprint_specs: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { spec_label: { type: Type.STRING }, structured_content: { type: Type.STRING } }, required: ["spec_label", "structured_content"] } },
        milestone_tasks: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { phase_number: { type: Type.INTEGER }, phase_title: { type: Type.STRING }, task_name: { type: Type.STRING }, action_item: { type: Type.STRING }, technical_dependency: { type: Type.STRING } }, required: ["phase_number", "task_name", "action_item"] } },
        provider: { type: Type.STRING }, funding_amount: { type: Type.STRING }, deadline: { type: Type.STRING }, target_audience: { type: Type.STRING }, effort_level: { type: Type.STRING },
        core_requirements: { type: Type.ARRAY, items: { type: Type.STRING } },
        eligibility_blueprint: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { criterion_label: { type: Type.STRING }, structured_content: { type: Type.STRING } }, required: ["criterion_label", "structured_content"] } },
        action_playbook: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { phase_title: { type: Type.STRING }, action_item: { type: Type.STRING }, technical_dependency: { type: Type.STRING } }, required: ["phase_title", "action_item"] } }
    },
    required: ["title", "scaffold_type", "high_level_overview"]
};

const chatResponseSchema = { type: Type.OBJECT, properties: { chat_reply: { type: Type.STRING }, updated_scaffold_data: polymorphicSchema }, required: ["chat_reply", "updated_scaffold_data"] };

// -------------------------------------------------------------------------
// AI ENGINE & DB PERSISTENCE
// -------------------------------------------------------------------------
async function generateWithFallback({ contents, systemInstruction, responseSchema, temperature = 0.25, signal }) {
    const modelCascade = ['gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-1.5-flash-8b'];
    for (const modelName of modelCascade) {
        try {
            const config = { systemInstruction, responseMimeType: "application/json", temperature };
            if (signal) config.abortSignal = signal;
            if (responseSchema) config.responseSchema = responseSchema;
            return await ai.models.generateContent({ model: modelName, contents, config });
        } catch (error) {
            if (error.name === 'AbortError' || (signal && signal.aborted)) throw error;
            console.warn(`[AI CASCADE] ${modelName} failed. Trying fallback...`);
        }
    }
    throw new Error("All models failed.");
}

async function saveScaffoldDetailsToDb(connection, scaffoldId, type, data) {
    if (type === 'OPPORTUNITY') {
        const metaFields = ['provider', 'funding_amount', 'deadline', 'target_audience', 'effort_level'];
        for (const field of metaFields) if (data[field]) await connection.query(`INSERT INTO blueprint_specs (scaffold_id, spec_label, structured_content) VALUES (?, ?, ?)`, [scaffoldId, `opp_${field}`, JSON.stringify(data[field])]);
        if (Array.isArray(data.core_requirements)) for (const req of data.core_requirements) await connection.query(`INSERT INTO blueprint_specs (scaffold_id, spec_label, structured_content) VALUES (?, ?, ?)`, [scaffoldId, 'opp_core_requirement', JSON.stringify(req)]);
        if (Array.isArray(data.eligibility_blueprint)) for (const c of data.eligibility_blueprint) await connection.query(`INSERT INTO structural_risks (scaffold_id, risk_title, risk_description, mitigation_protocol) VALUES (?, ?, ?, ?)`, [scaffoldId, c.criterion_label, c.structured_content, 'N/A']);
        if (Array.isArray(data.action_playbook)) for (let i = 0; i < data.action_playbook.length; i++) await connection.query(`INSERT INTO milestone_tasks (scaffold_id, phase_number, phase_title, task_name, action_item, technical_dependency) VALUES (?, ?, ?, ?, ?, ?)`, [scaffoldId, i + 1, data.action_playbook[i].phase_title, 'Action Step', data.action_playbook[i].action_item, data.action_playbook[i].technical_dependency || 'None']);
    } else {
        if (Array.isArray(data.structural_risks)) for (const r of data.structural_risks) await connection.query(`INSERT INTO structural_risks (scaffold_id, risk_title, risk_description, mitigation_protocol) VALUES (?, ?, ?, ?)`, [scaffoldId, r.risk_title, r.risk_description, r.mitigation_protocol]);
        if (Array.isArray(data.blueprint_specs)) for (const s of data.blueprint_specs) await connection.query(`INSERT INTO blueprint_specs (scaffold_id, spec_label, structured_content) VALUES (?, ?, ?)`, [scaffoldId, s.spec_label, JSON.stringify(s.structured_content)]);
        if (Array.isArray(data.milestone_tasks)) for (const t of data.milestone_tasks) await connection.query(`INSERT INTO milestone_tasks (scaffold_id, phase_number, phase_title, task_name, action_item, technical_dependency) VALUES (?, ?, ?, ?, ?, ?)`, [scaffoldId, t.phase_number, t.phase_title || `Phase ${t.phase_number}`, t.task_name, t.action_item, t.technical_dependency]);
    }
}

// -------------------------------------------------------------------------
// ROUTES
// -------------------------------------------------------------------------
app.post('/api/generate', async (req, res) => {
    const { userPrompt, mode } = req.body;
    try {
        const response = await generateWithFallback({
            contents: userPrompt,
            systemInstruction: `Set scaffold_type to "${mode}". Populate arrays based on mode. Output raw JSON.`,
            responseSchema: polymorphicSchema
        });
        const generatedData = JSON.parse(response.text);
        const connection = await db.getConnection();
        try {
            await connection.beginTransaction();
            const [result] = await connection.query(`INSERT INTO scaffolds (title, scaffold_type, raw_user_input, high_level_overview) VALUES (?, ?, ?, ?)`, [generatedData.title, generatedData.scaffold_type, userPrompt, generatedData.high_level_overview]);
            await saveScaffoldDetailsToDb(connection, result.insertId, generatedData.scaffold_type, generatedData);
            await connection.commit();
            res.status(200).json({ success: true, scaffoldId: result.insertId, data: generatedData });
        } catch (e) { await connection.rollback(); throw e; } finally { connection.release(); }
    } catch (error) { res.status(500).json({ error: error.message }); }
});

app.listen(PORT, () => console.log(`[SERVER] Running on ${PORT}`));