
exports.up = function (knex) {
    return knex.schema.createTable('puzzles', table => {
        table.increments('id').primary();
        table.string('team_id');
        table.string('channel_id');
        table.string('message_ts');
        table.string('category');
        table.string('answer_line1');
        table.string('answer_line2');
        table.string('answer_line3');
        table.string('answer_line4');
        table.string('progress_line1');
        table.string('progress_line2');
        table.string('progress_line3');
        table.string('progress_line4');
        table.boolean('solved');
        table.index(['team_id', 'channel_id', 'message_ts']);
    });
};

exports.down = function (knex) {
    return knex.schema.dropTableIfExists('puzzles');
};
