const config = require('config');
const { App } = require('@slack/bolt');

const app = new App({
    token: config.slack.bot_access_token,
    signingSecret: config.slack.signing_secret
});

// Listens to incoming messages that contain "hello"
app.message('hello', async ({ message, say }) => {

    console.log(message);

    // say() sends a message to the channel where the event was triggered
    await say(`Hey there <@${message.user}>!`);
});

// The open_modal shortcut opens a plain old modal
app.shortcut('create_puzzle', async ({ shortcut, ack, client }) => {

    try {
        // Acknowledge shortcut request
        await ack();

        console.log(shortcut);
        console.log(client);

        // Call the views.open method using one of the built-in WebClients
        const result = await client.views.open({
            trigger_id: shortcut.trigger_id,
            view: {
                "type": "modal",
                "callback_id": "submit_puzzle",
                "title": {
                    "type": "plain_text",
                    "text": "My App",
                    "emoji": true
                },
                "submit": {
                    "type": "plain_text",
                    "text": "Create Puzzle",
                    "emoji": true
                },
                "close": {
                    "type": "plain_text",
                    "text": "Cancel",
                    "emoji": true
                },
                "blocks": [
                    {
                        "type": "image",
                        "image_url": "https://www.thewordfinder.com/wof-puzzle-generator/puzzle.php?bg=1&ln1=&ln2=WHEEL%20OF&ln3=FORTUNE&ln4=&cat=&",
                        "alt_text": "Wheel of Fortune"
                    },
                    {
                        "type": "input",
                        "block_id": "line1",
                        "element": {
                            "type": "plain_text_input",
                            "action_id": "input",
                            "max_length": 12
                        },
                        "label": {
                            "type": "plain_text",
                            "text": "Line 1 (max 12 letters)",
                            "emoji": true
                        },
                        "optional": true
                    },
                    {
                        "type": "input",
                        "block_id": "line2",
                        "element": {
                            "type": "plain_text_input",
                            "action_id": "input",
                            "max_length": 14,
                            "initial_value": "WHEEL OF"
                        },
                        "label": {
                            "type": "plain_text",
                            "text": "Line 2 (max 14 letters)",
                            "emoji": true
                        },
                        "optional": true
                    },
                    {
                        "type": "input",
                        "block_id": "line3",
                        "element": {
                            "type": "plain_text_input",
                            "action_id": "input",
                            "max_length": 14,
                            "initial_value": "FORTUNE"
                        },
                        "label": {
                            "type": "plain_text",
                            "text": "Line 3 (max 14 letters)",
                            "emoji": true
                        },
                        "optional": true
                    },
                    {
                        "type": "input",
                        "block_id": "line4",
                        "element": {
                            "type": "plain_text_input",
                            "action_id": "input",
                            "max_length": 12
                        },
                        "label": {
                            "type": "plain_text",
                            "text": "Line 4 (max 12 letters)",
                            "emoji": true
                        },
                        "optional": true
                    },
                    {
                        "block_id": "channel",
                        "type": "input",
                        "label": {
                            "type": "plain_text",
                            "text": "Select a channel to post puzzle to",
                        },
                        "element": {
                            "action_id": "input",
                            "type": "conversations_select",
                            "response_url_enabled": true,
                            "default_to_current_conversation": true
                        },
                        "optional": false
                    },                    
                ]
            }
        });

        console.log(result);
    }
    catch (error) {
        console.error(error);
    }
});

// Handle a view_submission event
app.view('submit_puzzle', async ({ ack, body, view, context }) => {
    // Acknowledge the view_submission event
    await ack();

    console.log(view.state.values);

    const lines = [];

    lines[0] = view['state']['values']['line1']['input']['value'] ?? '';
    lines[1] = view['state']['values']['line2']['input']['value'] ?? '';
    lines[2] = view['state']['values']['line3']['input']['value'] ?? '';
    lines[3] = view['state']['values']['line4']['input']['value'] ?? '';

    for (var index in lines) {
        lines[index] = lines[index].replace(" ", "%20");
        lines[index] = lines[index].replace(/[a-zA-Z]/g, "_");
    }

    const channelId = view['state']['values']['channel']['input']['selected_conversation'];

    const imageUri = `https://www.thewordfinder.com/wof-puzzle-generator/puzzle.php?bg=1&ln1=${lines[0]}&ln2=${lines[1]}&ln3=${lines[2]}&ln4=${lines[3]}&cat=&`;

    try {
        await app.client.chat.postMessage({
            token: context.botToken,
            channel: channelId,
            blocks: [
                {
                    "type": "image",
                    "image_url": imageUri,
                    "alt_text": "Wheel of Fortune"
                }
            ]
        });
    }
    catch (error) {
        console.error(error);
    }

});

(async () => {
    // Start your app
    await app.start(config.port);

    console.log('⚡️ Bolt app is running!');
})();