const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const db = require('./db');
const { GoogleGenAI, Type } = require('@google/genai');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// -------------------------------------------------------------------------
// POLYMORPHIC SCHEMA (Strict validation for both Layouts)
// -------------------------------------------------------------------------
const polymorphicSchema = {
    type: Type.OBJECT,
    properties: {
        title: { type: Type.STRING },
        scaffold_type: { type: Type.STRING },
        high_level_overview: { type: Type.STRING },
        
        // --- MICRO SAAS LAYOUT ---
        structural_risks: {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: {
                    risk_title: { type: Type.STRING },
                    risk_description: { type: Type.STRING },
                    mitigation_protocol: { type: Type.STRING }
                },
                required: ["risk_title", "risk_description", "mitigation_protocol"]
            }
        },
        blueprint_specs: {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: {
                    spec_label: { type: Type.STRING },
                    structured_content: { type: Type.STRING }
                },
                required: ["spec_label", "structured_content"]
            }
        },
        milestone_tasks: {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: {
                    phase_number: { type: Type.INTEGER },
                    phase_title: { type: Type.STRING },
                    task_name: { type: Type.STRING },
                    action_item: { type: Type.STRING },
                    technical_dependency: { type: Type.STRING }
                },
                required: ["phase_number", "task_name", "action_item"]
            }
        },

        // --- OPPORTUNITY & GRANT LAYOUT ---
        provider: { type: Type.STRING },
        funding_amount: { type: Type.STRING },
        deadline: { type: Type.STRING },
        target_audience: { type: Type.STRING },
        effort_level: { type: Type.STRING },
        core_requirements: {
            type: Type.ARRAY,
            items: { type: Type.STRING }
        },
        eligibility_blueprint: {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: {
                    criterion_label: { type: Type.STRING },
                    structured_content: { type: Type.STRING }
                },
                required: ["criterion_label", "structured_content"]
            }
        },
        action_playbook: {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: {
                    phase_title: { type: Type.STRING },
                    action_item: { type: Type.STRING },
                    technical_dependency: { type: Type.STRING }
                },
                required: ["phase_title", "action_item"]
            }
        }
    },
    required: ["title", "scaffold_type", "high_level_overview"]
};

// Schema wrapper for the Chat endpoint to guarantee response safety
const chatResponseSchema = {
    type: Type.OBJECT,
    properties: {
        chat_reply: { type: Type.STRING },
        updated_scaffold_data: polymorphicSchema
    },
    required: ["chat_reply", "updated_scaffold_data"]
};

// -------------------------------------------------------------------------
// AUTOMATED MODEL FALLBACK ENGINE
// -------------------------------------------------------------------------
// -------------------------------------------------------------------------
// AUTOMATED MODEL FALLBACK ENGINE
// -------------------------------------------------------------------------
async function generateWithFallback({ contents, systemInstruction, responseSchema, temperature = 0.25, signal }) {
    const modelCascade = ['gemini-2.5-flash', 'gemini-flash-latest', 'gemini-2.5-flash-lite'];
    let lastError = null;

    for (const modelName of modelCascade) {
        try {
            console.log(`[AI CASCADE] Attempting generation with Model: ${modelName}`);
            
            const config = {
                systemInstruction: systemInstruction,
                responseMimeType: "application/json",
                temperature: temperature
            };

            // INJECT THE ABORT SIGNAL SAFELY
            if (signal) config.abortSignal = signal;
            if (responseSchema) config.responseSchema = responseSchema;

            const response = await ai.models.generateContent({
                model: modelName,
                contents: contents,
                config: config
            });

            console.log(`[AI CASCADE] Success using resource node: ${modelName}`);
            return response;

        } catch (error) {
            // SAFELY CHECK FOR USER ABORT
            if (error.name === 'AbortError' || (signal && signal.aborted)) {
                console.warn(`[AI CASCADE] Generation manually aborted by user.`);
                throw error; 
            }

            lastError = error;
            const statusCode = error.status || (error.error && error.error.code);
            
            if (statusCode === 503 || statusCode === 429 || String(error.message).includes('demand') || String(error.message).includes('UNAVAILABLE')) {
                console.warn(`[AI CASCADE WARNING] ${modelName} returned status ${statusCode || 'Transient Error'}. Switching to fallback...`);
                continue; 
            }
            console.error(`[AI CASCADE CRITICAL] Non-transient error caught on ${modelName}. Aborting.`);
            throw error;
        }
    }
    throw new Error(`All models in cascade failed. Underlying issue: ${lastError?.message || lastError}`);
}

// -------------------------------------------------------------------------
// DATABASE MAPPER (Translates objects into existing SQL Columns natively)
// -------------------------------------------------------------------------
async function saveScaffoldDetailsToDb(connection, scaffoldId, type, generatedData) {
    if (type === 'OPPORTUNITY') {
        // 1. Map single values to specs
        const metaFields = ['provider', 'funding_amount', 'deadline', 'target_audience', 'effort_level'];
        for (const field of metaFields) {
            if (generatedData[field]) {
                await connection.query(
                    `INSERT INTO blueprint_specs (scaffold_id, spec_label, structured_content) VALUES (?, ?, ?)`,
                    [scaffoldId, `opp_${field}`, JSON.stringify(generatedData[field])]
                );
            }
        }
        
        // 2. Map core requirements array to specs
        if (Array.isArray(generatedData.core_requirements)) {
            for (const req of generatedData.core_requirements) {
                await connection.query(
                    `INSERT INTO blueprint_specs (scaffold_id, spec_label, structured_content) VALUES (?, ?, ?)`,
                    [scaffoldId, 'opp_core_requirement', JSON.stringify(req)]
                );
            }
        }
        
        // 3. Map eligibility array to structural_risks columns
        if (Array.isArray(generatedData.eligibility_blueprint)) {
            for (const criterion of generatedData.eligibility_blueprint) {
                await connection.query(
                    `INSERT INTO structural_risks (scaffold_id, risk_title, risk_description, mitigation_protocol) VALUES (?, ?, ?, ?)`,
                    [scaffoldId, criterion.criterion_label, criterion.structured_content, 'N/A']
                );
            }
        }
        
        // 4. Map playbook array to milestone_tasks columns
        if (Array.isArray(generatedData.action_playbook)) {
            for (let i = 0; i < generatedData.action_playbook.length; i++) {
                const step = generatedData.action_playbook[i];
                await connection.query(
                    `INSERT INTO milestone_tasks (scaffold_id, phase_number, phase_title, task_name, action_item, technical_dependency) VALUES (?, ?, ?, ?, ?, ?)`,
                    [scaffoldId, i + 1, step.phase_title, 'Action Step', step.action_item, step.technical_dependency || 'None']
                );
            }
        }
    } else {
        // --- Standard Micro SaaS mapping ---
        if (Array.isArray(generatedData.structural_risks)) {
            for (const risk of generatedData.structural_risks) {
                await connection.query(
                    `INSERT INTO structural_risks (scaffold_id, risk_title, risk_description, mitigation_protocol) VALUES (?, ?, ?, ?)`,
                    [scaffoldId, risk.risk_title, risk.risk_description, risk.mitigation_protocol]
                );
            }
        }
        if (Array.isArray(generatedData.blueprint_specs)) {
            for (const spec of generatedData.blueprint_specs) {
                const safeJsonString = JSON.stringify(spec.structured_content);
                await connection.query(
                    `INSERT INTO blueprint_specs (scaffold_id, spec_label, structured_content) VALUES (?, ?, ?)`,
                    [scaffoldId, spec.spec_label, safeJsonString]
                );
            }
        }
        if (Array.isArray(generatedData.milestone_tasks)) {
            for (const task of generatedData.milestone_tasks) {
                await connection.query(
                    `INSERT INTO milestone_tasks (scaffold_id, phase_number, phase_title, task_name, action_item, technical_dependency) VALUES (?, ?, ?, ?, ?, ?)`,
                    [scaffoldId, task.phase_number, task.phase_title || `Phase ${task.phase_number}`, task.task_name, task.action_item, task.technical_dependency]
                );
            }
        }
    }
}

// -------------------------------------------------------------------------
// COMPATIBILITY ENDPOINTS
// -------------------------------------------------------------------------
app.get('/api/conversations', async (req, res) => {
    try {
        const [rows] = await db.query('SELECT id AS scaffold_id, title, scaffold_type FROM scaffolds ORDER BY id DESC');
        res.status(200).json({ success: true, data: rows });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/conversations/:scaffoldId/history', async (req, res) => {
    try {
        const { scaffoldId } = req.params;
        const [messages] = await db.query(
            'SELECT role, message_text FROM scaffold_messages WHERE scaffold_id = ? ORDER BY created_at ASC',
            [scaffoldId]
        );
        res.status(200).json({ success: true, messages });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// -------------------------------------------------------------------------
// GENERATE ROUTE (Initial creation)
// -------------------------------------------------------------------------
app.post('/api/generate', async (req, res) => {
    // Correctly parses whichever mode your frontend passes
    const { userPrompt, category, mode } = req.body;
    const selectedMode = mode || category || "MICRO_SAAS";

    if (!userPrompt) {
        return res.status(400).json({ error: "Missing prompt query parameter." });
    }

    try {
        const systemInstruction = `
        You are the Universal Zero-to-One Scaffold Engine.
        The user has explicitly selected the workspace mode: ${selectedMode}.
        
        CRITICAL RULES:
        1. Set the specific JSON field 'scaffold_type' to exactly: "${selectedMode}".
        2. If mode is 'MICRO_SAAS', act as a Principal Systems Architect. Fully populate: structural_risks, blueprint_specs, and milestone_tasks arrays. Leave all Opportunity fields empty/null.
        3. If mode is 'OPPORTUNITY', act as a Strategic Navigator for grants and hackathons. Fully populate: provider, funding_amount, deadline, target_audience, effort_level, core_requirements, eligibility_blueprint, and action_playbook. Leave Micro SaaS arrays empty/null.
        
        Output ONLY raw valid JSON matching the schema.
        `;

        const response = await generateWithFallback({
            contents: userPrompt,
            systemInstruction: systemInstruction,
            responseSchema: polymorphicSchema,
            temperature: 0.25
        });

        const generatedData = JSON.parse(response.text);
        console.log(`[AI ENGINE] Extracted structured ${generatedData.scaffold_type} payload.`);

        const connection = await db.getConnection();
        try {
            await connection.beginTransaction();

            const [scaffoldResult] = await connection.query(
                `INSERT INTO scaffolds (title, scaffold_type, raw_user_input, high_level_overview) VALUES (?, ?, ?, ?)`,
                [generatedData.title, generatedData.scaffold_type, userPrompt, generatedData.high_level_overview]
            );
            const scaffoldId = scaffoldResult.insertId;

            // Execute dynamic table translation
            await saveScaffoldDetailsToDb(connection, scaffoldId, generatedData.scaffold_type, generatedData);

            const initialBotMessage = generatedData.scaffold_type === 'OPPORTUNITY'
                ? `I've initialized your Opportunity Workspace for "${generatedData.title}". Let me know if you want to refine your pitch or break down specific requirements.`
                : `I've initialized the Micro SaaS architecture for "${generatedData.title}". What specific adjustments would you like to make to this structure?`;

            await connection.query(
                'INSERT INTO scaffold_messages (scaffold_id, role, message_text) VALUES (?, "model", ?)',
                [scaffoldId, initialBotMessage]
            );

            await connection.commit();
            res.status(200).json({ success: true, scaffoldId: scaffoldId, data: generatedData });

        } catch (dbError) {
            await connection.rollback();
            throw dbError;
        } finally {
            connection.release();
        }

    } catch (error) {
        console.error("[GENERATION FAIL]", error);
        res.status(500).json({ success: false, error: "Failed to generate or save scaffold data securely." });
    }
});

// -------------------------------------------------------------------------
// GET INDIVIDUAL SCAFFOLD (Polymorphically builds the JSON for UI)
// -------------------------------------------------------------------------
app.get('/api/scaffolds/:id', async (req, res) => {
    try {
        const scaffoldId = req.params.id;

        const [scaffolds] = await db.query('SELECT * FROM scaffolds WHERE id = ?', [scaffoldId]);
        if (scaffolds.length === 0) return res.status(404).json({ error: "Scaffold structure not found." });
        const scaffold = scaffolds[0];

        const [risks] = await db.query('SELECT * FROM structural_risks WHERE scaffold_id = ?', [scaffoldId]);
        const [specs] = await db.query('SELECT * FROM blueprint_specs WHERE scaffold_id = ?', [scaffoldId]);
        const [tasks] = await db.query('SELECT * FROM milestone_tasks WHERE scaffold_id = ?', [scaffoldId]);

        if (scaffold.scaffold_type === 'OPPORTUNITY') {
            // Reconstruct the flat Opportunity object for the frontend
            const responsePayload = {
                ...scaffold,
                provider: '',
                funding_amount: '',
                deadline: '',
                target_audience: '',
                effort_level: '',
                core_requirements: [],
                eligibility_blueprint: [],
                action_playbook: []
            };

            specs.forEach(s => {
                let cleanVal = s.structured_content;
                try { if(typeof cleanVal === 'string') cleanVal = JSON.parse(cleanVal); } catch(e){}
                
                if (s.spec_label === 'opp_provider') responsePayload.provider = cleanVal;
                else if (s.spec_label === 'opp_funding_amount') responsePayload.funding_amount = cleanVal;
                else if (s.spec_label === 'opp_deadline') responsePayload.deadline = cleanVal;
                else if (s.spec_label === 'opp_target_audience') responsePayload.target_audience = cleanVal;
                else if (s.spec_label === 'opp_effort_level') responsePayload.effort_level = cleanVal;
                else if (s.spec_label === 'opp_core_requirement') responsePayload.core_requirements.push(cleanVal);
            });

            risks.forEach(r => {
                responsePayload.eligibility_blueprint.push({
                    criterion_label: r.risk_title,
                    structured_content: r.risk_description
                });
            });

            tasks.forEach(t => {
                responsePayload.action_playbook.push({
                    phase_title: t.phase_title,
                    action_item: t.action_item,
                    technical_dependency: t.technical_dependency
                });
            });

            res.status(200).json({ success: true, data: responsePayload });
        } else {
            // Standard Micro SaaS output
            const formattedSpecs = specs.map(s => {
                let parsedContent;
                try {
                    parsedContent = typeof s.structured_content === 'string' ? JSON.parse(s.structured_content) : s.structured_content;
                } catch (e) {
                    parsedContent = s.structured_content;
                }
                return { ...s, structured_content: parsedContent };
            });

            res.status(200).json({
                success: true,
                data: {
                    ...scaffold,
                    structural_risks: risks,
                    blueprint_specs: formattedSpecs,
                    milestone_tasks: tasks
                }
            });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// -------------------------------------------------------------------------
// LIVE-SYNC CHAT ENDPOINT (State Modification)
// -------------------------------------------------------------------------
app.post('/api/scaffolds/:id/chat', async (req, res) => {
    const scaffoldId = req.params.id;
    const { userMessage } = req.body;
    

    if (!userMessage) return res.status(400).json({ error: "Missing user message content." });

    // 1. INITIALIZE ABORT CONTROLLER
    const abortController = new AbortController();



    // 2. LISTEN FOR CONNECTION DROP
    req.on('close', () => {
        // If the client disconnects before we finish sending a response, kill the AI request.
        if (!res.writableEnded) {
            console.log('[CLIENT DISCONNECT] Halting Gemini API generation to prevent zombie processes.');
            abortController.abort();
        }
    });



    try {
        const [scaffoldRows] = await db.query('SELECT * FROM scaffolds WHERE id = ?', [scaffoldId]);
        if (scaffoldRows.length === 0) return res.status(404).json({ error: "Scaffold framework not found." });
        const scaffold = scaffoldRows[0];

        const [tasks] = await db.query('SELECT * FROM milestone_tasks WHERE scaffold_id = ?', [scaffoldId]);
        const [specs] = await db.query('SELECT * FROM blueprint_specs WHERE scaffold_id = ?', [scaffoldId]);
        const [risks] = await db.query('SELECT * FROM structural_risks WHERE scaffold_id = ?', [scaffoldId]);

        let currentLayoutState = {
            title: scaffold.title,
            high_level_overview: scaffold.high_level_overview,
            scaffold_type: scaffold.scaffold_type
        };

        // Pass accurate UI state back to the model based on type
        if (scaffold.scaffold_type === 'OPPORTUNITY') {
            currentLayoutState.provider = '';
            currentLayoutState.funding_amount = '';
            currentLayoutState.deadline = '';
            currentLayoutState.target_audience = '';
            currentLayoutState.effort_level = '';
            currentLayoutState.core_requirements = [];
            currentLayoutState.eligibility_blueprint = [];
            currentLayoutState.action_playbook = [];

            specs.forEach(s => {
                let val = s.structured_content; try { val = JSON.parse(val); } catch(e){}
                if (s.spec_label === 'opp_provider') currentLayoutState.provider = val;
                else if (s.spec_label === 'opp_funding_amount') currentLayoutState.funding_amount = val;
                else if (s.spec_label === 'opp_deadline') currentLayoutState.deadline = val;
                else if (s.spec_label === 'opp_target_audience') currentLayoutState.target_audience = val;
                else if (s.spec_label === 'opp_effort_level') currentLayoutState.effort_level = val;
                else if (s.spec_label === 'opp_core_requirement') currentLayoutState.core_requirements.push(val);
            });
            risks.forEach(r => currentLayoutState.eligibility_blueprint.push({ criterion_label: r.risk_title, structured_content: r.risk_description }));
            tasks.forEach(t => currentLayoutState.action_playbook.push({ phase_title: t.phase_title, action_item: t.action_item, technical_dependency: t.technical_dependency }));
        } else {
            currentLayoutState.milestone_tasks = tasks.map(t => ({ phase_number: t.phase_number, phase_title: t.phase_title, task_name: t.task_name, action_item: t.action_item, technical_dependency: t.technical_dependency }));
            currentLayoutState.blueprint_specs = specs.map(s => ({ spec_label: s.spec_label, structured_content: s.structured_content }));
            currentLayoutState.structural_risks = risks.map(r => ({ risk_title: r.risk_title, risk_description: r.risk_description, mitigation_protocol: r.mitigation_protocol }));
        }

        const [historyRows] = await db.query(
            'SELECT role, message_text FROM scaffold_messages WHERE scaffold_id = ? ORDER BY created_at ASC',
            [scaffoldId]
        );
        const formattedHistory = historyRows.map(row => ({ role: row.role, parts: [{ text: row.message_text }] }));

        const systemInstruction = `
        You are an expert AI Copilot. The user is modifying their workspace layout.
        CRITICAL: You must retain the scaffold_type ("${scaffold.scaffold_type}") in your updated_scaffold_data JSON response to ensure database integrity. Format your updates according to that specific layout's rules.
        `;

        const response = await generateWithFallback({
            contents: [
                ...formattedHistory,
                { role: 'user', parts: [{ text: `Current State Layout:\n${JSON.stringify(currentLayoutState)}\n\nUser Request: ${userMessage}` }] }
            ],
            systemInstruction: systemInstruction,
            responseSchema: chatResponseSchema,
            temperature: 0.3,
            signal: abortController.signal // Pass the abort signal to the generation function to enable cancellation if the client disconnects
        });


        const dataPackage = JSON.parse(response.text);
        const { chat_reply, updated_scaffold_data } = dataPackage;

        // Force exact type match for DB mapper logic
        updated_scaffold_data.scaffold_type = scaffold.scaffold_type; 

        const connection = await db.getConnection();
        try {
            await connection.beginTransaction();

            await connection.query('UPDATE scaffolds SET title = ?, high_level_overview = ? WHERE id = ?', 
                [updated_scaffold_data.title, updated_scaffold_data.high_level_overview, scaffoldId]);

            // Clean Slate Pattern: Delete older arrays before writing updates
            await connection.query('DELETE FROM milestone_tasks WHERE scaffold_id = ?', [scaffoldId]);
            await connection.query('DELETE FROM blueprint_specs WHERE scaffold_id = ?', [scaffoldId]);
            await connection.query('DELETE FROM structural_risks WHERE scaffold_id = ?', [scaffoldId]);

            // Save new mappings cleanly
            await saveScaffoldDetailsToDb(connection, scaffoldId, scaffold.scaffold_type, updated_scaffold_data);

            await connection.query('INSERT INTO scaffold_messages (scaffold_id, role, message_text) VALUES (?, "user", ?)', [scaffoldId, userMessage]);
            await connection.query('INSERT INTO scaffold_messages (scaffold_id, role, message_text) VALUES (?, "model", ?)', [scaffoldId, chat_reply]);

            await connection.commit();
            res.status(200).json({ success: true, reply: chat_reply, updatedData: updated_scaffold_data });

        } catch (dbError) {
            await connection.rollback();
            throw dbError;
        } finally {
            connection.release();
        }

    } catch (error) {

        // 4. HANDLE ABORT GRACEFULLY
        if (error.name === 'AbortError' || abortController.signal.aborted) {
            // The client already left; attempting to send res.status() will crash Express.
            return; 
        }

        console.error("[COV CONTEXT LOG EXCEPTION]", error);
        res.status(500).json({ error: "Failed to compile live layout modifications securely." });
    }
});

app.get('/api/health', async (req, res) => {
    try {
        await db.query('SELECT 1 + 1 AS result');
        res.status(200).json({ status: 'healthy', database: 'connected' });
    } catch (error) {
        res.status(500).json({ status: 'unhealthy', error: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`[SERVER] Active and persistent on port ${PORT}`);
});