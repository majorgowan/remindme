const Cerebras = require("@cerebras/cerebras_cloud_sdk");

const client = new Cerebras({
    apiKey: process.env.CEREBRAS_API_KEY,
    maxRetries: 8
});

async function askCerebras(content, response_format = null, temperature = 0.2, max_completion_tokens = 1024) {
    try {
        const response = await client.chat.completions.create({
            model: process.env.CEREBRAS_MODEL,
            max_completion_tokens: max_completion_tokens,
            temperature: temperature,
            stream: false,
            response_format: response_format,
            reasoning_effort: "low",
            messages: [
                {
                    role: "user",
                    content: content
                }
            ]
        });

        return response;

    } catch (error) {
        console.error("Error: ", error.status, error.name, error.message);
        throw error;
    }
}


async function analyze(text, verbose=false) {
    // generate the content for asking cerebras
    const currentTime = new Date();

    const prompt = `
        Please process the following text representing a REMINDER for a future task or event:
        
        ==================
        ${text}
        ==================
        
        The current date is ${currentTime.toISOString().split("T")[0]} and the time is ${currentTime.toLocaleTimeString()}.
        
        The reminder time may be described as a time, such as "four o'clock", or a relative time like "this evening"
        or "tomorrow morning", in which case assume 8 AM ("morning"), 12 PM ("afternoon"), 4 PM ("evening"), and 8 PM ("night").
        
        If no time is specified, use the current time.
        
        The time should be expressed as a string in 24-hour time, such as "15:00" for 3 o'clock.
        
        If no date information is provided, assume the reminder is for TODAY ${new Date().toString().split("T")[0]}
        or TOMORROW if the time has already passed today.
        
        If the text implies that the task should be repeated, please infer
        - a rhythm - one of "DAILY", "WEEKLY" or "MONTHLY",
        - an integer frequency - where 1 means every day/week/month, 2 means every second day/week/month, etc. (default 1),
        - an integer number of times to repeat (default null for "NEVER ENDS").
        
        If applicable, identify a CATEGORY for the reminder - either "personal" or "work".
        
        If applicable, identify an urgency level - one of "NOT URGENT", "URGENT", "VERY URGENT".  You
        may use the tone of the text to infer the urgency.
        
        The WHAT field in your response should be a summary of the task or event without the time/date/repeat/urgency information.
    `;

    const response_format = {
        "type": "json_schema",
        "json_schema": {
            "name": "reminder",
            "schema": {
                "type": "object",
                "properties": {
                    "what": {"type": "string"},
                    "date": {"type": "string"},
                    "time": {"type": "string"},
                    "category": {
                        "type": "string",
                        "enum": ["personal", "work"]
                    },
                    "repeat": {
                        "type": "string",
                        "enum": ["never", "daily", "weekly", "monthly"]
                    },
                    "frequency": {"type": "integer"},
                    "number of times": {"type": "integer"},
                    "urgency": {
                        "type": "string",
                        "enum": ["not urgent", "urgent", "very urgent"]
                    }
                },
                "required": ["what", "date", "time", "repeat"],
                "additionalProperties": false
            },
            "strict": true
        }
    };

    if (verbose) console.log(prompt);

    return await askCerebras(prompt, response_format);
}


module.exports = { analyze };
