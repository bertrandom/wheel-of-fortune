const config = require('config');
const { App } = require('@slack/bolt');

const Knex = require('knex');
const knexConfig = require('./knexfile');

const { Model } = require('objection');
const { Puzzle } = require('./models/Puzzle');
const { Workspace } = require('./models/Workspace');

var environment = process.env.NODE_ENV;

const knex = Knex(knexConfig[environment]);

Model.knex(knex);

const app = new App({
    signingSecret: config.slack.signing_secret,
    clientId: config.slack.client_id,
    clientSecret: config.slack.client_secret,
    stateSecret: config.slack.state_secret,
    scopes: ['channels:history', 'chat:write', 'commands', 'reactions:write'],
    installationStore: {
        storeInstallation: async (installation) => {

            return await Workspace.query().insert({
                team_id: installation.team.id,
                team_name: installation.team.name,
                install_user_id: installation.user.id,
                bot_id: installation.bot.id,
                bot_user_id: installation.bot.userId,
                bot_access_token: installation.bot.token,
                scopes: JSON.stringify(installation.bot.scopes),
                installation: JSON.stringify(installation),
            });

        },
        fetchInstallation: async (InstallQuery) => {

            var workspace = await Workspace.query().findOne({
                team_id: InstallQuery.teamId
            });

            if (workspace) {
                return JSON.parse(workspace.installation);
            }

            return null;

        },
    },
});

var buildImageUri = function(puzzle) {

    const url = new URL("https://www.thewordfinder.com/wof-puzzle-generator/puzzle.php");

    url.searchParams.append("bg", "1");
    url.searchParams.append("ln1", puzzle.progress_line1);
    url.searchParams.append("ln2", puzzle.progress_line2);
    url.searchParams.append("ln3", puzzle.progress_line3);
    url.searchParams.append("ln4", puzzle.progress_line4);
    url.searchParams.append("cat", puzzle.category);

    return url.href;    

}

var isSolved = function(puzzle) {
    return ((puzzle.answer_line1 === puzzle.progress_line1) && 
        (puzzle.answer_line2 === puzzle.progress_line2) && 
        (puzzle.answer_line3 === puzzle.progress_line3) && 
        (puzzle.answer_line4 === puzzle.progress_line4));
}

var handleGuess = async function(puzzle, guess) {

    var correct = false;

    for (var i = 1; i <= 4; i++) {
        var progressLine = puzzle['progress_line' + i];
        var answerLine = puzzle['answer_line' + i];

        var updatedProgressLine = progressLine.repeat(1);

        for (var j = 0; j < progressLine.length; j++) {
            var progressChar = progressLine[j];
            var answerChar = answerLine[j];
            if (progressChar === '_' && answerChar === guess) {
                updatedProgressLine = updatedProgressLine.substring(0, j) + guess + updatedProgressLine.substring(j + 1);
                correct = true;         
            }
        }
        puzzle['progress_line' + i] = updatedProgressLine;
    }

    if (correct) {
        puzzle = await Puzzle.query().patchAndFetchById(puzzle.id, {
            progress_line1: puzzle.progress_line1,
            progress_line2: puzzle.progress_line2,
            progress_line3: puzzle.progress_line3,
            progress_line4: puzzle.progress_line4,
            solved: isSolved(puzzle),
        });
        return {correct: correct, puzzle: puzzle};
    }

    return { correct: correct, puzzle: puzzle };

}

var getAnswer = function(puzzle) {
    return ([puzzle.answer_line1, puzzle.answer_line2, puzzle.answer_line3, puzzle.answer_line4].join(" ")).trim();
}

var checkAnswer = async function(puzzle, guess) {

    var answer = getAnswer(puzzle);

    if (guess === answer) {
        puzzle = await Puzzle.query().patchAndFetchById(puzzle.id, {
            progress_line1: puzzle.answer_line1,
            progress_line2: puzzle.answer_line2,
            progress_line3: puzzle.answer_line3,
            progress_line4: puzzle.answer_line4,
            solved: true
        });
        return { correct: true, puzzle: puzzle };
    }

    return { correct: false, puzzle: puzzle };

}

var updateThread = async function(puzzle, client) {

    const imageUri = buildImageUri(puzzle);

    var blocks = [
        {
            "type": "image",
            "image_url": imageUri,
            "alt_text": "Wheel of Fortune"
        }
    ];

    if (isSolved(puzzle)) {

        await client.reactions.add({
            channel: puzzle.channel_id,
            timestamp: puzzle.message_ts,
            name: 'tada',
        });

        await client.reactions.add({
            channel: puzzle.channel_id,
            timestamp: puzzle.message_ts,
            name: 'white_check_mark',
        });

    }

    return await client.chat.update({
        channel: puzzle.channel_id,
        ts: puzzle.message_ts,
        blocks: blocks,
    });

}

app.message(async ({ message, client }) => {

    if (message.thread_ts) {

        let correct = false;
        let result = null;
        let puzzle = await Puzzle.query().findOne({
            "team_id": message.team,
            "channel_id": message.channel,
            "message_ts": message.thread_ts
        });

        if (!puzzle) {
            return;
        }

        if (puzzle.solved) {
            return;
        }

        if (message.text.trim().length === 1) {

            var guess = message.text.trim().toUpperCase();
            result = await handleGuess(puzzle, guess);

            correct = result.correct;
            puzzle = result.puzzle;

            await client.reactions.add({
                channel: message.channel,
                timestamp: message.ts,
                name: correct ? 'thumbsup' : 'thumbsdown'
            });
            await updateThread(puzzle, client);

        } else {

            result = await checkAnswer(puzzle, message.text.toUpperCase());
            console.log(result);

            correct = result.correct;
            puzzle = result.puzzle;

            await client.reactions.add({
                channel: message.channel,
                timestamp: message.ts,
                name: correct ? 'tada' : 'no_good'
            });

            if (correct) {
                await updateThread(puzzle, client);
            }

        }

    }

});

// The open_modal shortcut opens a plain old modal
app.shortcut('create_puzzle', async ({ shortcut, ack, client }) => {

    try {
        await ack();

        var exampleImageUri = buildImageUri({
            progress_line1: "",
            progress_line2: "WHEEL OF",
            progress_line3: "FORTUNE",
            progress_line4: "",
            category: "SHOW TITLE"
        });

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
                        "image_url": exampleImageUri,
                        "alt_text": "Wheel of Fortune"
                    },
                    {
                        "type": "input",
                        "block_id": "category",
                        "element": {
                            "type": "plain_text_input",
                            "action_id": "input",
                            "max_length": 32,
                            "initial_value": "SHOW TITLE"
                        },
                        "label": {
                            "type": "plain_text",
                            "text": "Category or Hint",
                            "emoji": true
                        },
                        "optional": true
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

    }
    catch (error) {
        console.error(error);
    }
});

// Handle a view_submission event
app.view('submit_puzzle', async ({ ack, body, view, context }) => {
    await ack();

    const lines = [];

    lines[0] = view['state']['values']['line1']['input']['value'];
    lines[1] = view['state']['values']['line2']['input']['value'];
    lines[2] = view['state']['values']['line3']['input']['value'];
    lines[3] = view['state']['values']['line4']['input']['value'];

    var category = view['state']['values']['category']['input']['value'];

    if (!category) {
        category = '';
    }

    for (var index in lines) {
        if (!lines[index]) {
            lines[index] = '';
        }
        lines[index] = lines[index].toUpperCase();
    }

    const progressLines = Object.assign({}, lines);

    for (var index in progressLines) {
        progressLines[index] = lines[index].replace(/[^ ]/g, "_");
    }

    const channelId = view['state']['values']['channel']['input']['selected_conversation'];

    const imageUri = buildImageUri({
        progress_line1: progressLines[0],
        progress_line2: progressLines[1],
        progress_line3: progressLines[2],
        progress_line4: progressLines[3],
        category: category,
    });

    try {

        let result = await app.client.chat.postMessage({
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

        let puzzle = await Puzzle.query().insert({
            team_id: result.message.team,
            channel_id: result.channel,
            message_ts: result.ts,
            answer_line1: lines[0],
            answer_line2: lines[1],
            answer_line3: lines[2],
            answer_line4: lines[3],
            progress_line1: progressLines[0],
            progress_line2: progressLines[1],
            progress_line3: progressLines[2],
            progress_line4: progressLines[3],
            category: category,
            solved: false,
        });

        let threadResult = await app.client.chat.postMessage({
            token: context.botToken,
            channel: channelId,
            thread_ts: result.ts,
            blocks: [
                {
                    "type": "section",
                    "text": {
                        "type": "plain_text",
                        "text": "Reply to this thread with a letter or the answer to guess.",
                        "emoji": true
                    }
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